"""Deterministic paid-admission state contract and simulation coordinator."""
from __future__ import annotations
from typing import Callable, Any
from dataclasses import dataclass
from enum import StrEnum


class PaidAdmissionState(StrEnum):
    ACCEPTED = "accepted"
    RESERVATION_PENDING = "reservation_pending"
    RESERVED = "reserved"
    SUBMIT_PENDING = "submit_pending"
    SUBMITTED = "submitted"
    HANDLE_SAVED = "handle_saved"
    UNKNOWN = "unknown"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    RELEASED = "released"


_TRANSITIONS: dict[PaidAdmissionState, frozenset[PaidAdmissionState]] = {
    PaidAdmissionState.ACCEPTED: frozenset({PaidAdmissionState.RESERVATION_PENDING}),
    PaidAdmissionState.RESERVATION_PENDING: frozenset({PaidAdmissionState.RESERVED, PaidAdmissionState.FAILED}),
    PaidAdmissionState.RESERVED: frozenset({PaidAdmissionState.SUBMIT_PENDING, PaidAdmissionState.RELEASED}),
    PaidAdmissionState.SUBMIT_PENDING: frozenset({PaidAdmissionState.SUBMITTED, PaidAdmissionState.UNKNOWN, PaidAdmissionState.FAILED}),
    PaidAdmissionState.SUBMITTED: frozenset({PaidAdmissionState.HANDLE_SAVED, PaidAdmissionState.UNKNOWN}),
    PaidAdmissionState.HANDLE_SAVED: frozenset({PaidAdmissionState.SUCCEEDED, PaidAdmissionState.FAILED}),
    PaidAdmissionState.UNKNOWN: frozenset({PaidAdmissionState.HANDLE_SAVED, PaidAdmissionState.FAILED}),
    PaidAdmissionState.SUCCEEDED: frozenset(),
    PaidAdmissionState.FAILED: frozenset(),
    PaidAdmissionState.RELEASED: frozenset(),
}


def can_transition(current: PaidAdmissionState, target: PaidAdmissionState) -> bool:
    return target in _TRANSITIONS[current]

def require_shared_idempotency_key(receipt_key: str, reservation_key: str) -> None:
    """Require the receipt and credit reservation to identify one intent."""
    if not receipt_key or receipt_key != reservation_key:
        raise ValueError("paid_admission_idempotency_key_mismatch")


def require_transition(current: PaidAdmissionState, target: PaidAdmissionState) -> None:
    if not can_transition(current, target):
        raise ValueError(f"paid_admission_invalid_transition:{current}->{target}")


@dataclass(frozen=True)
class PaidAdmissionResult:
    state: PaidAdmissionState
    reservation_id: str | None = None
    provider_handle: Any = None
    error: str | None = None


def simulate_paid_admission(
    *,
    receipt_key: str,
    reservation_key: str,
    save_receipt: Callable[[], None],
    reserve_credits: Callable[[], str],
    submit_provider: Callable[[], Any],
    save_handle: Callable[[Any], None],
    release_credits: Callable[[str], None],
) -> PaidAdmissionResult:
    """Exercise the required ordering against fake durable/external operations.

    A submit exception is deliberately `unknown`: the provider may have accepted
    the request. Handle-save failure is also `unknown`; neither path retries or
    releases credits automatically.
    """
    require_shared_idempotency_key(receipt_key, reservation_key)
    save_receipt()
    reservation_id = reserve_credits()
    try:
        handle = submit_provider()
    except Exception as exc:
        return PaidAdmissionResult(PaidAdmissionState.UNKNOWN, reservation_id, error=str(exc))
    try:
        save_handle(handle)
    except Exception as exc:
        return PaidAdmissionResult(PaidAdmissionState.UNKNOWN, reservation_id, provider_handle=handle, error=str(exc))
    return PaidAdmissionResult(PaidAdmissionState.SUCCEEDED, reservation_id, provider_handle=handle)

def replay_paid_admission(
    *,
    receipt_key: str,
    reservation_key: str,
    load_receipt: Callable[[], dict[str, Any]],
    load_reservation: Callable[[], dict[str, Any]],
) -> PaidAdmissionResult:
    """Read an existing receipt/reservation without submit or re-reservation."""
    require_shared_idempotency_key(receipt_key, reservation_key)
    receipt = load_receipt()
    reservation = load_reservation()
    if receipt.get("request_fingerprint") != receipt_key or reservation.get("idempotency_key") != reservation_key:
        raise ValueError("paid_admission_replay_identity_mismatch")
    if receipt.get("reservation_id") != reservation.get("reservation_id"):
        raise ValueError("paid_admission_replay_reservation_mismatch")
    state = PaidAdmissionState(reservation.get("state", "unknown"))
    return PaidAdmissionResult(state=state, reservation_id=reservation.get("reservation_id"), provider_handle=receipt.get("provider_handle"))

def recover_paid_admission(
    *,
    state: PaidAdmissionState,
    reservation_id: str | None,
    provider_handle: Any,
    query_identity: dict[str, str] | None,
    query_provider: Callable[[Any, dict[str, str]], Any] | None,
) -> PaidAdmissionResult:
    """Recover an uncertain submission without reservation or submit calls."""
    if state is not PaidAdmissionState.UNKNOWN:
        raise ValueError("paid_admission_recovery_requires_unknown")
    required_identity = {"provider", "account", "region", "workspace", "endpoint"}
    if not provider_handle or not query_identity or not required_identity.issubset(query_identity) or query_provider is None:
        return PaidAdmissionResult(PaidAdmissionState.UNKNOWN, reservation_id, error="provider_query_identity_unavailable")
    try:
        queried = query_provider(provider_handle, query_identity)
    except Exception as exc:
        return PaidAdmissionResult(PaidAdmissionState.UNKNOWN, reservation_id, provider_handle=provider_handle, error=str(exc))
    if queried is None:
        return PaidAdmissionResult(PaidAdmissionState.UNKNOWN, reservation_id, provider_handle=provider_handle, error="provider_result_unknown")
    return PaidAdmissionResult(PaidAdmissionState.HANDLE_SAVED, reservation_id, provider_handle=queried)

def query_identity_from_scope(scope: dict[str, Any]) -> dict[str, str]:
    """Project persisted non-secret provider scope into query identity."""
    required = {
        "provider": scope.get("provider"),
        "account": scope.get("account_identity"),
        "region": scope.get("region"),
        "workspace": scope.get("workspace_id"),
        "endpoint": scope.get("base_url"),
    }
    if any(not isinstance(value, str) or not value for value in required.values()):
        raise ValueError("provider_query_identity_incomplete")
    return required

@dataclass(frozen=True)
class PaidAdmissionIntent:
    """Durable cross-store correlation record owned by Atelier."""

    request_fingerprint: str
    project_id: str
    attempt_id: str
    skill_content_hash: str
    reservation_id: str | None = None
    provider_handle: Any = None
    provider_scope: dict[str, str] | None = None
    state: PaidAdmissionState = PaidAdmissionState.ACCEPTED

    def __post_init__(self) -> None:
        import re

        for name in ("request_fingerprint", "skill_content_hash"):
            if re.fullmatch(r"[0-9a-f]{64}", getattr(self, name)) is None:
                raise ValueError(f"paid_admission_invalid_{name}")
        if not self.project_id or not self.attempt_id:
            raise ValueError("paid_admission_identity_missing")
        if self.state in {PaidAdmissionState.RESERVED, PaidAdmissionState.SUBMIT_PENDING, PaidAdmissionState.UNKNOWN, PaidAdmissionState.HANDLE_SAVED, PaidAdmissionState.SUCCEEDED} and not self.reservation_id:
            raise ValueError("paid_admission_reservation_missing")

def classify_recovery_intent(intent: PaidAdmissionIntent) -> str:
    """Classify a persisted intent after restart without submitting anything."""
    if intent.state is PaidAdmissionState.UNKNOWN:
        if intent.provider_handle and intent.provider_scope:
            return "query"
        return "manual_confirmation"
    if intent.state in {PaidAdmissionState.RESERVED, PaidAdmissionState.SUBMIT_PENDING}:
        return "resume_only_if_durable_submit_proof"
    if intent.state is PaidAdmissionState.HANDLE_SAVED:
        return "query"
    return "no_action"


def scan_recovery_intents(intents: list[PaidAdmissionIntent]) -> list[tuple[str, str]]:
    """Return deterministic restart actions keyed by attempt ID."""
    return [(intent.attempt_id, classify_recovery_intent(intent)) for intent in intents]

def apply_query_recovery(
    intent: PaidAdmissionIntent,
    *,
    query_provider: Callable[[Any, dict[str, str]], Any],
) -> PaidAdmissionIntent:
    """Apply a successful query result to a copied intent; never submit."""
    if classify_recovery_intent(intent) != "query":
        raise ValueError("paid_admission_query_recovery_not_allowed")
    identity = query_identity_from_scope(intent.provider_scope or {})
    result = recover_paid_admission(
        state=intent.state,
        reservation_id=intent.reservation_id,
        provider_handle=intent.provider_handle,
        query_identity=identity,
        query_provider=query_provider,
    )
    if result.state is not PaidAdmissionState.HANDLE_SAVED:
        raise ValueError(result.error or "paid_admission_query_recovery_unknown")
    return PaidAdmissionIntent(
        request_fingerprint=intent.request_fingerprint,
        project_id=intent.project_id,
        attempt_id=intent.attempt_id,
        skill_content_hash=intent.skill_content_hash,
        reservation_id=intent.reservation_id,
        provider_handle=result.provider_handle,
        provider_scope=intent.provider_scope,
        state=PaidAdmissionState.HANDLE_SAVED,
    )
