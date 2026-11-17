"""Business services for the creator platform.

The service owns platform tables only. When the application composition root
injects a Core artifact resolver, submissions and deliveries persist the
resolver's authoritative snapshot instead of trusting client metadata.
"""

from datetime import datetime, timedelta, timezone
import hashlib
import json
import re
import secrets
import sqlite3
import uuid
from typing import Any
from math import ceil
import base64
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from pydantic import ValidationError

from ...core.artifact_resolver import ArtifactLookup, ArtifactProduct, ArtifactResolutionError, ArtifactResolver
from .config import PlatformConfig
from .contracts import TaskStatus, can_transition
from .db import connect, migrate


class PlatformError(Exception):
    def __init__(self, code: str, message: str, status: int = 400):
        super().__init__(message); self.code = code; self.message = message; self.status = status


def now() -> str: return datetime.now(timezone.utc).isoformat()
def uid() -> str: return str(uuid.uuid4())


def hash_password(password: str, salt: bytes | None = None) -> tuple[str, str]:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 310_000)
    return digest.hex(), salt.hex()


def verify_password(password: str, digest_hex: str, salt_hex: str) -> bool:
    digest, _ = hash_password(password, bytes.fromhex(salt_hex))
    return secrets.compare_digest(digest, digest_hex)


class PlatformService:
    def __init__(self, config: PlatformConfig | None = None, *, artifact_resolver: ArtifactResolver | None = None):
        self.config = config or PlatformConfig.from_env()
        self.path = self.config.sqlite_path()
        self.artifact_resolver = artifact_resolver
        migrate(self.path)

    def set_artifact_resolver(self, resolver: ArtifactResolver | None) -> None:
        """Attach the composition-root resolver after product services start."""

        self.artifact_resolver = resolver

    def _resolve_artifact_payload(self, actor: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
        """Replace client artifact metadata with a verified product snapshot.

        The optional resolver keeps existing local-only platform tests and
        legacy data readable while the application composition root is being
        upgraded. Once injected, every artifact write must name a product and
        pass the product-owned resolver.
        """

        if self.artifact_resolver is None:
            required = ("artifact_id", "artifact_version", "sha256", "media_type", "project_id", "project_title_snapshot", "title")
            if any(not payload.get(field) for field in required):
                raise PlatformError("artifact_invalid", "legacy artifact snapshot is incomplete", 422)
            return dict(payload)
        try:
            product = ArtifactProduct(payload["product"])
            lookup = ArtifactLookup(
                product=product,
                project_id=payload["project_id"],
                artifact_id=payload["artifact_id"],
                artifact_version=payload["artifact_version"],
                sha256=payload["sha256"],
            )
        except (KeyError, TypeError, ValueError, ValidationError) as exc:
            raise PlatformError("artifact_invalid", "artifact resolver input is invalid", 422) from exc
        try:
            resolved = self.artifact_resolver.resolve(actor["id"], lookup)
        except ArtifactResolutionError as exc:
            status = 403 if exc.code in {"artifact_forbidden", "owner_mismatch"} else 422
            raise PlatformError(exc.code, str(exc), status) from exc
        if resolved.owner_id != actor["id"]:
            raise PlatformError("artifact_forbidden", "resolved artifact belongs to another user", 403)
        if resolved.product != lookup.product or resolved.project_id != lookup.project_id or resolved.artifact_id != lookup.artifact_id:
            raise PlatformError("artifact_resolution_mismatch", "resolver returned a different artifact identity", 422)
        return {
            **payload,
            "product": resolved.product.value,
            "artifact_id": resolved.artifact_id,
            "artifact_version": resolved.artifact_version,
            "sha256": resolved.sha256,
            "media_type": resolved.media_type,
            "project_id": resolved.project_id,
            "project_title_snapshot": resolved.title,
            "title": resolved.title,
            "resolved_media_ref": resolved.media_ref,
            "source_kind": resolved.source_kind,
            "contract_version": resolved.contract_version,
            "resolved_at": now(),
        }

    def _idem(self, c: sqlite3.Connection, actor: str, key: str, request_hash: str | None = None) -> dict[str, Any] | None:
        row = c.execute("SELECT response_json,request_hash FROM idempotency_records WHERE actor_id=? AND key=?", (actor, key)).fetchone()
        if not row:
            return None
        if request_hash is not None and row[1] not in {None, request_hash}:
            raise PlatformError("idempotency_key_reused", "Idempotency-Key was already used with different parameters", 409)
        return json.loads(row[0])

    def _save_idem(self, c: sqlite3.Connection, actor: str, key: str, response: dict[str, Any], request_hash: str | None = None) -> None:
        c.execute("INSERT INTO idempotency_records (actor_id,key,response_json,created_at,request_hash) VALUES (?,?,?,?,?)", (actor, key, json.dumps(response), now(), request_hash))

    @staticmethod
    def _request_hash(payload: dict[str, Any]) -> str:
        canonical = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    @staticmethod
    def _require_admin(actor: dict[str, Any]) -> None:
        if actor.get("role") != "admin":
            raise PlatformError("forbidden", "admin role required", 403)

    def _audit(self, c: sqlite3.Connection, actor: str | None, event: str, entity: str, entity_id: str | None, payload: dict[str, Any]) -> None:
        c.execute("INSERT INTO audit_events_ext VALUES (?,?,?,?,?,?,?,?)", (uid(), actor, uid(), event, entity, entity_id, json.dumps(payload), now()))

    def register(self, username: str, password: str, email: str | None = None, role: str = "user", invite_code: str | None = None, test_access_code_hash: str | None = None) -> dict[str, Any]:
        if len(password) < self.config.password_min_length: raise PlatformError("weak_password", "password is too short")
        if role not in {"user", "creator", "reviewer", "client", "admin", "agent"}: raise PlatformError("invalid_role", "unsupported role")
        digest, salt = hash_password(password); user_id = uid(); timestamp = now()
        registered_invite_code = None
        registration_source = "open"
        inviter_user_id = None
        try:
            with connect(self.path) as c:
                invite_row = None
                normalized = (invite_code or "").strip().upper()
                if not test_access_code_hash:
                    if not normalized and self.is_registration_invite_required():
                        raise PlatformError("invite_required", "a valid invitation code is required", 422)
                    if normalized:
                        invite_row = c.execute(
                            "SELECT id, created_by, batch_id FROM registration_invites WHERE code=? AND used_count < max_uses AND (expires_at IS NULL OR expires_at > ?)",
                            (normalized, timestamp),
                        ).fetchone()
                        claimed = c.execute(
                            "UPDATE registration_invites SET used_count=used_count+1,last_used_at=? WHERE code=? AND used_count < max_uses AND (expires_at IS NULL OR expires_at > ?)",
                            (timestamp, normalized, timestamp),
                        )
                        if claimed.rowcount != 1:
                            raise PlatformError("invalid_invite", "invitation code is invalid, expired, or already used", 422)
                        registered_invite_code = normalized
                        if invite_row and invite_row[1]:
                            inviter_user_id = invite_row[1]
                            agent_profile = c.execute("SELECT user_id FROM agent_profiles WHERE user_id=?", (inviter_user_id,)).fetchone()
                            is_agent_user = c.execute("SELECT 1 FROM platform_users WHERE id=? AND role='agent'", (inviter_user_id,)).fetchone()
                            if agent_profile or is_agent_user:
                                registration_source = "agent"
                            else:
                                registration_source = "admin"
                else:
                    registration_source = "test_access"

                if test_access_code_hash and c.execute(
                    "SELECT 1 FROM platform_test_access_bindings WHERE access_code_hash=?",
                    (test_access_code_hash,),
                ).fetchone():
                    raise PlatformError("test_access_already_registered", "this test access code is already bound to an account", 409)

                c.execute(
                    """
                    INSERT INTO platform_users (
                        id, username, email, phone, password_hash, password_salt,
                        nickname, role, is_active, created_at, updated_at,
                        registered_invite_code, registration_source, inviter_user_id
                    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                    """,
                    (
                        user_id, username, email, None, digest, salt,
                        username, role, 1, timestamp, timestamp,
                        registered_invite_code, registration_source, inviter_user_id,
                    ),
                )
                if test_access_code_hash:
                    c.execute(
                        "INSERT INTO platform_test_access_bindings(access_code_hash,user_id,created_at) VALUES (?,?,?)",
                        (test_access_code_hash, user_id, timestamp),
                    )
                if role == "creator": c.execute("INSERT INTO creator_certifications VALUES (?,?,?,?,?,?,?,?,?,?)", (uid(), user_id, "unapplied", "standard", "direct_exam", None, None, None, None, timestamp))
                if role == "agent":
                    c.execute(
                        "INSERT INTO agent_profiles(user_id, agency_type, institution_name, contact_name, contact_phone, discount_rate, commission_rate, status, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                        (user_id, "individual", username, username, None, 1.0, 0.01, "active", None, timestamp, timestamp),
                    )
                if invite_row and invite_row[1] and registration_source == "agent":
                    agent_id, invite_id, batch_id = invite_row[1], invite_row[0], invite_row[2]
                    c.execute(
                        "INSERT OR IGNORE INTO agent_students(id, agent_id, student_user_id, invite_id, invite_code, batch_id, notes, registered_at) VALUES (?,?,?,?,?,?,?,?)",
                        (uid(), agent_id, user_id, invite_id, normalized, batch_id, None, timestamp),
                    )
                self._audit(c, user_id, "user.registered", "user", user_id, {
                    "role": role,
                    "registration_source": registration_source,
                    "registered_invite_code": registered_invite_code,
                    "inviter_user_id": inviter_user_id,
                })
        except sqlite3.IntegrityError as exc: raise PlatformError("user_exists", "username or email already exists", 409) from exc
        return {"id": user_id, "username": username, "email": email, "role": role}

    def create_registration_invite(self, actor: dict[str, Any], code: str | None = None, max_uses: int = 1, expires_at: str | None = None, batch_id: str | None = None, student_note: str | None = None) -> dict[str, Any]:
        if actor.get("role") not in {"admin", "agent"}:
            raise PlatformError("forbidden", "admin or agent role required", 403)
        normalized = (code or secrets.token_urlsafe(8)).strip().upper()
        if not 6 <= len(normalized) <= 64 or not normalized.replace("-", "").isalnum():
            raise PlatformError("invalid_invite", "invitation code must be 6-64 alphanumeric characters", 422)
        if max_uses < 1 or max_uses > 100000:
            raise PlatformError("invalid_invite", "max_uses must be between 1 and 100000", 422)
        invite_id = uid(); timestamp = now()
        try:
            with connect(self.path) as c:
                c.execute(
                    "INSERT INTO registration_invites(id,code,max_uses,used_count,expires_at,created_by,created_at,last_used_at,batch_id,student_note) VALUES (?,?,?,?,?,?,?,?,?,?)",
                    (invite_id, normalized, max_uses, 0, expires_at, actor["id"], timestamp, None, batch_id, student_note),
                )
                self._audit(c, actor["id"], "registration.invite_created", "registration_invite", invite_id, {"code": normalized, "max_uses": max_uses, "expires_at": expires_at})
        except sqlite3.IntegrityError as exc:
            raise PlatformError("invite_exists", "invitation code already exists", 409) from exc
        return {"id": invite_id, "code": normalized, "max_uses": max_uses, "used_count": 0, "expires_at": expires_at, "created_at": timestamp, "batch_id": batch_id, "student_note": student_note}

    def list_registration_invites(self, actor: dict[str, Any]) -> list[dict[str, Any]]:
        if actor.get("role") not in {"admin", "agent"}:
            raise PlatformError("forbidden", "admin or agent role required", 403)
        with connect(self.path) as c:
            if actor.get("role") == "admin":
                rows = c.execute("SELECT id,code,max_uses,used_count,expires_at,created_at,last_used_at,batch_id,student_note FROM registration_invites ORDER BY created_at DESC").fetchall()
            else:
                rows = c.execute("SELECT id,code,max_uses,used_count,expires_at,created_at,last_used_at,batch_id,student_note FROM registration_invites WHERE created_by=? ORDER BY created_at DESC", (actor["id"],)).fetchall()
        keys = ("id", "code", "max_uses", "used_count", "expires_at", "created_at", "last_used_at", "batch_id", "student_note")
        return [dict(zip(keys, row)) for row in rows]

    def is_registration_invite_required(self) -> bool:
        with connect(self.path) as c:
            try:
                row = c.execute("SELECT value FROM platform_system_settings WHERE key='registration_invite_required'").fetchone()
                if row:
                    return row[0].lower() in ("true", "1", "yes")
            except sqlite3.OperationalError:
                pass
        return bool(self.config.registration_invite_required)

    def set_registration_invite_required(self, actor: dict[str, Any], required: bool) -> bool:
        self._require_admin(actor)
        timestamp = now()
        val_str = "true" if required else "false"
        with connect(self.path) as c:
            c.execute(
                """
                INSERT INTO platform_system_settings (key, value, description, updated_at)
                VALUES ('registration_invite_required', ?, 'Whether invite code is mandatory for registration', ?)
                ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
                """,
                (val_str, timestamp),
            )
            self._audit(c, actor.get("id"), "settings.registration_invite_required_updated", "system_settings", "registration_invite_required", {"required": required})
        return bool(required)

    def login(self, username: str, password: str) -> dict[str, Any]:
        with connect(self.path) as c:
            row = c.execute("SELECT id,password_hash,password_salt,role,is_active FROM platform_users WHERE username=?", (username,)).fetchone()
            if not row or not row[4] or not verify_password(password, row[1], row[2]): raise PlatformError("invalid_credentials", "invalid credentials", 401)
            raw = secrets.token_urlsafe(32); token_hash = hashlib.sha256(raw.encode()).hexdigest(); sid = uid()
            expires = (datetime.now(timezone.utc) + timedelta(seconds=self.config.session_ttl_seconds)).isoformat()
            c.execute("INSERT INTO platform_sessions VALUES (?,?,?,?,?,?)", (sid, row[0], token_hash, expires, None, now()))
            return {"access_token": raw, "token_type": "bearer", "expires_at": expires, "user": {"id": row[0], "username": username, "role": row[3]}}

    def authenticate(self, token: str) -> dict[str, Any]:
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        with connect(self.path) as c:
            row = c.execute("SELECT u.id,u.username,u.role,s.id,s.expires_at FROM platform_sessions s JOIN platform_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.revoked_at IS NULL", (token_hash,)).fetchone()
            if not row or datetime.fromisoformat(row[4]) <= datetime.now(timezone.utc): raise PlatformError("session_invalid", "session is invalid or expired", 401)
            return {"id": row[0], "username": row[1], "role": row[2], "session_id": row[3]}

    def logout(self, token: str) -> None:
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        with connect(self.path) as c: c.execute("UPDATE platform_sessions SET revoked_at=? WHERE token_hash=? AND revoked_at IS NULL", (now(), token_hash))

    def admin_overview(self, actor: dict[str, Any]) -> dict[str, Any]:
        """Return bounded operational counters for the admin console."""
        self._require_admin(actor)
        with connect(self.path) as c:
            users = c.execute("SELECT COUNT(*), SUM(is_active), SUM(role='creator'), SUM(role='admin') FROM platform_users").fetchone()
            tasks = c.execute("SELECT COUNT(*), SUM(status IN ('published','claimed','in_progress','delivered','revision_requested','resubmitted')) FROM commercial_tasks").fetchone()
            competitions = c.execute("SELECT COUNT(*), SUM(status IN ('enrolling','ongoing','judging')) FROM competitions").fetchone()
            submissions = c.execute("SELECT COUNT(*), SUM(status='submitted') FROM platform_submissions").fetchone()
            ledger = c.execute("SELECT COALESCE(SUM(CASE WHEN direction='credit' THEN amount_cents ELSE -amount_cents END),0) FROM ledger_entries").fetchone()[0]
        return {
            "users": {"total": users[0] or 0, "active": users[1] or 0, "creators": users[2] or 0, "admins": users[3] or 0},
            "tasks": {"total": tasks[0] or 0, "open": tasks[1] or 0},
            "competitions": {"total": competitions[0] or 0, "active": competitions[1] or 0},
            "submissions": {"total": submissions[0] or 0, "pending": submissions[1] or 0},
            "ledger_balance_cents": ledger,
        }

    def admin_users(self, actor: dict[str, Any], *, query: str = "", role: str | None = None, active: bool | None = None, limit: int = 50, offset: int = 0) -> dict[str, Any]:
        self._require_admin(actor)
        limit = max(1, min(limit, 100)); offset = max(0, offset)
        clauses: list[str] = []; params: list[Any] = []
        if query.strip():
            like = f"%{query.strip()}%"
            clauses.append("(u.username LIKE ? OR COALESCE(u.email,'') LIKE ? OR COALESCE(u.nickname,'') LIKE ? OR COALESCE(u.registered_invite_code,'') LIKE ?)")
            params.extend([like, like, like, like])
        if role:
            clauses.append("u.role=?"); params.append(role)
        if active is not None:
            clauses.append("u.is_active=?"); params.append(1 if active else 0)
        where = f" WHERE {' AND '.join(clauses)}" if clauses else ""
        with connect(self.path) as c:
            total = c.execute(f"SELECT COUNT(*) FROM platform_users u{where}", params).fetchone()[0]
            sql = f"""
                SELECT u.id, u.username, u.email, u.nickname, u.role, u.is_active, u.created_at, u.updated_at,
                       u.registered_invite_code, u.registration_source, u.inviter_user_id,
                       p.institution_name as inviter_name,
                       inv.username as inviter_username
                FROM platform_users u
                LEFT JOIN platform_users inv ON inv.id = u.inviter_user_id
                LEFT JOIN agent_profiles p ON p.user_id = u.inviter_user_id
                {where}
                ORDER BY u.created_at DESC
                LIMIT ? OFFSET ?
            """
            rows = c.execute(sql, [*params, limit, offset]).fetchall()
        keys = (
            "id", "username", "email", "nickname", "role", "is_active", "created_at", "updated_at",
            "registered_invite_code", "registration_source", "inviter_user_id", "inviter_name", "inviter_username",
        )
        return {"items": [dict(zip(keys, row)) for row in rows], "total": total, "limit": limit, "offset": offset}


    def admin_update_user(self, actor: dict[str, Any], user_id: str, *, role: str | None = None, is_active: bool | None = None) -> dict[str, Any]:
        self._require_admin(actor)
        if role is not None and role not in {"user", "creator", "reviewer", "client", "admin", "agent"}:
            raise PlatformError("invalid_role", "unsupported role", 422)
        if user_id == actor.get("id") and is_active is False:
            raise PlatformError("self_deactivate", "an admin cannot deactivate their own account", 422)
        with connect(self.path) as c:
            row = c.execute("SELECT id,username,email,nickname,role,is_active,created_at,updated_at FROM platform_users WHERE id=?", (user_id,)).fetchone()
            if not row: raise PlatformError("user_not_found", "user not found", 404)
            before = {"role": row[4], "is_active": bool(row[5])}
            next_role = role or row[4]; next_active = int(is_active if is_active is not None else bool(row[5]))
            if row[4] == "admin" and next_role != "admin":
                remaining = c.execute("SELECT COUNT(*) FROM platform_users WHERE role='admin' AND is_active=1 AND id<>?", (user_id,)).fetchone()[0]
                if remaining < 1: raise PlatformError("last_admin", "cannot demote the last active admin", 422)
            timestamp = now()
            c.execute("UPDATE platform_users SET role=?,is_active=?,updated_at=? WHERE id=?", (next_role, next_active, timestamp, user_id))
            if next_role == "agent":
                c.execute(
                    "INSERT OR IGNORE INTO agent_profiles(user_id, agency_type, institution_name, contact_name, contact_phone, discount_rate, commission_rate, status, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                    (user_id, "individual", row[1], row[1], None, 1.0, 0.01, "active", None, timestamp, timestamp),
                )
            self._audit(c, actor["id"], "admin.user_updated", "user", user_id, {"before": before, "after": {"role": next_role, "is_active": bool(next_active)}})
            updated = c.execute("SELECT id,username,email,nickname,role,is_active,created_at,updated_at FROM platform_users WHERE id=?", (user_id,)).fetchone()
        keys = ("id", "username", "email", "nickname", "role", "is_active", "created_at", "updated_at")
        return dict(zip(keys, updated))

    def admin_audit_events(self, actor: dict[str, Any], *, limit: int = 100, offset: int = 0) -> dict[str, Any]:
        self._require_admin(actor)
        limit = max(1, min(limit, 200)); offset = max(0, offset)
        with connect(self.path) as c:
            total = c.execute("SELECT COUNT(*) FROM audit_events_ext").fetchone()[0]
            rows = c.execute("SELECT id,actor_id,event_type,entity_type,entity_id,payload_json,created_at FROM audit_events_ext ORDER BY created_at DESC LIMIT ? OFFSET ?", (limit, offset)).fetchall()
        keys = ("id", "actor_id", "event_type", "entity_type", "entity_id", "payload_json", "created_at")
        return {"items": [dict(zip(keys, row)) for row in rows], "total": total, "limit": limit, "offset": offset}

    def bind_project(self, actor: dict[str, Any], *, user_id: str, product: str, project_id: str, storage_id: str | None = None) -> dict[str, Any]:
        """Create an auditable project binding; only an admin may grant it."""
        self._require_admin(actor)
        if product not in {"studio", "atelier"}:
            raise PlatformError("invalid_project_product", "project binding product is invalid", 422)
        if not user_id.strip() or not project_id.strip():
            raise PlatformError("invalid_project_binding", "user_id and project_id are required", 422)
        timestamp = now()
        with connect(self.path) as c:
            if not c.execute("SELECT 1 FROM platform_users WHERE id=? AND is_active=1", (user_id,)).fetchone():
                raise PlatformError("user_not_found", "project binding user was not found", 404)
            existing = c.execute(
                "SELECT id,storage_id FROM platform_project_bindings WHERE user_id=? AND product=? AND project_id=? AND status='active'",
                (user_id, product, project_id),
            ).fetchone()
            if existing:
                if existing[1] != storage_id:
                    raise PlatformError("project_binding_conflict", "project is already bound to this user with another storage", 409)
                return {"id": existing[0], "user_id": user_id, "product": product, "project_id": project_id, "storage_id": storage_id, "status": "active", "idempotent_replay": True}
            binding_id = uid()
            c.execute(
                "INSERT INTO platform_project_bindings(id,user_id,product,project_id,storage_id,status,created_by,created_at,revoked_at) VALUES (?,?,?,?,?,?,?,?,NULL)",
                (binding_id, user_id, product, project_id, storage_id, "active", actor["id"], timestamp),
            )
            self._audit(c, actor["id"], "project.binding_created", "project_binding", binding_id, {"user_id": user_id, "product": product, "project_id": project_id, "storage_id": storage_id})
        return {"id": binding_id, "user_id": user_id, "product": product, "project_id": project_id, "storage_id": storage_id, "status": "active", "idempotent_replay": False}

    def revoke_project_binding(self, actor: dict[str, Any], binding_id: str) -> dict[str, Any]:
        self._require_admin(actor)
        timestamp = now()
        with connect(self.path) as c:
            row = c.execute("SELECT user_id,product,project_id,status FROM platform_project_bindings WHERE id=?", (binding_id,)).fetchone()
            if not row:
                raise PlatformError("project_binding_not_found", "project binding was not found", 404)
            if row[3] == "revoked":
                return {"id": binding_id, "status": "revoked", "idempotent_replay": True}
            c.execute("UPDATE platform_project_bindings SET status='revoked',revoked_at=? WHERE id=? AND status='active'", (timestamp, binding_id))
            self._audit(c, actor["id"], "project.binding_revoked", "project_binding", binding_id, {"user_id": row[0], "product": row[1], "project_id": row[2]})
        return {"id": binding_id, "status": "revoked", "idempotent_replay": False}

    def list_project_bindings(self, actor: dict[str, Any], *, user_id: str | None = None, product: str | None = None, include_revoked: bool = False) -> list[dict[str, Any]]:
        self._require_admin(actor)
        clauses = ["1=1"]
        params: list[Any] = []
        if user_id:
            clauses.append("user_id=?"); params.append(user_id)
        if product:
            if product not in {"studio", "atelier"}:
                raise PlatformError("invalid_project_product", "project binding product is invalid", 422)
            clauses.append("product=?"); params.append(product)
        if not include_revoked:
            clauses.append("status='active'")
        with connect(self.path) as c:
            rows = c.execute(
                f"SELECT id,user_id,product,project_id,storage_id,status,created_by,created_at,revoked_at FROM platform_project_bindings WHERE {' AND '.join(clauses)} ORDER BY created_at DESC",
                params,
            ).fetchall()
        keys = ("id", "user_id", "product", "project_id", "storage_id", "status", "created_by", "created_at", "revoked_at")
        return [dict(zip(keys, row)) for row in rows]

    def is_project_bound(self, *, user_id: str, product: str, project_id: str, storage_id: str | None = None) -> bool:
        if product not in {"studio", "atelier"}:
            return False
        with connect(self.path) as c:
            row = c.execute(
                "SELECT 1 FROM platform_project_bindings WHERE user_id=? AND product=? AND project_id=? AND status='active' AND (storage_id IS NULL OR storage_id=?) LIMIT 1",
                (user_id, product, project_id, storage_id),
            ).fetchone()
        return row is not None

    def xiangongyun_verify(self, actor: dict[str, Any], access_token: str, *, idempotency_key: str) -> dict[str, Any]:
        if not access_token or len(access_token.strip()) < 16:
            raise PlatformError("invalid_xiangongyun_token", "仙宫云 Access Token 无效", 422)
        if not idempotency_key or len(idempotency_key) > 200:
            raise PlatformError("idempotency_key_required", "Idempotency-Key is required", 422)
        token = access_token.strip()
        request_hash = self._request_hash({"operation": "xiangongyun.verify", "access_token": token})
        with connect(self.path) as c:
            replay = self._idem(c, actor["id"], idempotency_key, request_hash)
        if replay is not None:
            return replay

        def get(path: str) -> dict[str, Any]:
            request = Request(
                f"https://api.xiangongyun.com{path}",
                headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
                method="GET",
            )
            try:
                with urlopen(request, timeout=10) as response:
                    payload = json.loads(response.read().decode("utf-8"))
            except HTTPError as exc:
                if exc.code in {401, 403}:
                    raise PlatformError("xiangongyun_unauthorized", "仙宫云 Token 无效或已过期", 401) from exc
                raise PlatformError("xiangongyun_unavailable", f"仙宫云接口返回 HTTP {exc.code}", 502) from exc
            except (URLError, TimeoutError, OSError, ValueError) as exc:
                raise PlatformError("xiangongyun_unavailable", "无法连接仙宫云接口", 502) from exc
            if not isinstance(payload, dict) or ("success" in payload and payload["success"] is not True):
                raise PlatformError("xiangongyun_api_error", "仙宫云接口返回格式无效", 502)
            data = payload.get("data")
            if not isinstance(data, dict):
                raise PlatformError("xiangongyun_api_error", "仙宫云接口返回格式无效", 502)
            return data

        account = get("/open/whoami")
        balance_data = get("/open/balance")
        instance_data = get("/open/instances")
        account_view: dict[str, str] = {}
        for key in ("nickname", "phone", "uuid"):
            value = account.get(key)
            if value is not None:
                if not isinstance(value, str):
                    raise PlatformError("xiangongyun_api_error", "仙宫云账户响应格式无效", 502)
                account_view[key] = value
        balance_value = balance_data.get("balance")
        if isinstance(balance_value, bool) or not isinstance(balance_value, (int, float)):
            raise PlatformError("xiangongyun_api_error", "仙宫云余额响应格式无效", 502)
        raw_items = instance_data.get("list")
        if not isinstance(raw_items, list) or any(not isinstance(item, dict) for item in raw_items):
            raise PlatformError("xiangongyun_api_error", "仙宫云实例响应格式无效", 502)
        safe_instances = [
            {key: item[key] for key in ("id", "name", "gpu_model", "gpu_used", "status", "price_per_hour", "data_center_name") if key in item}
            for item in raw_items
        ]
        result = {
            "provider": "xiangongyun",
            "verified": True,
            "account": account_view,
            "balance": balance_value,
            "instances": safe_instances,
            "checked_at": now(),
        }
        with connect(self.path) as c:
            replay = self._idem(c, actor["id"], idempotency_key, request_hash)
            if replay is not None:
                return replay
            result["credential_id"] = self._save_xiangongyun_binding(c, actor, token, result)
            self._save_idem(c, actor["id"], idempotency_key, result, request_hash)
        return result

    def _save_xiangongyun_binding(self, c: sqlite3.Connection, actor: dict[str, Any], token: str, result: dict[str, Any]) -> str:
        cipher = self._credentials_cipher()
        timestamp = now()
        account_nonce = secrets.token_bytes(12)
        account_ciphertext = cipher.encrypt(
            account_nonce,
            json.dumps(result["account"], ensure_ascii=False, separators=(",", ":")).encode(),
            f"{actor['id']}:xiangongyun:account".encode(),
        )
        token_nonce = secrets.token_bytes(12)
        token_ciphertext = cipher.encrypt(token_nonce, token.encode(), f"{actor['id']}:xiangongyun".encode())
        fingerprint = hashlib.sha256(token.encode()).hexdigest()
        encoded_account = base64.urlsafe_b64encode(account_ciphertext).decode()
        encoded_account_nonce = base64.urlsafe_b64encode(account_nonce).decode()
        encoded_token = base64.urlsafe_b64encode(token_ciphertext).decode()
        encoded_token_nonce = base64.urlsafe_b64encode(token_nonce).decode()
        binding = c.execute("SELECT credential_id FROM platform_xiangongyun_bindings WHERE user_id=?", (actor["id"],)).fetchone()
        credential_id = binding[0] if binding else None
        if credential_id:
            credential = c.execute("SELECT id,status,provider FROM platform_credentials WHERE id=? AND user_id=?", (credential_id, actor["id"])).fetchone()
            if not credential or credential[1] != "active" or credential[2] != "xiangongyun":
                c.execute("DELETE FROM platform_xiangongyun_bindings WHERE user_id=?", (actor["id"],))
                credential_id = None
        if credential_id is None:
            existing = c.execute(
                "SELECT id FROM platform_credentials WHERE user_id=? AND provider=? AND status='active' ORDER BY updated_at DESC LIMIT 1",
                (actor["id"], "xiangongyun"),
            ).fetchone()
            credential_id = existing[0] if existing else uid()
        if not c.execute("SELECT 1 FROM platform_credentials WHERE id=?", (credential_id,)).fetchone():
            c.execute(
                "INSERT INTO platform_credentials VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                (credential_id, actor["id"], "xiangongyun", "仙宫云 H3", encoded_token, encoded_token_nonce, fingerprint, "active", timestamp, timestamp, timestamp, None),
            )
            event = "xiangongyun.binding_created"
        else:
            c.execute(
                "UPDATE platform_credentials SET ciphertext_b64=?,nonce_b64=?,key_fingerprint=?,label=?,updated_at=?,last_verified_at=?,revoked_at=NULL,status='active' WHERE id=? AND user_id=? AND provider=?",
                (encoded_token, encoded_token_nonce, fingerprint, "仙宫云 H3", timestamp, timestamp, credential_id, actor["id"], "xiangongyun"),
            )
            event = "xiangongyun.binding_verified"
        instances_json = json.dumps(result["instances"], ensure_ascii=False, separators=(",", ":"))
        updated = c.execute(
            "UPDATE platform_xiangongyun_bindings SET account_ciphertext_b64=?,account_nonce_b64=?,balance=?,instances_json=?,checked_at=?,updated_at=?,credential_id=? WHERE user_id=?",
            (encoded_account, encoded_account_nonce, result["balance"], instances_json, result["checked_at"], timestamp, credential_id, actor["id"]),
        )
        if updated.rowcount != 1:
            c.execute(
                "INSERT INTO platform_xiangongyun_bindings (user_id,credential_id,account_ciphertext_b64,account_nonce_b64,balance,instances_json,checked_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
                (actor["id"], credential_id, encoded_account, encoded_account_nonce, result["balance"], instances_json, result["checked_at"], timestamp, timestamp),
            )
            event = "xiangongyun.binding_created"
        self._audit(c, actor["id"], event, "credential", credential_id, {"provider": "xiangongyun", "fingerprint": fingerprint[:12]})
        return credential_id

    def xiangongyun_status(self, actor: dict[str, Any]) -> dict[str, Any] | None:
        with connect(self.path) as c:
            row = c.execute(
                "SELECT b.credential_id,b.account_ciphertext_b64,b.account_nonce_b64,b.balance,b.instances_json,b.checked_at FROM platform_xiangongyun_bindings b JOIN platform_credentials c ON c.id=b.credential_id WHERE b.user_id=? AND c.status='active' AND c.provider='xiangongyun'",
                (actor["id"],),
            ).fetchone()
        if not row:
            return None
        cipher = self._credentials_cipher()
        try:
            account = json.loads(cipher.decrypt(base64.urlsafe_b64decode(row[2]), base64.urlsafe_b64decode(row[1]), f"{actor['id']}:xiangongyun:account".encode()).decode())
        except Exception as exc:
            raise PlatformError("credential_corrupt", "仙宫云绑定无法解密", 500) from exc
        try:
            instances = json.loads(row[4])
        except (TypeError, ValueError):
            instances = []
        return {
            "provider": "xiangongyun",
            "verified": True,
            "credential_id": row[0],
            "account": account if isinstance(account, dict) else {},
            "balance": row[3],
            "instances": instances if isinstance(instances, list) else [],
            "checked_at": row[5],
        }

    def clear_xiangongyun_binding(self, actor: dict[str, Any], *, idempotency_key: str) -> dict[str, str]:
        if not idempotency_key or len(idempotency_key) > 200:
            raise PlatformError("idempotency_key_required", "Idempotency-Key is required", 422)
        request_hash = self._request_hash({"operation": "xiangongyun.clear"})
        with connect(self.path) as c:
            replay = self._idem(c, actor["id"], idempotency_key, request_hash)
            if replay is not None:
                return replay
            timestamp = now()
            rows = c.execute("SELECT id FROM platform_credentials WHERE user_id=? AND provider=? AND status='active'", (actor["id"], "xiangongyun")).fetchall()
            c.execute("DELETE FROM platform_xiangongyun_bindings WHERE user_id=?", (actor["id"],))
            c.execute("UPDATE platform_credentials SET status='revoked',revoked_at=?,updated_at=? WHERE user_id=? AND provider=? AND status='active'", (timestamp, timestamp, actor["id"], "xiangongyun"))
            for row in rows:
                self._audit(c, actor["id"], "xiangongyun.binding_cleared", "credential", row[0], {"provider": "xiangongyun"})
            response = {"status": "cleared"}
            self._save_idem(c, actor["id"], idempotency_key, response, request_hash)
        return response

    def _credentials_cipher(self) -> AESGCM:
        raw = self.config.credentials_key
        if not raw:
            raise PlatformError("credentials_key_required", "platform credential encryption is not configured", 503)
        try:
            key = base64.urlsafe_b64decode(raw.encode() + b"=" * (-len(raw) % 4))
        except Exception as exc:
            raise PlatformError("credentials_key_invalid", "platform credential encryption key is invalid", 500) from exc
        if len(key) != 32: raise PlatformError("credentials_key_invalid", "platform credential encryption key must decode to 32 bytes", 500)
        return AESGCM(key)

    @staticmethod
    def _credential_view(row) -> dict[str, Any]:
        return {"id": row[0], "provider": row[1], "label": row[2], "masked_key": f"{row[4][:4]}…{row[4][-4:]}", "status": row[5], "created_at": row[6], "updated_at": row[7], "last_verified_at": row[8], "revoked_at": row[9]}

    def list_credentials(self, actor: dict[str, Any]) -> list[dict[str, Any]]:
        with connect(self.path) as c:
            rows = c.execute("SELECT id,provider,label,ciphertext_b64,key_fingerprint,status,created_at,updated_at,last_verified_at,revoked_at FROM platform_credentials WHERE user_id=? ORDER BY created_at DESC", (actor["id"],)).fetchall()
        return [self._credential_view(row) for row in rows]

    def create_credential(self, actor: dict[str, Any], provider: str, label: str, api_key: str) -> dict[str, Any]:
        if not api_key or len(api_key) < 16: raise PlatformError("invalid_credential", "API-Key is too short")
        if not provider or len(provider) > 50: raise PlatformError("invalid_provider", "provider is invalid")
        if not label or len(label) > 80: raise PlatformError("invalid_label", "credential label is invalid")
        cipher = self._credentials_cipher(); nonce = secrets.token_bytes(12); credential_id = uid(); timestamp = now()
        ciphertext = cipher.encrypt(nonce, api_key.encode(), f"{actor['id']}:{provider}".encode())
        fingerprint = hashlib.sha256(api_key.encode()).hexdigest()
        with connect(self.path) as c:
            c.execute("INSERT INTO platform_credentials VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", (credential_id, actor["id"], provider, label, base64.urlsafe_b64encode(ciphertext).decode(), base64.urlsafe_b64encode(nonce).decode(), fingerprint, "active", timestamp, timestamp, None, None))
            self._audit(c, actor["id"], "credential.created", "credential", credential_id, {"provider": provider, "fingerprint": fingerprint[:12]})
            row = c.execute("SELECT id,provider,label,ciphertext_b64,key_fingerprint,status,created_at,updated_at,last_verified_at,revoked_at FROM platform_credentials WHERE id=?", (credential_id,)).fetchone()
        return self._credential_view(row)

    def verify_credential(self, actor: dict[str, Any], credential_id: str) -> dict[str, Any]:
        cipher = self._credentials_cipher()
        with connect(self.path) as c:
            row = c.execute("SELECT id,provider,label,ciphertext_b64,nonce_b64,key_fingerprint,status,created_at,updated_at,last_verified_at,revoked_at FROM platform_credentials WHERE id=? AND user_id=?", (credential_id, actor["id"])).fetchone()
            if not row: raise PlatformError("credential_not_found", "credential not found", 404)
            if row[6] != "active": raise PlatformError("credential_revoked", "credential is revoked", 409)
            try: cipher.decrypt(base64.urlsafe_b64decode(row[4]), base64.urlsafe_b64decode(row[3]), f"{actor['id']}:{row[1]}".encode())
            except Exception as exc: raise PlatformError("credential_corrupt", "credential cannot be decrypted", 500) from exc
            timestamp = now(); c.execute("UPDATE platform_credentials SET last_verified_at=?,updated_at=? WHERE id=?", (timestamp, timestamp, credential_id))
            view = c.execute("SELECT id,provider,label,ciphertext_b64,key_fingerprint,status,created_at,updated_at,last_verified_at,revoked_at FROM platform_credentials WHERE id=?", (credential_id,)).fetchone()
        return self._credential_view(view)

    def rotate_credential(self, actor: dict[str, Any], credential_id: str, api_key: str) -> dict[str, Any]:
        if not api_key or len(api_key) < 16: raise PlatformError("invalid_credential", "API-Key is too short")
        cipher = self._credentials_cipher(); nonce = secrets.token_bytes(12)
        with connect(self.path) as c:
            row = c.execute("SELECT provider FROM platform_credentials WHERE id=? AND user_id=?", (credential_id, actor["id"])).fetchone()
            if not row: raise PlatformError("credential_not_found", "credential not found", 404)
            ciphertext = cipher.encrypt(nonce, api_key.encode(), f"{actor['id']}:{row[0]}".encode()); fingerprint = hashlib.sha256(api_key.encode()).hexdigest(); timestamp = now()
            c.execute("UPDATE platform_credentials SET ciphertext_b64=?,nonce_b64=?,key_fingerprint=?,status='active',updated_at=?,last_verified_at=NULL,revoked_at=NULL WHERE id=?", (base64.urlsafe_b64encode(ciphertext).decode(), base64.urlsafe_b64encode(nonce).decode(), fingerprint, timestamp, credential_id))
            view = c.execute("SELECT id,provider,label,ciphertext_b64,key_fingerprint,status,created_at,updated_at,last_verified_at,revoked_at FROM platform_credentials WHERE id=?", (credential_id,)).fetchone()
            self._audit(c, actor["id"], "credential.rotated", "credential", credential_id, {"provider": row[0], "fingerprint": fingerprint[:12]})
        return self._credential_view(view)

    def revoke_credential(self, actor: dict[str, Any], credential_id: str) -> dict[str, Any]:
        with connect(self.path) as c:
            row = c.execute("SELECT provider FROM platform_credentials WHERE id=? AND user_id=?", (credential_id, actor["id"])).fetchone()
            if not row: raise PlatformError("credential_not_found", "credential not found", 404)
            timestamp = now()
            c.execute("UPDATE platform_credentials SET status='revoked',revoked_at=?,updated_at=? WHERE id=?", (timestamp, timestamp, credential_id))
            if row[0] == "xiangongyun":
                c.execute("DELETE FROM platform_xiangongyun_bindings WHERE user_id=? AND credential_id=?", (actor["id"], credential_id))
            self._audit(c, actor["id"], "credential.revoked", "credential", credential_id, {"provider": row[0]})
        return {"id": credential_id, "status": "revoked"}

    def resolve_credential(self, actor: dict[str, Any], credential_id: str) -> dict[str, Any]:
        cipher = self._credentials_cipher()
        with connect(self.path) as c:
            row = c.execute("SELECT provider,ciphertext_b64,nonce_b64,status FROM platform_credentials WHERE id=? AND user_id=?", (credential_id, actor["id"])).fetchone()
        if not row: raise PlatformError("credential_not_found", "credential not found", 404)
        if row[3] != "active": raise PlatformError("credential_revoked", "credential is revoked", 409)
        try: secret = cipher.decrypt(base64.urlsafe_b64decode(row[2]), base64.urlsafe_b64decode(row[1]), f"{actor['id']}:{row[0]}".encode()).decode()
        except Exception as exc: raise PlatformError("credential_corrupt", "credential cannot be decrypted", 500) from exc
        return {"credential_ref": credential_id, "provider": row[0], "secret": secret, "billing_mode": "byok"}

    def record_token_usage(self, actor: dict[str, Any], event: dict[str, Any]) -> None:
        prompt = max(0, int(event.get("prompt_tokens") or 0))
        completion = max(0, int(event.get("completion_tokens") or 0))
        total = max(0, int(event.get("total_tokens") or prompt + completion))
        product = event.get("product") if event.get("product") in {"studio", "atelier", "core"} else "core"
        with connect(self.path) as c:
            c.execute(
                "INSERT INTO platform_token_usage VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (uid(), actor["id"], product, str(event.get("operation") or "llm.chat"),
                 str(event.get("provider") or "unknown"), event.get("requested_model"),
                 event.get("provider_model"), prompt, completion, total, event.get("request_id"),
                 json.dumps(event.get("metadata") or {}, ensure_ascii=False), now()),
            )

    def token_usage(self, actor: dict[str, Any], limit: int = 100) -> dict[str, Any]:
        limit = max(1, min(limit, 500))
        with connect(self.path) as c:
            totals = c.execute(
                "SELECT COALESCE(SUM(prompt_tokens),0), COALESCE(SUM(completion_tokens),0), COALESCE(SUM(total_tokens),0) FROM platform_token_usage WHERE user_id=?",
                (actor["id"],),
            ).fetchone()
            rows = c.execute(
                "SELECT id,product,operation,provider,requested_model,provider_model,prompt_tokens,completion_tokens,total_tokens,request_id,created_at FROM platform_token_usage WHERE user_id=? ORDER BY created_at DESC LIMIT ?",
                (actor["id"], limit),
            ).fetchall()
        keys = ("id", "product", "operation", "provider", "requested_model", "provider_model", "prompt_tokens", "completion_tokens", "total_tokens", "request_id", "created_at")
        return {"prompt_tokens": totals[0], "completion_tokens": totals[1], "total_tokens": totals[2], "records": [dict(zip(keys, row)) for row in rows]}

    def credit_pricing(self) -> list[dict[str, Any]]:
        with connect(self.path) as c:
            rows = c.execute("SELECT provider,model,pricing_version,input_credits_per_1k,output_credits_per_1k FROM credit_pricing WHERE active=1 ORDER BY provider,model").fetchall()
        return [dict(zip(("provider", "model", "pricing_version", "input_credits_per_1k", "output_credits_per_1k"), row)) for row in rows]

    def media_pricing(self) -> list[dict[str, Any]]:
        with connect(self.path) as c:
            rows = c.execute(
                "SELECT provider,model,media_kind,pricing_version,credits_per_unit FROM media_pricing WHERE active=1 ORDER BY provider,media_kind,model"
            ).fetchall()
        keys = ("provider", "model", "media_kind", "pricing_version", "credits_per_unit")
        return [dict(zip(keys, row)) for row in rows]

    @staticmethod
    def _skill_manifest(manifest: dict[str, Any]) -> tuple[str, str, str, str]:
        if not isinstance(manifest, dict):
            raise PlatformError("invalid_skill_manifest", "Skill manifest must be an object")
        forbidden = {"path", "source", "script", "command", "credential_ref", "provider_handle", "network", "url", "secret", "env"}
        if forbidden.intersection(manifest):
            raise PlatformError("invalid_skill_manifest", "Skill manifest cannot contain executable or secret fields")
        required = {"name", "version", "title", "description", "category", "prompt_template", "expected_tools", "content_hash"}
        unknown = set(manifest) - required
        if unknown:
            raise PlatformError("invalid_skill_manifest", "Skill manifest contains unsupported fields")
        missing = required - set(manifest)
        if missing:
            raise PlatformError("invalid_skill_manifest", "Skill manifest is missing required fields")
        name, version, content_hash = manifest["name"], manifest["version"], manifest["content_hash"]
        if not isinstance(name, str) or not re.fullmatch(r"[a-z][a-z0-9-]{2,63}", name):
            raise PlatformError("invalid_skill_manifest", "Skill name is invalid")
        if not isinstance(version, str) or not re.fullmatch(r"\d+\.\d+\.\d+", version):
            raise PlatformError("invalid_skill_manifest", "Skill version is invalid")
        if not isinstance(manifest["title"], str) or not 1 <= len(manifest["title"]) <= 80:
            raise PlatformError("invalid_skill_manifest", "Skill title is invalid")
        if not isinstance(manifest["description"], str) or not 1 <= len(manifest["description"]) <= 280:
            raise PlatformError("invalid_skill_manifest", "Skill description is invalid")
        if manifest["category"] not in {"story", "shot", "review", "sequence"}:
            raise PlatformError("invalid_skill_manifest", "Skill category is invalid")
        if not isinstance(manifest["prompt_template"], str) or not 1 <= len(manifest["prompt_template"]) <= 4000:
            raise PlatformError("invalid_skill_manifest", "Skill prompt template is invalid")
        tools = manifest["expected_tools"]
        if not isinstance(tools, list) or len(tools) > 16 or any(not isinstance(tool, str) for tool in tools):
            raise PlatformError("invalid_skill_manifest", "Skill tools are invalid")
        unsupported = set(tools) - {"canvas.readProject", "canvas.createVideoNode", "canvas.updateNodePrompt", "generation.createVideoCandidates"}
        if unsupported:
            raise PlatformError("invalid_skill_manifest", "Skill requests an unsupported tool")
        if not isinstance(content_hash, str) or not re.fullmatch(r"[0-9a-f]{64}", content_hash):
            raise PlatformError("invalid_skill_manifest", "Skill content hash is invalid")
        canonical = json.dumps({k: manifest[k] for k in sorted(manifest) if k != "content_hash"}, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        expected = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
        if content_hash != expected:
            raise PlatformError("invalid_skill_manifest", "Skill content hash does not match manifest")
        return name, version, content_hash, canonical

    def create_skill_version(self, actor: dict[str, Any], manifest: dict[str, Any], *, scope: str = "user", project_id: str | None = None, parent_version: str | None = None) -> dict[str, Any]:
        if scope not in {"system", "workspace", "user", "project"}:
            raise PlatformError("invalid_skill_scope", "unsupported Skill scope")
        if scope in {"system", "workspace"} and actor.get("role") != "admin":
            raise PlatformError("skill_admin_required", f"{scope} Skill versions require admin", 403)
        if scope == "project" and not project_id:
            raise PlatformError("skill_project_required", "project Skill versions require project_id")
        if scope != "project" and project_id is not None:
            raise PlatformError("skill_project_forbidden", "project_id is only valid for project scope")
        name, version, content_hash, canonical = self._skill_manifest(manifest)
        owner_id = actor.get("id") if scope in {"user", "project"} else None
        skill_id = uid(); timestamp = now()
        try:
            with connect(self.path) as c:
                c.execute(
                    "INSERT INTO platform_skill_versions VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                    (skill_id, name, version, scope, owner_id, project_id, parent_version, canonical, content_hash, "draft", timestamp),
                )
                self._audit(c, actor.get("id"), "skill.version.created", "skill_version", skill_id, {"name": name, "version": version, "scope": scope, "project_id": project_id})
        except sqlite3.IntegrityError as exc:
            raise PlatformError("skill_version_exists", "Skill version already exists", 409) from exc
        return {"id": skill_id, "name": name, "version": version, "scope": scope, "owner_id": owner_id, "project_id": project_id, "parent_version": parent_version, "content_hash": content_hash, "status": "draft", "created_at": timestamp}

    def clone_skill_version_as_draft(self, actor: dict[str, Any], skill_version_id: str, *, version: str) -> dict[str, Any]:
        with connect(self.path) as c:
            row = c.execute(
                "SELECT name,scope,owner_id,project_id,version,manifest_json FROM platform_skill_versions WHERE id=?",
                (skill_version_id,),
            ).fetchone()
        if not row:
            raise PlatformError("skill_version_not_found", "Skill version not found", 404)
        if row[2] != actor.get("id") or row[1] not in {"user", "project"}:
            raise PlatformError("skill_forbidden", "Only owned user/project Skills may be cloned", 403)
        manifest = json.loads(row[5])
        manifest["version"] = version
        payload = {key: manifest[key] for key in manifest if key != "content_hash"}
        manifest["content_hash"] = hashlib.sha256(
            json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
        ).hexdigest()
        return self.create_skill_version(
            actor,
            manifest,
            scope=row[1],
            project_id=row[3],
            parent_version=row[4],
        )

    def compare_skill_versions(self, actor: dict[str, Any], skill_version_id: str, against_version_id: str) -> dict[str, Any]:
        with connect(self.path) as c:
            rows = c.execute(
                "SELECT id,name,version,scope,owner_id,project_id,parent_version,manifest_json,content_hash FROM platform_skill_versions WHERE id IN (?,?)",
                (skill_version_id, against_version_id),
            ).fetchall()
        versions = {row[0]: row for row in rows}
        if len(versions) != 2:
            raise PlatformError("skill_version_not_found", "Skill version not found", 404)
        current, against = versions[skill_version_id], versions[against_version_id]
        if current[4] != actor.get("id") or against[4] != actor.get("id"):
            raise PlatformError("skill_forbidden", "Skill version belongs to another user", 403)
        if current[1] != against[1] or current[5] != against[5]:
            raise PlatformError("skill_diff_scope_mismatch", "Skill versions are not comparable", 409)
        current_manifest = json.loads(current[7])
        against_manifest = json.loads(against[7])
        changed = {
            key: {"from": against_manifest.get(key), "to": current_manifest.get(key)}
            for key in sorted(set(current_manifest) | set(against_manifest))
            if current_manifest.get(key) != against_manifest.get(key)
        }
        return {
            "skill_name": current[1],
            "current": {"id": current[0], "version": current[2], "content_hash": current[8]},
            "against": {"id": against[0], "version": against[2], "content_hash": against[8]},
            "changed": changed,
        }

    def bind_skill_version(self, actor: dict[str, Any], skill_version_id: str, *, active: bool = True) -> dict[str, Any]:
        timestamp = now()
        with connect(self.path) as c:
            row = c.execute("SELECT id,name,scope,owner_id,project_id,status FROM platform_skill_versions WHERE id=?", (skill_version_id,)).fetchone()
            if not row: raise PlatformError("skill_version_not_found", "Skill version not found", 404)
            if row[2] in {"system", "workspace"} and actor.get("role") != "admin": raise PlatformError("skill_admin_required", f"{row[2]} Skill versions require admin", 403)
            if row[2] in {"user", "project"} and row[3] != actor.get("id"): raise PlatformError("skill_forbidden", "Skill version belongs to another user", 403)
            previous = c.execute("SELECT skill_version_id FROM platform_skill_bindings WHERE name=? AND scope=? AND owner_id IS ? AND project_id IS ? AND active=1", (row[1], row[2], row[3], row[4])).fetchone()
            if previous and previous[0] != skill_version_id:
                c.execute("INSERT INTO platform_skill_binding_history VALUES (?,?,?,?,?,?,?,?)", (uid(), row[1], row[2], row[3], row[4], previous[0], timestamp, actor.get("id")))
            c.execute("UPDATE platform_skill_versions SET status=? WHERE id=?", ("active" if active else "draft", skill_version_id))
            c.execute("DELETE FROM platform_skill_bindings WHERE name=? AND scope=? AND owner_id IS ? AND project_id IS ?", (row[1], row[2], row[3], row[4]))
            if active:
                c.execute("INSERT INTO platform_skill_bindings VALUES (?,?,?,?,?,?,?,?,?)", (uid(), row[1], row[2], row[3], row[4], skill_version_id, 1, timestamp, timestamp))
            self._audit(c, actor.get("id"), "skill.version.bound", "skill_version", skill_version_id, {"active": active, "scope": row[2], "project_id": row[4]})
        return {"id": skill_version_id, "name": row[1], "scope": row[2], "project_id": row[4], "active": active}

    def rollback_skill_binding(self, actor: dict[str, Any], skill_version_id: str) -> dict[str, Any]:
        with connect(self.path) as c:
            row = c.execute("SELECT name,scope,owner_id,project_id FROM platform_skill_versions WHERE id=?", (skill_version_id,)).fetchone()
            if not row:
                raise PlatformError("skill_version_not_found", "Skill version not found", 404)
            if row[2] != actor.get("id") or row[1] not in {"user", "project"}:
                raise PlatformError("skill_forbidden", "Skill version belongs to another user", 403)
            previous = c.execute("SELECT skill_version_id FROM platform_skill_binding_history WHERE name=? AND scope=? AND owner_id IS ? AND project_id IS ? ORDER BY replaced_at DESC LIMIT 1", row).fetchone()
        if not previous:
            raise PlatformError("skill_rollback_unavailable", "No previous Skill binding is available", 409)
        return self.bind_skill_version(actor, previous[0], active=True)

    def delete_skill_version(self, actor: dict[str, Any], skill_version_id: str) -> dict[str, Any]:
        with connect(self.path) as c:
            row = c.execute("SELECT id,name,scope,owner_id FROM platform_skill_versions WHERE id=?", (skill_version_id,)).fetchone()
            if not row:
                raise PlatformError("skill_version_not_found", "Skill version not found", 404)
            skill_id, name, scope, owner_id = row
            if scope in {"system", "workspace"}:
                raise PlatformError("skill_system_cannot_delete", "系统内置 Skill 仅支持开启/关闭，不允许删除", 403)
            if owner_id != actor.get("id") and actor.get("role") != "admin":
                raise PlatformError("skill_forbidden", "只能删除自己创建的自定义 Skill", 403)
            c.execute("DELETE FROM platform_skill_bindings WHERE skill_version_id=?", (skill_version_id,))
            c.execute("DELETE FROM platform_skill_binding_history WHERE skill_version_id=?", (skill_version_id,))
            c.execute("DELETE FROM platform_skill_versions WHERE id=?", (skill_version_id,))
            self._audit(c, actor.get("id"), "skill.version.deleted", "skill_version", skill_version_id, {"name": name, "scope": scope})
        return {"id": skill_version_id, "deleted": True, "name": name}

    def resolve_skill_version(self, actor: dict[str, Any], name: str, *, project_id: str | None = None) -> dict[str, Any] | None:
        order = [("project", actor.get("id"), project_id), ("user", actor.get("id"), None), ("workspace", None, None), ("system", None, None)]
        with connect(self.path) as c:
            for scope, owner_id, scoped_project in order:
                row = c.execute("SELECT v.id,v.name,v.version,v.scope,v.owner_id,v.project_id,v.parent_version,v.manifest_json,v.content_hash FROM platform_skill_bindings b JOIN platform_skill_versions v ON v.id=b.skill_version_id WHERE b.name=? AND b.scope=? AND b.owner_id IS ? AND b.project_id IS ? AND b.active=1 AND v.status='active'", (name, scope, owner_id, scoped_project)).fetchone()
                if row:
                    keys = ("id", "name", "version", "scope", "owner_id", "project_id", "parent_version", "manifest_json", "content_hash")
                    return dict(zip(keys, row))
        return None

    def list_skill_versions(self, actor: dict[str, Any], *, name: str | None = None, project_id: str | None = None) -> list[dict[str, Any]]:
        with connect(self.path) as c:
            rows = c.execute(
                "SELECT id,name,version,scope,owner_id,project_id,parent_version,content_hash,status,created_at FROM platform_skill_versions WHERE (scope IN ('system','workspace') OR (scope='user' AND owner_id=?) OR (scope='project' AND owner_id=? AND project_id=?)) AND (? IS NULL OR name=?) ORDER BY name,created_at DESC",
                (actor.get("id"), actor.get("id"), project_id, name, name),
            ).fetchall()
        keys = ("id", "name", "version", "scope", "owner_id", "project_id", "parent_version", "content_hash", "status", "created_at")
        return [dict(zip(keys, row)) for row in rows]

    def create_skill_run(self, actor: dict[str, Any], *, project_id: str, binding: dict[str, Any], input_hash: str | None = None) -> dict[str, Any]:
        required = ("skill_name", "skill_version", "skill_content_hash", "request_fingerprint")
        if any(not isinstance(binding.get(key), str) or not binding[key] for key in required):
            raise PlatformError("invalid_skill_binding", "Skill run binding is incomplete")
        if any(len(binding[key]) != 64 for key in ("skill_content_hash", "request_fingerprint")):
            raise PlatformError("invalid_skill_binding", "Skill run hashes are invalid")
        run_id, timestamp = uid(), now()
        with connect(self.path) as c:
            existing = c.execute("SELECT id,status FROM platform_skill_runs WHERE user_id=? AND request_fingerprint=?", (actor["id"], binding["request_fingerprint"])).fetchone()
            if existing:
                return {"id": existing[0], "status": existing[1], "idempotent_replay": True}
            c.execute("INSERT INTO platform_skill_runs (id,user_id,project_id,skill_name,skill_version,skill_content_hash,request_fingerprint,status,input_hash,output_hash,error_code,created_at,updated_at,lease_owner,lease_expires_at,attempt_count) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", (run_id, actor["id"], project_id, binding["skill_name"], binding["skill_version"], binding["skill_content_hash"], binding["request_fingerprint"], "queued", input_hash, None, None, timestamp, timestamp, None, None, 0))
            self._audit(c, actor["id"], "skill.run.created", "skill_run", run_id, {"project_id": project_id, "skill_name": binding["skill_name"], "skill_version": binding["skill_version"]})
        return {"id": run_id, "status": "queued", "idempotent_replay": False}

    def register_skill_worker(self, actor: dict[str, Any], label: str) -> dict[str, Any]:
        if not label or len(label) > 80: raise PlatformError("invalid_worker_label", "Worker label is invalid")
        raw = secrets.token_urlsafe(32); worker_id = uid(); timestamp = now()
        token_hash = hashlib.sha256(raw.encode()).hexdigest()
        with connect(self.path) as c:
            c.execute("INSERT INTO platform_skill_workers VALUES (?,?,?,?,?,?,?,?)", (worker_id, actor["id"], label, token_hash, "active", timestamp, timestamp, None))
            self._audit(c, actor["id"], "skill.worker.registered", "skill_worker", worker_id, {"label": label})
        return {"worker_id": worker_id, "label": label, "worker_token": raw, "status": "active"}

    def _worker(self, actor: dict[str, Any], worker_token: str) -> dict[str, Any]:
        token_hash = hashlib.sha256(worker_token.encode()).hexdigest()
        with connect(self.path) as c:
            row = c.execute("SELECT id,user_id,label,status FROM platform_skill_workers WHERE token_hash=?", (token_hash,)).fetchone()
            if not row or row[1] != actor.get("id") or row[3] != "active":
                raise PlatformError("skill_worker_invalid", "Worker token is invalid", 401)
            c.execute("UPDATE platform_skill_workers SET last_seen_at=? WHERE id=?", (now(), row[0]))
        return {"worker_id": row[0], "user_id": row[1], "label": row[2]}

    def claim_skill_run(self, actor: dict[str, Any], run_id: str, *, worker_id: str, lease_seconds: int = 300) -> dict[str, Any]:
        if not worker_id or lease_seconds <= 0 or lease_seconds > 3600:
            raise PlatformError("invalid_skill_lease", "Worker lease is invalid")
        timestamp = now(); expires = (datetime.now(timezone.utc) + timedelta(seconds=lease_seconds)).isoformat()
        with connect(self.path) as c:
            row = c.execute("SELECT user_id,status,lease_owner,lease_expires_at,attempt_count FROM platform_skill_runs WHERE id=?", (run_id,)).fetchone()
            if not row: raise PlatformError("skill_run_not_found", "Skill run not found", 404)
            if row[0] != actor.get("id"): raise PlatformError("skill_run_forbidden", "Skill run belongs to another user", 403)
            expired = row[1] == "running" and row[3] is not None and datetime.fromisoformat(row[3]) <= datetime.now(timezone.utc)
            if row[1] not in {"queued", "running"} or (row[1] == "running" and not expired):
                raise PlatformError("skill_run_not_claimable", "Skill run is not claimable", 409)
            attempt = int(row[4]) + 1
            c.execute("UPDATE platform_skill_runs SET status='running',lease_owner=?,lease_expires_at=?,attempt_count=?,updated_at=? WHERE id=?", (worker_id, expires, attempt, timestamp, run_id))
            self._audit(c, actor.get("id"), "skill.run.claimed", "skill_run", run_id, {"worker_id": worker_id, "attempt": attempt, "lease_expires_at": expires})
        return {"id": run_id, "status": "running", "lease_owner": worker_id, "lease_expires_at": expires, "attempt_count": attempt}

    def claim_skill_run_with_token(self, actor: dict[str, Any], run_id: str, *, worker_token: str, lease_seconds: int = 300) -> dict[str, Any]:
        worker = self._worker(actor, worker_token)
        return self.claim_skill_run(actor, run_id, worker_id=worker["worker_id"], lease_seconds=lease_seconds)

    def heartbeat_skill_run(self, actor: dict[str, Any], run_id: str, *, worker_token: str, lease_seconds: int = 300) -> dict[str, Any]:
        worker = self._worker(actor, worker_token)
        if lease_seconds <= 0 or lease_seconds > 3600: raise PlatformError("invalid_skill_lease", "Worker lease is invalid")
        expires = (datetime.now(timezone.utc) + timedelta(seconds=lease_seconds)).isoformat(); timestamp = now()
        with connect(self.path) as c:
            row = c.execute("SELECT user_id,status,lease_owner FROM platform_skill_runs WHERE id=?", (run_id,)).fetchone()
            if not row: raise PlatformError("skill_run_not_found", "Skill run not found", 404)
            if row[0] != actor.get("id"): raise PlatformError("skill_run_forbidden", "Skill run belongs to another user", 403)
            if row[1] != "running" or row[2] != worker["worker_id"]: raise PlatformError("skill_run_lease_required", "Worker lease is required", 409)
            c.execute("UPDATE platform_skill_runs SET lease_expires_at=?,updated_at=? WHERE id=?", (expires, timestamp, run_id))
        return {"id": run_id, "status": "running", "lease_owner": worker["worker_id"], "lease_expires_at": expires}

    def recover_expired_skill_runs(self, actor: dict[str, Any], *, now_value: str | None = None) -> int:
        cutoff = now_value or now()
        with connect(self.path) as c:
            rows = c.execute("SELECT id FROM platform_skill_runs WHERE user_id=? AND status='running' AND lease_expires_at IS NOT NULL AND lease_expires_at<=?", (actor.get("id"), cutoff)).fetchall()
            for (run_id,) in rows:
                c.execute("UPDATE platform_skill_runs SET status='queued',lease_owner=NULL,lease_expires_at=NULL,updated_at=? WHERE id=?", (cutoff, run_id))
                self._audit(c, actor.get("id"), "skill.run.lease_expired", "skill_run", run_id, {"requeued_at": cutoff})
        return len(rows)

    def update_skill_run(self, actor: dict[str, Any], run_id: str, *, status: str, output_hash: str | None = None, error_code: str | None = None, worker_id: str | None = None) -> dict[str, Any]:
        if status not in {"queued", "running", "succeeded", "failed", "cancelled"}:
            raise PlatformError("invalid_skill_run_status", "Skill run status is invalid")
        timestamp = now()
        with connect(self.path) as c:
            row = c.execute("SELECT user_id,status FROM platform_skill_runs WHERE id=?", (run_id,)).fetchone()
            if not row: raise PlatformError("skill_run_not_found", "Skill run not found", 404)
            if row[0] != actor.get("id"): raise PlatformError("skill_run_forbidden", "Skill run belongs to another user", 403)
            owner = c.execute("SELECT lease_owner FROM platform_skill_runs WHERE id=?", (run_id,)).fetchone()[0]
            if row[1] == "running" and owner != worker_id:
                raise PlatformError("skill_run_lease_required", "Worker lease is required", 409)
            c.execute("UPDATE platform_skill_runs SET status=?,output_hash=?,error_code=?,lease_owner=NULL,lease_expires_at=NULL,updated_at=? WHERE id=?", (status, output_hash, error_code, timestamp, run_id))
            self._audit(c, actor.get("id"), "skill.run.updated", "skill_run", run_id, {"from": row[1], "to": status})
        return {"id": run_id, "status": status, "output_hash": output_hash, "error_code": error_code}

    def list_skill_runs(self, actor: dict[str, Any], *, project_id: str | None = None, limit: int = 50) -> list[dict[str, Any]]:
        limit = max(1, min(limit, 200))
        with connect(self.path) as c:
            rows = c.execute("SELECT id,project_id,skill_name,skill_version,skill_content_hash,request_fingerprint,status,input_hash,output_hash,error_code,created_at,updated_at FROM platform_skill_runs WHERE user_id=? AND (? IS NULL OR project_id=?) ORDER BY created_at DESC LIMIT ?", (actor["id"], project_id, project_id, limit)).fetchall()
        keys = ("id", "project_id", "skill_name", "skill_version", "skill_content_hash", "request_fingerprint", "status", "input_hash", "output_hash", "error_code", "created_at", "updated_at")
        return [dict(zip(keys, row)) for row in rows]
    def record_skill_feedback(
        self,
        actor: dict[str, Any],
        *,
        project_id: str,
        skill_name: str,
        skill_version: str,
        skill_content_hash: str,
        decision: str,
        qc_score: float | None = None,
        note: str = "",
        run_id: str | None = None,
    ) -> dict[str, Any]:
        if decision not in {"accepted", "rejected", "revision_requested"}:
            raise PlatformError("invalid_skill_feedback", "unsupported feedback decision")
        if len(skill_content_hash) != 64 or any(c not in "0123456789abcdef" for c in skill_content_hash):
            raise PlatformError("invalid_skill_feedback", "invalid Skill content hash")
        if qc_score is not None and not 0 <= qc_score <= 1:
            raise PlatformError("invalid_skill_feedback", "QC score must be between 0 and 1")
        feedback_id = uid()
        timestamp = now()
        with connect(self.path) as c:
            c.execute(
                "INSERT INTO platform_skill_feedback (id,user_id,project_id,skill_name,skill_version,skill_content_hash,run_id,decision,qc_score,note,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                (feedback_id, actor["id"], project_id, skill_name, skill_version, skill_content_hash, run_id, decision, qc_score, note[:2000], timestamp),
            )
            self._audit(c, actor["id"], "skill.feedback.recorded", "skill_feedback", feedback_id, {"skill_name": skill_name, "decision": decision})
        return {"id": feedback_id, "project_id": project_id, "skill_name": skill_name, "skill_version": skill_version, "decision": decision, "qc_score": qc_score, "note": note[:2000]}

    def list_skill_feedback(self, actor: dict[str, Any], *, project_id: str | None = None, skill_name: str | None = None, limit: int = 50) -> list[dict[str, Any]]:
        limit = max(1, min(limit, 200))
        with connect(self.path) as c:
            rows = c.execute(
                "SELECT id,project_id,skill_name,skill_version,skill_content_hash,run_id,decision,qc_score,note,created_at FROM platform_skill_feedback WHERE user_id=? AND (? IS NULL OR project_id=?) AND (? IS NULL OR skill_name=?) ORDER BY created_at DESC LIMIT ?",
                (actor["id"], project_id, project_id, skill_name, skill_name, limit),
            ).fetchall()
        keys = ("id", "project_id", "skill_name", "skill_version", "skill_content_hash", "run_id", "decision", "qc_score", "note", "created_at")
        return [dict(zip(keys, row)) for row in rows]

    def estimate_media_credits(self, provider: str, model: str, media_kind: str, units: int = 1) -> dict[str, Any]:
        if media_kind not in {"image", "video", "audio"} or type(units) is not int or units <= 0:
            raise PlatformError("invalid_media_usage", "media kind and units are invalid")
        with connect(self.path) as c:
            row = c.execute(
                "SELECT pricing_version,credits_per_unit FROM media_pricing WHERE provider=? AND model IN (?, '*') AND media_kind=? AND active=1 ORDER BY model DESC,created_at DESC LIMIT 1",
                (provider, model, media_kind),
            ).fetchone()
        if not row:
            raise PlatformError("pricing_unavailable", "no active media pricing for this model", 422)
        return {"provider": provider, "model": model, "media_kind": media_kind, "units": units,
                "pricing_version": row[0], "credits_per_unit": row[1], "estimated_credits": row[1] * units}

    def reserve_media_credits(self, actor: dict[str, Any], provider: str, model: str, media_kind: str,
                              units: int, generation_id: str, idempotency_key: str, *,
                              product: str | None = None, project_id: str | None = None) -> dict[str, Any]:
        """Create an idempotent reservation using the frozen media price version."""
        estimate = self.estimate_media_credits(provider, model, media_kind, units)
        return {**self.reserve_credits(actor, estimate["estimated_credits"], generation_id,
                                        estimate["pricing_version"], idempotency_key,
                                        product=product, project_id=project_id), **estimate}

    def settle_media_credits(self, actor: dict[str, Any], reservation_id: str,
                             actual_units: int, *, provider: str, model: str,
                             media_kind: str) -> dict[str, Any]:
        if type(actual_units) is not int or actual_units < 0:
            raise PlatformError("invalid_media_usage", "actual media units are invalid")
        estimate = self.estimate_media_credits(provider, model, media_kind, max(actual_units, 1))
        return self.settle_credits(actor, reservation_id,
                                   estimate["credits_per_unit"] * actual_units)

    def estimate_credits(self, provider: str, model: str, prompt_tokens: int, completion_tokens: int) -> dict[str, Any]:
        if min(prompt_tokens, completion_tokens) < 0:
            raise PlatformError("invalid_token_usage", "token counts cannot be negative")
        with connect(self.path) as c:
            row = c.execute("SELECT pricing_version,input_credits_per_1k,output_credits_per_1k FROM credit_pricing WHERE provider=? AND model=? AND active=1 ORDER BY created_at DESC LIMIT 1", (provider, model)).fetchone()
        if not row: raise PlatformError("pricing_unavailable", "no active credit pricing for this model", 422)
        input_credits = ceil(prompt_tokens * row[1] / 1000)
        output_credits = ceil(completion_tokens * row[2] / 1000)
        return {"provider": provider, "model": model, "pricing_version": row[0], "prompt_tokens": prompt_tokens, "completion_tokens": completion_tokens, "estimated_credits": input_credits + output_credits}

    def credit_balance(self, actor: dict[str, Any]) -> dict[str, Any]:
        with connect(self.path) as c:
            row = c.execute("SELECT COALESCE(SUM(CASE WHEN direction IN ('credit','release','refund') THEN amount_credits ELSE -amount_credits END),0), COALESCE(SUM(CASE WHEN direction='credit' THEN amount_credits ELSE 0 END),0), COALESCE(SUM(CASE WHEN direction='debit' THEN amount_credits ELSE 0 END),0) FROM credit_ledger WHERE user_id=?", (actor["id"],)).fetchone()
        return {"user_id": actor["id"], "available_credits": row[0], "credited_credits": row[1], "debited_credits": row[2]}

    def credit_ledger(self, actor: dict[str, Any], limit: int = 100) -> list[dict[str, Any]]:
        limit = max(1, min(limit, 500))
        with connect(self.path) as c:
            rows = c.execute("SELECT id,amount_credits,direction,reference_type,reference_id,metadata_json,created_at FROM credit_ledger WHERE user_id=? ORDER BY created_at DESC LIMIT ?", (actor["id"], limit)).fetchall()
        keys = ("id", "amount_credits", "direction", "reference_type", "reference_id", "metadata_json", "created_at")
        return [dict(zip(keys, row)) for row in rows]

    def grant_credits(self, issuer: dict[str, Any], user_id: str, amount: int, reason: str, idempotency_key: str) -> dict[str, Any]:
        if issuer["role"] not in {"admin", "client"}: raise PlatformError("forbidden", "credit grants require admin or client", 403)
        if amount <= 0: raise PlatformError("invalid_credit_amount", "credit amount must be positive")
        with connect(self.path) as c:
            if not c.execute("SELECT 1 FROM platform_users WHERE id=? AND is_active=1", (user_id,)).fetchone(): raise PlatformError("user_not_found", "credit recipient not found", 404)
            existing = c.execute("SELECT id,amount_credits FROM credit_ledger WHERE idempotency_key=?", (idempotency_key,)).fetchone()
            if existing: return {"id": existing[0], "user_id": user_id, "amount_credits": existing[1], "status": "credited", "idempotent_replay": True}
            entry_id = uid()
            c.execute("INSERT INTO credit_ledger VALUES (?,?,?,?,?,?,?,?,?)", (entry_id, user_id, amount, "credit", "grant", user_id, idempotency_key, json.dumps({"reason": reason}, ensure_ascii=False), now()))
            self._audit(c, issuer["id"], "credits.granted", "user", user_id, {"amount_credits": amount, "reason": reason})
        return {"id": entry_id, "user_id": user_id, "amount_credits": amount, "status": "credited", "idempotent_replay": False}

    @staticmethod
    def _credit_scope_metadata(product: str | None, project_id: str | None) -> dict[str, str]:
        return {key: value for key, value in (("product", product), ("project_id", project_id)) if value is not None}

    def _validate_credit_project_scope(self, c: sqlite3.Connection, actor: dict[str, Any], *, product: str | None, project_id: str | None) -> None:
        if (product is None) != (project_id is None):
            raise PlatformError("invalid_credit_project_scope", "product and project_id must be provided together", 422)
        if product is None:
            return
        if product not in {"studio", "atelier"} or not project_id or not c.execute(
            "SELECT 1 FROM platform_project_bindings WHERE user_id=? AND product=? AND project_id=? AND status='active'",
            (actor["id"], product, project_id),
        ).fetchone():
            raise PlatformError("project_binding_required", "an active platform project binding is required", 403)

    def reserve_credits(self, actor: dict[str, Any], estimated_credits: int, generation_id: str, pricing_version: str, idempotency_key: str, *, product: str | None = None, project_id: str | None = None) -> dict[str, Any]:
        if estimated_credits <= 0: raise PlatformError("invalid_credit_amount", "reservation must be positive")
        with connect(self.path) as c:
            self._validate_credit_project_scope(c, actor, product=product, project_id=project_id)
            old = c.execute("SELECT id,estimated_credits,status,product,project_id FROM credit_reservations WHERE idempotency_key=? AND user_id=?", (idempotency_key, actor["id"])).fetchone()
            if old:
                if (old[3], old[4]) != (product, project_id):
                    raise PlatformError("idempotency_key_reused", "Idempotency-Key was already used with a different project scope", 409)
                return {"reservation_id": old[0], "estimated_credits": old[1], "status": old[2], "product": old[3], "project_id": old[4], "idempotent_replay": True}
            balance = c.execute("SELECT COALESCE(SUM(CASE WHEN direction IN ('credit','release','refund') THEN amount_credits ELSE -amount_credits END),0) FROM credit_ledger WHERE user_id=?", (actor["id"],)).fetchone()[0]
            if balance < estimated_credits: raise PlatformError("insufficient_credits", "insufficient platform credits", 402)
            reservation_id = uid(); timestamp = now()
            c.execute("INSERT INTO credit_reservations (id,user_id,generation_id,estimated_credits,settled_credits,released_credits,pricing_version,status,idempotency_key,created_at,updated_at,product,project_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", (reservation_id, actor["id"], generation_id, estimated_credits, 0, 0, pricing_version, "reserved", idempotency_key, timestamp, timestamp, product, project_id))
            c.execute("INSERT INTO credit_ledger VALUES (?,?,?,?,?,?,?,?,?)", (uid(), actor["id"], estimated_credits, "debit", "reservation", reservation_id, f"{idempotency_key}:reserve", json.dumps({"pricing_version": pricing_version, **self._credit_scope_metadata(product, project_id)}, ensure_ascii=False), timestamp))
        return {"reservation_id": reservation_id, "estimated_credits": estimated_credits, "status": "reserved", "product": product, "project_id": project_id, "idempotent_replay": False}

    def reserve_for_usage(self, actor: dict[str, Any], provider: str, model: str, prompt_tokens: int, completion_tokens: int, generation_id: str, idempotency_key: str, *, product: str | None = None, project_id: str | None = None) -> dict[str, Any]:
        estimate = self.estimate_credits(provider, model, prompt_tokens, completion_tokens)
        return {**self.reserve_credits(actor, estimate["estimated_credits"], generation_id, estimate["pricing_version"], idempotency_key, product=product, project_id=project_id), "pricing_version": estimate["pricing_version"], "estimated_credits": estimate["estimated_credits"]}

    def settle_for_usage(self, actor: dict[str, Any], reservation_id: str, provider: str, model: str, prompt_tokens: int, completion_tokens: int) -> dict[str, Any]:
        estimate = self.estimate_credits(provider, model, prompt_tokens, completion_tokens)
        return self.settle_credits(actor, reservation_id, estimate["estimated_credits"])

    def settle_credits(self, actor: dict[str, Any], reservation_id: str, actual_credits: int) -> dict[str, Any]:
        if actual_credits < 0: raise PlatformError("invalid_credit_amount", "actual credits cannot be negative")
        with connect(self.path) as c:
            row = c.execute("SELECT user_id,estimated_credits,status,product,project_id FROM credit_reservations WHERE id=?", (reservation_id,)).fetchone()
            if not row or row[0] != actor["id"]: raise PlatformError("reservation_not_found", "credit reservation not found", 404)
            if row[2] != "reserved": return {"reservation_id": reservation_id, "status": row[2], "actual_credits": actual_credits, "idempotent_replay": True}
            extra = max(0, actual_credits - row[1]); release = max(0, row[1] - actual_credits)
            if extra:
                balance = c.execute("SELECT COALESCE(SUM(CASE WHEN direction IN ('credit','release','refund') THEN amount_credits ELSE -amount_credits END),0) FROM credit_ledger WHERE user_id=?", (actor["id"],)).fetchone()[0]
                if balance < extra: raise PlatformError("insufficient_credits", "additional settlement credits are unavailable", 402)
                c.execute("INSERT INTO credit_ledger VALUES (?,?,?,?,?,?,?,?,?)", (uid(), actor["id"], extra, "debit", "settlement", reservation_id, f"{reservation_id}:extra", json.dumps(self._credit_scope_metadata(row[3], row[4]), ensure_ascii=False), now()))
            if release:
                c.execute("INSERT INTO credit_ledger VALUES (?,?,?,?,?,?,?,?,?)", (uid(), actor["id"], release, "release", "settlement", reservation_id, f"{reservation_id}:release", json.dumps(self._credit_scope_metadata(row[3], row[4]), ensure_ascii=False), now()))
            c.execute("UPDATE credit_reservations SET settled_credits=?,released_credits=?,status='settled',updated_at=? WHERE id=?", (actual_credits, release, now(), reservation_id))
            if actual_credits > 0:
                self._process_agent_commission(
                    c,
                    student_user_id=row[0],
                    amount_cents=actual_credits,
                    source_type="credit_settlement",
                    source_id=reservation_id,
                    description=f"算力消费结算 ({actual_credits} 算力)",
                )
        return {"reservation_id": reservation_id, "status": "settled", "actual_credits": actual_credits, "released_credits": release, "additional_credits": extra, "idempotent_replay": False}

    def release_credits(self, actor: dict[str, Any], reservation_id: str) -> dict[str, Any]:
        with connect(self.path) as c:
            row = c.execute("SELECT user_id,estimated_credits,status,product,project_id FROM credit_reservations WHERE id=?", (reservation_id,)).fetchone()
            if not row or row[0] != actor["id"]: raise PlatformError("reservation_not_found", "credit reservation not found", 404)
            if row[2] != "reserved": return {"reservation_id": reservation_id, "status": row[2], "idempotent_replay": True}
            c.execute("INSERT INTO credit_ledger VALUES (?,?,?,?,?,?,?,?,?)", (uid(), actor["id"], row[1], "release", "reservation", reservation_id, f"{reservation_id}:release", json.dumps(self._credit_scope_metadata(row[3], row[4]), ensure_ascii=False), now()))
            c.execute("UPDATE credit_reservations SET released_credits=?,status='released',updated_at=? WHERE id=?", (row[1], now(), reservation_id))
        return {"reservation_id": reservation_id, "status": "released", "released_credits": row[1], "idempotent_replay": False}

    def create_competition(self, actor: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
        if actor["role"] not in {"admin", "client"}: raise PlatformError("forbidden", "only client or admin can publish competitions", 403)
        cid = uid(); timestamp = now()
        with connect(self.path) as c:
            c.execute("INSERT INTO competitions VALUES (?,?,?,?,?,?,?,?,?,?,?)", (cid, payload["title"], payload["slug"], payload.get("description", ""), payload.get("rules_markdown", ""), int(payload.get("whitelist_required", True)), int(payload.get("allocated_credits", 0)), payload.get("status", "draft"), payload.get("enroll_deadline"), payload.get("submit_deadline"), timestamp))
        return {"id": cid, **payload}

    def list_competitions(self) -> list[dict[str, Any]]:
        with connect(self.path) as c:
            rows = c.execute("SELECT id,title,slug,description,rules_markdown,whitelist_required,allocated_credits,status,enroll_deadline,submit_deadline,created_at FROM competitions ORDER BY created_at DESC").fetchall()
        keys = ["id","title","slug","description","rules_markdown","whitelist_required","allocated_credits","status","enroll_deadline","submit_deadline","created_at"]
        return [dict(zip(keys, row)) for row in rows]

    def competition(self, competition_id: str) -> dict[str, Any]:
        with connect(self.path) as c:
            row = c.execute("SELECT id,title,slug,description,rules_markdown,whitelist_required,allocated_credits,status,enroll_deadline,submit_deadline,created_at FROM competitions WHERE id=?", (competition_id,)).fetchone()
        if not row: raise PlatformError("not_found", "competition not found", 404)
        return dict(zip(("id","title","slug","description","rules_markdown","whitelist_required","allocated_credits","status","enroll_deadline","submit_deadline","created_at"), row))

    def leaderboard(self, competition_id: str) -> list[dict[str, Any]]:
        with connect(self.path) as c:
            rows = c.execute("SELECT id,user_id,title,score,award_title,status FROM platform_submissions WHERE target_type='competition' AND target_id=? AND status='approved' ORDER BY score DESC, created_at ASC", (competition_id,)).fetchall()
        return [dict(zip(("submission_id","user_id","title","score","award_title","status"), row)) for row in rows]

    def enroll(self, actor: dict[str, Any], competition_id: str, invite_code: str | None, idem: str) -> dict[str, Any]:
        with connect(self.path) as c:
            old = self._idem(c, actor["id"], idem)
            if old: return old
            competition = c.execute("SELECT status,whitelist_required FROM competitions WHERE id=?", (competition_id,)).fetchone()
            if not competition: raise PlatformError("not_found", "competition not found", 404)
            if competition[0] not in {"enrolling", "ongoing"}: raise PlatformError("competition_closed", "competition is not open")
            if competition[1]:
                allowed = c.execute("SELECT 1 FROM competition_whitelists WHERE competition_id=? AND user_id=? AND status='approved' AND (invite_code IS NULL OR invite_code=?)", (competition_id, actor["id"], invite_code)).fetchone()
                if not allowed: raise PlatformError("not_whitelisted", "user is not on the competition whitelist", 403)
            result = {"competition_id": competition_id, "user_id": actor["id"], "status": "enrolled"}
            self._save_idem(c, actor["id"], idem, result); self._audit(c, actor["id"], "competition.enrolled", "competition", competition_id, result); return result

    def whitelist(self, actor: dict[str, Any], competition_id: str, user_id: str, invite_code: str | None = None) -> dict[str, Any]:
        if actor["role"] not in {"admin", "client"}: raise PlatformError("forbidden", "reviewer cannot manage whitelist", 403)
        item = {"id": uid(), "competition_id": competition_id, "user_id": user_id, "invite_code": invite_code, "status": "approved", "created_at": now()}
        with connect(self.path) as c:
            try: c.execute("INSERT INTO competition_whitelists VALUES (?,?,?,?,?,?)", tuple(item.values()))
            except sqlite3.IntegrityError as exc: raise PlatformError("already_whitelisted", "user already whitelisted", 409) from exc
        return item

    def submit_artifact(self, actor: dict[str, Any], target_type: str, target_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        if target_type not in {"competition", "certification_exam"}: raise PlatformError("invalid_target", "invalid submission target")
        if target_type == "competition":
            with connect(self.path) as c:
                competition = c.execute("SELECT status,submit_deadline FROM competitions WHERE id=?", (target_id,)).fetchone()
            if not competition: raise PlatformError("not_found", "competition not found", 404)
            if competition[0] not in {"ongoing", "judging"}: raise PlatformError("competition_closed", "competition is not accepting submissions")
            if competition[1] and datetime.fromisoformat(competition[1]) < datetime.now(timezone.utc): raise PlatformError("submission_closed", "submission deadline has passed")
        payload = self._resolve_artifact_payload(actor, payload)
        sid = uid(); item = {"id": sid, "target_type": target_type, "target_id": target_id, "user_id": actor["id"], **{"product": payload.get("product"), **{k: payload[k] for k in ("artifact_id","artifact_version","sha256","media_type","project_id","project_title_snapshot","title")}}, "description": payload.get("description", ""), "resolved_media_ref": payload.get("resolved_media_ref"), "source_kind": payload.get("source_kind"), "contract_version": payload.get("contract_version"), "resolved_at": payload.get("resolved_at"), "status": "submitted", "created_at": now()}
        with connect(self.path) as c:
            c.execute("INSERT INTO platform_submissions (id,target_type,target_id,user_id,product,artifact_id,artifact_version,sha256,media_type,project_id,project_title_snapshot,title,description,resolved_media_ref,source_kind,contract_version,resolved_at,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", tuple(item.values()))
        return item

    def review_submission(self, actor: dict[str, Any], submission_id: str, approved: bool, score: float | None, award_title: str | None = None) -> dict[str, Any]:
        if actor["role"] not in {"admin", "reviewer", "client"}: raise PlatformError("forbidden", "review role required", 403)
        status = "approved" if approved else "rejected"
        with connect(self.path) as c:
            row = c.execute("SELECT user_id,target_type,target_id FROM platform_submissions WHERE id=?", (submission_id,)).fetchone()
            if not row: raise PlatformError("not_found", "submission not found", 404)
            c.execute("UPDATE platform_submissions SET status=?,score=?,award_title=? WHERE id=?", (status,score,award_title,submission_id))
            if approved and row[1] == "competition" and award_title:
                c.execute("INSERT OR IGNORE INTO creator_certifications (id,user_id,status,level,source_type,submission_id,score,feedback,certified_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)", (uid(),row[0],"certified","standard","competition_award",submission_id,score,"competition award",now(),now()))
                c.execute("UPDATE creator_certifications SET status='certified',source_type='competition_award',submission_id=?,score=?,certified_at=? WHERE user_id=?", (submission_id,score,now(),row[0]))
            return {"submission_id": submission_id, "status": status, "score": score, "award_title": award_title}

    def create_task(self, actor: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
        if actor["role"] not in {"admin", "client"}: raise PlatformError("forbidden", "only client or admin can publish tasks", 403)
        item = {"id": uid(), **payload, "status": payload.get("status", "draft"), "version": 0, "created_at": now()}
        with connect(self.path) as c: c.execute("INSERT INTO commercial_tasks (id,title,category,brief_markdown,bounty_cents,required_level,deadline,status,version,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)", (item["id"],item["title"],item["category"],item["brief_markdown"],item["bounty_cents"],item.get("required_level","standard"),item["deadline"],item["status"],0,item["created_at"]))
        return item

    def task_square(self) -> list[dict[str, Any]]:
        with connect(self.path) as c: rows = c.execute("SELECT id,title,category,brief_markdown,bounty_cents,required_level,deadline,status,version,created_at FROM commercial_tasks WHERE status='published' ORDER BY deadline").fetchall()
        keys = ["id","title","category","brief_markdown","bounty_cents","required_level","deadline","status","version","created_at"]
        return [dict(zip(keys, r)) for r in rows]

    def claim_task(self, actor: dict[str, Any], task_id: str, idem: str) -> dict[str, Any]:
        if actor["role"] != "creator": raise PlatformError("forbidden", "only certified creators can claim tasks", 403)
        with connect(self.path) as c:
            old = self._idem(c, actor["id"], idem)
            if old: return old
            cert = c.execute("SELECT status FROM creator_certifications WHERE user_id=?", (actor["id"],)).fetchone()
            if not cert or cert[0] != "certified": raise PlatformError("creator_not_certified", "creator certification is required", 403)
            cur = c.execute("UPDATE commercial_tasks SET status='claimed',claimed_by=?,claim_time=?,version=version+1 WHERE id=? AND status='published'", (actor["id"], now(), task_id))
            if cur.rowcount != 1: raise PlatformError("task_unavailable", "task is no longer available", 409)
            result = {"task_id": task_id, "claimed_by": actor["id"], "status": "claimed"}; self._save_idem(c, actor["id"], idem, result); c.execute("INSERT INTO task_history VALUES (?,?,?,?,?,?,?,?)", (uid(),task_id,"published","claimed",actor["id"],None,idem,now())); return result

    def transition_task(self, actor: dict[str, Any], task_id: str, target: TaskStatus, reason: str | None = None) -> dict[str, Any]:
        with connect(self.path) as c:
            row = c.execute("SELECT status,claimed_by,version FROM commercial_tasks WHERE id=?", (task_id,)).fetchone()
            if not row: raise PlatformError("not_found", "task not found", 404)
            current = TaskStatus(row[0]);
            if not can_transition(current, target): raise PlatformError("invalid_transition", f"cannot move {current} to {target}")
            if actor["role"] not in {"admin", "client", "reviewer"} and actor["id"] != row[1]: raise PlatformError("forbidden", "not task owner", 403)
            c.execute("UPDATE commercial_tasks SET status=?,version=version+1 WHERE id=? AND version=?", (target.value, task_id, row[2])); c.execute("INSERT INTO task_history VALUES (?,?,?,?,?,?,?,?)", (uid(),task_id,current.value,target.value,actor["id"],reason,uid(),now()))
            return {"task_id": task_id, "from_status": current.value, "status": target.value}

    def start_task(self, actor: dict[str, Any], task_id: str) -> dict[str, Any]:
        return self.transition_task(actor, task_id, TaskStatus.IN_PROGRESS, "creator started work")

    def deliver_task(self, actor: dict[str, Any], task_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        with connect(self.path) as c:
            row = c.execute("SELECT status,claimed_by FROM commercial_tasks WHERE id=?", (task_id,)).fetchone()
            if not row or row[1] != actor["id"]: raise PlatformError("forbidden", "task is not assigned to this creator", 403)
            current = TaskStatus(row[0]); target = TaskStatus.DELIVERED if current in {TaskStatus.CLAIMED,TaskStatus.IN_PROGRESS} else TaskStatus.RESUBMITTED
            if not can_transition(current, target): raise PlatformError("invalid_transition", "task cannot accept delivery")
        payload = self._resolve_artifact_payload(actor, payload)
        with connect(self.path) as c:
            row = c.execute("SELECT status,claimed_by FROM commercial_tasks WHERE id=?", (task_id,)).fetchone()
            if not row or row[1] != actor["id"]: raise PlatformError("forbidden", "task is not assigned to this creator", 403)
            current = TaskStatus(row[0]); target = TaskStatus.DELIVERED if current in {TaskStatus.CLAIMED,TaskStatus.IN_PROGRESS} else TaskStatus.RESUBMITTED
            if not can_transition(current, target): raise PlatformError("invalid_transition", "task cannot accept delivery")
            n = c.execute("SELECT COALESCE(MAX(version_num),0)+1 FROM task_deliveries WHERE task_id=?", (task_id,)).fetchone()[0]; did=uid(); timestamp=now()
            c.execute("INSERT INTO task_deliveries (id,task_id,creator_id,product,artifact_id,artifact_version,sha256,media_type,project_id,project_title_snapshot,resolved_media_ref,source_kind,contract_version,resolved_at,version_num,delivery_note,review_status,review_feedback,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", (did,task_id,actor["id"],payload.get("product"),payload["artifact_id"],payload["artifact_version"],payload["sha256"],payload["media_type"],payload["project_id"],payload["project_title_snapshot"],payload.get("resolved_media_ref"),payload.get("source_kind"),payload.get("contract_version"),payload.get("resolved_at"),n,payload.get("delivery_note",""),"pending","",timestamp))
            c.execute("UPDATE commercial_tasks SET status=?,version=version+1 WHERE id=?", (target.value,task_id)); return {"id":did,"task_id":task_id,"version_num":n,"status":target.value}

    def review_task(self, actor: dict[str, Any], task_id: str, approved: bool, feedback: str = "") -> dict[str, Any]:
        if actor["role"] not in {"admin","client","reviewer"}: raise PlatformError("forbidden", "review role required", 403)
        with connect(self.path) as c:
            row=c.execute("SELECT status,claimed_by,bounty_cents FROM commercial_tasks WHERE id=?",(task_id,)).fetchone()
            if not row: raise PlatformError("not_found", "task not found",404)
            current=TaskStatus(row[0]); target=TaskStatus.ACCEPTED if approved else TaskStatus.REVISION_REQUESTED
            if not can_transition(current,target): raise PlatformError("invalid_transition", "task is not awaiting review")
            c.execute("UPDATE commercial_tasks SET status=?,version=version+1 WHERE id=?",(target.value,task_id)); c.execute("UPDATE task_deliveries SET review_status=?,review_feedback=? WHERE task_id=? AND review_status='pending'", ("approved" if approved else "revision_required",feedback,task_id))
            if approved and row[2] > 0:
                account = c.execute("SELECT id FROM ledger_accounts WHERE user_id=?",(row[1],)).fetchone(); account_id=account[0] if account else uid()
                if not account: c.execute("INSERT INTO ledger_accounts VALUES (?,?,?)",(account_id,row[1],now()))
                c.execute("INSERT INTO ledger_entries VALUES (?,?,?,?,?,?,?,?,?)",(uid(),uid(),account_id,row[2],"credit","task",task_id,"task-settlement-"+task_id,now()))
                c.execute("UPDATE commercial_tasks SET status='settled',version=version+1 WHERE id=?",(task_id,)); target=TaskStatus.SETTLED
            return {"task_id":task_id,"status":target.value,"feedback":feedback}

    def wallet(self, actor: dict[str, Any]) -> dict[str, Any]:
        with connect(self.path) as c:
            rows=c.execute("SELECT COALESCE(SUM(CASE WHEN direction='credit' THEN amount_cents ELSE -amount_cents END),0) FROM ledger_entries le JOIN ledger_accounts la ON la.id=le.account_id WHERE la.user_id=?",(actor["id"],)).fetchone()
        return {"user_id":actor["id"],"simulated_balance_cents":rows[0]}

    def transactions(self, actor: dict[str, Any]) -> list[dict[str, Any]]:
        with connect(self.path) as c:
            rows = c.execute("SELECT le.id,le.transaction_id,le.amount_cents,le.direction,le.reference_type,le.reference_id,le.created_at FROM ledger_entries le JOIN ledger_accounts la ON la.id=le.account_id WHERE la.user_id=? ORDER BY le.created_at DESC", (actor["id"],)).fetchall()
        return [dict(zip(("entry_id","transaction_id","amount_cents","direction","reference_type","reference_id","created_at"), row)) for row in rows]

    def release_expired_tasks(self) -> int:
        released = 0
        with connect(self.path) as c:
            rows = c.execute("SELECT id,status FROM commercial_tasks WHERE status IN ('published','claimed','in_progress') AND deadline < ?", (now(),)).fetchall()
            for task_id, status in rows:
                c.execute("UPDATE commercial_tasks SET status='expired',version=version+1 WHERE id=? AND status=?", (task_id,status))
                c.execute("INSERT INTO task_history VALUES (?,?,?,?,?,?,?,?)", (uid(),task_id,status,"expired","system","deadline",uid(),now())); released += 1
        return released

    def add_course(self, actor: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
        if actor["role"] not in {"admin", "client"}: raise PlatformError("forbidden", "course publishing requires admin or client", 403)
        item = {"id": uid(), "title": payload["title"], "description": payload.get("description", ""), "video_url": payload.get("video_url", ""), "status": "published"}
        with connect(self.path) as c: c.execute("INSERT INTO courses VALUES (?,?,?,?,?)", tuple(item.values()))
        return item

    def list_courses(self) -> list[dict[str, Any]]:
        with connect(self.path) as c: rows = c.execute("SELECT id,title,description,video_url,status FROM courses WHERE status='published' ORDER BY title").fetchall()
        return [dict(zip(("id","title","description","video_url","status"), row)) for row in rows]

    def add_template(self, actor: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
        if actor["role"] not in {"admin", "client"}: raise PlatformError("forbidden", "template publishing requires admin or client", 403)
        item = {"id": uid(), "title": payload["title"], "source_project_id": payload["source_project_id"], "version": payload.get("version", "1"), "metadata_json": json.dumps(payload.get("metadata", {})), "status": "published"}
        with connect(self.path) as c: c.execute("INSERT INTO templates VALUES (?,?,?,?,?,?)", tuple(item.values()))
        return item

    def list_templates(self) -> list[dict[str, Any]]:
        with connect(self.path) as c: rows = c.execute("SELECT id,title,source_project_id,version,metadata_json,status FROM templates WHERE status='published' ORDER BY title").fetchall()
        return [dict(zip(("id","title","source_project_id","version","metadata_json","status"), row)) for row in rows]

    def fork_template(self, actor: dict[str, Any], template_id: str, fork_project_id: str) -> dict[str, Any]:
        with connect(self.path) as c:
            if not c.execute("SELECT 1 FROM templates WHERE id=? AND status='published'", (template_id,)).fetchone(): raise PlatformError("not_found", "template not found", 404)
            item = {"id": uid(), "template_id": template_id, "user_id": actor["id"], "fork_project_id": fork_project_id, "created_at": now()}
            try: c.execute("INSERT INTO template_forks VALUES (?,?,?,?,?)", tuple(item.values()))
            except sqlite3.IntegrityError as exc: raise PlatformError("fork_exists", "this fork already exists", 409) from exc
            return item

    def create_exam(self, actor: dict[str, Any], prompt: str, version: str) -> dict[str, Any]:
        if actor["role"] not in {"admin", "client"}: raise PlatformError("forbidden", "exam management requires admin or client", 403)
        item = {"id": uid(), "prompt": prompt, "version": version, "is_active": 1, "created_at": now()}
        with connect(self.path) as c:
            c.execute("UPDATE certification_exams SET is_active=0")
            c.execute("INSERT INTO certification_exams VALUES (?,?,?,?,?)", tuple(item.values()))
        return item

    def active_exam(self) -> dict[str, Any] | None:
        with connect(self.path) as c: row = c.execute("SELECT id,prompt,version,created_at FROM certification_exams WHERE is_active=1 ORDER BY created_at DESC LIMIT 1").fetchone()
        return dict(zip(("id","prompt","version","created_at"), row)) if row else None

    def apply_certification(self, actor: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
        with connect(self.path) as c:
            exam = c.execute("SELECT id FROM certification_exams WHERE id=? AND is_active=1", (payload["exam_id"],)).fetchone()
            if not exam: raise PlatformError("exam_unavailable", "active exam not found", 404)
            submission = self.submit_artifact(actor, "certification_exam", payload["exam_id"], payload["artifact"])
            item = {"id": uid(), "exam_id": payload["exam_id"], "user_id": actor["id"], "submission_id": submission["id"], "status": "reviewing", "score": None, "feedback": None, "created_at": now()}
            c.execute("INSERT INTO certification_applications VALUES (?,?,?,?,?,?,?,?)", tuple(item.values()))
            c.execute("INSERT OR IGNORE INTO creator_certifications (id,user_id,status,level,source_type,submission_id,score,feedback,certified_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)", (uid(),actor["id"],"reviewing","standard","direct_exam",submission["id"],None,None,None,now()))
            return item

    def certification_status(self, actor: dict[str, Any]) -> dict[str, Any] | None:
        with connect(self.path) as c: row = c.execute("SELECT status,level,source_type,score,feedback,certified_at FROM creator_certifications WHERE user_id=?", (actor["id"],)).fetchone()
        return dict(zip(("status","level","source_type","score","feedback","certified_at"), row)) if row else None

    def review_certification(self, actor: dict[str, Any], application_id: str, approved: bool, score: float | None, feedback: str) -> dict[str, Any]:
        if actor["role"] not in {"admin", "reviewer"}: raise PlatformError("forbidden", "reviewer role required", 403)
        status = "certified" if approved else "rejected"
        with connect(self.path) as c:
            row = c.execute("SELECT user_id,submission_id FROM certification_applications WHERE id=?", (application_id,)).fetchone()
            if not row: raise PlatformError("not_found", "application not found", 404)
            c.execute("UPDATE certification_applications SET status=?,score=?,feedback=? WHERE id=?", (status,score,feedback,application_id))
            c.execute("UPDATE creator_certifications SET status=?,score=?,feedback=?,certified_at=? WHERE user_id=?", (status,score,feedback,now() if approved else None,row[0]))
            return {"application_id": application_id, "user_id": row[0], "status": status, "score": score, "feedback": feedback}

    def get_agent_profile(self, actor: dict[str, Any], target_user_id: str | None = None) -> dict[str, Any]:
        user_id = target_user_id if (target_user_id and actor.get("role") == "admin") else actor.get("id")
        if not user_id:
            raise PlatformError("unauthorized", "login required", 401)
        with connect(self.path) as c:
            user_row = c.execute("SELECT id, username, email, role, is_active FROM platform_users WHERE id=?", (user_id,)).fetchone()
            if not user_row:
                raise PlatformError("user_not_found", "user not found", 404)
            profile = c.execute(
                "SELECT user_id, agency_type, institution_name, contact_name, contact_phone, discount_rate, commission_rate, status, notes, created_at, updated_at FROM agent_profiles WHERE user_id=?",
                (user_id,),
            ).fetchone()
            if not profile:
                default_status = "active" if user_row[3] in {"agent", "admin"} else "unapplied"
                timestamp = now()
                c.execute(
                    "INSERT OR IGNORE INTO agent_profiles(user_id, agency_type, institution_name, contact_name, contact_phone, discount_rate, commission_rate, status, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                    (user_id, "individual", user_row[1], user_row[1], None, 1.0, 0.01, default_status, None, timestamp, timestamp),
                )
                profile = (user_id, "individual", user_row[1], user_row[1], None, 1.0, 0.01, default_status, None, timestamp, timestamp)

            total_batches = c.execute("SELECT COUNT(*) FROM agent_invite_batches WHERE agent_id=?", (user_id,)).fetchone()[0]
            purchased_invites = c.execute("SELECT COALESCE(SUM(quantity), 0) FROM agent_invite_batches WHERE agent_id=? AND status='completed'", (user_id,)).fetchone()[0]
            invites_stats = c.execute(
                "SELECT COUNT(*), COALESCE(SUM(used_count), 0) FROM registration_invites WHERE created_by=?",
                (user_id,),
            ).fetchone()
            total_invites = invites_stats[0]
            used_invites = invites_stats[1]
            remaining_invites = max(0, total_invites - used_invites)
            total_students = c.execute("SELECT COUNT(*) FROM agent_students WHERE agent_id=?", (user_id,)).fetchone()[0]
            total_commissions_cents = c.execute("SELECT COALESCE(SUM(commission_cents), 0) FROM agent_commissions WHERE agent_id=? AND status='settled'", (user_id,)).fetchone()[0]

            return {
                "user_id": profile[0],
                "username": user_row[1],
                "email": user_row[2],
                "role": user_row[3],
                "agency_type": profile[1],
                "institution_name": profile[2],
                "contact_name": profile[3],
                "contact_phone": profile[4],
                "discount_rate": profile[5],
                "commission_rate": profile[6] if profile[6] is not None else 0.01,
                "status": profile[7],
                "notes": profile[8],
                "created_at": profile[9],
                "updated_at": profile[10],
                "metrics": {
                    "total_batches": total_batches,
                    "purchased_invites": purchased_invites or total_invites,
                    "total_invites": total_invites,
                    "used_invites": used_invites,
                    "remaining_invites": remaining_invites,
                    "total_students": total_students,
                    "total_commissions_cents": total_commissions_cents,
                },
            }

    def upsert_agent_profile(
        self,
        actor: dict[str, Any],
        *,
        agency_type: str = "individual",
        institution_name: str = "",
        contact_name: str | None = None,
        contact_phone: str | None = None,
        discount_rate: float | None = None,
        commission_rate: float | None = None,
        status: str | None = None,
        notes: str | None = None,
        target_user_id: str | None = None,
    ) -> dict[str, Any]:
        is_admin = actor.get("role") == "admin"
        target_id = target_user_id if (target_user_id and is_admin) else actor.get("id")
        if not target_id:
            raise PlatformError("unauthorized", "login required", 401)
        if agency_type not in {"individual", "institution"}:
            raise PlatformError("invalid_agency_type", "agency_type must be 'individual' or 'institution'", 422)
        timestamp = now()
        with connect(self.path) as c:
            existing = c.execute("SELECT user_id, discount_rate, commission_rate, status FROM agent_profiles WHERE user_id=?", (target_id,)).fetchone()
            current_discount = existing[1] if existing else 1.0
            current_commission = existing[2] if (existing and existing[2] is not None) else 0.01
            current_status = existing[3] if existing else ("active" if is_admin else "pending")

            next_discount = float(discount_rate) if (discount_rate is not None and is_admin) else current_discount
            next_commission = float(commission_rate) if (commission_rate is not None and is_admin) else current_commission
            next_status = status if (status is not None and is_admin) else (current_status or "active")

            inst_name = institution_name.strip() or (contact_name or actor.get("username", "代理机构"))
            c.execute(
                """
                INSERT INTO agent_profiles(user_id, agency_type, institution_name, contact_name, contact_phone, discount_rate, commission_rate, status, notes, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    agency_type=excluded.agency_type,
                    institution_name=excluded.institution_name,
                    contact_name=excluded.contact_name,
                    contact_phone=excluded.contact_phone,
                    discount_rate=excluded.discount_rate,
                    commission_rate=excluded.commission_rate,
                    status=excluded.status,
                    notes=COALESCE(excluded.notes, agent_profiles.notes),
                    updated_at=excluded.updated_at
                """,
                (target_id, agency_type, inst_name, contact_name, contact_phone, next_discount, next_commission, next_status, notes, timestamp, timestamp),
            )
            if next_status == "active":
                u_role = c.execute("SELECT role FROM platform_users WHERE id=?", (target_id,)).fetchone()
                if u_role and u_role[0] not in {"admin", "agent"}:
                    c.execute("UPDATE platform_users SET role='agent', updated_at=? WHERE id=?", (timestamp, target_id))
            self._audit(c, actor["id"], "agent.profile_updated", "agent_profile", target_id, {"agency_type": agency_type, "institution_name": inst_name, "status": next_status})
        return self.get_agent_profile(actor, target_id)

    def purchase_agent_invites(
        self,
        actor: dict[str, Any],
        quantity: int,
        title: str,
        package_type: str = "standard",
        expires_at: str | None = None,
    ) -> dict[str, Any]:
        if actor.get("role") not in {"admin", "agent"}:
            raise PlatformError("forbidden", "agent or admin role required", 403)
        if quantity < 1 or quantity > 1000:
            raise PlatformError("invalid_quantity", "quantity must be between 1 and 1000", 422)
        title = (title or "").strip()
        if not title:
            raise PlatformError("invalid_title", "title is required", 422)

        agent_id = actor["id"]
        if quantity >= 100:
            base_unit_price = 2500
        elif quantity >= 50:
            base_unit_price = 3500
        elif quantity >= 10:
            base_unit_price = 4000
        else:
            base_unit_price = 5000

        timestamp = now()
        batch_id = uid()
        batch_no = f"AGT-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{secrets.token_hex(3).upper()}"
        codes_generated: list[dict[str, Any]] = []

        with connect(self.path) as c:
            prof = c.execute("SELECT discount_rate, status FROM agent_profiles WHERE user_id=?", (agent_id,)).fetchone()
            discount_rate = float(prof[0]) if prof and prof[0] else 1.0
            unit_price_cents = max(100, int(base_unit_price * discount_rate))
            total_price_cents = unit_price_cents * quantity

            c.execute(
                """
                INSERT INTO agent_invite_batches(id, agent_id, batch_no, title, package_type, quantity, unit_price_cents, total_price_cents, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?)
                """,
                (batch_id, agent_id, batch_no, title, package_type, quantity, unit_price_cents, total_price_cents, timestamp),
            )

            for i in range(quantity):
                code_id = uid()
                code_str = f"LX-{secrets.token_hex(4).upper()}"
                student_tag = f"{title} #{i+1:03d}"
                c.execute(
                    """
                    INSERT INTO registration_invites(id, code, max_uses, used_count, expires_at, created_by, created_at, last_used_at, batch_id, student_note)
                    VALUES (?, ?, 1, 0, ?, ?, ?, NULL, ?, ?)
                    """,
                    (code_id, code_str, expires_at, agent_id, timestamp, batch_id, student_tag),
                )
                codes_generated.append({
                    "id": code_id,
                    "code": code_str,
                    "student_note": student_tag,
                    "max_uses": 1,
                    "used_count": 0,
                    "expires_at": expires_at,
                    "batch_id": batch_id,
                    "created_at": timestamp,
                })

            self._audit(
                c,
                agent_id,
                "agent.invites_purchased",
                "agent_invite_batches",
                batch_id,
                {
                    "batch_no": batch_no,
                    "quantity": quantity,
                    "total_price_cents": total_price_cents,
                    "unit_price_cents": unit_price_cents,
                },
            )

        return {
            "batch": {
                "id": batch_id,
                "agent_id": agent_id,
                "batch_no": batch_no,
                "title": title,
                "package_type": package_type,
                "quantity": quantity,
                "unit_price_cents": unit_price_cents,
                "total_price_cents": total_price_cents,
                "created_at": timestamp,
            },
            "codes": codes_generated,
        }

    def list_agent_batches(self, actor: dict[str, Any], target_user_id: str | None = None) -> list[dict[str, Any]]:
        is_admin = actor.get("role") == "admin"
        agent_id = target_user_id if (target_user_id and is_admin) else actor.get("id")
        with connect(self.path) as c:
            if is_admin and not target_user_id:
                rows = c.execute("SELECT id, agent_id, batch_no, title, package_type, quantity, unit_price_cents, total_price_cents, status, created_at FROM agent_invite_batches ORDER BY created_at DESC").fetchall()
            else:
                rows = c.execute("SELECT id, agent_id, batch_no, title, package_type, quantity, unit_price_cents, total_price_cents, status, created_at FROM agent_invite_batches WHERE agent_id=? ORDER BY created_at DESC", (agent_id,)).fetchall()
        keys = ("id", "agent_id", "batch_no", "title", "package_type", "quantity", "unit_price_cents", "total_price_cents", "status", "created_at")
        return [dict(zip(keys, row)) for row in rows]

    def list_agent_invites(self, actor: dict[str, Any], batch_id: str | None = None, target_user_id: str | None = None) -> list[dict[str, Any]]:
        is_admin = actor.get("role") == "admin"
        agent_id = target_user_id if (target_user_id and is_admin) else actor.get("id")
        clauses = []
        params: list[Any] = []
        if not (is_admin and not target_user_id):
            clauses.append("r.created_by=?")
            params.append(agent_id)
        if batch_id:
            clauses.append("r.batch_id=?")
            params.append(batch_id)
        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""

        with connect(self.path) as c:
            sql = f"""
                SELECT r.id, r.code, r.max_uses, r.used_count, r.expires_at, r.created_by, r.created_at, r.last_used_at, r.batch_id, r.student_note,
                       b.title as batch_title, s.student_user_id, u.username as student_username, s.registered_at as student_registered_at
                FROM registration_invites r
                LEFT JOIN agent_invite_batches b ON b.id = r.batch_id
                LEFT JOIN agent_students s ON s.invite_id = r.id
                LEFT JOIN platform_users u ON u.id = s.student_user_id
                {where}
                ORDER BY r.created_at DESC
            """
            rows = c.execute(sql, params).fetchall()

        keys = ("id", "code", "max_uses", "used_count", "expires_at", "created_by", "created_at", "last_used_at", "batch_id", "student_note", "batch_title", "student_user_id", "student_username", "student_registered_at")
        return [dict(zip(keys, row)) for row in rows]

    def update_agent_invite_note(self, actor: dict[str, Any], invite_id: str, student_note: str) -> dict[str, Any]:
        is_admin = actor.get("role") == "admin"
        agent_id = actor.get("id")
        with connect(self.path) as c:
            row = c.execute("SELECT id, created_by FROM registration_invites WHERE id=?", (invite_id,)).fetchone()
            if not row:
                raise PlatformError("not_found", "invite code not found", 404)
            if not is_admin and row[1] != agent_id:
                raise PlatformError("forbidden", "not authorized to update this invite", 403)
            c.execute("UPDATE registration_invites SET student_note=? WHERE id=?", (student_note.strip(), invite_id))
        return {"id": invite_id, "student_note": student_note.strip()}

    def list_agent_students(self, actor: dict[str, Any], target_user_id: str | None = None) -> list[dict[str, Any]]:
        is_admin = actor.get("role") == "admin"
        agent_id = target_user_id if (target_user_id and is_admin) else actor.get("id")
        clauses = []
        params: list[Any] = []
        if not (is_admin and not target_user_id):
            clauses.append("s.agent_id=?")
            params.append(agent_id)
        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""

        with connect(self.path) as c:
            sql = f"""
                SELECT s.id, s.agent_id, s.student_user_id, s.invite_id, s.invite_code, s.batch_id, s.notes, s.registered_at,
                       u.username as student_username, u.email as student_email, b.title as batch_title
                FROM agent_students s
                JOIN platform_users u ON u.id = s.student_user_id
                LEFT JOIN agent_invite_batches b ON b.id = s.batch_id
                {where}
                ORDER BY s.registered_at DESC
            """
            rows = c.execute(sql, params).fetchall()

        keys = ("id", "agent_id", "student_user_id", "invite_id", "invite_code", "batch_id", "notes", "registered_at", "student_username", "student_email", "batch_title")
        return [dict(zip(keys, row)) for row in rows]

    def admin_list_agents(self, actor: dict[str, Any]) -> list[dict[str, Any]]:
        self._require_admin(actor)
        with connect(self.path) as c:
            sql = """
                SELECT u.id, u.username, u.email, u.role, u.is_active, u.created_at,
                       p.agency_type, p.institution_name, p.contact_name, p.contact_phone, p.discount_rate, p.commission_rate, p.status, p.notes,
                       (SELECT COUNT(*) FROM agent_invite_batches b WHERE b.agent_id = u.id) as total_batches,
                       (SELECT COALESCE(SUM(quantity), 0) FROM agent_invite_batches b WHERE b.agent_id = u.id) as total_purchased,
                       (SELECT COUNT(*) FROM registration_invites r WHERE r.created_by = u.id) as total_invites,
                       (SELECT COALESCE(SUM(used_count), 0) FROM registration_invites r WHERE r.created_by = u.id) as used_invites,
                       (SELECT COUNT(*) FROM agent_students s WHERE s.agent_id = u.id) as total_students,
                       (SELECT COALESCE(SUM(commission_cents), 0) FROM agent_commissions ac WHERE ac.agent_id = u.id AND ac.status='settled') as total_commissions_cents
                FROM platform_users u
                JOIN agent_profiles p ON p.user_id = u.id
                ORDER BY u.created_at DESC
            """
            rows = c.execute(sql).fetchall()

        keys = (
            "id", "username", "email", "role", "is_active", "created_at",
            "agency_type", "institution_name", "contact_name", "contact_phone", "discount_rate", "commission_rate", "status", "notes",
            "total_batches", "total_purchased", "total_invites", "used_invites", "total_students", "total_commissions_cents",
        )
        return [dict(zip(keys, row)) for row in rows]

    def _process_agent_commission(
        self,
        c: sqlite3.Connection,
        student_user_id: str,
        amount_cents: int,
        source_type: str,
        source_id: str | None = None,
        description: str = "",
    ) -> dict[str, Any] | None:
        if amount_cents <= 0:
            return None
        binding = c.execute(
            "SELECT agent_id FROM agent_students WHERE student_user_id=?",
            (student_user_id,),
        ).fetchone()
        if not binding:
            return None
        agent_id = binding[0]
        prof = c.execute(
            "SELECT commission_rate, status FROM agent_profiles WHERE user_id=?",
            (agent_id,),
        ).fetchone()
        if not prof or prof[1] != "active":
            return None
        commission_rate = float(prof[0]) if (prof[0] is not None and prof[0] > 0) else 0.01
        commission_cents = int(round(amount_cents * commission_rate))
        if commission_cents < 1:
            commission_cents = 1 if (amount_cents * commission_rate >= 0.5) else 0
        if commission_cents <= 0:
            return None

        commission_id = uid()
        timestamp = now()
        c.execute(
            """
            INSERT INTO agent_commissions(id, agent_id, student_user_id, source_type, source_id, amount_cents, commission_rate, commission_cents, status, description, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'settled', ?, ?)
            """,
            (commission_id, agent_id, student_user_id, source_type, source_id, amount_cents, commission_rate, commission_cents, description, timestamp),
        )

        acc = c.execute("SELECT id FROM ledger_accounts WHERE user_id=?", (agent_id,)).fetchone()
        if not acc:
            acc_id = uid()
            c.execute("INSERT INTO ledger_accounts(id, user_id, created_at) VALUES (?, ?, ?)", (acc_id, agent_id, timestamp))
        else:
            acc_id = acc[0]

        c.execute(
            "INSERT INTO ledger_entries(id, transaction_id, account_id, amount_cents, direction, reference_type, reference_id, idempotency_key, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
            (uid(), uid(), acc_id, commission_cents, "credit", "agent_commission", commission_id, f"commission:{commission_id}", timestamp),
        )

        self._audit(
            c,
            student_user_id,
            "agent.commission_settled",
            "agent_commission",
            commission_id,
            {
                "agent_id": agent_id,
                "student_user_id": student_user_id,
                "amount_cents": amount_cents,
                "commission_rate": commission_rate,
                "commission_cents": commission_cents,
            },
        )
        return {
            "id": commission_id,
            "agent_id": agent_id,
            "student_user_id": student_user_id,
            "amount_cents": amount_cents,
            "commission_rate": commission_rate,
            "commission_cents": commission_cents,
            "created_at": timestamp,
        }

    def record_user_consumption(
        self,
        student_user_id: str,
        amount_cents: int,
        source_type: str = "order",
        source_id: str | None = None,
        description: str = "",
    ) -> dict[str, Any] | None:
        if amount_cents <= 0:
            raise PlatformError("invalid_amount", "consumption amount must be positive", 422)
        with connect(self.path) as c:
            return self._process_agent_commission(c, student_user_id, amount_cents, source_type, source_id, description)

    def list_agent_commissions(self, actor: dict[str, Any], target_user_id: str | None = None) -> list[dict[str, Any]]:
        is_admin = actor.get("role") == "admin"
        agent_id = target_user_id if (target_user_id and is_admin) else actor.get("id")
        clauses = []
        params: list[Any] = []
        if not (is_admin and not target_user_id):
            clauses.append("ac.agent_id=?")
            params.append(agent_id)
        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""

        with connect(self.path) as c:
            sql = f"""
                SELECT ac.id, ac.agent_id, ac.student_user_id, ac.source_type, ac.source_id,
                       ac.amount_cents, ac.commission_rate, ac.commission_cents, ac.status,
                       ac.description, ac.created_at, u.username as student_username
                FROM agent_commissions ac
                JOIN platform_users u ON u.id = ac.student_user_id
                {where}
                ORDER BY ac.created_at DESC
            """
            rows = c.execute(sql, params).fetchall()

        keys = ("id", "agent_id", "student_user_id", "source_type", "source_id", "amount_cents", "commission_rate", "commission_cents", "status", "description", "created_at", "student_username")
        return [dict(zip(keys, row)) for row in rows]
