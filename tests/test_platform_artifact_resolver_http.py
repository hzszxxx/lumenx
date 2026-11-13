from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.apps.atelier.artifact_resolver import AtelierArtifactResolver
from src.apps.platform.api import router
from src.apps.platform.config import PlatformConfig
from src.apps.platform.service import PlatformService
from src.core.artifact_resolver import ProductArtifactResolver


def test_http_binding_and_submission_use_server_artifact_snapshot(tmp_path):
    svc = PlatformService(PlatformConfig(enabled=True, database_url=f"sqlite:///{tmp_path / 'platform.db'}"))
    app = FastAPI()
    app.include_router(router, prefix="/api/platform")
    app.state.platform_service = svc
    client = TestClient(app)

    admin = svc.register("admin", "a" * 12, role="admin")
    creator = svc.register("creator", "b" * 12)
    admin_token = svc.login("admin", "a" * 12)["access_token"]
    creator_token = svc.login("creator", "b" * 12)["access_token"]

    proof = SimpleNamespace(
        project_id="atelier-project",
        sha256="b" * 64,
        size_bytes=42,
        relative_path="video/atelier_seq_export-1.mp4",
    )
    export = SimpleNamespace(
        id="export-1",
        deletion=None,
        snapshot_digest="server-snapshot",
        publication_proof=proof,
    )
    project = SimpleNamespace(id="atelier-project", title="Server title", exports=[export])
    storage = SimpleNamespace(get_project=lambda project_id: project)

    def owns(actor_id, project_id):
        return svc.is_project_bound(
            user_id=actor_id,
            product="atelier",
            project_id=project_id,
            storage_id="store-1",
        )

    def verify_media(relative_path, sha256, size_bytes):
        assert (relative_path, sha256, size_bytes) == (proof.relative_path, proof.sha256, proof.size_bytes)

    svc.set_artifact_resolver(
        ProductArtifactResolver(
            studio=SimpleNamespace(resolve=lambda actor_id, lookup: None),
            atelier=AtelierArtifactResolver(storage, ownership_check=owns, media_verifier=verify_media),
        )
    )

    competition_response = client.post(
        "/api/platform/competitions",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"title": "Atelier challenge", "slug": "atelier-challenge", "status": "ongoing", "whitelist_required": False},
    )
    assert competition_response.status_code == 200
    competition_id = competition_response.json()["id"]

    binding_response = client.post(
        "/api/platform/admin/project-bindings",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"user_id": creator["id"], "product": "atelier", "project_id": "atelier-project", "storage_id": "store-1"},
    )
    assert binding_response.status_code == 200

    submission_response = client.post(
        f"/api/platform/competitions/{competition_id}/submit",
        headers={"Authorization": f"Bearer {creator_token}"},
        json={
            "product": "atelier",
            "artifact_id": "export-1",
            "artifact_version": "snapshot:server-snapshot",
            "sha256": "b" * 64,
            "media_type": "text/plain",
            "project_id": "atelier-project",
            "title": "Client title",
        },
    )
    assert submission_response.status_code == 200
    body = submission_response.json()
    assert body["artifact_id"] == "export-1"
    assert body["project_title_snapshot"] == "Server title"
    assert body["title"] == "Server title"
    assert body["media_type"] == "video/mp4"
    assert body["resolved_media_ref"] == proof.relative_path
