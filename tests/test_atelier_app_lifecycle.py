"""Atelier's product store uses the real application's ownership and HTTP gates."""

import json

import pytest
from fastapi.testclient import TestClient

from src.apps.comic_gen.api import create_app
from src.utils.json_storage import DirectoryWriterLock, StorageConflictError, StorageError
from tests.test_app_lifecycle import StubPipeline


def make_app(root, **kwargs):
    return create_app(data_dir=root, load_config=False, recover_orphan_tasks=False, **kwargs)


def test_independent_projects_survive_restart_and_share_one_application_lease(tmp_path):
    first, second = tmp_path / "a", tmp_path / "b"
    app_a, app_b = make_app(first), make_app(second)
    with TestClient(app_a) as a, TestClient(app_b) as b:
        store = app_a.state.atelier_storage
        assert store._writer_lock is app_a.state.pipeline._writer_lock
        assert store._lock is app_a.state.pipeline._save_lock
        result = a.post('/atelier/projects', json={'title': 'Independent', 'description': 'Local'})
        assert result.status_code == 200, result.text
        project = result.json()
        assert project['revision'] == 0
        assert project['agent_policy']['approval_mode'] == 'untrusted'
        assert project['source_project_id'] is None
        assert a.get('/projects/').json() == []
        assert b.get('/atelier/projects').json() == []
        assert b.get('/atelier/projects/' + project['id']).status_code == 404
        changed = a.put('/atelier/projects/' + project['id'], json={
            'title': 'Saved', 'expected_revision': 0,
        })
        assert changed.status_code == 200, changed.text
        assert changed.json()['revision'] == 1
        with pytest.raises(StorageConflictError):
            DirectoryWriterLock(first).acquire()
    assert not hasattr(app_a.state, 'atelier_storage')
    assert not hasattr(app_a.state, 'atelier_service')
    with pytest.raises(StorageError):
        store.list_projects()
    with TestClient(make_app(first)) as reopened:
        assert reopened.get('/atelier/projects/' + project['id']).json()['title'] == 'Saved'
        deleted = reopened.request('DELETE', '/atelier/projects/' + project['id'], json={'expected_revision': 1})
        assert deleted.status_code == 200, deleted.text
        assert reopened.get('/atelier/projects').json() == []


def test_injected_nonwriting_pipeline_reuses_existing_playground_owner(tmp_path):
    app = make_app(tmp_path, pipeline_instance=StubPipeline(data_dir=tmp_path))
    with TestClient(app) as client:
        playground = app.state.playground_storage
        atelier = app.state.atelier_storage
        assert playground._owns_writer_lock
        assert atelier._writer_lock is playground._writer_lock
        assert not atelier._owns_writer_lock
        assert client.post('/atelier/projects', json={'title': 'Standalone'}).status_code == 200
    with DirectoryWriterLock(tmp_path):
        with pytest.raises(StorageError):
            atelier.list_projects()


def test_source_binding_uses_committed_studio_view_and_can_be_cleared(tmp_path):
    with TestClient(make_app(tmp_path)) as client:
        source = client.post('/projects?skip_analysis=true', json={
            'title': 'Studio source', 'text': 'Local source script',
        }).json()
        before = client.get('/projects/' + source['id']).json()
        missing = client.post('/atelier/projects', json={'title': 'Missing', 'source_project_id': 'absent'})
        assert missing.status_code == 404, missing.text
        created = client.post('/atelier/projects', json={'title': 'Derived', 'source_project_id': source['id']})
        assert created.status_code == 200, created.text
        item = '/atelier/projects/' + created.json()['id']
        no_change = client.put(item, json={'expected_revision': 0})
        assert no_change.json() == created.json()
        unlinked = client.put(item, json={'expected_revision': 0, 'source_project_id': None})
        assert unlinked.status_code == 200, unlinked.text
        assert unlinked.json()['source_project_id'] is None
        assert unlinked.json()['revision'] == 1
        assert client.get('/projects/' + source['id']).json() == before


def test_injected_pipeline_with_different_directory_owner_is_rejected(tmp_path):
    from src.apps.comic_gen.pipeline import ComicGenPipeline

    original, wrong = tmp_path / 'original', tmp_path / 'wrong'
    pipeline = ComicGenPipeline(data_dir=original, recover_orphan_tasks=False)
    app = make_app(wrong, pipeline_instance=pipeline)
    with pytest.raises(StorageConflictError):
        with TestClient(app):
            pytest.fail('a different directory owner must not be borrowed')
    assert not hasattr(app.state, 'atelier_storage')
    assert not (wrong / 'atelier_projects.json').exists()
    with DirectoryWriterLock(original):
        pass


def test_corrupt_atelier_file_aborts_startup_preserves_bytes_and_releases_owner(tmp_path):
    path = tmp_path / 'atelier_projects.json'
    bad = b'{broken user data'
    path.write_bytes(bad)
    app = make_app(tmp_path)
    with pytest.raises(StorageError):
        with TestClient(app):
            pytest.fail('corrupt product storage must block startup')
    assert path.read_bytes() == bad
    assert not hasattr(app.state, 'pipeline')
    assert not hasattr(app.state, 'atelier_storage')
    with DirectoryWriterLock(tmp_path):
        path.write_text('{}')
    with TestClient(make_app(tmp_path)) as client:
        assert client.get('/atelier/projects').json() == []


def test_parent_failure_and_uncertain_atelier_commit_close_both_products(tmp_path, monkeypatch):
    from src.apps.atelier import storage as storage_module

    app = make_app(tmp_path)
    with TestClient(app) as client:
        created = client.post('/atelier/projects', json={'title': 'Before'}).json()
        original = storage_module.atomic_write_json

        def uncertain(path, value):
            original(path, value)
            raise StorageError('synthetic fsync failure', commit_uncertain=True)

        monkeypatch.setattr(storage_module, 'atomic_write_json', uncertain)
        response = client.put('/atelier/projects/' + created['id'], json={
            'title': 'Committed but uncertain', 'expected_revision': 0,
        })
        assert response.status_code == 503, response.text
        assert response.json()['commit_uncertain'] is True
        assert client.get('/atelier/projects').status_code == 503
        assert client.get('/projects/').status_code == 503
    monkeypatch.setattr(storage_module, 'atomic_write_json', original)
    with TestClient(make_app(tmp_path)) as client:
        actual = client.get('/atelier/projects/' + created['id']).json()
        assert actual['title'] == 'Committed but uncertain'
        assert actual['revision'] == 1
        client.app.state.pipeline.mark_storage_failed(StorageError('parent unavailable'))
        assert client.get('/atelier/projects').status_code == 503


def test_atelier_mutations_obey_access_storage_identity_and_safe_validation(tmp_path):
    token = 'synthetic-test-token-' * 3
    app = make_app(tmp_path, access_mode='remote', access_token=token)
    with TestClient(app) as client:
        assert client.post('/atelier/projects', json={'title': 'Hidden'}).status_code == 401
        auth = {'Authorization': 'Bearer ' + token}
        identity = client.get('/runtime/environment', headers=auth).json()['storage_id']
        wrong = {**auth, 'X-LumenX-Environment': '11111111-1111-4111-8111-111111111111'}
        assert client.post('/atelier/projects', json={'title': 'Wrong root'}, headers=wrong).status_code == 409
        headers = {**auth, 'X-LumenX-Environment': identity, 'Content-Type': 'application/json'}
        invalid = client.post('/atelier/projects', content='{"title": NaN}', headers=headers)
        assert invalid.status_code == 422, invalid.text
        assert 'NaN' not in invalid.text
        created = client.post('/atelier/projects', json={'title': 'Valid'}, headers=headers)
        assert created.status_code == 200, created.text
        item = '/atelier/projects/' + created.json()['id']
        for method in ('PUT', 'DELETE'):
            rejected = client.request(method, item, content='{"expected_revision": Infinity}', headers=headers)
            assert rejected.status_code == 422, rejected.text
            assert 'Infinity' not in rejected.text
        assert client.get(item, headers=headers).json()['revision'] == 0
        assert len(json.loads((tmp_path / 'atelier_projects.json').read_text())) == 1

def test_paid_admission_resolver_is_platform_gated(tmp_path, monkeypatch):
    from src.apps.platform.config import PlatformConfig

    monkeypatch.setattr("src.apps.comic_gen.api.PlatformConfig.from_env", classmethod(lambda cls: PlatformConfig(enabled=False)))
    disabled = make_app(tmp_path / "disabled")
    assert not hasattr(disabled.state, "paid_admission_request_resolver")

    monkeypatch.setattr("src.apps.comic_gen.api.PlatformConfig.from_env", classmethod(lambda cls: PlatformConfig(enabled=True)))
    enabled = make_app(
        tmp_path / "enabled",
        paid_admission_callbacks_factory=lambda **context: {},
    )
    assert hasattr(enabled.state, "paid_admission_request_resolver")

def test_enabled_app_resolver_rejects_request_owner_mismatch(tmp_path, monkeypatch):
    from src.apps.atelier.paid_admission import PaidAdmissionState
    from src.apps.atelier.paid_admission_coordinator import PaidAdmissionIdentity
    from src.apps.platform.config import PlatformConfig

    monkeypatch.setattr("src.apps.comic_gen.api.PlatformConfig.from_env", classmethod(lambda cls: PlatformConfig(enabled=True)))
    def callbacks(**context):
        return {
            "save_receipt": lambda identity: None,
            "reserve_credits": lambda identity: "r1",
            "submit_provider": lambda identity: "h1",
            "save_handle": lambda identity, handle: None,
            "release_credits": lambda reservation: None,
            "load_receipt": lambda key: {},
            "load_reservation": lambda key: {},
            "query_provider": lambda handle, scope: None,
        }
    app = make_app(tmp_path, paid_admission_callbacks_factory=callbacks)
    resolver = app.state.paid_admission_request_resolver
    identity = PaidAdmissionIdentity("u1", "p1", "a1", "r1")
    with pytest.raises(ValueError, match="ownership_mismatch"):
        resolver(actor_user_id="u2", identity=identity, project_owner_id="p1", attempt_owner_id="a1")

def test_enabled_app_resolver_runs_valid_paid_admission_callbacks_in_order(tmp_path, monkeypatch):
    from src.apps.atelier.paid_admission import PaidAdmissionState
    from src.apps.atelier.paid_admission_coordinator import PaidAdmissionIdentity
    from src.apps.platform.config import PlatformConfig

    monkeypatch.setattr("src.apps.comic_gen.api.PlatformConfig.from_env", classmethod(lambda cls: PlatformConfig(enabled=True)))
    events = []
    def callbacks(**context):
        return {
            "save_receipt": lambda identity: events.append(("receipt", identity)),
            "reserve_credits": lambda identity: events.append(("reserve", identity)) or "r1",
            "submit_provider": lambda identity: events.append(("submit", identity)) or "h1",
            "save_handle": lambda identity, handle: events.append(("handle", identity, handle)),
            "release_credits": lambda reservation: None,
            "load_receipt": lambda key: {},
            "load_reservation": lambda key: {},
            "query_provider": lambda handle, scope: None,
        }
    app = make_app(tmp_path, paid_admission_callbacks_factory=callbacks)
    identity = PaidAdmissionIdentity("u1", "p1", "a1", "r1")
    result = app.state.paid_admission_request_resolver(
        actor_user_id="u1", identity=identity, project_owner_id="p1", attempt_owner_id="a1",
    ).start_for_identity(identity)
    assert result.state is PaidAdmissionState.SUCCEEDED
    assert [event[0] for event in events] == ["receipt", "reserve", "submit", "handle"]
    assert all(event[1] is identity for event in events)

@pytest.mark.parametrize("failure", ["submit", "handle"])
def test_app_paid_admission_failures_preserve_unknown_state(tmp_path, monkeypatch, failure):
    from src.apps.atelier.paid_admission import PaidAdmissionState
    from src.apps.atelier.paid_admission_coordinator import PaidAdmissionIdentity
    from src.apps.platform.config import PlatformConfig

    monkeypatch.setattr("src.apps.comic_gen.api.PlatformConfig.from_env", classmethod(lambda cls: PlatformConfig(enabled=True)))
    def callbacks(**context):
        def submit(identity):
            if failure == "submit":
                raise RuntimeError("provider timeout")
            return "h1"
        def save_handle(identity, handle):
            if failure == "handle":
                raise RuntimeError("receipt disk failure")
        return {
            "save_receipt": lambda identity: None,
            "reserve_credits": lambda identity: "r1",
            "submit_provider": submit,
            "save_handle": save_handle,
            "release_credits": lambda reservation: None,
            "load_receipt": lambda key: {},
            "load_reservation": lambda key: {},
            "query_provider": lambda handle, scope: None,
        }
    app = make_app(tmp_path, paid_admission_callbacks_factory=callbacks)
    identity = PaidAdmissionIdentity("u1", "p1", "a1", "r1")
    result = app.state.paid_admission_request_resolver(
        actor_user_id="u1", identity=identity, project_owner_id="p1", attempt_owner_id="a1",
    ).start_for_identity(identity)
    assert result.state is PaidAdmissionState.UNKNOWN

@pytest.mark.parametrize("failure", ["receipt", "reserve"])
def test_app_paid_admission_pre_submit_failures_do_not_submit(tmp_path, monkeypatch, failure):
    from src.apps.atelier.paid_admission_coordinator import PaidAdmissionIdentity
    from src.apps.platform.config import PlatformConfig

    monkeypatch.setattr("src.apps.comic_gen.api.PlatformConfig.from_env", classmethod(lambda cls: PlatformConfig(enabled=True)))
    events = []
    def callbacks(**context):
        def save_receipt(identity):
            events.append("receipt")
            if failure == "receipt":
                raise RuntimeError("receipt storage failure")
        def reserve(identity):
            events.append("reserve")
            if failure == "reserve":
                raise RuntimeError("credit service failure")
            return "r1"
        return {
            "save_receipt": save_receipt,
            "reserve_credits": reserve,
            "submit_provider": lambda identity: events.append("submit") or "h1",
            "save_handle": lambda identity, handle: events.append("handle"),
            "release_credits": lambda reservation: None,
            "load_receipt": lambda key: {},
            "load_reservation": lambda key: {},
            "query_provider": lambda handle, scope: None,
        }
    app = make_app(tmp_path, paid_admission_callbacks_factory=callbacks)
    identity = PaidAdmissionIdentity("u1", "p1", "a1", "r1")
    resolver = app.state.paid_admission_request_resolver(
        actor_user_id="u1", identity=identity, project_owner_id="p1", attempt_owner_id="a1",
    )
    with pytest.raises(RuntimeError):
        resolver.start_for_identity(identity)
    assert events == ["receipt"] if failure == "receipt" else events == ["receipt", "reserve"]

def test_app_resolver_can_use_real_platform_credit_callback(tmp_path, monkeypatch):
    from src.apps.atelier.paid_admission import PaidAdmissionState
    from src.apps.atelier.paid_admission_coordinator import PaidAdmissionIdentity
    from src.apps.comic_gen.paid_admission_composition import make_platform_credit_reserver
    from src.apps.platform.config import PlatformConfig
    from src.apps.platform.service import PlatformService

    monkeypatch.setattr("src.apps.comic_gen.api.PlatformConfig.from_env", classmethod(lambda cls: PlatformConfig(enabled=True)))
    platform = PlatformService(PlatformConfig(enabled=True, database_url=f"sqlite:///{tmp_path / 'credits.db'}"))
    admin = platform.register("admin", "a" * 12, role="admin")
    actor = platform.register("creator", "b" * 12)
    platform.grant_credits(admin, actor["id"], 20, "test", "grant-app-1")
    events = []
    def callbacks(**context):
        reserve = make_platform_credit_reserver(
            actor_for_user=lambda user_id: actor,
            reserve_credits=lambda *args: platform.reserve_credits(*args),
            estimated_credits=5,
            pricing_version="pricing-app-v1",
        )
        return {
            "save_receipt": lambda identity: events.append("receipt"),
            "reserve_credits": reserve,
            "submit_provider": lambda identity: events.append("submit") or "handle-1",
            "save_handle": lambda identity, handle: events.append(("handle", handle)),
            "release_credits": lambda reservation: platform.release_credits(actor, reservation),
            "load_receipt": lambda key: {},
            "load_reservation": lambda key: {},
            "query_provider": lambda handle, scope: None,
        }
    app = make_app(tmp_path / "app", paid_admission_callbacks_factory=callbacks)
    identity = PaidAdmissionIdentity(actor["id"], "project-1", "attempt-1", "request-app-1")
    result = app.state.paid_admission_request_resolver(
        actor_user_id=actor["id"], identity=identity, project_owner_id="project-1", attempt_owner_id="attempt-1",
    ).start_for_identity(identity)
    assert result.state is PaidAdmissionState.SUCCEEDED
    assert events == ["receipt", "submit", ("handle", "handle-1")]
    assert platform.credit_balance(actor)["available_credits"] == 15
