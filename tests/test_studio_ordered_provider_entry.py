"""Ordered Studio requests retain atomic receipts and original execution ownership."""

import struct
import zlib
import io
import wave
from dataclasses import replace

import pytest
from fastapi.testclient import TestClient

from src.apps.comic_gen import api
from src.apps.comic_gen.models import Script
from src.models.provider_tasks import ProviderScope
from src.utils.json_storage import StorageError
from tests.test_provider_video_entry import URL
from tests.test_studio_provider_recovery import FakeProvider, _admission_request
from tests.test_studio_provider_recovery_dispatcher import _make_runtime


def _image_bytes():
    def chunk(name, data):
        return struct.pack('>I', len(data)) + name + data + struct.pack('>I', zlib.crc32(name + data))
    return (b'\x89PNG\r\n\x1a\n'
            + chunk(b'IHDR', struct.pack('>IIBBBBB', 240, 240, 8, 2, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress((b'\0' + b'\0\x20\x40' * 240) * 240))
            + chunk(b'IEND', b''))


@pytest.fixture
def entry(tmp_path, monkeypatch):
    provider = FakeProvider()
    runtime = _make_runtime(tmp_path, monkeypatch, provider)
    original = runtime.provider_recovery_runtime
    runtime.provider_recovery_runtime = replace(original, scope=ProviderScope(
        provider='dashscope', backend='dashscope', gateway='dashscope_workspace',
        base_url='https://workspace.cn-beijing.maas.aliyuncs.com', region='cn-beijing', workspace_id='workspace',
    ))
    for name in ('source.png', 'last.png', 'ref.png'):
        (runtime.data_dir / 'uploads' / name).write_bytes(_image_bytes())
    audio = io.BytesIO()
    with wave.open(audio, 'wb') as writer:
        writer.setnchannels(1)
        writer.setsampwidth(2)
        writer.setframerate(16000)
        writer.writeframes(b'\0\0' * 16000)
    (runtime.data_dir / 'uploads/ref.wav').write_bytes(audio.getvalue())
    scheduled = []
    monkeypatch.setattr(api.BackgroundTasks, 'add_task', lambda self, func, *args, **kwargs: scheduled.append((func, args)))
    app = api.create_app(data_dir=runtime.data_dir, pipeline_instance=runtime, load_config=False, recover_orphan_tasks=False)
    with TestClient(app) as client:
        yield runtime, client, scheduled, provider, original


def payload(**changes):
    return {
        'client_request_id': 'ordered-action', 'contract_version': 'ordered-media-v1',
        'model': 'wan3.0-video', 'generation_mode': 't2v', 'frame_id': 'frame',
        'prompt': 'A quiet shot', 'duration': -1, 'resolution': '1080P', 'ratio': '16:9',
        'seed': 0, 'generate_audio': False, 'prompt_extend': False, 'watermark': False,
        **changes,
    }


@pytest.mark.parametrize('media_fields,roles', [
    ({}, []),
    ({'generation_mode': 'i2v', 'image_url': 'uploads/source.png', 'last_frame_url': 'uploads/last.png'}, ['first_frame', 'last_frame']),
    ({'generation_mode': 'r2v', 'reference_image_urls': ['uploads/ref.png', 'uploads/source.png']}, ['reference_image', 'reference_image']),
    ({'generation_mode': 'r2v', 'reference_audio_urls': ['uploads/ref.wav'], 'workbench_tab': 'direct_r2v'}, ['reference_audio']),
])
def test_ordered_http_batch_freezes_correct_media_and_commits_before_dispatch(entry, media_fields, roles):
    runtime, client, scheduled, provider, _ = entry
    response = client.post(URL, json=payload(batch_size=2, **media_fields))
    assert response.status_code == 200, response.text
    body = response.json()
    saved = runtime.read_committed_script('p')
    assert len(saved.video_tasks) == len(scheduled) == 2
    receipt = saved.provider_request_receipts[0]
    assert receipt.entrypoint == 'studio.provider_video.v2' and receipt.schema_version == 2
    assert body['task_ids'] == [task.id for task in saved.video_tasks]
    for task in saved.video_tasks:
        record = task.provider_execution
        assert record.phase == 'accepted'
        assert [item['role'] for item in record.media] == roles
        assert task.generation_mode == media_fields.get('generation_mode', 't2v')
        assert task.image_url == media_fields.get('image_url', '')
        assert task.last_frame_url == media_fields.get('last_frame_url')
        assert task.reference_image_urls == media_fields.get('reference_image_urls', [])
        assert task.reference_audio_urls == media_fields.get('reference_audio_urls', [])
        assert task.workbench_tab == media_fields.get('workbench_tab')
        assert task.watermark is False and task.generate_audio is False and task.prompt_extend is False
        assert task.seed == 0 and task.duration == -1 and task.ratio == '16:9'
        assert record.intent['params']['audio'] is False
    assert provider.submits == []
    assert Script.model_validate(saved.model_dump()).provider_request_receipts == saved.provider_request_receipts


def test_ordered_http_route_admission_binds_frame_tags_runtime_model_and_budget(entry):
    runtime, client, scheduled, _, _ = entry
    runtime.scripts['p'].frames[0].stage = 'final'
    runtime._commit_storage('projects.json')
    request = payload(
        batch_size=2,
        duration=6,
        resolution='720P',
        compute_route={
            'routing': {
                'stage': 'final',
                'shot_type': 'consistency_long',
                'urgency': 'low',
                'duration_sec': 6,
                'has_dialogue': False,
                'has_audio': False,
                'closeup_or_hero': False,
            },
            'batch_size': 2,
            'budget_cny': 20,
        },
    )
    response = client.post(URL, json=request)
    assert response.status_code == 200, response.text
    assert len(response.json()['task_ids']) == len(scheduled) == 2


def test_project_compute_budget_is_persisted_with_revision_guard(entry):
    runtime, client, _, _, _ = entry
    initial = client.get('/projects/p/compute_budget')
    assert initial.status_code == 200
    assert initial.json() == {'project_id': 'p', 'budget_cny': None, 'revision': 0}

    saved = client.put('/projects/p/compute_budget', json={'budget_cny': 5, 'expected_revision': 0})
    assert saved.status_code == 200, saved.text
    assert saved.json()['compute_budget_cny'] == 5
    current = client.get('/projects/p/compute_budget').json()
    assert current == {'project_id': 'p', 'budget_cny': 5, 'revision': 1}

    stale = client.put('/projects/p/compute_budget', json={'budget_cny': 10, 'expected_revision': 0})
    assert stale.status_code == 409
    assert 'changed' in stale.json()['detail']
    assert runtime.read_committed_script('p').compute_budget_cny == 5


def test_ordered_http_route_admission_rejects_project_budget_cap(entry):
    runtime, client, scheduled, _, _ = entry
    runtime.scripts['p'].frames[0].stage = 'final'
    runtime._commit_storage('projects.json')
    revision = runtime.read_committed_script('p').revision
    budget = client.put('/projects/p/compute_budget', json={'budget_cny': 5, 'expected_revision': revision})
    assert budget.status_code == 200, budget.text
    response = client.post(URL, json=payload(
        duration=6,
        resolution='720P',
        compute_route={
            'routing': {'stage': 'final', 'shot_type': 'consistency_long', 'urgency': 'low', 'duration_sec': 6},
            'batch_size': 1,
            'budget_cny': 20,
        },
    ))
    assert response.status_code == 422
    assert response.json()['code'] == 'project_budget_exceeded'
    assert runtime.read_committed_script('p').video_tasks == []
    assert scheduled == []


@pytest.mark.parametrize('compute_route,expected_code', [
    ({
        'routing': {'stage': 'final', 'shot_type': 'consistency_long', 'urgency': 'low', 'duration_sec': 6},
        'batch_size': 1,
        'budget_cny': 1,
    }, 'route_budget_exceeded'),
])
def test_ordered_http_route_admission_rejects_before_provider_task_commit(entry, compute_route, expected_code):
    runtime, client, scheduled, _, _ = entry
    runtime.scripts['p'].frames[0].stage = 'final'
    runtime._commit_storage('projects.json')
    response = client.post(URL, json=payload(duration=6, compute_route=compute_route))
    assert response.status_code == 422
    assert response.json()['code'] == expected_code
    assert runtime.read_committed_script('p').video_tasks == []
    assert scheduled == []


def test_ordered_http_route_admission_rejects_runtime_model_mismatch(entry):
    runtime, client, scheduled, _, _ = entry
    runtime.scripts['p'].frames[0].stage = 'final'
    runtime._commit_storage('projects.json')
    response = client.post(URL, json=payload(
        duration=6,
        model='seedance-2.0-i2v',
        compute_route={
            'routing': {'stage': 'final', 'shot_type': 'consistency_long', 'urgency': 'low', 'duration_sec': 6},
            'batch_size': 1,
            'budget_cny': 20,
        },
    ))
    assert response.status_code == 422
    assert response.json()['code'] == 'route_runtime_model_mismatch'
    assert runtime.read_committed_script('p').video_tasks == []
    assert scheduled == []


def test_ordered_http_route_admission_rejects_runtime_resolution_mismatch(entry):
    runtime, client, scheduled, _, _ = entry
    runtime.scripts['p'].frames[0].stage = 'final'
    runtime._commit_storage('projects.json')
    response = client.post(URL, json=payload(
        duration=6,
        resolution='1080P',
        compute_route={
            'routing': {'stage': 'final', 'shot_type': 'consistency_long', 'urgency': 'low', 'duration_sec': 6},
            'batch_size': 1,
            'budget_cny': 20,
            'requested_resolution': '720p',
        },
    ))
    assert response.status_code == 422
    assert response.json()['code'] == 'route_runtime_resolution_mismatch'
    assert runtime.read_committed_script('p').video_tasks == []
    assert scheduled == []


def test_ordered_replay_needs_no_source_runtime_or_new_dispatch(entry):
    runtime, client, scheduled, _, _ = entry
    request = payload(generation_mode='i2v', image_url='uploads/source.png')
    first = client.post(URL, json=request)
    assert first.status_code == 200, first.text
    before = (runtime.data_dir / 'projects.json').read_bytes()
    (runtime.data_dir / 'uploads/source.png').unlink()
    runtime.provider_recovery_runtime = None
    runtime.provider_runtime_selector = None
    scheduled.clear()
    replay = client.post(URL, json=request)
    assert replay.status_code == 200 and replay.json()['replayed'] is True
    assert replay.json()['task_ids'] == first.json()['task_ids']
    assert (runtime.data_dir / 'projects.json').read_bytes() == before
    assert scheduled == []


def test_same_project_request_id_cannot_cross_contract_versions(entry):
    runtime, client, scheduled, _, _ = entry
    first = client.post(URL, json=payload())
    assert first.status_code == 200, first.text
    scheduled.clear()
    changed = client.post(URL, json={**_admission_request(), 'client_request_id': 'ordered-action'})
    assert changed.status_code == 409 and changed.json()['code'] == 'provider_request_conflict'
    assert len(runtime.read_committed_script('p').video_tasks) == 1 and scheduled == []


def test_ordered_continue_uses_original_t2v_attempt_only_once(entry):
    runtime, client, _, provider, _ = entry
    first = client.post(URL, json=payload())
    assert first.status_code == 200, first.text
    task = first.json()['tasks'][0]
    record = task['provider_execution']
    url = URL + '/' + task['id'] + '/continue'
    identity = {'expected_attempt_id': record['attempt_id'], 'expected_fingerprint': record['fingerprint']}
    continued = client.post(url, json=identity)
    assert continued.status_code == 200, continued.text
    assert len(provider.submits) == 1 and provider.submits[0][0].media == ()
    assert client.post(url, json=identity).status_code == 409
    assert len(provider.submits) == 1


@pytest.mark.parametrize('changes', [
    {'contract_version': None}, {'contract_version': 'future'},
    {'generation_mode': 't2v', 'image_url': 'uploads/source.png'},
    {'frame_id': 'missing'}, {'negative_prompt': 'not supported'}, {'duration': True},
])
def test_bad_ordered_input_never_schedules_or_saves_tasks(entry, changes):
    runtime, client, scheduled, _, _ = entry
    before = (runtime.data_dir / 'projects.json').read_bytes()
    response = client.post(URL, json=payload(**changes))
    assert response.status_code == 422, response.text
    assert (runtime.data_dir / 'projects.json').read_bytes() == before and scheduled == []


def test_ordered_failed_atomic_save_never_schedules(entry, monkeypatch):
    runtime, client, scheduled, _, _ = entry
    before = (runtime.data_dir / 'projects.json').read_bytes()
    def fail(*args, **kwargs):
        raise StorageError('unavailable')
    monkeypatch.setattr(runtime._storage, 'commit', fail)
    response = client.post(URL, json=payload(batch_size=2))
    assert response.status_code == 503, response.text
    assert (runtime.data_dir / 'projects.json').read_bytes() == before and scheduled == []


@pytest.mark.parametrize('ordered', [False, True])
def test_one_batch_uses_one_frozen_media_snapshot(entry, monkeypatch, ordered):
    from src.apps.comic_gen import provider_recovery
    from tests.frozen_image_fixtures import rgb_png_bytes

    runtime, client, scheduled, _, legacy = entry
    if not ordered:
        runtime.provider_runtime_selector = None
        runtime.provider_recovery_runtime = legacy
    original = provider_recovery.freeze_media
    freezes = []

    def freeze_then_replace(*args, **kwargs):
        version = original(*args, **kwargs)
        freezes.append(version)
        (runtime.data_dir / 'uploads/source.png').write_bytes(rgb_png_bytes('changed after freeze'))
        return version

    monkeypatch.setattr(provider_recovery, 'freeze_media', freeze_then_replace)
    request = payload(batch_size=3, generation_mode='i2v', image_url='uploads/source.png') if ordered else {
        **_admission_request(), 'client_request_id': 'legacy-batch', 'batch_size': 3,
    }
    response = client.post(URL, json=request)
    assert response.status_code == 200, response.text
    tasks = response.json()['tasks']
    assert len(tasks) == len(scheduled) == 3
    assert len(freezes) == 1
    assert all(task['provider_execution']['media'] == tasks[0]['provider_execution']['media'] for task in tasks)
    assert len({task['provider_execution']['attempt_id'] for task in tasks}) == 3
    assert len({task['provider_execution']['fingerprint'] for task in tasks}) == 3
