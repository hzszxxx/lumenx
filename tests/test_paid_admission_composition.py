import pytest

from src.apps.atelier.paid_admission import PaidAdmissionState
from src.apps.atelier.paid_admission_coordinator import PaidAdmissionIdentity
from src.apps.comic_gen.paid_admission_composition import (
    build_paid_admission_coordinator,
    make_identity_credit_reserver,
    make_paid_admission_request_resolver,
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
