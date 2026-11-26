from fastapi.testclient import TestClient
from pathlib import Path
from src.apps.comic_gen.api import create_app
from src.apps.platform.config import PlatformConfig
from src.apps.platform.service import PlatformService


def test_platform_auth_registration_validation_and_no_input_leak(tmp_path: Path, monkeypatch):
    monkeypatch.setenv("LUMENX_PLATFORM_ENABLED", "true")
    monkeypatch.setenv("LUMENX_PLATFORM_DATABASE_URL", f"sqlite:///{tmp_path / 'platform.db'}")
    monkeypatch.setenv("LUMENX_PLATFORM_REGISTRATION_INVITE_REQUIRED", "false")

    app = create_app(setup_logs=False, recover_orphan_tasks=False)
    client = TestClient(app)

    # 1. Two-character username (like "大鹏") should succeed
    res = client.post("/api/platform/auth/register", json={
        "username": "大鹏",
        "password": "validPassword123!",
    })
    assert res.status_code == 200, res.text
    user = res.json()
    assert user["username"] == "大鹏"

    # 2. Too short username (<2 chars) should return 422
    res_short_user = client.post("/api/platform/auth/register", json={
        "username": "x",
        "password": "validPassword123!",
    })
    assert res_short_user.status_code == 422
    err_body = res_short_user.json()
    assert "detail" in err_body
    for item in err_body["detail"]:
        assert "input" not in item

    # 3. Too short password (<12 chars) should return 422 and MUST NOT leak password in input
    secret_pass = "13572468"
    res_short_pwd = client.post("/api/platform/auth/register", json={
        "username": "xiaoming",
        "password": secret_pass,
    })
    assert res_short_pwd.status_code == 422
    pwd_err_body = res_short_pwd.json()
    assert "detail" in pwd_err_body
    # Ensure sensitive password input is never present in response JSON
    assert secret_pass not in res_short_pwd.text
    for item in pwd_err_body["detail"]:
        assert "input" not in item
