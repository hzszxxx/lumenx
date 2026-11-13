import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.core.compute_routing import (
    ComputeStage,
    PostOperation,
    RouteAdmissionRequest,
    RouteResolutionError,
    ShotRoutingRequest,
    ShotType,
    Urgency,
    default_compute_route_resolver,
)
from src.apps.atelier.models import AtelierNode
from src.apps.comic_gen.models import StoryboardFrame
from src.apps.comic_gen.api import router as studio_router


@pytest.fixture()
def resolver():
    return default_compute_route_resolver()


def request(**overrides):
    value = {
        "stage": ComputeStage.FINAL,
        "shot_type": ShotType.CONSISTENCY_LONG,
        "urgency": Urgency.HIGH,
        "duration_sec": 10.0,
    }
    value.update(overrides)
    return ShotRoutingRequest(**value)


def test_draft_route_uses_self_hosted_model_by_content(resolver):
    silent = resolver.resolve(request(stage=ComputeStage.DRAFT, has_dialogue=False, has_audio=False))
    dialogue = resolver.resolve(request(stage=ComputeStage.DRAFT, has_dialogue=True))
    assert (silent.provider, silent.model) == ("xiangong", "wan22_selfhost")
    assert (dialogue.provider, dialogue.model) == ("xiangong", "minimax_h3_selfhost")
    assert silent.est_cost_cny == 0
    assert dialogue.audio is True


def test_high_urgency_filler_avoids_libtv(resolver):
    decision = resolver.resolve(request(shot_type=ShotType.FILLER, urgency=Urgency.HIGH))
    assert (decision.provider, decision.model, decision.resolution) == ("bailian", "wan3", "480p")
    assert decision.promo is False


def test_low_urgency_promo_is_opt_in_and_excludes_hero(resolver):
    promo = resolver.resolve(
        request(shot_type=ShotType.ACTION_HARD, urgency=Urgency.LOW, prefer_libtv_promo=True)
    )
    hero = resolver.resolve(
        request(shot_type=ShotType.HERO_COVER, urgency=Urgency.LOW, prefer_libtv_promo=True)
    )
    assert (promo.provider, promo.model, promo.promo) == ("libtv", "seedance25", True)
    assert promo.est_cost_cny == round((10 + 2) * 0.16 * 1.5, 2)
    assert (hero.provider, hero.model, hero.resolution) == ("volcengine_ark", "seedance25", "1080p")
    assert hero.promo is False


def test_dialogue_closeup_upgrades_to_2k_and_converts_usd_price(resolver):
    decision = resolver.resolve(
        request(shot_type=ShotType.DIALOGUE_AV, closeup_or_hero=True, urgency=Urgency.HIGH, duration_sec=8)
    )
    assert (decision.provider, decision.model, decision.resolution) == ("minimax", "minimax_h3_hosted", "2k")
    assert decision.est_cost_cny == round((8 + 2) * 0.13 * 7.15 * 1.5, 2)


def test_post_route_is_non_generation_cost_and_supports_operations(resolver):
    upscale = resolver.resolve(request(stage=ComputeStage.POST, post_operation=PostOperation.UPSCALE))
    interpolate = resolver.resolve(
        request(stage=ComputeStage.POST, post_operation=PostOperation.FRAME_INTERPOLATION)
    )
    assemble = resolver.resolve(request(stage=ComputeStage.POST, post_operation=PostOperation.ASSEMBLY))
    assert (upscale.provider, upscale.model, upscale.resolution) == ("xiangong", "SeedVR2 (7B Sharp)", "1080p")
    assert (interpolate.provider, interpolate.model) == ("xiangong", "RIFE")
    assert (assemble.provider, assemble.model) == ("local", "local-assembly")
    assert upscale.est_cost_cny == interpolate.est_cost_cny == assemble.est_cost_cny == 0


def test_route_admission_enforces_requested_route_and_batch_budget(resolver):
    admission = resolver.admit(RouteAdmissionRequest(
        routing=request(shot_type=ShotType.CONSISTENCY_LONG, duration_sec=10),
        batch_size=2,
        budget_cny=25,
        requested_provider="bailian",
        requested_model="wan3",
        requested_resolution="720p",
    ))
    assert admission.estimated_total_cny == round(12 * 0.60 * 1.5 * 2, 2)
    assert admission.remaining_cny == round(25 - admission.estimated_total_cny, 2)

    with pytest.raises(RouteResolutionError, match="exceeds budget") as budget_error:
        resolver.admit(RouteAdmissionRequest(
            routing=request(shot_type=ShotType.CONSISTENCY_LONG, duration_sec=10),
            batch_size=2,
            budget_cny=1,
        ))
    assert budget_error.value.code == "route_budget_exceeded"

    with pytest.raises(RouteResolutionError) as mismatch_error:
        resolver.admit(RouteAdmissionRequest(
            routing=request(shot_type=ShotType.CONSISTENCY_LONG, duration_sec=10),
            batch_size=1,
            budget_cny=20,
            requested_provider="minimax",
        ))
    assert mismatch_error.value.code == "route_request_mismatch"


def test_route_request_is_strict_and_requires_positive_duration():
    with pytest.raises(ValueError):
        ShotRoutingRequest(
            stage="final",
            shot_type="filler",
            urgency="low",
            duration_sec=0,
            unknown=True,
        )


def test_storyboard_and_atelier_nodes_have_backward_compatible_route_tags():
    frame = StoryboardFrame(id="frame-1", scene_id="scene-1")
    node = AtelierNode(id="node-1", project_id="atelier-1")
    assert (frame.shot_type, frame.urgency, frame.stage) == ("consistency_long", "low", "draft")
    assert (node.shot_type, node.urgency, node.stage) == ("consistency_long", "low", "draft")
    assert StoryboardFrame(id="frame-2", scene_id="scene-2", shot_type="hero_cover", urgency="high", stage="final").stage == "final"
    with pytest.raises(ValueError):
        StoryboardFrame(id="frame-3", scene_id="scene-3", shot_type="unsupported")


def test_studio_route_preview_is_read_only_http_contract():
    class Pipeline:
        def read_committed_script(self, script_id):
            if script_id != "project-1":
                raise ValueError("missing")
            return type("Script", (), {"frames": [StoryboardFrame(id="frame-1", scene_id="scene-1")]})()

    app = FastAPI()
    app.include_router(studio_router)
    app.state.pipeline = Pipeline()
    response = TestClient(app).post(
        "/projects/project-1/frames/frame-1/compute_route",
        json={
            "stage": "final",
            "shot_type": "hero_cover",
            "urgency": "low",
            "duration_sec": 6,
            "prefer_libtv_promo": True,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert (body["provider"], body["model"], body["resolution"]) == ("volcengine_ark", "seedance25", "1080p")
    assert body["est_cost_cny"] == round((6 + 2) * 3.74 * 1.5, 2)


def test_studio_route_admission_is_read_only_and_returns_budget_receipt():
    class Pipeline:
        def read_committed_script(self, script_id):
            if script_id != "project-1":
                raise ValueError("missing")
            return type("Script", (), {"frames": [StoryboardFrame(id="frame-1", scene_id="scene-1")]})()

    app = FastAPI()
    app.include_router(studio_router)
    app.state.pipeline = Pipeline()
    response = TestClient(app).post(
        "/projects/project-1/frames/frame-1/compute_route/admission",
        json={
            "routing": {
                "stage": "final",
                "shot_type": "consistency_long",
                "urgency": "high",
                "duration_sec": 6,
            },
            "batch_size": 2,
            "budget_cny": 30,
            "requested_provider": "bailian",
            "requested_model": "wan3",
            "requested_resolution": "720p",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["route"]["rule_id"] == "final.consistency_long"
    assert body["estimated_total_cny"] == round((6 + 2) * 0.60 * 1.5 * 2, 2)
    assert body["remaining_cny"] == round(30 - body["estimated_total_cny"], 2)
