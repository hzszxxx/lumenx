"""Tests for Xiangongyun H3 video generation model and pipeline integration."""

from __future__ import annotations

import json
import os
import shutil
import tempfile
from unittest.mock import MagicMock, patch

import pytest

from src.models.factory import ModelFactory
from src.models.xiangongyun import (
    FIXTURE_MP4_PATH,
    MINIMAL_MP4_BYTES,
    XiangongyunH3Model,
)


def test_xiangongyun_initialization_defaults():
    model = XiangongyunH3Model({})
    assert model.access_token == ""
    assert model.endpoint == ""
    assert model.model_name == "xiangongyun-h3-i2v"
    assert model.simulate is False


def test_xiangongyun_initialization_with_env():
    env = {
        "XIANGONGYUN_ACCESS_TOKEN": "test_token_1234567890",
        "XIANGONGYUN_H3_ENDPOINT": "http://192.168.1.100:8000",
        "XIANGONGYUN_SIMULATE": "1",
    }
    model = XiangongyunH3Model({}, env=env)
    assert model.access_token == "test_token_1234567890"
    assert model.endpoint == "http://192.168.1.100:8000"
    assert model.simulate is True


def test_factory_creates_xiangongyun_model():
    for name in ("xiangongyun", "xiangongyun-h3", "xiangongyun-h3-i2v", "xiangongyun-h3-r2v", "h3-video"):
        instance = ModelFactory.create_model({"model.name": name})
        assert isinstance(instance, XiangongyunH3Model)


def test_find_running_instance_endpoint_success():
    model = XiangongyunH3Model(
        {"access_token": "valid_token_sample_123"},
        env={"XIANGONGYUN_OPEN_API_BASE": "https://api.xiangongyun.com"},
    )
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "code": 0,
        "data": {
            "list": [
                {"id": "inst_1", "status": "stopped", "ip": "1.1.1.1"},
                {"id": "inst_2", "status": "running", "public_ip": "123.45.67.89", "port": 8888},
            ]
        },
    }

    with patch("requests.get", return_value=mock_resp) as mock_get:
        endpoint = model.find_running_instance_endpoint()
        assert endpoint == "http://123.45.67.89:8888"
        mock_get.assert_called_once_with(
            "https://api.xiangongyun.com/open/instances",
            headers={"Authorization": "Bearer valid_token_sample_123", "Accept": "application/json"},
            timeout=5,
        )


def test_find_running_instance_endpoint_none_when_no_token():
    model = XiangongyunH3Model({})
    assert model.find_running_instance_endpoint() is None


def test_resolve_image_input(tmp_path):
    model = XiangongyunH3Model({"output_root": str(tmp_path)})

    # Remote URL passes through
    url = "https://example.com/frame.png"
    assert model._resolve_image_input(url) == url

    # Local file gets base64 encoded
    img_file = tmp_path / "test.png"
    img_file.write_bytes(b"\x89PNG\r\n\x1a\nfakeimagebytes")
    resolved = model._resolve_image_input(str(img_file))
    assert resolved.startswith("data:image/png;base64,")


def test_generate_simulation_fallback(tmp_path):
    model = XiangongyunH3Model({}, env={"XIANGONGYUN_SIMULATE": "1"})
    output_file = tmp_path / "output.mp4"

    res_path, duration = model.generate(
        prompt="A girl smiling in the sunshine",
        output_path=str(output_file),
        duration=5,
        resolution="768p",
    )
    assert res_path == str(output_file)
    assert os.path.isfile(res_path)
    assert os.path.getsize(res_path) > 0


def test_generate_with_mock_live_endpoint(tmp_path):
    model = XiangongyunH3Model({
        "endpoint": "http://gpu-h3.local:8000",
        "access_token": "token_abc",
    })
    output_file = tmp_path / "live_output.mp4"

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.headers = {"Content-Type": "video/mp4"}
    mock_resp.content = b"\x00\x00\x00\x1cftypisom\x00\x00\x02\x00isomiso2mp41\x00\x00\x00\x08free"

    with patch("requests.post", return_value=mock_resp) as mock_post:
        res_path, duration = model.generate(
            prompt="Close-up of a character speaking",
            output_path=str(output_file),
            img_url="https://example.com/first.png",
            duration=6,
            resolution="768p",
            audio=True,
            generation_mode="i2v",
        )
        assert res_path == str(output_file)
        assert os.path.isfile(res_path)
        assert output_file.read_bytes() == mock_resp.content

        # Verify POST payload
        mock_post.assert_called_once()
        call_kwargs = mock_post.call_args[1]
        payload = call_kwargs["json"]
        assert payload["prompt"] == "Close-up of a character speaking"
        assert payload["image"] == "https://example.com/first.png"
        assert payload["duration"] == 6
        assert payload["audio"] is True
        assert call_kwargs["headers"]["Authorization"] == "Bearer token_abc"


def test_generate_live_r2v_mode(tmp_path):
    model = XiangongyunH3Model({
        "endpoint": "http://gpu-h3.local:8000",
    })
    output_file = tmp_path / "r2v_output.mp4"

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.headers = {"Content-Type": "application/json"}
    mock_json = {
        "status": "completed",
        "video_url": "https://storage.example.com/video.mp4",
    }
    mock_resp.json.return_value = mock_json
    mock_resp.content = json.dumps(mock_json).encode()

    mock_dl_resp = MagicMock()
    mock_dl_resp.status_code = 200
    mock_dl_resp.content = b"\x00\x00\x00\x1cftypisom\x00\x00\x02\x00isomiso2mp41\x00\x00\x00\x08free"

    with patch("requests.post", return_value=mock_resp) as mock_post, \
         patch("requests.get", return_value=mock_dl_resp) as mock_get:
        res_path, duration = model.generate(
            prompt="Two characters talking",
            output_path=str(output_file),
            generation_mode="r2v",
            ref_image_urls=["https://example.com/char1.png", "https://example.com/scene.png"],
        )
        assert res_path == str(output_file)
        assert os.path.isfile(res_path)

        call_kwargs = mock_post.call_args[1]
        payload = call_kwargs["json"]
        assert payload["generation_mode"] == "r2v"
        assert payload["reference_images"] == ["https://example.com/char1.png", "https://example.com/scene.png"]


def test_generate_http_error_raises_runtime_error(tmp_path):
    model = XiangongyunH3Model({"endpoint": "http://gpu-h3.local:8000"})
    output_file = tmp_path / "error_output.mp4"

    mock_resp = MagicMock()
    mock_resp.status_code = 500
    mock_resp.text = "Internal GPU Out of Memory"

    with patch("requests.post", return_value=mock_resp):
        with pytest.raises(RuntimeError, match="Xiangongyun H3 generation failed with HTTP 500"):
            model.generate(prompt="Fail prompt", output_path=str(output_file))


def test_pipeline_process_xiangongyun_video_task(tmp_path, monkeypatch):
    from unittest.mock import Mock
    from src.apps.comic_gen import pipeline as module
    from src.apps.comic_gen.models import Character, Scene, Script, StoryboardFrame, VideoTask

    for name in ("AssetGenerator", "StoryboardGenerator", "AudioGenerator", "ExportManager"):
        monkeypatch.setattr(module, name, Mock())

    pipe = module.ComicGenPipeline(data_dir=tmp_path / "data", script_processor=Mock(), warmup_demucs=False)
    image = pipe.data_dir / "uploads/source.png"
    image.parent.mkdir(parents=True, exist_ok=True)
    image.write_bytes(b"\x89PNG\r\n\x1a\nfakeimage")

    task = VideoTask(
        id="task_xgy_1",
        project_id="proj_1",
        frame_id="frame_1",
        image_url="uploads/source.png",
        prompt="A peaceful meadow swaying in the wind",
        status="pending",
        model="xiangongyun-h3-i2v",
        duration=5,
    )
    pipe.scripts["proj_1"] = Script(
        id="proj_1",
        title="project",
        original_text="source",
        created_at=1,
        updated_at=1,
        scenes=[Scene(id="scene_1", name="Meadow", description="quiet", image_url="uploads/source.png")],
        characters=[],
        frames=[StoryboardFrame(id="frame_1", scene_id="scene_1")],
        video_tasks=[task],
    )
    pipe._commit_storage("projects.json", "series.json", "library_assets.json")

    mock_xgy = MagicMock()
    def fake_generate(**kwargs):
        with open(kwargs["output_path"], "wb") as f:
            f.write(b"\x00\x00\x00\x1cftypisom\x00\x00\x02\x00isomiso2mp41\x00\x00\x00\x08free")
        return kwargs["output_path"], 1.5

    mock_xgy.generate.side_effect = fake_generate
    pipe._xiangongyun_model = mock_xgy

    pipe.process_video_task("proj_1", "task_xgy_1")

    updated_script = pipe.scripts["proj_1"]
    updated_task = next(t for t in updated_script.video_tasks if t.id == "task_xgy_1")
    assert updated_task.status == "completed"
    assert updated_task.video_url.startswith("video/")
    assert mock_xgy.generate.called
    call_kwargs = mock_xgy.generate.call_args[1]
    assert call_kwargs["prompt"] == "A peaceful meadow swaying in the wind"
    assert call_kwargs["duration"] == 5
    pipe.close()


def test_pipeline_create_video_task_normalizes_xiangongyun_r2v(tmp_path, monkeypatch):
    from unittest.mock import Mock
    from src.apps.comic_gen import pipeline as module
    from src.apps.comic_gen.models import Character, Scene, Script, StoryboardFrame

    for name in ("AssetGenerator", "StoryboardGenerator", "AudioGenerator", "ExportManager"):
        monkeypatch.setattr(module, name, Mock())

    pipe = module.ComicGenPipeline(data_dir=tmp_path / "data", script_processor=Mock(), warmup_demucs=False)
    image = pipe.data_dir / "uploads/source.png"
    image.parent.mkdir(parents=True, exist_ok=True)
    image.write_bytes(b"\x89PNG\r\n\x1a\nfakeimage")

    pipe.scripts["proj_2"] = Script(
        id="proj_2",
        title="project",
        original_text="source",
        created_at=1,
        updated_at=1,
        scenes=[Scene(id="scene_2", name="Meadow", description="quiet", image_url="uploads/source.png")],
        characters=[],
        frames=[StoryboardFrame(id="frame_2", scene_id="scene_2")],
        video_tasks=[],
    )
    pipe._commit_storage("projects.json", "series.json", "library_assets.json")

    script, task_id = pipe.create_video_task(
        script_id="proj_2",
        image_url="uploads/source.png",
        prompt="Character speaking with facial expressions",
        generation_mode="r2v",
        model="xiangongyun-h3-i2v",
        reference_image_urls=["uploads/source.png"],
    )

    task = next(t for t in script.video_tasks if t.id == task_id)
    assert task.generation_mode == "r2v"
    assert task.model == "xiangongyun-h3-r2v"
    pipe.close()
