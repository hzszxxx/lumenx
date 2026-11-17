from pathlib import Path
import pytest
from src.apps.platform.config import PlatformConfig
from src.apps.platform.service import PlatformService, PlatformError

@pytest.fixture
def service(tmp_path: Path) -> PlatformService:
    return PlatformService(PlatformConfig(enabled=True, database_url=f"sqlite:///{tmp_path / 'platform.db'}"))

def test_agent_purchase_invites_and_student_attribution(service: PlatformService):
    admin = service.register("admin_user", "AdminSecretPass123!", role="admin")

    # 1. Register agent (institution)
    agent = service.register("star_academy", "AcademyPass123!", role="agent")
    assert agent["role"] == "agent"

    # 2. Get profile and update institution details
    profile = service.get_agent_profile(agent)
    assert profile["user_id"] == agent["id"]
    assert profile["agency_type"] == "individual"

    updated_profile = service.upsert_agent_profile(
        agent,
        agency_type="institution",
        institution_name="星火数字艺术学院",
        contact_name="王老师",
        contact_phone="13800138000",
    )
    assert updated_profile["agency_type"] == "institution"
    assert updated_profile["institution_name"] == "星火数字艺术学院"

    # 3. Agent purchases batch of 10 invites
    purchase_res = service.purchase_agent_invites(
        agent,
        quantity=10,
        title="2026春季实战班第一期",
    )
    batch = purchase_res["batch"]
    codes = purchase_res["codes"]
    assert batch["quantity"] == 10
    assert len(codes) == 10
    assert batch["total_price_cents"] == 4000 * 10  # 10 codes tier = 4000 cents each

    # 4. Check agent's batch and invite listings
    batches = service.list_agent_batches(agent)
    assert len(batches) == 1
    assert batches[0]["title"] == "2026春季实战班第一期"

    agent_invites = service.list_agent_invites(agent)
    assert len(agent_invites) == 10
    first_code = agent_invites[0]["code"]
    first_invite_id = agent_invites[0]["id"]

    # 5. Agent updates student note on first invite
    service.update_agent_invite_note(agent, first_invite_id, "学员-李华")
    refreshed_invites = service.list_agent_invites(agent)
    matched = [inv for inv in refreshed_invites if inv["id"] == first_invite_id][0]
    assert matched["student_note"] == "学员-李华"

    # 6. Student registers with the first code
    student = service.register(
        username="student_lihua",
        password="StudentPass123!",
        email="lihua@example.com",
        invite_code=first_code,
    )
    assert student["id"] is not None

    # 7. Verify student attribution in agent_students
    students = service.list_agent_students(agent)
    assert len(students) == 1
    assert students[0]["student_username"] == "student_lihua"
    assert students[0]["invite_code"] == first_code
    assert students[0]["batch_title"] == "2026春季实战班第一期"

    # 8. Profile metrics updated
    metrics = service.get_agent_profile(agent)["metrics"]
    assert metrics["purchased_invites"] == 10
    assert metrics["used_invites"] == 1
    assert metrics["remaining_invites"] == 9
    assert metrics["total_students"] == 1

    # 9. Admin lists agents and updates discount rate
    admin_agents = service.admin_list_agents(admin)
    assert len(admin_agents) >= 1
    target = [a for a in admin_agents if a["id"] == agent["id"]][0]
    assert target["institution_name"] == "星火数字艺术学院"

    # Admin grants 20% discount (discount_rate = 0.8)
    service.upsert_agent_profile(
        admin,
        agency_type="institution",
        discount_rate=0.8,
        target_user_id=agent["id"],
    )

    # 10. Agent purchases with discount
    discount_res = service.purchase_agent_invites(agent, quantity=10, title="第二期折后采购")
    # Base 4000 * 0.8 = 3200 cents each, total = 32000
    assert discount_res["batch"]["unit_price_cents"] == 3200
    assert discount_res["batch"]["total_price_cents"] == 32000


def test_agent_api_endpoints(tmp_path: Path):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from src.apps.platform.api import router

    app = FastAPI()
    app.include_router(router, prefix="/api/platform")
    svc = PlatformService(PlatformConfig(enabled=True, database_url=f"sqlite:///{tmp_path / 'platform.db'}"))
    app.state.platform_service = svc

    admin = svc.register("admin_boss", "AdminPass12345!", role="admin")
    agent = svc.register("partner_org", "PartnerPass123!", role="agent")

    client = TestClient(app)
    admin_token = client.post("/api/platform/auth/login", json={"username": "admin_boss", "password": "AdminPass12345!"}).json()["access_token"]
    agent_token = client.post("/api/platform/auth/login", json={"username": "partner_org", "password": "PartnerPass123!"}).json()["access_token"]
    admin_hdr = {"Authorization": f"Bearer {admin_token}"}
    agent_hdr = {"Authorization": f"Bearer {agent_token}"}

    # 1. Get agent profile
    prof_res = client.get("/api/platform/agent/profile", headers=agent_hdr)
    assert prof_res.status_code == 200
    assert prof_res.json()["user_id"] == agent["id"]

    # 2. Update agent profile
    update_res = client.put(
        "/api/platform/agent/profile",
        headers=agent_hdr,
        json={"agency_type": "institution", "institution_name": "创新影视工坊", "contact_name": "张总监", "contact_phone": "13912345678"},
    )
    assert update_res.status_code == 200
    assert update_res.json()["institution_name"] == "创新影视工坊"

    # 3. Purchase invites via API
    purchase_res = client.post(
        "/api/platform/agent/invites/purchase",
        headers=agent_hdr,
        json={"quantity": 5, "title": "影视工坊一期实训营"},
    )
    assert purchase_res.status_code == 200
    data = purchase_res.json()
    assert len(data["codes"]) == 5
    first_code = data["codes"][0]["code"]
    first_invite_id = data["codes"][0]["id"]

    # 4. List agent invites and batches
    invites_res = client.get("/api/platform/agent/invites", headers=agent_hdr)
    assert invites_res.status_code == 200
    assert len(invites_res.json()) == 5

    # 5. Update note
    patch_note = client.patch(
        f"/api/platform/agent/invites/{first_invite_id}/note",
        headers=agent_hdr,
        json={"student_note": "VIP学员-赵六"},
    )
    assert patch_note.status_code == 200

    # 6. Student registers using first_code
    reg_res = client.post(
        "/api/platform/auth/register",
        json={"username": "student_zhaoliu", "password": "StudentPass666!", "invite_code": first_code},
    )
    assert reg_res.status_code == 200

    # 7. List students
    students_res = client.get("/api/platform/agent/students", headers=agent_hdr)
    assert students_res.status_code == 200
    assert len(students_res.json()) == 1
    assert students_res.json()[0]["student_username"] == "student_zhaoliu"

    # 8. Admin list agents
    admin_agents = client.get("/api/platform/admin/agents", headers=admin_hdr)
    assert admin_agents.status_code == 200
    assert len(admin_agents.json()) >= 1


def test_lifetime_commission_automatic_settlement_and_admin_config(service: PlatformService):
    admin = service.register("admin_master", "MasterPass123!", role="admin")
    agent = service.register("top_agent", "AgentPass123!", role="agent")

    # Verify default commission_rate is 0.01 (1%)
    prof = service.get_agent_profile(agent)
    assert prof["commission_rate"] == 0.01

    # Agent purchases 5 invites
    res = service.purchase_agent_invites(agent, quantity=5, title="特训营")
    code = res["codes"][0]["code"]

    # Student registers with this code
    student = service.register("student_tom", "TomPassword123!", invite_code=code)

    # 1. First consumption: 10000 cents (100 RMB) -> 1% default = 100 cents
    comm1 = service.record_user_consumption(
        student_user_id=student["id"],
        amount_cents=10000,
        source_type="ai_generation",
        source_id="task-001",
        description="电影分镜渲染",
    )
    assert comm1 is not None
    assert comm1["agent_id"] == agent["id"]
    assert comm1["commission_rate"] == 0.01
    assert comm1["commission_cents"] == 100

    # Verify ledger credit
    agent_prof = service.get_agent_profile(agent)
    assert agent_prof["metrics"]["total_commissions_cents"] == 100

    # Check commission list
    comms = service.list_agent_commissions(agent)
    assert len(comms) == 1
    assert comms[0]["student_username"] == "student_tom"
    assert comms[0]["amount_cents"] == 10000
    assert comms[0]["commission_cents"] == 100

    # 2. Admin adjusts agent commission rate to 5% (0.05)
    updated_prof = service.upsert_agent_profile(
        admin,
        agency_type="institution",
        commission_rate=0.05,
        target_user_id=agent["id"],
    )
    assert updated_prof["commission_rate"] == 0.05

    # 3. Subsequent consumption: 20000 cents (200 RMB) -> 5% = 1000 cents
    comm2 = service.record_user_consumption(
        student_user_id=student["id"],
        amount_cents=20000,
        source_type="recharge",
        source_id="order-002",
        description="算力包充值",
    )
    assert comm2 is not None
    assert comm2["commission_rate"] == 0.05
    assert comm2["commission_cents"] == 1000

    # Check updated total
    agent_prof2 = service.get_agent_profile(agent)
    assert agent_prof2["metrics"]["total_commissions_cents"] == 1100

    # Admin list agents verifies total_commissions_cents and commission_rate
    admin_agents = service.admin_list_agents(admin)
    target = [a for a in admin_agents if a["id"] == agent["id"]][0]
    assert target["commission_rate"] == 0.05
    assert target["total_commissions_cents"] == 1100


def test_agent_commissions_api(tmp_path: Path):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from src.apps.platform.api import router

    app = FastAPI()
    app.include_router(router, prefix="/api/platform")
    svc = PlatformService(PlatformConfig(enabled=True, database_url=f"sqlite:///{tmp_path / 'platform.db'}"))
    app.state.platform_service = svc

    admin = svc.register("super_admin", "SuperAdmin123!", role="admin")
    agent = svc.register("partner_agent", "PartnerAgent123!", role="agent")

    client = TestClient(app)
    admin_token = client.post("/api/platform/auth/login", json={"username": "super_admin", "password": "SuperAdmin123!"}).json()["access_token"]
    agent_token = client.post("/api/platform/auth/login", json={"username": "partner_agent", "password": "PartnerAgent123!"}).json()["access_token"]
    admin_hdr = {"Authorization": f"Bearer {admin_token}"}
    agent_hdr = {"Authorization": f"Bearer {agent_token}"}

    # Purchase code & register student
    buy = client.post("/api/platform/agent/invites/purchase", headers=agent_hdr, json={"quantity": 1, "title": "班级码"}).json()
    code = buy["codes"][0]["code"]

    student = svc.register("student_mary", "MaryPass12345!", invite_code=code)

    # Record consumption via API
    cons_res = client.post(
        "/api/platform/agent/consumption",
        headers=admin_hdr,
        json={"student_user_id": student["id"], "amount_cents": 5000, "source_type": "subscription", "description": "月度VIP"},
    )
    assert cons_res.status_code == 200
    assert cons_res.json()["commission_cents"] == 50  # 1% of 5000

    # Agent checks commissions list
    list_res = client.get("/api/platform/agent/commissions", headers=agent_hdr)
    assert list_res.status_code == 200
    items = list_res.json()
    assert len(items) == 1
    assert items[0]["student_username"] == "student_mary"
    assert items[0]["commission_cents"] == 50


def test_registration_invite_toggle_service(tmp_path: Path):
    svc = PlatformService(PlatformConfig(enabled=True, database_url=f"sqlite:///{tmp_path / 'platform.db'}", registration_invite_required=False))
    admin = svc.register("admin_toggle", "TogglePass1234!", role="admin")

    # 1. Admin turns on invite requirement
    res1 = svc.set_registration_invite_required(admin, True)
    assert res1 is True
    assert svc.is_registration_invite_required() is True

    # With invite_required=True, registering without invite code fails
    with pytest.raises(PlatformError) as exc:
        svc.register("user_no_invite", "UserPass12345!")
    assert exc.value.code == "invite_required"

    # 2. Admin toggles invite requirement to False
    res2 = svc.set_registration_invite_required(admin, False)
    assert res2 is False
    assert svc.is_registration_invite_required() is False

    # 3. Registering without invite code now succeeds
    open_user = svc.register("user_no_invite", "UserPass12345!")
    assert open_user["username"] == "user_no_invite"

    # 4. Agent invite code can still be used and bound even in open registration mode
    agent = svc.register("agent_school", "SchoolPass1234!", role="agent")
    batch = svc.purchase_agent_invites(agent, quantity=1, title="开放期测试")
    code = batch["codes"][0]["code"]

    bound_user = svc.register("user_with_invite", "UserPass12345!", invite_code=code)
    students = svc.list_agent_students(agent)
    assert len(students) == 1
    assert students[0]["student_username"] == "user_with_invite"

    # 5. Admin toggles invite requirement back to True
    res3 = svc.set_registration_invite_required(admin, True)
    assert res3 is True
    assert svc.is_registration_invite_required() is True

    # 6. Once again, registering without code is rejected
    with pytest.raises(PlatformError) as exc2:
        svc.register("user_blocked", "UserPass12345!")
    assert exc2.value.code == "invite_required"


def test_registration_invite_toggle_api(tmp_path: Path):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from src.apps.platform.api import router

    app = FastAPI()
    app.include_router(router, prefix="/api/platform")
    svc = PlatformService(PlatformConfig(enabled=True, database_url=f"sqlite:///{tmp_path / 'platform.db'}", registration_invite_required=False))
    app.state.platform_service = svc

    admin = svc.register("admin_switch", "AdminSwitchPass1!", role="admin")
    client = TestClient(app)
    admin_token = client.post("/api/platform/auth/login", json={"username": "admin_switch", "password": "AdminSwitchPass1!"}).json()["access_token"]
    admin_hdr = {"Authorization": f"Bearer {admin_token}"}

    # Public config returns false initially
    pub_cfg = client.get("/api/platform/auth/config").json()
    assert pub_cfg["registration_invite_required"] is False

    # Admin reads settings
    adm_cfg = client.get("/api/platform/admin/settings", headers=admin_hdr).json()
    assert adm_cfg["registration_invite_required"] is False

    # Admin toggles to true
    patch_res = client.post("/api/platform/admin/settings/registration-invite", headers=admin_hdr, json={"required": True})
    assert patch_res.status_code == 200
    assert patch_res.json()["registration_invite_required"] is True

    # Public config now reflects true
    pub_cfg2 = client.get("/api/platform/auth/config").json()
    assert pub_cfg2["registration_invite_required"] is True

    # Registration without invite fails
    fail_res = client.post("/api/platform/auth/register", json={"username": "blocked_user", "password": "BlockedPassword123!"})
    assert fail_res.status_code == 422
    assert fail_res.json()["detail"]["code"] == "invite_required"

    # Admin toggles back to false
    patch_res2 = client.post("/api/platform/admin/settings/registration-invite", headers=admin_hdr, json={"required": False})
    assert patch_res2.status_code == 200
    assert patch_res2.json()["registration_invite_required"] is False

    # Registration without code now succeeds
    reg_res = client.post("/api/platform/auth/register", json={"username": "free_user", "password": "FreeUserPassword123!"})
    assert reg_res.status_code == 200
    assert reg_res.json()["username"] == "free_user"


def test_user_registration_source_tracking(tmp_path: Path):
    db_file = tmp_path / "platform.db"
    service = PlatformService(PlatformConfig(enabled=True, database_url=f"sqlite:///{db_file}", registration_invite_required=False))

    admin = service.register("admin_src", "AdminSrcPass123!", role="admin")
    agent = service.register("agent_src", "AgentSrcPass123!", role="agent")
    service.upsert_agent_profile(agent, agency_type="institution", institution_name="超影艺术学院")

    # 1. Open registration user (no invite code)
    open_user = service.register("open_user", "OpenUserPass123!")

    # 2. Agent invite registered user
    batch = service.purchase_agent_invites(agent, quantity=2, title="秋季班")
    agent_code = batch["codes"][0]["code"]
    agent_student = service.register("student_src", "StudentSrcPass123!", invite_code=agent_code)

    # 3. Admin invite registered user
    adm_invite = service.create_registration_invite(admin)
    admin_user = service.register("admin_invited", "AdminInvPass123!", invite_code=adm_invite["code"])

    # 4. Check admin_users query
    admin_res = service.admin_users(admin)
    items = {item["username"]: item for item in admin_res["items"]}

    assert items["open_user"]["registration_source"] == "open"
    assert items["open_user"]["registered_invite_code"] is None
    assert items["open_user"]["inviter_name"] is None

    assert items["student_src"]["registration_source"] == "agent"
    assert items["student_src"]["registered_invite_code"] == agent_code
    assert items["student_src"]["inviter_user_id"] == agent["id"]
    assert items["student_src"]["inviter_name"] == "超影艺术学院"

    assert items["admin_invited"]["registration_source"] == "admin"
    assert items["admin_invited"]["registered_invite_code"] == adm_invite["code"]
    assert items["admin_invited"]["inviter_user_id"] == admin["id"]




