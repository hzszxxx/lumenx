from src.apps.atelier.paid_admission import PaidAdmissionState
from src.apps.atelier.paid_admission_coordinator import PaidAdmissionCoordinator, PaidAdmissionIdentity


def coordinator(events):
    return PaidAdmissionCoordinator(
        save_receipt=lambda key: events.append(("receipt", key)),
        reserve_credits=lambda key: events.append(("reserve", key)) or "reservation-1",
        submit_provider=lambda key: events.append(("submit", key)) or "provider-1",
        save_handle=lambda key, handle: events.append(("handle", key, handle)),
        release_credits=lambda reservation: events.append(("release", reservation)),
        load_receipt=lambda key: {"request_fingerprint": key, "reservation_id": "reservation-1", "provider_handle": "provider-1"},
        load_reservation=lambda key: {"idempotency_key": key, "reservation_id": "reservation-1", "state": "succeeded"},
        query_provider=lambda handle, identity: {"handle": handle, "identity": identity, "status": "succeeded"},
    )


def test_coordinator_uses_injected_callbacks_in_durable_order():
    events = []
    result = coordinator(events).start(request_key="request-1")
    assert result.state is PaidAdmissionState.SUCCEEDED
    assert events == [
        ("receipt", "request-1"),
        ("reserve", "request-1"),
        ("submit", "request-1"),
        ("handle", "request-1", "provider-1"),
    ]


def test_coordinator_replay_uses_reads_only():
    events = []
    result = coordinator(events).replay(request_key="request-1")
    assert result.state is PaidAdmissionState.SUCCEEDED
    assert result.provider_handle == "provider-1"
    assert events == []


def test_coordinator_unknown_recovery_uses_query_callback_only():
    events = []
    result = coordinator(events).recover_unknown(
        state=PaidAdmissionState.UNKNOWN,
        reservation_id="reservation-1",
        provider_handle="provider-1",
        query_identity={"provider": "p", "account": "a", "region": "r", "workspace": "w", "endpoint": "e"},
    )
    assert result.state is PaidAdmissionState.HANDLE_SAVED
    assert result.provider_handle["status"] == "succeeded"
    assert events == []


def test_identity_contract_requires_user_project_attempt_and_request():
    events = []
    result = coordinator(events).start_for_identity(PaidAdmissionIdentity(
        user_id="user-1", project_id="project-1", attempt_id="attempt-1", request_key="request-1",
    ))
    assert result.state is PaidAdmissionState.SUCCEEDED
    import pytest
    with pytest.raises(ValueError, match="identity_incomplete"):
        PaidAdmissionIdentity(user_id="", project_id="project-1", attempt_id="attempt-1", request_key="request-1")

def test_identity_callbacks_receive_full_ownership_contract():
    events = []
    identity = PaidAdmissionIdentity("u1", "p1", "a1", "r1")
    coordinator_instance = PaidAdmissionCoordinator(
        save_receipt=lambda key: None,
        reserve_credits=lambda key: "unused",
        submit_provider=lambda key: None,
        save_handle=lambda key, handle: None,
        release_credits=lambda reservation: None,
        load_receipt=lambda key: {},
        load_reservation=lambda key: {},
        query_provider=lambda handle, scope: None,
        save_receipt_for_identity=lambda value: events.append(("receipt", value)),
        reserve_credits_for_identity=lambda value: events.append(("reserve", value)) or "r1",
        submit_provider_for_identity=lambda value: events.append(("submit", value)) or "h1",
        save_handle_for_identity=lambda value, handle: events.append(("handle", value, handle)),
    )
    coordinator_instance.start_for_identity(identity)
    assert [event[0] for event in events] == ["receipt", "reserve", "submit", "handle"]
    assert all(event[1] is identity for event in events)
