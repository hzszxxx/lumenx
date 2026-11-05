import hashlib
import json

from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.apps.platform.api import router
from src.apps.platform.config import PlatformConfig
from src.apps.platform.service import PlatformService


def _manifest(version="1.0.0", title="Story Scout"):
    payload = {"name": "story-scout", "version": version, "title": title, "description": "A controlled story planning skill", "category": "story", "prompt_template": "Plan the next scene: {{input}}", "expected_tools": ["canvas.readProject"]}
    canonical = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return {**payload, "content_hash": hashlib.sha256(canonical.encode()).hexdigest()}


def _client(tmp_path):
    app = FastAPI()
    app.include_router(router, prefix="/api/platform")
    app.state.platform_service = PlatformService(PlatformConfig(enabled=True, database_url=f"sqlite:///{tmp_path / 'platform.db'}"))
    client = TestClient(app)
    register = client.post("/api/platform/auth/register", json={"username": "alice", "password": "a" * 12})
    token = client.post("/api/platform/auth/login", json={"username": "alice", "password": "a" * 12}).json()["access_token"]
    return client, {"Authorization": f"Bearer {token}"}


def test_skill_api_creates_lists_binds_and_resolves_user_skill(tmp_path):
    client, headers = _client(tmp_path)
    created = client.post("/api/platform/skills/versions", headers=headers, json={"manifest": _manifest(), "scope": "user"})
    assert created.status_code == 200
    skill_id = created.json()["id"]
    assert client.post(f"/api/platform/skills/versions/{skill_id}/bind", headers=headers).status_code == 200
    listed = client.get("/api/platform/skills", headers=headers)
    assert listed.status_code == 200
    assert listed.json()[0]["name"] == "story-scout"
    resolved = client.get("/api/platform/skills/story-scout/resolve", headers=headers)
    assert resolved.status_code == 200
    assert resolved.json()["version"] == "1.0.0"


def test_skill_api_rejects_script_field_before_service_write(tmp_path):
    client, headers = _client(tmp_path)
    payload = _manifest(); payload["script"] = "echo unsafe"
    response = client.post("/api/platform/skills/versions", headers=headers, json={"manifest": payload, "scope": "user"})
    assert response.status_code == 422



def test_skill_version_can_be_cloned_as_unbound_draft(tmp_path):
    client, headers = _client(tmp_path)
    created = client.post("/api/platform/skills/versions", headers=headers, json={"manifest": _manifest(), "scope": "user"}).json()
    cloned = client.post(f"/api/platform/skills/versions/{created['id']}/draft", headers=headers, json={"version": "1.1.0"})
    assert cloned.status_code == 200
    assert cloned.json()["status"] == "draft"
    assert cloned.json()["parent_version"] == "1.0.0"
    assert client.get("/api/platform/skills/story-scout/resolve", headers=headers).status_code == 404

    diff = client.get(f"/api/platform/skills/versions/{cloned.json()['id']}/diff?against_version_id={created['id']}", headers=headers)
    assert diff.status_code == 200
    assert diff.json()["changed"]["version"] == {"from": "1.0.0", "to": "1.1.0"}

def test_skill_binding_can_roll_back_to_previous_active_version(tmp_path):
    client, headers = _client(tmp_path)
    first = client.post("/api/platform/skills/versions", headers=headers, json={"manifest": _manifest(), "scope": "user"}).json()
    client.post(f"/api/platform/skills/versions/{first['id']}/bind", headers=headers)
    second_manifest = _manifest(version="2.0.0", title="Story Scout v2")
    second = client.post("/api/platform/skills/versions", headers=headers, json={"manifest": second_manifest, "scope": "user"}).json()
    client.post(f"/api/platform/skills/versions/{second['id']}/bind", headers=headers)
    rollback = client.post(f"/api/platform/skills/versions/{second['id']}/rollback", headers=headers)
    assert rollback.status_code == 200
    assert client.get("/api/platform/skills/story-scout/resolve", headers=headers).json()["version"] == "1.0.0"
def test_registration_api_accepts_and_consumes_invite(tmp_path):
    app = FastAPI()
    app.include_router(router, prefix="/api/platform")
    config = PlatformConfig(enabled=True, database_url=f"sqlite:///{tmp_path / 'platform.db'}", registration_invite_required=True)
    svc = PlatformService(config)
    app.state.platform_service = svc
    admin = PlatformService(PlatformConfig(enabled=True, database_url=f"sqlite:///{tmp_path / 'platform.db'}")).register("admin", "a" * 12, role="admin")
    svc.create_registration_invite(admin, "API1234")
    client = TestClient(app)
    created = client.post("/api/platform/auth/register", json={"username": "alice", "password": "a" * 12, "invite_code": "api1234"})
    assert created.status_code == 200
    replay = client.post("/api/platform/auth/register", json={"username": "bob", "password": "b" * 12, "invite_code": "API1234"})
    assert replay.status_code == 422

def test_skill_feedback_is_persisted_and_scoped_to_user(tmp_path):
    client, headers = _client(tmp_path)
    payload = {
        "project_id": "project-1",
        "skill_name": "story-scout",
        "skill_version": "1.0.0",
        "skill_content_hash": "a" * 64,
        "decision": "revision_requested",
        "qc_score": 0.75,
        "note": "Needs stronger continuity checks",
    }
    created = client.post("/api/platform/skills/feedback", headers=headers, json=payload)
    assert created.status_code == 200
    assert created.json()["decision"] == "revision_requested"
    listed = client.get("/api/platform/skills/feedback?project_id=project-1", headers=headers)
    assert listed.status_code == 200
    assert listed.json()[0]["skill_content_hash"] == "a" * 64


def test_skill_feedback_rejects_invalid_decision_and_score(tmp_path):
    client, headers = _client(tmp_path)
    payload = {
        "project_id": "project-1",
        "skill_name": "story-scout",
        "skill_version": "1.0.0",
        "skill_content_hash": "a" * 64,
        "decision": "activate",
        "qc_score": 2,
    }
    response = client.post("/api/platform/skills/feedback", headers=headers, json=payload)
    assert response.status_code == 422
