"""MiniMax H3-Image and Image-01 generation model adapter."""

from __future__ import annotations

import base64
import logging
import mimetypes
import os
import time
from types import MappingProxyType
from typing import Any, Dict, List, Mapping, Optional, Tuple

import requests

from .image import ImageGenModel

logger = logging.getLogger(__name__)

DEFAULT_MINIMAX_BASE_URL = "https://api.minimaxi.chat"

# Minimal 1x1 transparent PNG for simulation / offline tests
MINIMAL_PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00"
    b"\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)


def map_size_to_aspect_ratio(size: Optional[str]) -> str:
    """Map width*height dimensions or aspect ratio strings to MiniMax aspect_ratio."""
    if not size:
        return "16:9"
    size_str = str(size).strip().lower()
    if size_str in {"16:9", "9:16", "1:1", "4:3", "3:4", "21:9"}:
        return size_str
    delimiters = ["*", "x", "×"]
    for d in delimiters:
        if d in size_str:
            parts = size_str.split(d)
            if len(parts) == 2:
                try:
                    w, h = float(parts[0].strip()), float(parts[1].strip())
                    if h <= 0:
                        continue
                    ratio = w / h
                    if ratio >= 2.1:
                        return "21:9"
                    elif ratio >= 1.55:
                        return "16:9"
                    elif ratio >= 1.15:
                        return "4:3"
                    elif ratio >= 0.88:
                        return "1:1"
                    elif ratio >= 0.65:
                        return "3:4"
                    else:
                        return "9:16"
                except ValueError:
                    pass
    return "16:9"


def map_model_name_to_api_id(model_name: Optional[str]) -> str:
    """Resolve LumenX model identifier to MiniMax API model ID."""
    if not model_name:
        return "MiniMax-H3-Image"
    clean = str(model_name).strip().lower()
    if "highspeed" in clean:
        return "MiniMax-H3-Image-Highspeed"
    if "image-01" in clean:
        return "image-01"
    if "h3" in clean:
        return "MiniMax-H3-Image"
    return "MiniMax-H3-Image"


class MinimaxImageModel(ImageGenModel):
    """Adapter for MiniMax Image Generation API (H3-Image & Image-01)."""

    def __init__(self, config: Optional[Dict[str, Any]] = None, *, env: Mapping[str, str] | None = None):
        super().__init__(config or {})
        self.params = self.config.get("params", {})
        self._env = os.environ if env is None else MappingProxyType(dict(env))
        self.api_key = (
            self.config.get("api_key")
            or self._env.get("MINIMAX_API_KEY", "")
        )
        self.base_url = (
            self.config.get("base_url")
            or self._env.get("MINIMAX_BASE_URL", "")
            or DEFAULT_MINIMAX_BASE_URL
        ).rstrip("/")
        self.model_name = self.params.get("model_name", "minimax/h3-image")
        self.simulate = bool(int(self._env.get("MINIMAX_SIMULATE", "0")))

    def _resolve_image_input(self, image_ref: Optional[str]) -> Optional[str]:
        """Convert local image references to data URIs, or pass through remote URLs."""
        if not image_ref:
            return None
        if image_ref.startswith(("http://", "https://", "data:")):
            return image_ref

        candidates = [image_ref]
        if self.output_root:
            candidates.append(os.path.join(self.output_root, image_ref))

        for path in candidates:
            if os.path.isfile(path):
                try:
                    mime, _ = mimetypes.guess_type(path)
                    mime = mime or "image/png"
                    with open(path, "rb") as f:
                        data = f.read()
                    encoded = base64.b64encode(data).decode("utf-8")
                    return f"data:{mime};base64,{encoded}"
                except Exception as exc:
                    logger.warning(f"Failed to read reference image file {path}: {exc}")
                    break

        return image_ref

    def generate(
        self,
        prompt: str,
        output_path: str,
        ref_image_path: str = None,
        ref_image_paths: list = None,
        model_name: str = None,
        size: str = None,
        **kwargs,
    ) -> Tuple[str, float]:
        """Generate image via MiniMax Image Generation API.

        Args:
            prompt: Text prompt describing the target image.
            output_path: Target image file path.
            ref_image_path: Single reference image path (for I2I / subject consistency).
            ref_image_paths: List of reference image paths (up to 16 for H3-Image).
            model_name: Target model identifier (minimax/h3-image, image-01, etc.).
            size: Target dimensions (e.g., 1024*576, 576*1024, 16:9).
            **kwargs: Extra parameters (e.g. prompt_optimizer, seed).

        Returns:
            Tuple of (output_file_path, duration_seconds).
        """
        start_time = time.time()
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

        if self.simulate:
            logger.info("MinimaxImageModel running in simulation mode")
            with open(output_path, "wb") as f:
                f.write(MINIMAL_PNG_BYTES)
            elapsed = time.time() - start_time
            return output_path, elapsed

        api_key = self.api_key or self._env.get("MINIMAX_API_KEY", "")
        if not api_key:
            raise RuntimeError("MiniMax API Key 未配置，请先在设置中配置 MINIMAX_API_KEY。")

        effective_model_name = model_name or self.model_name
        api_model_id = map_model_name_to_api_id(effective_model_name)
        aspect_ratio = map_size_to_aspect_ratio(size or self.params.get("size"))

        # Collect reference images (up to 16 supported by H3-Image)
        all_refs = []
        if ref_image_path:
            all_refs.append(ref_image_path)
        if ref_image_paths:
            all_refs.extend(ref_image_paths)
        resolved_refs = [
            self._resolve_image_input(ref) for ref in all_refs[:16] if ref
        ]
        resolved_refs = [r for r in resolved_refs if r]

        payload: Dict[str, Any] = {
            "model": api_model_id,
            "prompt": prompt,
            "aspect_ratio": aspect_ratio,
            "response_format": "url",
            "prompt_optimizer": kwargs.get("prompt_optimizer", True),
        }
        if "seed" in kwargs and kwargs["seed"] is not None:
            payload["seed"] = kwargs["seed"]
        if resolved_refs and api_model_id != "image-01":
            payload["reference_images"] = resolved_refs

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

        endpoint = f"{self.base_url}/v1/image_generation"
        logger.info(f"Calling MiniMax image generation: model={api_model_id}, aspect_ratio={aspect_ratio}")

        resp = requests.post(endpoint, json=payload, headers=headers, timeout=120)
        if resp.status_code != 200:
            raise RuntimeError(
                f"MiniMax image generation failed with HTTP {resp.status_code}: {resp.text[:300]}"
            )

        res_json = resp.json()
        base_resp = res_json.get("base_resp") or {}
        status_code = base_resp.get("status_code", 0)
        status_msg = base_resp.get("status_msg", "success")

        if status_code != 0:
            if status_code == 1004:
                raise RuntimeError(f"MiniMax 认证失败 (1004)：API Key 无效或未授权。详情: {status_msg}")
            elif status_code == 1008:
                raise RuntimeError(f"MiniMax 额度不足 (1008)：账户余额已耗尽，请充值后重试。详情: {status_msg}")
            elif status_code in (1026, 2049):
                raise RuntimeError(f"MiniMax 内容合规拦截 ({status_code})：提示词或参考图触发安全审查。详情: {status_msg}")
            elif status_code == 1002:
                raise RuntimeError(f"MiniMax 请求限流 (1002)：并发超过阈值，请稍候重试。详情: {status_msg}")
            raise RuntimeError(f"MiniMax 生图异常 ({status_code}): {status_msg}")

        # Extract generated image URL or base64
        data = res_json.get("data") or {}
        image_urls = data.get("image_urls") or []
        items = res_json.get("items") or []
        image_base64_list = data.get("image_base64") or []

        image_url = None
        if image_urls and isinstance(image_urls[0], str):
            image_url = image_urls[0]
        elif items and isinstance(items[0], dict) and items[0].get("url"):
            image_url = items[0]["url"]

        if image_url:
            dl_resp = requests.get(image_url, timeout=60)
            if dl_resp.status_code != 200:
                raise RuntimeError(f"Failed to download generated image from {image_url}")
            with open(output_path, "wb") as f:
                f.write(dl_resp.content)
        elif image_base64_list and isinstance(image_base64_list[0], str):
            b64_data = base64.b64decode(image_base64_list[0])
            with open(output_path, "wb") as f:
                f.write(b64_data)
        else:
            raise RuntimeError(f"MiniMax returned unrecognized image response: {res_json}")

        if not os.path.isfile(output_path) or os.path.getsize(output_path) == 0:
            raise RuntimeError("MiniMax image generation produced an empty image file")

        elapsed = time.time() - start_time
        return output_path, elapsed
