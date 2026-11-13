import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.apps.platform.api import router
from src.apps.platform.config import PlatformConfig
from src.apps.platform.service import PlatformError, PlatformService


def _service(tmp_path):
    return PlatformService(PlatformConfig(enabled=True, database_url=f"sqlite:///{tmp_path / 'platform.db'}"))


def test_admin_project_binding_is_audited_and_revocable(tmp_path):
    svc = _service(tmp_path)
    admin = svc.register("admin", "a" * 12, role="admin")
    creator = svc.register("creator", "b" * 12)

    binding = svc.bind_project(admin, user_id=creator["id"], product="atelier", project_id="atelier-1", storage_id="store-1")
    assert binding["status"] == "active"
    assert svc.is_project_bound(user_id=creator["id"], product="atelier", project_id="atelier-1", storage_id="store-1")
    assert not svc.is_project_bound(user_id=creator["id"], product="atelier", project_id="atelier-1", storage_id="store-2")
    assert svc.bind_project(admin, user_id=creator["id"], product="atelier", project_id="atelier-1", storage_id="store-1")["idempotent_replay"]

    revoked = svc.revoke_project_binding(admin, binding["id"])
    assert revoked["status"] == "revoked"
    assert not svc.is_project_bound(user_id=creator["id"], product="atelier", project_id="atelier-1", storage_id="store-1")

    with pytest.raises(PlatformError, match="admin role"):
        svc.bind_project(creator, user_id=creator["id"], product="studio", project_id="studio-1")


def test_project_binding_api_is_admin_only(tmp_path):
    app = FastAPI()
    app.include_router(router, prefix="/api/platform")
    svc = _service(tmp_path)
    app.state.platform_service = svc
    client = TestClient(app)
    admin = svc.register("admin", "a" * 12, role="admin")
    creator = svc.register("creator", "b" * 12)
    admin_token = svc.login("admin", "a" * 12)["access_token"]
    creator_token = svc.login("creator", "b" * 12)["access_token"]

    response = client.post(
        "/api/platform/admin/project-bindings",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"user_id": creator["id"], "product": "studio", "project_id": "studio-1"},
    )
    assert response.status_code == 200
    assert response.json()["user_id"] == creator["id"]

    forbidden = client.get(
        "/api/platform/admin/project-bindings",
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert forbidden.status_code == 403
