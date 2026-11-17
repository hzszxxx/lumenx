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
