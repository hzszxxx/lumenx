"""Unit tests for MinimaxImageModel adapter."""

import os
from unittest.mock import Mock, patch
import pytest

from src.models.minimax_image import (
    MinimaxImageModel,
    map_size_to_aspect_ratio,
    map_model_name_to_api_id,
    MINIMAL_PNG_BYTES,
)


def test_map_size_to_aspect_ratio():
    assert map_size_to_aspect_ratio("1024*576") == "16:9"
    assert map_size_to_aspect_ratio("1280x720") == "16:9"
    assert map_size_to_aspect_ratio("576*1024") == "9:16"
    assert map_size_to_aspect_ratio("720x1280") == "9:16"
    assert map_size_to_aspect_ratio("1024*1024") == "1:1"
    assert map_size_to_aspect_ratio("1024*768") == "4:3"
    assert map_size_to_aspect_ratio("768*1024") == "3:4"
    assert map_size_to_aspect_ratio("16:9") == "16:9"
    assert map_size_to_aspect_ratio("9:16") == "9:16"
    assert map_size_to_aspect_ratio(None) == "16:9"


def test_map_model_name_to_api_id():
    assert map_model_name_to_api_id("minimax/h3-image") == "MiniMax-H3-Image"
    assert map_model_name_to_api_id("minimax-h3-image") == "MiniMax-H3-Image"
    assert map_model_name_to_api_id("minimax/h3-image-highspeed") == "MiniMax-H3-Image-Highspeed"
    assert map_model_name_to_api_id("minimax/image-01") == "image-01"
    assert map_model_name_to_api_id(None) == "MiniMax-H3-Image"


def test_minimax_simulate_mode(tmp_path):
    out_file = str(tmp_path / "simulated.png")
    model = MinimaxImageModel({"output_root": str(tmp_path)}, env={"MINIMAX_SIMULATE": "1"})
    path, elapsed = model.generate("a cute cat", out_file)
    assert os.path.isfile(path)
    with open(path, "rb") as f:
        assert f.read() == MINIMAL_PNG_BYTES


def test_minimax_missing_key_raises(tmp_path):
    out_file = str(tmp_path / "out.png")
    model = MinimaxImageModel({"output_root": str(tmp_path)}, env={"MINIMAX_API_KEY": ""})
    with pytest.raises(RuntimeError, match="MINIMAX_API_KEY"):
        model.generate("test prompt", out_file)


def test_minimax_successful_generate(tmp_path):
    out_file = str(tmp_path / "out.png")
    model = MinimaxImageModel({"output_root": str(tmp_path)}, env={"MINIMAX_API_KEY": "test-key-123"})

    mock_post_resp = Mock()
    mock_post_resp.status_code = 200
    mock_post_resp.json.return_value = {
        "base_resp": {"status_code": 0, "status_msg": "success"},
        "data": {
            "image_urls": ["https://mock.minimax.chat/files/test.png"]
        }
    }

    mock_dl_resp = Mock()
    mock_dl_resp.status_code = 200
    mock_dl_resp.content = MINIMAL_PNG_BYTES

    with patch("requests.post", return_value=mock_post_resp) as mock_post, \
         patch("requests.get", return_value=mock_dl_resp) as mock_get:
        path, elapsed = model.generate(
            "a futuristic cityscape",
            out_file,
            model_name="minimax/h3-image",
            size="1024*576",
        )
        assert path == out_file
        assert os.path.isfile(out_file)
        assert os.path.getsize(out_file) == len(MINIMAL_PNG_BYTES)

        # Verify POST payload
        mock_post.assert_called_once()
        call_args = mock_post.call_args
        assert call_args[1]["headers"]["Authorization"] == "Bearer test-key-123"
        payload = call_args[1]["json"]
        assert payload["model"] == "MiniMax-H3-Image"
        assert payload["aspect_ratio"] == "16:9"
        assert payload["prompt"] == "a futuristic cityscape"

        # Verify image download
        mock_get.assert_called_once_with("https://mock.minimax.chat/files/test.png", timeout=60)


def test_minimax_api_error_handling(tmp_path):
    out_file = str(tmp_path / "out.png")
    model = MinimaxImageModel({"output_root": str(tmp_path)}, env={"MINIMAX_API_KEY": "test-key-123"})

    mock_post_resp = Mock()
    mock_post_resp.status_code = 200
    mock_post_resp.json.return_value = {
        "base_resp": {"status_code": 1008, "status_msg": "balance insufficient"},
    }

    with patch("requests.post", return_value=mock_post_resp):
        with pytest.raises(RuntimeError, match="额度不足"):
            model.generate("test prompt", out_file)


def test_minimax_user_isolated_byok_credential(tmp_path):
    from src.core.provider_credentials import bind_provider_credential, reset_provider_credential

    out_file = str(tmp_path / "byok_out.png")
    # 模型本身配置为空，全局环境变量也为空
    model = MinimaxImageModel({"output_root": str(tmp_path)}, env={"MINIMAX_API_KEY": ""})

    # 1. 未绑定用户凭证时，报错
    with pytest.raises(RuntimeError, match="MINIMAX_API_KEY"):
        model.generate("test prompt", out_file)

    # 2. 模拟用户 A 登录并绑定自己的专属凭证
    token_a = bind_provider_credential({"provider": "minimax", "secret": "user-a-secret-key-888"})
    mock_post_resp = Mock()
    mock_post_resp.status_code = 200
    mock_post_resp.json.return_value = {
        "base_resp": {"status_code": 0, "status_msg": "success"},
        "data": {"image_urls": ["https://mock.minimax.chat/files/user_a.png"]},
    }
    mock_dl_resp = Mock()
    mock_dl_resp.status_code = 200
    mock_dl_resp.content = MINIMAL_PNG_BYTES

    try:
        with patch("requests.post", return_value=mock_post_resp) as mock_post, \
             patch("requests.get", return_value=mock_dl_resp):
            model.generate("prompt for user A", out_file)
            assert mock_post.call_args[1]["headers"]["Authorization"] == "Bearer user-a-secret-key-888"
    finally:
        reset_provider_credential(token_a)

    # 3. 模拟用户 B 登录并绑定自己的专属凭证
    token_b = bind_provider_credential({"provider": "minimax", "secret": "user-b-secret-key-999"})
    try:
        with patch("requests.post", return_value=mock_post_resp) as mock_post, \
             patch("requests.get", return_value=mock_dl_resp):
            model.generate("prompt for user B", out_file)
            assert mock_post.call_args[1]["headers"]["Authorization"] == "Bearer user-b-secret-key-999"
    finally:
        reset_provider_credential(token_b)


def test_minimax_mplan_subscription_key_routing(tmp_path):
    out_file = str(tmp_path / "mplan_out.png")
    model = MinimaxImageModel({"output_root": str(tmp_path)}, env={"MINIMAX_API_KEY": "sk-cp-SdhUg-explore-key"})

    mock_post_resp = Mock()
    mock_post_resp.status_code = 200
    mock_post_resp.json.return_value = {
        "base_resp": {"status_code": 0, "status_msg": "success"},
        "data": {"image_urls": ["https://mock.minimax.chat/files/mplan.png"]},
    }
    mock_dl_resp = Mock()
    mock_dl_resp.status_code = 200
    mock_dl_resp.content = MINIMAL_PNG_BYTES

    with patch("requests.post", return_value=mock_post_resp) as mock_post, \
         patch("requests.get", return_value=mock_dl_resp):
        model.generate("an anime warrior", out_file)
        assert mock_post.call_args[0][0] == "https://api.minimaxi.com/v1/images/generations"
        assert mock_post.call_args[1]["headers"]["Authorization"] == "Bearer sk-cp-SdhUg-explore-key"


def test_minimax_h3_highspeed_routes_to_generations_and_parses_list_data(tmp_path):
    out_file = str(tmp_path / "h3_fast.png")
    model = MinimaxImageModel({"output_root": str(tmp_path)}, env={"MINIMAX_API_KEY": "sk-cp-key"})

    mock_post_resp = Mock()
    mock_post_resp.status_code = 200
    mock_post_resp.json.return_value = {
        "data": [{"url": "https://mock.minimax.io/h3_fast.png", "size": "1024x576"}],
    }
    mock_dl_resp = Mock()
    mock_dl_resp.status_code = 200
    mock_dl_resp.content = MINIMAL_PNG_BYTES

    with patch("requests.post", return_value=mock_post_resp) as mock_post, \
         patch("requests.get", return_value=mock_dl_resp):
        path, _ = model.generate("a cat", out_file, model_name="minimax/h3-image-highspeed", size="576*1024")
        assert path == out_file
        assert mock_post.call_args[0][0] == "https://api.minimaxi.com/v1/images/generations"
        assert mock_post.call_args[1]["json"]["model"] == "MiniMax-H3-Image-Highspeed"
        assert mock_post.call_args[1]["json"]["aspect_ratio"] == "9:16"


def test_minimax_h3_with_ref_routes_to_edits_multipart(tmp_path):
    ref_file = tmp_path / "ref.png"
    ref_file.write_bytes(MINIMAL_PNG_BYTES)
    out_file = str(tmp_path / "h3_edit.png")
    model = MinimaxImageModel({"output_root": str(tmp_path)}, env={"MINIMAX_API_KEY": "sk-cp-key"})

    mock_post_resp = Mock()
    mock_post_resp.status_code = 200
    mock_post_resp.json.return_value = {
        "data": [{"url": "https://mock.minimax.io/h3_edit.png"}],
    }
    mock_dl_resp = Mock()
    mock_dl_resp.status_code = 200
    mock_dl_resp.content = MINIMAL_PNG_BYTES

    with patch("requests.post", return_value=mock_post_resp) as mock_post, \
         patch("requests.get", return_value=mock_dl_resp):
        path, _ = model.generate("edit cat", out_file, ref_image_path=str(ref_file), model_name="minimax/h3-image")
        assert path == out_file
        assert mock_post.call_args[0][0] == "https://api.minimaxi.com/v1/images/edits"
        assert mock_post.call_args[1]["data"]["model"] == "MiniMax-H3-Image"
        assert len(mock_post.call_args[1]["files"]) == 1


def test_minimax_image_01_routes_to_legacy_endpoint(tmp_path):
    out_file = str(tmp_path / "img01.png")
    model = MinimaxImageModel({"output_root": str(tmp_path)}, env={"MINIMAX_API_KEY": "sk-cp-key"})

    mock_post_resp = Mock()
    mock_post_resp.status_code = 200
    mock_post_resp.json.return_value = {
        "base_resp": {"status_code": 0, "status_msg": "success"},
        "data": {"image_urls": ["https://mock.minimax.chat/img01.png"]},
    }
    mock_dl_resp = Mock()
    mock_dl_resp.status_code = 200
    mock_dl_resp.content = MINIMAL_PNG_BYTES

    with patch("requests.post", return_value=mock_post_resp) as mock_post, \
         patch("requests.get", return_value=mock_dl_resp):
        model.generate("a dog", out_file, model_name="minimax/image-01")
        assert mock_post.call_args[0][0] == "https://api.minimaxi.com/v1/image_generation"
        assert mock_post.call_args[1]["json"]["model"] == "image-01"


