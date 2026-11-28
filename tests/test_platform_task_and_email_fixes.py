from __future__ import annotations

from fastapi.testclient import TestClient

from src.apps.comic_gen.api import create_app
from src.models.xiangongyun_manager import resolve_gpu_model_for_instance, select_best_h3_instance


def _register_and_login(client: TestClient, username: str, password: str = "StrongPass1234"):
    reg = client.post("/api/platform/auth/register", json={"username": username, "password": password})
    assert reg.status_code == 200, reg.text
    login = client.post("/api/platform/auth/login", json={"username": username, "password": password})
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_update_email_and_task_crud(monkeypatch, tmp_path):
    monkeypatch.setenv("LUMENX_PLATFORM_ENABLED", "true")
    monkeypatch.setenv("LUMENX_PLATFORM_REGISTRATION_INVITE_REQUIRED", "false")
    monkeypatch.setenv("LUMENX_PLATFORM_DB_PATH", str(tmp_path / "platform.db"))

    app = create_app(data_dir=tmp_path / "output", user_data_dir=tmp_path)
    with TestClient(app) as client:
        owner_headers = _register_and_login(client, "发包方甲")
        other_headers = _register_and_login(client, "其他用户")

        # 1. Invalid email rejected
        bad_email = client.patch("/api/platform/auth/me", headers=owner_headers, json={"email": "not-an-email"})
        assert bad_email.status_code == 422

        # 2. Valid email binds cleanly
        ok_email = client.patch("/api/platform/auth/me", headers=owner_headers, json={"email": "creator@example.com"})
        assert ok_email.status_code == 200
        assert ok_email.json()["email"] == "creator@example.com"

        # 3. Course seed video URLs point to valid local sample path
        courses = client.get("/api/platform/academy/courses").json()
        assert len(courses) > 0
        assert all(c["video_url"] == "/sample-assets/sample_preview.mp4" for c in courses)

        # 4. Create -> Update -> Delete commercial task
        task_payload = {
            "title": "测试商单标题",
            "category": "短剧分镜",
            "brief_markdown": "测试需求",
            "bounty_cents": 200000,
            "deadline": "2026-12-30T00:00:00Z",
            "status": "published",
        }
        created = client.post("/api/platform/tasks", headers=owner_headers, json=task_payload)
        assert created.status_code == 200, created.text
        task_id = created.json()["id"]

        # Non-owner cannot edit or delete
        assert client.patch(f"/api/platform/tasks/{task_id}", headers=other_headers, json={**task_payload, "title": "篡改"}).status_code == 403
        assert client.delete(f"/api/platform/tasks/{task_id}", headers=other_headers).status_code == 403

        # Owner can update
        updated = client.patch(f"/api/platform/tasks/{task_id}", headers=owner_headers, json={**task_payload, "title": "修改后商单标题"})
        assert updated.status_code == 200, updated.text
        assert updated.json()["title"] == "修改后商单标题"

        # Owner can delete
        deleted = client.delete(f"/api/platform/tasks/{task_id}", headers=owner_headers)
        assert deleted.status_code == 200, deleted.text
        assert deleted.json()["deleted"] is True


def test_xiangongyun_h3_auto_matching():
    instances = [
        {"id": "inst-cpu", "name": "dev-cpu", "status": "stopped", "gpu_model": ""},
        {"id": "inst-h3-stopped", "name": "minimax-h3-node", "status": "stopped", "gpu_model": "RTX 4090"},
        {"id": "inst-h3-running", "name": "h3-worker", "status": "running", "gpu_model": "A100"},
    ]
    best = select_best_h3_instance(instances)
    assert best is not None
    assert best["id"] == "inst-h3-running"
    assert resolve_gpu_model_for_instance(instances[0]) == "RTX 4090"
    assert resolve_gpu_model_for_instance(instances[1]) == "RTX 4090"
