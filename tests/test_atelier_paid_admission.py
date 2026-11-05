import pytest

from src.apps.atelier.paid_admission import (
    PaidAdmissionState,
    apply_query_recovery,
    can_transition,
    classify_recovery_intent,
    query_identity_from_scope,
    recover_paid_admission,
    replay_paid_admission,
    require_shared_idempotency_key,
    require_transition,
    scan_recovery_intents,
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

def test_paid_admission_intent_carries_cross_store_correlation():
    from src.apps.atelier.paid_admission import PaidAdmissionIntent

    intent = PaidAdmissionIntent(
        request_fingerprint="a" * 64,
        project_id="project-1",
        attempt_id="attempt-1",
        skill_content_hash="b" * 64,
        reservation_id="reservation-1",
        state=PaidAdmissionState.RESERVED,
    )
    assert intent.project_id == "project-1"
    assert intent.reservation_id == "reservation-1"


def test_paid_admission_intent_rejects_reserved_state_without_reservation():
    from src.apps.atelier.paid_admission import PaidAdmissionIntent

    with pytest.raises(ValueError, match="reservation_missing"):
        PaidAdmissionIntent(
            request_fingerprint="a" * 64,
            project_id="project-1",
            attempt_id="attempt-1",
            skill_content_hash="b" * 64,
            state=PaidAdmissionState.RESERVED,
        )

def test_paid_admission_intent_is_part_of_atelier_project_snapshot():
    from src.apps.atelier.models import AtelierProject
    from src.apps.atelier.paid_admission import PaidAdmissionIntent

    project = AtelierProject(id="project-1", title="Canvas", created_at=1.0, updated_at=1.0)
    project.paid_admission_intents.append(PaidAdmissionIntent(
        request_fingerprint="a" * 64,
        project_id="project-1",
        attempt_id="attempt-1",
        skill_content_hash="b" * 64,
    ))
    restored = AtelierProject.model_validate(project.model_dump(mode="json"))
    assert restored.paid_admission_intents[0].attempt_id == "attempt-1"

def test_restart_scan_classifies_paid_intents_without_resubmission():
    from src.apps.atelier.paid_admission import PaidAdmissionIntent

    intents = [
        PaidAdmissionIntent(request_fingerprint="a" * 64, project_id="p", attempt_id="a1", skill_content_hash="b" * 64, reservation_id="r1", state=PaidAdmissionState.UNKNOWN),
        PaidAdmissionIntent(request_fingerprint="c" * 64, project_id="p", attempt_id="a2", skill_content_hash="d" * 64, reservation_id="r2", state=PaidAdmissionState.RESERVED),
        PaidAdmissionIntent(request_fingerprint="e" * 64, project_id="p", attempt_id="a3", skill_content_hash="f" * 64, reservation_id="r3", provider_handle={"task_id": "t1"}, provider_scope={"provider": "x"}, state=PaidAdmissionState.UNKNOWN),
    ]
    assert classify_recovery_intent(intents[0]) == "manual_confirmation"
    assert scan_recovery_intents(intents) == [
        ("a1", "manual_confirmation"),
        ("a2", "resume_only_if_durable_submit_proof"),
        ("a3", "query"),
    ]

def test_storage_restart_scan_is_read_only(tmp_path):
    from src.apps.atelier.models import AtelierProject
    from src.apps.atelier.paid_admission import PaidAdmissionIntent
    from src.apps.atelier.storage import AtelierStorage

    project = AtelierProject(id="project-1", title="Canvas", created_at=1.0, updated_at=1.0)
    project.paid_admission_intents.append(PaidAdmissionIntent(
        request_fingerprint="a" * 64,
        project_id="project-1",
        attempt_id="attempt-1",
        skill_content_hash="b" * 64,
        reservation_id="reservation-1",
        state=PaidAdmissionState.UNKNOWN,
    ))
    store = AtelierStorage(tmp_path)
    try:
        store.create_project(project)
        before = store.get_project("project-1").revision
        assert store.scan_paid_admission_recovery("project-1") == [("attempt-1", "manual_confirmation")]
        assert store.get_project("project-1").revision == before
    finally:
        store.close()

def test_query_recovery_updates_only_handle_and_state():
    from src.apps.atelier.paid_admission import PaidAdmissionIntent

    intent = PaidAdmissionIntent(
        request_fingerprint="a" * 64,
        project_id="p",
        attempt_id="attempt-1",
        skill_content_hash="b" * 64,
        reservation_id="r1",
        provider_handle={"task_id": "old"},
        provider_scope={"provider": "seedance", "account_identity": "a1", "region": "cn", "workspace_id": "w1", "base_url": "https://provider"},
        state=PaidAdmissionState.UNKNOWN,
    )
    updated = apply_query_recovery(intent, query_provider=lambda handle, identity: {"task_id": handle["task_id"], "status": "succeeded"})
    assert updated.state is PaidAdmissionState.HANDLE_SAVED
    assert updated.provider_handle["status"] == "succeeded"
    assert updated.reservation_id == "r1"

def test_storage_query_recovery_checks_revision_and_persists_handle(tmp_path):
    from src.apps.atelier.models import AtelierProject
    from src.apps.atelier.paid_admission import PaidAdmissionIntent
    from src.apps.atelier.storage import AtelierStorage
    from src.utils.json_storage import StorageConflictError

    project = AtelierProject(id="project-1", title="Canvas", created_at=1.0, updated_at=1.0)
    project.paid_admission_intents.append(PaidAdmissionIntent(
        request_fingerprint="a" * 64,
        project_id="project-1",
        attempt_id="attempt-1",
        skill_content_hash="b" * 64,
        reservation_id="reservation-1",
        provider_handle={"task_id": "old"},
        provider_scope={"provider": "seedance", "account_identity": "a1", "region": "cn", "workspace_id": "w1", "base_url": "https://provider"},
        state=PaidAdmissionState.UNKNOWN,
    ))
    store = AtelierStorage(tmp_path)
    try:
        store.create_project(project)
        with pytest.raises(StorageConflictError):
            store.apply_paid_admission_query_recovery("project-1", attempt_id="attempt-1", expected_revision=99, query_provider=lambda h, i: {"status": "succeeded"})
        updated = store.apply_paid_admission_query_recovery("project-1", attempt_id="attempt-1", expected_revision=0, query_provider=lambda h, i: {"status": "succeeded"})
        assert updated.paid_admission_intents[0].state is PaidAdmissionState.HANDLE_SAVED
        assert updated.revision == 1
    finally:
        store.close()

def test_duplicate_query_recovery_with_stale_revision_is_rejected(tmp_path):
    from src.apps.atelier.models import AtelierProject
    from src.apps.atelier.paid_admission import PaidAdmissionIntent
    from src.apps.atelier.storage import AtelierStorage
    from src.utils.json_storage import StorageConflictError

    project = AtelierProject(id="project-1", title="Canvas", created_at=1.0, updated_at=1.0)
    project.paid_admission_intents.append(PaidAdmissionIntent(
        request_fingerprint="a" * 64,
        project_id="project-1",
        attempt_id="attempt-1",
        skill_content_hash="b" * 64,
        reservation_id="reservation-1",
        provider_handle={"task_id": "old"},
        provider_scope={"provider": "seedance", "account_identity": "a1", "region": "cn", "workspace_id": "w1", "base_url": "https://provider"},
        state=PaidAdmissionState.UNKNOWN,
    ))
    store = AtelierStorage(tmp_path)
    try:
        store.create_project(project)
        store.apply_paid_admission_query_recovery("project-1", attempt_id="attempt-1", expected_revision=0, query_provider=lambda h, i: {"status": "succeeded"})
        with pytest.raises(StorageConflictError):
            store.apply_paid_admission_query_recovery("project-1", attempt_id="attempt-1", expected_revision=0, query_provider=lambda h, i: pytest.fail("stale replay must not query"))
    finally:
        store.close()

def test_two_recovery_workers_only_one_commits(tmp_path):
    from concurrent.futures import ThreadPoolExecutor
    from src.apps.atelier.models import AtelierProject
    from src.apps.atelier.paid_admission import PaidAdmissionIntent
    from src.apps.atelier.storage import AtelierStorage
    from src.utils.json_storage import StorageConflictError

    project = AtelierProject(id="project-1", title="Canvas", created_at=1.0, updated_at=1.0)
    project.paid_admission_intents.append(PaidAdmissionIntent(
        request_fingerprint="a" * 64,
        project_id="project-1",
        attempt_id="attempt-1",
        skill_content_hash="b" * 64,
        reservation_id="reservation-1",
        provider_handle={"task_id": "old"},
        provider_scope={"provider": "seedance", "account_identity": "a1", "region": "cn", "workspace_id": "w1", "base_url": "https://provider"},
        state=PaidAdmissionState.UNKNOWN,
    ))
    store = AtelierStorage(tmp_path)
    try:
        store.create_project(project)
        def recover():
            try:
                store.apply_paid_admission_query_recovery("project-1", attempt_id="attempt-1", expected_revision=0, query_provider=lambda h, i: {"status": "succeeded"})
                return "committed"
            except StorageConflictError:
                return "conflict"
        with ThreadPoolExecutor(max_workers=2) as pool:
            outcomes = sorted(pool.map(lambda _: recover(), (1, 2)))
        assert outcomes == ["committed", "conflict"]
    finally:
        store.close()

def test_separate_process_cannot_open_second_atelier_writer(tmp_path):
    import multiprocessing
    from src.apps.atelier.storage import AtelierStorage

    store = AtelierStorage(tmp_path)
    queue = multiprocessing.Queue()

    def child(root, result_queue):
        try:
            second = AtelierStorage(root)
        except Exception as exc:
            result_queue.put(type(exc).__name__)
        else:
            second.close()
            result_queue.put("opened")

    process = multiprocessing.get_context("fork").Process(target=child, args=(str(tmp_path), queue))
    process.start()
    process.join(timeout=10)
    try:
        assert process.exitcode == 0
        assert queue.get(timeout=2) == "StorageConflictError"
    finally:
        store.close()
