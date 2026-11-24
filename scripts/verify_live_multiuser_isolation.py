#!/usr/bin/env python3
"""Live server-side verification of multi-user workspace isolation on LumenX."""

import sys
import json
import uuid
import urllib.request
import urllib.error
import sqlite3
from datetime import datetime, timezone, timedelta
import secrets
import hashlib

BASE_URL = "http://127.0.0.1:17177"
DB_PATH = "output/platform.db"

def http_req(method: str, path: str, token: str | None = None, body: dict | None = None) -> tuple[int, dict | list]:
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8")
        try:
            parsed = json.loads(raw)
        except Exception:
            parsed = {"raw": raw}
        return exc.code, parsed

def setup_test_users():
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    now_str = datetime.now(timezone.utc).isoformat()
    expires_str = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()

    def get_or_create_user_token(username: str, role: str) -> tuple[str, str]:
        row = cur.execute("SELECT id FROM platform_users WHERE username=?", (username,)).fetchone()
        if row:
            uid_str = row[0]
            # update role if needed
            cur.execute("UPDATE platform_users SET role=? WHERE id=?", (role, uid_str))
        else:
            uid_str = str(uuid.uuid4())
            cur.execute(
                """INSERT INTO platform_users 
                   (id, username, email, phone, password_hash, password_salt, nickname, role, is_active, created_at, updated_at, registration_source)
                   VALUES (?, ?, ?, NULL, 'dummy_hash', 'dummy_salt', ?, ?, 1, ?, ?, 'test')""",
                (uid_str, username, f"{username}@test.local", username, role, now_str, now_str),
            )
        # Issue fresh session
        raw_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        sid = str(uuid.uuid4())
        cur.execute(
            "INSERT INTO platform_sessions (id, user_id, token_hash, expires_at, revoked_at, created_at) VALUES (?, ?, ?, ?, NULL, ?)",
            (sid, uid_str, token_hash, expires_str, now_str),
        )
        return uid_str, raw_token

    admin_id, admin_token = get_or_create_user_token("admin", "admin")
    alpha_id, alpha_token = get_or_create_user_token("test_user_alpha", "user")
    beta_id, beta_token = get_or_create_user_token("test_user_beta", "user")

    con.commit()
    con.close()

    return {
        "admin": {"id": admin_id, "token": admin_token},
        "alpha": {"id": alpha_id, "token": alpha_token},
        "beta": {"id": beta_id, "token": beta_token},
    }

def cleanup(users, created_ids):
    # Delete created projects from backend
    alpha_tok = users["alpha"]["token"]
    beta_tok = users["beta"]["token"]

    for pid in created_ids.get("studio_alpha", []):
        http_req("DELETE", f"/projects/{pid}", token=alpha_tok)
    for pid in created_ids.get("studio_beta", []):
        http_req("DELETE", f"/projects/{pid}", token=beta_tok)
    for sid in created_ids.get("series_alpha", []):
        http_req("DELETE", f"/series/{sid}", token=alpha_tok)
    for sid in created_ids.get("series_beta", []):
        http_req("DELETE", f"/series/{sid}", token=beta_tok)
    for aid in created_ids.get("atelier_alpha", []):
        http_req("DELETE", f"/atelier/projects/{aid}", token=alpha_tok, body={"expected_revision": 0})
    for aid in created_ids.get("atelier_beta", []):
        http_req("DELETE", f"/atelier/projects/{aid}", token=beta_tok, body={"expected_revision": 0})

    # Delete test users from DB
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    cur.execute("DELETE FROM platform_sessions WHERE user_id IN (?, ?)", (users["alpha"]["id"], users["beta"]["id"]))
    cur.execute("DELETE FROM platform_users WHERE id IN (?, ?)", (users["alpha"]["id"], users["beta"]["id"]))
    con.commit()
    con.close()

def run_tests():
    print("=" * 70)
    print("  LumenX 真实服务器端多用户工作区隔离验证测试")
    print(f"  测试目标: {BASE_URL}")
    print("=" * 70)

    users = setup_test_users()
    admin_token = users["admin"]["token"]
    alpha_token = users["alpha"]["token"]
    beta_token = users["beta"]["token"]

    created_ids = {
        "studio_alpha": [],
        "studio_beta": [],
        "series_alpha": [],
        "series_beta": [],
        "atelier_alpha": [],
        "atelier_beta": [],
    }

    passed = 0
    failed = 0

    def check(name: str, condition: bool, details: str = ""):
        nonlocal passed, failed
        if condition:
            print(f"  [PASS] {name}")
            passed += 1
        else:
            print(f"  [FAIL] {name} -> {details}")
            failed += 1

    try:
        # -------------------------------------------------------------
        print("\n[测试阶段 1] 匿名（未携带 Token）访问隔离性测试")
        # -------------------------------------------------------------
        status, data = http_req("GET", "/projects/")
        check("未登录用户请求 /projects/ 返回空列表 []", status == 200 and data == [], f"status={status}, data={data}")

        status, data = http_req("GET", "/series")
        check("未登录用户请求 /series 返回空列表 []", status == 200 and data == [], f"status={status}, data={data}")

        status, data = http_req("GET", "/atelier/projects")
        check("未登录用户请求 /atelier/projects 返回空列表 []", status == 200 and data == [], f"status={status}, data={data}")

        # -------------------------------------------------------------
        print("\n[测试阶段 2] 新用户初始状态独立性测试")
        # -------------------------------------------------------------
        status, data = http_req("GET", "/projects/", token=alpha_token)
        check("新用户 Alpha 的 Studio 项目列表为空", status == 200 and data == [], f"status={status}, data={data}")

        status, data = http_req("GET", "/projects/", token=beta_token)
        check("新用户 Beta 的 Studio 项目列表为空", status == 200 and data == [], f"status={status}, data={data}")

        status, data = http_req("GET", "/series", token=alpha_token)
        check("新用户 Alpha 的 Series 剧集列表为空", status == 200 and data == [], f"status={status}, data={data}")

        status, data = http_req("GET", "/series", token=beta_token)
        check("新用户 Beta 的 Series 剧集列表为空", status == 200 and data == [], f"status={status}, data={data}")

        status, data = http_req("GET", "/atelier/projects", token=alpha_token)
        check("新用户 Alpha 的 Atelier 画布列表为空", status == 200 and data == [], f"status={status}, data={data}")

        status, data = http_req("GET", "/atelier/projects", token=beta_token)
        check("新用户 Beta 的 Atelier 画布列表为空", status == 200 and data == [], f"status={status}, data={data}")

        # -------------------------------------------------------------
        print("\n[测试阶段 3] 用户创建各自资源")
        # -------------------------------------------------------------
        # Alpha creates
        st, res = http_req("POST", "/projects?skip_analysis=true", token=alpha_token, body={
            "title": "Alpha Studio 专属项目", "text": "Alpha text", "workflow_mode": "r2v"
        })
        check("Alpha 成功创建 Studio 项目", st == 200 and "id" in res)
        alpha_proj_id = res.get("id")
        created_ids["studio_alpha"].append(alpha_proj_id)

        st, res = http_req("POST", "/series", token=alpha_token, body={
            "title": "Alpha 专属系列", "description": "Alpha series desc"
        })
        check("Alpha 成功创建 Series 系列", st == 200 and "id" in res)
        alpha_series_id = res.get("id")
        created_ids["series_alpha"].append(alpha_series_id)

        st, res = http_req("POST", "/atelier/projects", token=alpha_token, body={
            "title": "Alpha Atelier 专属画布", "description": "Alpha atelier desc"
        })
        check("Alpha 成功创建 Atelier 画布项目", st == 200 and "id" in res)
        alpha_atelier_id = res.get("id")
        created_ids["atelier_alpha"].append(alpha_atelier_id)

        # Beta creates
        st, res = http_req("POST", "/projects?skip_analysis=true", token=beta_token, body={
            "title": "Beta Studio 专属项目", "text": "Beta text", "workflow_mode": "r2v"
        })
        check("Beta 成功创建 Studio 项目", st == 200 and "id" in res)
        beta_proj_id = res.get("id")
        created_ids["studio_beta"].append(beta_proj_id)

        st, res = http_req("POST", "/series", token=beta_token, body={
            "title": "Beta 专属系列", "description": "Beta series desc"
        })
        check("Beta 成功创建 Series 系列", st == 200 and "id" in res)
        beta_series_id = res.get("id")
        created_ids["series_beta"].append(beta_series_id)

        st, res = http_req("POST", "/atelier/projects", token=beta_token, body={
            "title": "Beta Atelier 专属画布", "description": "Beta atelier desc"
        })
        check("Beta 成功创建 Atelier 画布项目", st == 200 and "id" in res)
        beta_atelier_id = res.get("id")
        created_ids["atelier_beta"].append(beta_atelier_id)

        # -------------------------------------------------------------
        print("\n[测试阶段 4] 交叉可见性测试（工作区完全隔离）")
        # -------------------------------------------------------------
        # Alpha lists
        st, list_a = http_req("GET", "/projects/", token=alpha_token)
        ids_a = [p["id"] for p in list_a]
        check("Alpha Studio 列表中仅包含自己的项目，不包含 Beta 项目", alpha_proj_id in ids_a and beta_proj_id not in ids_a, f"ids={ids_a}")

        st, list_series_a = http_req("GET", "/series", token=alpha_token)
        sids_a = [s["id"] for s in list_series_a]
        check("Alpha Series 列表中仅包含自己的系列，不包含 Beta 系列", alpha_series_id in sids_a and beta_series_id not in sids_a, f"ids={sids_a}")

        st, list_at_a = http_req("GET", "/atelier/projects", token=alpha_token)
        at_ids_a = [p["id"] for p in list_at_a]
        check("Alpha Atelier 列表中仅包含自己的画布，不包含 Beta 画布", alpha_atelier_id in at_ids_a and beta_atelier_id not in at_ids_a, f"ids={at_ids_a}")

        # Beta lists
        st, list_b = http_req("GET", "/projects/", token=beta_token)
        ids_b = [p["id"] for p in list_b]
        check("Beta Studio 列表中仅包含自己的项目，不包含 Alpha 项目", beta_proj_id in ids_b and alpha_proj_id not in ids_b, f"ids={ids_b}")

        st, list_series_b = http_req("GET", "/series", token=beta_token)
        sids_b = [s["id"] for s in list_series_b]
        check("Beta Series 列表中仅包含自己的系列，不包含 Alpha 系列", beta_series_id in sids_b and alpha_series_id not in sids_b, f"ids={sids_b}")

        st, list_at_b = http_req("GET", "/atelier/projects", token=beta_token)
        at_ids_b = [p["id"] for p in list_at_b]
        check("Beta Atelier 列表中仅包含自己的画布，不包含 Alpha 画布", beta_atelier_id in at_ids_b and alpha_atelier_id not in at_ids_b, f"ids={at_ids_b}")

        # -------------------------------------------------------------
        print("\n[测试阶段 5] 越权访问与修改防护测试（横向越权防御）")
        # -------------------------------------------------------------
        # Beta tries to access Alpha's Studio Project
        st, _ = http_req("GET", f"/projects/{alpha_proj_id}", token=beta_token)
        check("Beta 尝试读取 Alpha 的 Studio 项目 -> 返回 404", st == 404, f"got status={st}")

        st, _ = http_req("DELETE", f"/projects/{alpha_proj_id}", token=beta_token)
        check("Beta 尝试删除 Alpha 的 Studio 项目 -> 返回 404", st == 404, f"got status={st}")

        # Beta tries to access Alpha's Series
        st, _ = http_req("GET", f"/series/{alpha_series_id}", token=beta_token)
        check("Beta 尝试读取 Alpha 的 Series 系列 -> 返回 404", st == 404, f"got status={st}")

        st, _ = http_req("DELETE", f"/series/{alpha_series_id}", token=beta_token)
        check("Beta 尝试删除 Alpha 的 Series 系列 -> 返回 404", st == 404, f"got status={st}")

        # Beta tries to add episode to Alpha's Series
        st, _ = http_req("POST", f"/series/{alpha_series_id}/episode_requests", token=beta_token, body={
            "title": "Hacked Episode", "client_request_id": "hack-1", "expected_revision": 0
        })
        check("Beta 尝试向 Alpha 的 Series 中注入剧集 -> 返回 404", st == 404, f"got status={st}")

        # Beta tries to access Alpha's Atelier project
        st, _ = http_req("GET", f"/atelier/projects/{alpha_atelier_id}", token=beta_token)
        check("Beta 尝试读取 Alpha 的 Atelier 画布 -> 返回 404", st == 404, f"got status={st}")

        st, _ = http_req("PUT", f"/atelier/projects/{alpha_atelier_id}", token=beta_token, body={
            "expected_revision": 0, "title": "Hacked Title"
        })
        check("Beta 尝试修改 Alpha 的 Atelier 画布 -> 返回 404", st == 404, f"got status={st}")

        st, _ = http_req("DELETE", f"/atelier/projects/{alpha_atelier_id}", token=beta_token, body={"expected_revision": 0})
        check("Beta 尝试删除 Alpha 的 Atelier 画布 -> 返回 404", st == 404, f"got status={st}")

        # -------------------------------------------------------------
        print("\n[测试阶段 6] 匿名越权访问防护测试")
        # -------------------------------------------------------------
        st, _ = http_req("GET", f"/projects/{alpha_proj_id}")
        check("匿名请求读取 Alpha Studio 项目 -> 返回 404", st == 404, f"got status={st}")

        st, _ = http_req("GET", f"/series/{alpha_series_id}")
        check("匿名请求读取 Alpha Series 系列 -> 返回 404", st == 404, f"got status={st}")

        st, _ = http_req("GET", f"/atelier/projects/{alpha_atelier_id}")
        check("匿名请求读取 Alpha Atelier 画布 -> 返回 404", st == 404, f"got status={st}")

        # -------------------------------------------------------------
        print("\n[测试阶段 7] 管理员个人工作区 vs 管理控制台全量视图")
        # -------------------------------------------------------------
        st, admin_personal = http_req("GET", "/projects/", token=admin_token)
        admin_personal_ids = [p["id"] for p in admin_personal]
        check("管理员个人创作空间未被 Alpha 或 Beta 的项目污染", alpha_proj_id not in admin_personal_ids and beta_proj_id not in admin_personal_ids, f"ids={admin_personal_ids}")

        st, admin_all = http_req("GET", "/projects/?all=true", token=admin_token)
        admin_all_ids = [p["id"] for p in admin_all]
        check("管理员在管理控制台（?all=true）可以统筹查看所有用户的项目", alpha_proj_id in admin_all_ids and beta_proj_id in admin_all_ids, f"ids={admin_all_ids}")

    finally:
        print("\n[清理阶段] 恢复测试环境数据...")
        cleanup(users, created_ids)
        print("  测试产生的数据与临时测试用户已清理完毕。")

    print("\n" + "=" * 70)
    print(f"  测试汇总: 共运行 {passed + failed} 项测试 | 通过: {passed} | 失败: {failed}")
    print("=" * 70)

    if failed > 0:
        sys.exit(1)

if __name__ == "__main__":
    run_tests()
