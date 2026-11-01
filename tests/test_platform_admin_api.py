from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.apps.platform.api import router
from src.apps.platform.config import PlatformConfig
from src.apps.platform.service import PlatformService


def _app(tmp_path):
    app = FastAPI()
    app.include_router(router, prefix="/api/platform")
    svc = PlatformService(PlatformConfig(enabled=True, database_url=f"sqlite:///{tmp_path / 'platform.db'}"))
    app.state.platform_service = svc
    admin = svc.register("admin", "a" * 12, role="admin")
    user = svc.register("alice", "b" * 12)
    client = TestClient(app)
    admin_token = client.post("/api/platform/auth/login", json={"username": "admin", "password": "a" * 12}).json()["access_token"]
    user_token = client.post("/api/platform/auth/login", json={"username": "alice", "password": "b" * 12}).json()["access_token"]
    return client, admin, user, {"Authorization": f"Bearer {admin_token}"}, {"Authorization": f"Bearer {user_token}"}


def test_admin_console_endpoints_are_role_gated_and_operational(tmp_path):
    client, _, user, admin_headers, user_headers = _app(tmp_path)
    assert client.get("/api/platform/admin/overview", headers=user_headers).status_code == 403
    overview = client.get("/api/platform/admin/overview", headers=admin_headers)
    assert overview.status_code == 200
    assert overview.json()["users"]["total"] == 2
    listed = client.get("/api/platform/admin/users?query=ali", headers=admin_headers)
    assert listed.json()["total"] == 1
    assert listed.json()["items"][0]["username"] == "alice"
    updated = client.patch(f"/api/platform/admin/users/{user['id']}", headers=admin_headers, json={"role": "creator"})
    assert updated.status_code == 200
    assert updated.json()["role"] == "creator"
    assert client.get("/api/platform/admin/audit-events", headers=admin_headers).json()["total"] >= 1


def test_admin_cannot_demote_last_admin_or_deactivate_self(tmp_path):
    client, admin, _, admin_headers, _ = _app(tmp_path)
    assert client.patch(f"/api/platform/admin/users/{admin['id']}", headers=admin_headers, json={"role": "user"}).status_code == 422
    assert client.patch(f"/api/platform/admin/users/{admin['id']}", headers=admin_headers, json={"is_active": False}).status_code == 422
