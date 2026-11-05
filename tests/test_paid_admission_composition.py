import pytest

from src.apps.atelier.paid_admission import PaidAdmissionState
from src.apps.atelier.paid_admission_coordinator import PaidAdmissionIdentity
from src.apps.comic_gen.paid_admission_composition import (
    build_paid_admission_coordinator,
    make_identity_credit_reserver,
    make_paid_admission_request_resolver,
    make_platform_credit_reserver,
    resolve_paid_admission_coordinator,
)

def test_composition_factory_validates_owners_before_callbacks():
    events = []
    identity = PaidAdmissionIdentity("u1", "p1", "a1", "r1")
    coordinator = build_paid_admission_coordinator(
        identity=identity,
        actor_user_id="u1",
        project_owner_id="p1",
        attempt_owner_id="a1",
        save_receipt=lambda value: events.append(("receipt", value)),
        reserve_credits=lambda value: events.append(("reserve", value)) or "r1",
        submit_provider=lambda value: events.append(("submit", value)) or "h1",
        save_handle=lambda value, handle: events.append(("handle", value, handle)),
        release_credits=lambda reservation: None,
        load_receipt=lambda key: {"request_fingerprint": key, "reservation_id": "r1", "provider_handle": "h1"},
        load_reservation=lambda key: {"idempotency_key": key, "reservation_id": "r1", "state": "succeeded"},
        query_provider=lambda handle, scope: None,
    )
    assert coordinator.start_for_identity(identity).state is PaidAdmissionState.SUCCEEDED
    assert [event[0] for event in events] == ["receipt", "reserve", "submit", "handle"]
    assert all(event[1] is identity for event in events)


def test_composition_factory_rejects_wrong_authenticated_actor():
    identity = PaidAdmissionIdentity("u1", "p1", "a1", "r1")
    with pytest.raises(ValueError, match="ownership_mismatch"):
        build_paid_admission_coordinator(
            identity=identity,
            actor_user_id="u2",
            project_owner_id="p1",
            attempt_owner_id="a1",
            save_receipt=lambda value: None,
            reserve_credits=lambda value: "r1",
            submit_provider=lambda value: "h1",
            save_handle=lambda value, handle: None,
            release_credits=lambda reservation: None,
            load_receipt=lambda key: {},
            load_reservation=lambda key: {},
            query_provider=lambda handle, scope: None,
        )

def test_disabled_platform_does_not_resolve_coordinator():
    with pytest.raises(ValueError, match="platform_disabled"):
        resolve_paid_admission_coordinator(
            platform_enabled=False,
            actor_user_id="u1",
            identity=PaidAdmissionIdentity("u1", "p1", "a1", "r1"),
            project_owner_id="p1",
            attempt_owner_id="a1",
        )

def test_request_resolver_does_not_capture_identity_between_requests():
    seen = []
    def callbacks_factory(**context):
        seen.append(context["identity"])
        return {
            "save_receipt": lambda value: None,
            "reserve_credits": lambda value: "r1",
            "submit_provider": lambda value: "h1",
            "save_handle": lambda value, handle: None,
            "release_credits": lambda reservation: None,
            "load_receipt": lambda key: {},
            "load_reservation": lambda key: {},
            "query_provider": lambda handle, scope: None,
        }
    resolve = make_paid_admission_request_resolver(platform_enabled=True, callbacks_factory=callbacks_factory)
    identity = PaidAdmissionIdentity("u1", "p1", "a1", "r1")
    coordinator = resolve(actor_user_id="u1", identity=identity, project_owner_id="p1", attempt_owner_id="a1")
    assert coordinator.start_for_identity(identity).state is PaidAdmissionState.SUCCEEDED
    assert seen == [identity]

def test_identity_credit_reserver_passes_user_attempt_and_request_key():
    calls = []
    reserve = make_identity_credit_reserver(lambda user_id, attempt_id, request_key: calls.append((user_id, attempt_id, request_key)) or "reservation-1")
    identity = PaidAdmissionIdentity("u1", "p1", "a1", "request-1")
    assert reserve(identity) == "reservation-1"
    assert calls == [("u1", "a1", "request-1")]

def test_platform_credit_adapter_validates_actor_and_reservation_result():
    calls = []
    reserve = make_platform_credit_reserver(
        actor_for_user=lambda user_id: {"id": user_id},
        reserve_credits=lambda actor, amount, generation_id, pricing, key: calls.append((actor, amount, generation_id, pricing, key)) or {"reservation_id": "r1"},
        estimated_credits=12,
        pricing_version="pricing-v1",
    )
    identity = PaidAdmissionIdentity("u1", "p1", "a1", "request-1")
    assert reserve(identity) == "r1"
    assert calls == [({"id": "u1"}, 12, "a1", "pricing-v1", "request-1")]

def test_platform_credit_adapter_uses_real_service_reservation(tmp_path):
    from src.apps.platform.config import PlatformConfig
    from src.apps.platform.service import PlatformService

    svc = PlatformService(PlatformConfig(enabled=True, database_url=f"sqlite:///{tmp_path / 'platform.db'}"))
    admin = svc.register("admin", "a" * 12, role="admin")
    actor = svc.register("user", "b" * 12)
    svc.grant_credits(admin, actor["id"], 20, "test", "grant-real-1")
    reserve = make_platform_credit_reserver(
        actor_for_user=lambda user_id: actor if user_id == actor["id"] else {"id": user_id},
        reserve_credits=lambda *args: svc.reserve_credits(*args),
        estimated_credits=5,
        pricing_version="pricing-test-v1",
    )
    identity = PaidAdmissionIdentity(actor["id"], "project-1", "attempt-1", "request-real-1")
    assert reserve(identity)
