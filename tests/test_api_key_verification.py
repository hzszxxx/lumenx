"""Tests for API key verification endpoint /config/test-key."""

import json
import os
from unittest.mock import Mock, patch
import pytest
from fastapi.testclient import TestClient

from src.apps.comic_gen import api, pipeline as pipeline_module


@pytest.fixture
def api_client(tmp_path, monkeypatch):
    for name in ("AssetGenerator", "StoryboardGenerator", "VideoGenerator", "AudioGenerator", "ExportManager"):
        monkeypatch.setattr(pipeline_module, name, Mock())
    pipeline = pipeline_module.ComicGenPipeline(data_dir=tmp_path / "output", script_processor=Mock())
    path = tmp_path / "settings" / "config.json"
    path.parent.mkdir()
    path.write_text(json.dumps({"DASHSCOPE_API_KEY": "stored-env-key"}))
    monkeypatch.setenv("DASHSCOPE_API_KEY", "stored-env-key")
    app = api.create_app(data_dir=pipeline.data_dir, user_data_dir=path.parent,
                         load_config=False, pipeline_instance=pipeline)
    with TestClient(app) as client:
        yield client


def test_missing_api_key_returns_failure(tmp_path, monkeypatch):
    for name in ("AssetGenerator", "StoryboardGenerator", "VideoGenerator", "AudioGenerator", "ExportManager"):
        monkeypatch.setattr(pipeline_module, name, Mock())
    pipeline = pipeline_module.ComicGenPipeline(data_dir=tmp_path / "output", script_processor=Mock())
    path = tmp_path / "settings" / "config.json"
    path.parent.mkdir()
    path.write_text(json.dumps({}))
    monkeypatch.delenv("DASHSCOPE_API_KEY", raising=False)
    app = api.create_app(data_dir=pipeline.data_dir, user_data_dir=path.parent,
                         load_config=False, pipeline_instance=pipeline)
    with TestClient(app) as client:
        resp = client.post("/config/test-key", json={"provider": "dashscope", "api_key": ""})
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is False
        assert "未检测到 API Key" in data["message"]


def test_provided_key_success(api_client):
    mock_openai = Mock()
    mock_client = Mock()
    mock_openai.return_value = mock_client
    mock_completion = Mock()
    mock_client.chat.completions.create.return_value = mock_completion

    with patch("openai.OpenAI", mock_openai):
        resp = api_client.post("/config/test-key", json={
            "provider": "dashscope",
            "api_key": "sk-valid-key-12345",
            "base_url": "https://dashscope.aliyuncs.com"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "连接成功" in data["message"]
        assert "latency_ms" in data
        mock_openai.assert_called_once_with(
            api_key="sk-valid-key-12345",
            base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
            timeout=12.0,
            max_retries=0,
        )


def test_masked_key_resolves_from_runtime_env(api_client):
    mock_openai = Mock()
    mock_client = Mock()
    mock_openai.return_value = mock_client
    mock_client.chat.completions.create.return_value = Mock()

    with patch("openai.OpenAI", mock_openai):
        resp = api_client.post("/config/test-key", json={
            "provider": "dashscope",
            "api_key": "••••••••-key",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        mock_openai.assert_called_once_with(
            api_key="stored-env-key",
            base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
            timeout=12.0,
            max_retries=0,
        )


def test_authentication_error_returns_clear_message(api_client):
    from openai import AuthenticationError
    import httpx

    mock_openai = Mock()
    mock_client = Mock()
    mock_openai.return_value = mock_client

    request = httpx.Request("POST", "https://dashscope.aliyuncs.com")
    response = httpx.Response(401, request=request)
    mock_client.chat.completions.create.side_effect = AuthenticationError(
        "Incorrect API key provided", response=response, body={"message": "Incorrect API key provided"}
    )

    with patch("openai.OpenAI", mock_openai):
        resp = api_client.post("/config/test-key", json={
            "provider": "dashscope",
            "api_key": "sk-wrong-key",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is False
        assert "401" in data["message"]
        assert "密钥认证失败" in data["message"]


def test_unsupported_provider(api_client):
    resp = api_client.post("/config/test-key", json={
        "provider": "unsupported_xyz",
        "api_key": "sk-12345",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is False
    assert "不支持" in data["message"]


def test_minimax_test_key_success(api_client):
    mock_resp = Mock()
    mock_resp.status_code = 200
    with patch("requests.get", return_value=mock_resp):
        resp = api_client.post("/config/test-key", json={
            "provider": "minimax",
            "api_key": "minimax-test-key",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "连接成功" in data["message"]


def test_minimax_missing_key(api_client):
    resp = api_client.post("/config/test-key", json={
        "provider": "minimax",
        "api_key": "",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is False
    assert "未检测到 MiniMax API Key" in data["message"]
