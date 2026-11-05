import pytest

from src.apps.atelier.paid_admission import (
    PaidAdmissionState,
    can_transition,
    query_identity_from_scope,
    recover_paid_admission,
    replay_paid_admission,
    require_shared_idempotency_key,
    require_transition,
    simulate_paid_admission,
)


def test_paid_admission_orders_receipt_reservation_and_submit():
    assert can_transition(PaidAdmissionState.ACCEPTED, PaidAdmissionState.RESERVATION_PENDING)
    assert can_transition(PaidAdmissionState.RESERVATION_PENDING, PaidAdmissionState.RESERVED)
    assert can_transition(PaidAdmissionState.RESERVED, PaidAdmissionState.SUBMIT_PENDING)
    assert can_transition(PaidAdmissionState.SUBMIT_PENDING, PaidAdmissionState.SUBMITTED)
    assert can_transition(PaidAdmissionState.SUBMITTED, PaidAdmissionState.HANDLE_SAVED)


def test_paid_admission_unknown_state_cannot_auto_resubmit_or_charge_again():
    assert can_transition(PaidAdmissionState.UNKNOWN, PaidAdmissionState.HANDLE_SAVED)
    assert can_transition(PaidAdmissionState.UNKNOWN, PaidAdmissionState.FAILED)
    assert not can_transition(PaidAdmissionState.UNKNOWN, PaidAdmissionState.SUBMIT_PENDING)
    assert not can_transition(PaidAdmissionState.UNKNOWN, PaidAdmissionState.RESERVATION_PENDING)


def test_paid_admission_releases_only_reserved_credits():
    assert can_transition(PaidAdmissionState.RESERVED, PaidAdmissionState.RELEASED)
    assert not can_transition(PaidAdmissionState.SUBMIT_PENDING, PaidAdmissionState.RELEASED)
    assert not can_transition(PaidAdmissionState.HANDLE_SAVED, PaidAdmissionState.RELEASED)


def test_invalid_paid_admission_transition_is_explicit():
    with pytest.raises(ValueError, match="paid_admission_invalid_transition"):
        require_transition(PaidAdmissionState.SUCCEEDED, PaidAdmissionState.SUBMIT_PENDING)


def test_simulated_paid_admission_saves_receipt_before_reservation_and_handle():
    events = []
    result = simulate_paid_admission(
        receipt_key="request-1",
        reservation_key="request-1",
        save_receipt=lambda: events.append("receipt"),
        reserve_credits=lambda: events.append("reserve") or "reservation-1",
        submit_provider=lambda: events.append("submit") or "provider-1",
        save_handle=lambda handle: events.append(f"handle:{handle}"),
        release_credits=lambda reservation: events.append(f"release:{reservation}"),
    )
    assert result.state is PaidAdmissionState.SUCCEEDED
    assert events == ["receipt", "reserve", "submit", "handle:provider-1"]


def test_simulated_submit_failure_is_unknown_and_not_released():
    events = []
    result = simulate_paid_admission(
        receipt_key="request-1",
        reservation_key="request-1",
        save_receipt=lambda: events.append("receipt"),
        reserve_credits=lambda: events.append("reserve") or "reservation-1",
        submit_provider=lambda: (_ for _ in ()).throw(RuntimeError("timeout")),
        save_handle=lambda handle: events.append("handle"),
        release_credits=lambda reservation: events.append("release"),
    )
    assert result.state is PaidAdmissionState.UNKNOWN
    assert events == ["receipt", "reserve"]

def test_receipt_and_credit_reservation_must_share_idempotency_key():
    require_shared_idempotency_key("request-1", "request-1")
    with pytest.raises(ValueError, match="idempotency_key_mismatch"):
        require_shared_idempotency_key("request-1", "request-2")
    with pytest.raises(ValueError, match="idempotency_key_mismatch"):
        require_shared_idempotency_key("", "")

def test_replay_reads_matching_receipt_and_reservation_without_side_effects():
    events = []
    result = replay_paid_admission(
        receipt_key="request-1",
        reservation_key="request-1",
        load_receipt=lambda: events.append("receipt") or {
            "request_fingerprint": "request-1",
            "reservation_id": "reservation-1",
            "provider_handle": "provider-1",
        },
        load_reservation=lambda: events.append("reservation") or {
            "idempotency_key": "request-1",
            "reservation_id": "reservation-1",
            "state": "succeeded",
        },
    )
    assert result.state is PaidAdmissionState.SUCCEEDED
    assert result.provider_handle == "provider-1"
    assert events == ["receipt", "reservation"]


def test_replay_rejects_mismatched_reservation_identity():
    with pytest.raises(ValueError, match="replay_reservation_mismatch"):
        replay_paid_admission(
            receipt_key="request-1",
            reservation_key="request-1",
            load_receipt=lambda: {"request_fingerprint": "request-1", "reservation_id": "r1"},
            load_reservation=lambda: {"idempotency_key": "request-1", "reservation_id": "r2", "state": "reserved"},
        )

def test_unknown_recovery_queries_existing_handle_without_resubmitting():
    calls = []
    result = recover_paid_admission(
        state=PaidAdmissionState.UNKNOWN,
        reservation_id="reservation-1",
        provider_handle="provider-1",
        query_identity={"provider": "dashscope", "account": "acct-1", "region": "cn", "workspace": "ws-1", "endpoint": "video"},
        query_provider=lambda handle, identity: calls.append((handle, identity)) or {"status": "succeeded"},
    )
    assert result.state is PaidAdmissionState.HANDLE_SAVED
    assert calls[0][0] == "provider-1"


def test_unknown_recovery_without_handle_stays_pending_confirmation():
    result = recover_paid_admission(
        state=PaidAdmissionState.UNKNOWN,
        reservation_id="reservation-1",
        provider_handle=None,
        query_identity=None,
        query_provider=None,
    )
    assert result.state is PaidAdmissionState.UNKNOWN
    assert result.error == "provider_query_identity_unavailable"

def test_query_identity_is_projected_from_persisted_provider_scope():
    identity = query_identity_from_scope({
        "provider": "dashscope",
        "account_identity": "acct-1",
        "region": "cn-beijing",
        "workspace_id": "ws-1",
        "base_url": "https://example.test",
    })
    assert identity == {
        "provider": "dashscope",
        "account": "acct-1",
        "region": "cn-beijing",
        "workspace": "ws-1",
        "endpoint": "https://example.test",
    }

def test_incomplete_historical_scope_cannot_be_repaired_from_defaults():
    with pytest.raises(ValueError, match="provider_query_identity_incomplete"):
        query_identity_from_scope({
            "provider": "dashscope",
            "region": "cn-beijing",
            "base_url": "https://example.test",
        })
