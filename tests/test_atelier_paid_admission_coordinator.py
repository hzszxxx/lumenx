from src.apps.atelier.paid_admission import PaidAdmissionState
from src.apps.atelier.paid_admission_coordinator import PaidAdmissionCoordinator


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
