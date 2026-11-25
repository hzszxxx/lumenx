"""Tests for standalone and project-scoped script rewrite endpoints."""

from types import SimpleNamespace
from unittest.mock import Mock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.apps.comic_gen import api


@pytest.fixture
def rewrite_client():
    fake_script = SimpleNamespace(
        id="proj-1",
        owner_user_id=None,
    )
    runtime = SimpleNamespace(
        get_script=Mock(return_value=fake_script),
    )
    app = FastAPI()
    app.include_router(api.router)
    app.dependency_overrides[api.get_pipeline] = lambda: runtime
    with TestClient(app) as client:
        yield runtime, client


def test_standalone_script_rewrite_success(rewrite_client):
    _, client = rewrite_client
    with patch("src.apps.comic_gen.llm_adapter.LLMAdapter.is_configured", True), \
         patch("src.apps.comic_gen.llm_adapter.LLMAdapter.chat", return_value="第1场 阳光洒在木桌上\n猫咪轻轻抬头。"):
        response = client.post(
            "/script/rewrite",
            json={
                "script_text": "一只猫在探店",
                "skill_prompt": "优化为短剧分场规范",
            },
        )
    assert response.status_code == 200
    data = response.json()
    assert data["rewritten_text"] == "第1场 阳光洒在木桌上\n猫咪轻轻抬头。"
    assert "model" in data


def test_standalone_script_rewrite_validation_empty_text(rewrite_client):
    _, client = rewrite_client
    response = client.post(
        "/script/rewrite",
        json={
            "script_text": "   ",
            "skill_prompt": "提示词",
        },
    )
    assert response.status_code == 400
    assert "剧本内容不能为空" in response.json()["detail"]


def test_standalone_script_rewrite_validation_empty_prompt(rewrite_client):
    _, client = rewrite_client
    response = client.post(
        "/script/rewrite",
        json={
            "script_text": "一些剧本内容",
            "skill_prompt": "   ",
        },
    )
    assert response.status_code == 400
    assert "改写 Skill 指令不能为空" in response.json()["detail"]


def test_project_scoped_script_rewrite_success(rewrite_client):
    runtime, client = rewrite_client
    with patch("src.apps.comic_gen.llm_adapter.LLMAdapter.is_configured", True), \
         patch("src.apps.comic_gen.llm_adapter.LLMAdapter.chat", return_value="```markdown\n第1场 咖啡厅\n```"):
        response = client.post(
            "/projects/proj-1/rewrite_script",
            json={
                "script_text": "原稿",
                "skill_prompt": "指令",
            },
        )
    assert response.status_code == 200
    runtime.get_script.assert_called_with("proj-1")
    assert response.json()["rewritten_text"] == "第1场 咖啡厅"
