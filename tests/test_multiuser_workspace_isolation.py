import pytest
from fastapi.testclient import TestClient

from src.apps.comic_gen import api
from src.apps.platform.config import PlatformConfig
from src.apps.platform.service import PlatformService


def _setup_app_and_users(tmp_path, monkeypatch):
    platform_db = tmp_path / "platform.db"
    monkeypatch.setenv("LUMENX_PLATFORM_ENABLED", "1")
    monkeypatch.setenv("LUMENX_PLATFORM_DB_URL", f"sqlite:///{platform_db}")
    monkeypatch.setenv("LUMENX_PLATFORM_REGISTRATION_INVITE_REQUIRED", "0")

    svc = PlatformService(PlatformConfig.from_env())
    admin = svc.register("admin", "a" * 12, role="admin")
    user_a = svc.register("user_a", "a" * 12)
    user_b = svc.register("user_b", "b" * 12)

    admin_token = svc.login("admin", "a" * 12)["access_token"]
    token_a = svc.login("user_a", "a" * 12)["access_token"]
    token_b = svc.login("user_b", "b" * 12)["access_token"]

    data_dir = tmp_path / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    app = api.create_app(
        data_dir=data_dir,
        load_config=False,
        recover_orphan_tasks=False,
    )
    return {
        "svc": svc,
        "app": app,
        "admin": admin,
        "user_a": user_a,
        "user_b": user_b,
        "admin_token": admin_token,
        "token_a": token_a,
        "token_b": token_b,
    }


def test_studio_multiuser_workspace_isolation(tmp_path, monkeypatch):
    ctx = _setup_app_and_users(tmp_path, monkeypatch)
    token_a = ctx["token_a"]
    token_b = ctx["token_b"]
    admin_token = ctx["admin_token"]

    with TestClient(ctx["app"]) as client:
        # 1. User A creates a Studio project
        res_a = client.post(
            "/projects?skip_analysis=true",
            headers={"Authorization": f"Bearer {token_a}"},
            json={"title": "Project A", "text": "Novel content A", "workflow_mode": "r2v"},
        )
        assert res_a.status_code == 200, res_a.text
        proj_a = res_a.json()
        proj_a_id = proj_a["id"]
        assert proj_a.get("owner_user_id") == ctx["user_a"]["id"]

        # 2. User A lists projects -> sees Project A
        list_a = client.get("/projects/", headers={"Authorization": f"Bearer {token_a}"})
        assert list_a.status_code == 200
        ids_a = [p["id"] for p in list_a.json()]
        assert proj_a_id in ids_a

        # 3. User B (newly registered) lists projects -> sees empty list
        list_b = client.get("/projects/", headers={"Authorization": f"Bearer {token_b}"})
        assert list_b.status_code == 200
        assert list_b.json() == []

        # 4. User B cannot access Project A (404)
        get_b = client.get(f"/projects/{proj_a_id}", headers={"Authorization": f"Bearer {token_b}"})
        assert get_b.status_code == 404

        # 5. User B cannot delete Project A (404)
        del_b = client.delete(f"/projects/{proj_a_id}", headers={"Authorization": f"Bearer {token_b}"})
        assert del_b.status_code == 404

        # 6. User B creates Project B
        res_b = client.post(
            "/projects?skip_analysis=true",
            headers={"Authorization": f"Bearer {token_b}"},
            json={"title": "Project B", "text": "Novel content B", "workflow_mode": "r2v"},
        )
        assert res_b.status_code == 200
        proj_b_id = res_b.json()["id"]

        # 7. User B only sees Project B
        list_b2 = client.get("/projects/", headers={"Authorization": f"Bearer {token_b}"})
        assert [p["id"] for p in list_b2.json()] == [proj_b_id]

        # 8. User A only sees Project A
        list_a2 = client.get("/projects/", headers={"Authorization": f"Bearer {token_a}"})
        assert [p["id"] for p in list_a2.json()] == [proj_a_id]

        # 9. Admin sees both Project A and Project B
        list_admin = client.get("/projects/", headers={"Authorization": f"Bearer {admin_token}"})
        admin_ids = [p["id"] for p in list_admin.json()]
        assert proj_a_id in admin_ids
        assert proj_b_id in admin_ids

        # 10. Standalone / local unauthenticated mode sees all projects
        list_anon = client.get("/projects/")
        anon_ids = [p["id"] for p in list_anon.json()]
        assert proj_a_id in anon_ids
        assert proj_b_id in anon_ids


def test_series_multiuser_workspace_isolation(tmp_path, monkeypatch):
    ctx = _setup_app_and_users(tmp_path, monkeypatch)
    token_a = ctx["token_a"]
    token_b = ctx["token_b"]
    admin_token = ctx["admin_token"]

    with TestClient(ctx["app"]) as client:
        # 1. User A creates Series A
        res_a = client.post(
            "/series",
            headers={"Authorization": f"Bearer {token_a}"},
            json={"title": "Series A", "description": "Desc A"},
        )
        assert res_a.status_code == 200, res_a.text
        series_a = res_a.json()
        series_a_id = series_a["id"]
        assert series_a.get("owner_user_id") == ctx["user_a"]["id"]

        # 2. User A lists series -> sees Series A
        list_a = client.get("/series", headers={"Authorization": f"Bearer {token_a}"})
        assert [s["id"] for s in list_a.json()] == [series_a_id]

        # 3. User B lists series -> sees empty list
        list_b = client.get("/series", headers={"Authorization": f"Bearer {token_b}"})
        assert list_b.json() == []

        # 4. User B cannot get or delete Series A
        assert client.get(f"/series/{series_a_id}", headers={"Authorization": f"Bearer {token_b}"}).status_code == 404
        assert client.delete(f"/series/{series_a_id}", headers={"Authorization": f"Bearer {token_b}"}).status_code == 404

        # 5. User B cannot create an episode in Series A
        ep_b = client.post(
            f"/series/{series_a_id}/episode_requests",
            headers={"Authorization": f"Bearer {token_b}"},
            json={"title": "Ep 1", "client_request_id": "req-1", "expected_revision": 0},
        )
        assert ep_b.status_code == 404

        # 6. User B cannot add project to Series A
        proj_b = client.post(
            "/projects?skip_analysis=true",
            headers={"Authorization": f"Bearer {token_b}"},
            json={"title": "Proj B", "text": "Content", "series_id": series_a_id},
        )
        assert proj_b.status_code == 404

        # 7. Admin sees Series A
        list_admin = client.get("/series", headers={"Authorization": f"Bearer {admin_token}"})
        assert series_a_id in [s["id"] for s in list_admin.json()]


def test_atelier_multiuser_workspace_isolation(tmp_path, monkeypatch):
    ctx = _setup_app_and_users(tmp_path, monkeypatch)
    token_a = ctx["token_a"]
    token_b = ctx["token_b"]
    admin_token = ctx["admin_token"]

    with TestClient(ctx["app"]) as client:
        # 1. User A creates Atelier Project A
        res_a = client.post(
            "/atelier/projects",
            headers={"Authorization": f"Bearer {token_a}"},
            json={"title": "Atelier Project A", "description": "Desc A"},
        )
        assert res_a.status_code == 200, res_a.text
        atelier_a = res_a.json()
        atelier_a_id = atelier_a["id"]
        assert atelier_a.get("owner_user_id") == ctx["user_a"]["id"]

        # 2. User A lists atelier projects -> sees Atelier Project A
        list_a = client.get("/atelier/projects", headers={"Authorization": f"Bearer {token_a}"})
        assert [p["id"] for p in list_a.json()] == [atelier_a_id]

        # 3. User B lists atelier projects -> sees empty list
        list_b = client.get("/atelier/projects", headers={"Authorization": f"Bearer {token_b}"})
        assert list_b.json() == []

        # 4. User B cannot get, update, or delete Atelier Project A
        assert client.get(f"/atelier/projects/{atelier_a_id}", headers={"Authorization": f"Bearer {token_b}"}).status_code == 404
        assert client.put(
            f"/atelier/projects/{atelier_a_id}",
            headers={"Authorization": f"Bearer {token_b}"},
            json={"expected_revision": 0, "title": "Hacked"},
        ).status_code == 404
        assert client.request(
            "DELETE",
            f"/atelier/projects/{atelier_a_id}",
            headers={"Authorization": f"Bearer {token_b}"},
            json={"expected_revision": 0},
        ).status_code == 404

        # 5. User B creates Atelier Project B
        res_b = client.post(
            "/atelier/projects",
            headers={"Authorization": f"Bearer {token_b}"},
            json={"title": "Atelier Project B", "description": "Desc B"},
        )
        assert res_b.status_code == 200
        atelier_b_id = res_b.json()["id"]

        # 6. User B sees only Project B
        list_b2 = client.get("/atelier/projects", headers={"Authorization": f"Bearer {token_b}"})
        assert [p["id"] for p in list_b2.json()] == [atelier_b_id]

        # 7. User A sees only Project A
        list_a2 = client.get("/atelier/projects", headers={"Authorization": f"Bearer {token_a}"})
        assert [p["id"] for p in list_a2.json()] == [atelier_a_id]

        # 8. Admin sees both
        list_admin = client.get("/atelier/projects", headers={"Authorization": f"Bearer {admin_token}"})
        admin_ids = [p["id"] for p in list_admin.json()]
        assert atelier_a_id in admin_ids
        assert atelier_b_id in admin_ids

        # 9. Anonymous / local mode sees both
        list_anon = client.get("/atelier/projects")
        anon_ids = [p["id"] for p in list_anon.json()]
        assert atelier_a_id in anon_ids
        assert atelier_b_id in anon_ids
