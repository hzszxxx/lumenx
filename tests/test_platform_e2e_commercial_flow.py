import pytest
import json
from datetime import datetime, timedelta, timezone
from src.apps.platform.config import PlatformConfig
from src.apps.platform.service import PlatformService, PlatformError


def test_commercial_full_lifecycle_e2e(tmp_path):
    """
    End-to-End full lifecycle verification:
    1. Client/Admin creates structured commercial task with milestone & copyright specs
    2. Uncertified creator attempt to claim is rejected
    3. Creator undergoes certification exam and passes
    4. Certified creator claims task -> triggers electronic contract signing with SHA256 digest
    5. Creator and client inspect signed contract with digest and NDA clauses
    6. Creator delivers completed video artifact with anti-theft watermark snapshot
    7. Client reviews and accepts delivery -> task transitions to settled
    8. Creator's simulated wallet automatically receives bounty settlement cents
    """
    db_path = tmp_path / "platform_e2e.db"
    svc = PlatformService(PlatformConfig(enabled=True, database_url=f"sqlite:///{db_path}"))

    # Actors
    admin = svc.register("admin_user", "AdminSecret123!", role="admin")
    client = svc.register("brand_client", "ClientSecret123!", role="client")
    creator = svc.register("pro_director", "CreatorSecret123!", role="creator")

    # 1. Client creates structured commercial demand
    deadline = (datetime.now(timezone.utc) + timedelta(days=14)).isoformat()
    milestone_specs = [
        {"title": "第一阶段：分镜线稿与3D白模确认", "percentage": 40, "amount_cents": 200000},
        {"title": "第二阶段：次世代高清视频成片终审交付", "percentage": 60, "amount_cents": 300000},
    ]
    deliverable_specs = {
        "resolution": "4K UHD (3840x2160)",
        "aspect_ratio": "16:9",
        "format": "MP4 (ProRes / H.265)",
        "duration_seconds": 60,
        "anti_theft_watermark": True,
    }
    copyright_terms = {
        "commercial_use": "全渠道商业买断（含信息流广告投放与院线展示）",
        "creator_credit": "正片片尾保留导演署名权，创作者享有非商用作品集展示权",
    }

    task_payload = {
        "title": "《未来机甲：深空启航》影视级先导预告片",
        "category": "ai_drama",
        "demand_type": "ai_drama",
        "brief_markdown": "### 制作要求\n需要依据3D白模走廊与机甲设定，完成60秒连贯影视级运镜成片。",
        "bounty_cents": 500000,
        "deadline": deadline,
        "status": "published",
        "deliverable_specs_json": deliverable_specs,
        "milestone_specs_json": milestone_specs,
        "copyright_terms_json": copyright_terms,
        "client_name": "星际影业",
        "level_tier": "pro",
    }
    task = svc.create_task(client, task_payload)
    assert task["id"] is not None
    assert task["demand_type"] == "ai_drama"
    assert task["bounty_cents"] == 500000

    # 2. Creator uncertified -> claim rejected
    with pytest.raises(PlatformError) as exc_info:
        svc.claim_task(creator, task["id"], "idem-claim-fail")
    assert exc_info.value.code == "creator_not_certified"

    # 3. Creator takes certification exam and passes
    exam = svc.create_exam(admin, "影视级镜头动量与透视控制考核", "1")
    exam_artifact = {
        "product": "atelier",
        "artifact_id": "exam-shot-1",
        "artifact_version": "v1.0.0",
        "sha256": "1" * 64,
        "media_type": "video/mp4",
        "project_id": "proj-exam",
        "project_title_snapshot": "考核分镜成片",
        "title": "考核提交作品",
    }
    app = svc.apply_certification(creator, {"exam_id": exam["id"], "artifact": exam_artifact})
    cert_res = svc.review_certification(admin, app["id"], True, 98, "镜头节奏掌控极佳，透视与光影严谨，准予S级商业签约认证")
    assert cert_res["status"] == "certified"

    # 4. Creator claims task -> signs electronic contract
    claim_res = svc.claim_task(creator, task["id"], "idem-claim-success")
    assert claim_res["status"] == "claimed"
    assert claim_res["contract_id"] == f"contract-{task['id']}"
    assert len(claim_res["digest_hash"]) == 64

    # 5. Creator views signed electronic contract
    contract = svc.get_task_contract(creator, task["id"])
    assert contract["status"] == "signed"
    assert contract["signer_name"] == "pro_director"
    assert contract["digest_hash"] == claim_res["digest_hash"]
    assert "保密协议" in contract["terms"]["title"]

    # 6. Creator starts task and delivers finished work with watermark
    svc.start_task(creator, task["id"])
    delivery_artifact = {
        "product": "atelier",
        "artifact_id": "delivery-artifact-final",
        "artifact_version": "v1.0.0",
        "sha256": "f" * 64,
        "media_type": "video/mp4",
        "project_id": "proj-future-mecha",
        "project_title_snapshot": "《未来机甲：深空启航》终审样片",
        "title": "终审正片（含影伴防盗暗水印）",
        "delivery_note": "已根据3D白模机位严格还原，分镜与材质达到4K超写实画质，附带白模卷帘对比报告，请查收验收。",
    }
    delivery = svc.deliver_task(creator, task["id"], delivery_artifact)
    assert delivery["status"] == "delivered"
    assert delivery["version_num"] == 1

    # 7. Client reviews and accepts
    review_res = svc.review_task(client, task["id"], True, "画面质感出众，符合Brief要求，准予验收放款！")
    assert review_res["status"] == "settled"

    # 8. Wallet settlement balance verification
    creator_wallet = svc.wallet(creator)
    assert creator_wallet["simulated_balance_cents"] == 500000

    txs = svc.transactions(creator)
    assert len(txs) == 1
    assert txs[0]["amount_cents"] == 500000
    assert txs[0]["direction"] == "credit"
    assert txs[0]["reference_type"] == "task"
    assert txs[0]["reference_id"] == task["id"]
