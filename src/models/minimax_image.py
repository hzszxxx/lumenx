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

try:
    from ..core.provider_credentials import current_provider_credential
except Exception:
    try:
        from src.core.provider_credentials import current_provider_credential
    except Exception:
        def current_provider_credential(_provider: str):
            return None

from .image import ImageGenModel

logger = logging.getLogger(__name__)

DEFAULT_MINIMAX_BASE_URL = "https://api.minimaxi.chat"
DEFAULT_MINIMAX_MPLAN_BASE_URL = "https://api.minimaxi.com"

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

    def _resolve_image_bytes(self, image_ref: Optional[str]) -> Optional[Tuple[str, bytes, str]]:
        """Resolve local file, data URI, or HTTP URL to (filename, bytes, mime_type)."""
        if not image_ref:
            return None
        if image_ref.startswith("data:"):
            try:
                header, b64 = image_ref.split(",", 1)
                mime = header.split(";")[0].split(":", 1)[1] if ":" in header else "image/png"
                ext = mimetypes.guess_extension(mime) or ".png"
                return f"ref{ext}", base64.b64decode(b64), mime
            except Exception as exc:
                logger.warning(f"Failed to decode data URI reference image: {exc}")
                return None
        if image_ref.startswith(("http://", "https://")):
            try:
                dl = requests.get(image_ref, timeout=30)
                if dl.status_code == 200 and dl.content:
                    mime = dl.headers.get("content-type", "image/png").split(";")[0].strip()
                    ext = mimetypes.guess_extension(mime) or ".png"
                    return f"ref{ext}", dl.content, mime
            except Exception as exc:
                logger.warning(f"Failed to download reference image {image_ref}: {exc}")
                return None

        candidates = [image_ref]
        if self.output_root:
            candidates.append(os.path.join(self.output_root, image_ref))

        for path in candidates:
            if os.path.isfile(path):
                try:
                    mime, _ = mimetypes.guess_type(path)
                    mime = mime or "image/png"
                    with open(path, "rb") as f:
                        return os.path.basename(path) or "ref.png", f.read(), mime
                except Exception as exc:
                    logger.warning(f"Failed to read reference image file {path}: {exc}")
                    break

        return None

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

        # 优先读取当前请求上下文中绑定的用户专属 BYOK 凭证（多用户完全隔离）
        credential = current_provider_credential("minimax")
        api_key = (
            (credential.get("secret") if credential else None)
            or self.api_key
            or self._env.get("MINIMAX_API_KEY", "")
        )
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

        is_legacy_image01 = api_model_id == "image-01"
        resolved_bytes = []
        if not is_legacy_image01 and all_refs:
            for ref in all_refs[:16]:
                resolved = self._resolve_image_bytes(ref)
                if resolved:
                    resolved_bytes.append(resolved)

        use_edits_endpoint = not is_legacy_image01 and bool(resolved_bytes)
        if is_legacy_image01:
            endpoint_path = "/v1/image_generation"
        elif use_edits_endpoint:
            endpoint_path = "/v1/images/edits"
        else:
            endpoint_path = "/v1/images/generations"

        # 确定端点列表：支持 M Plan 订阅 Key (sk-cp-) 自动切换到 api.minimaxi.com / api.minimax.io
        is_subscription_key = api_key.startswith("sk-cp-")
        has_custom_base = bool(self.config.get("base_url") or self._env.get("MINIMAX_BASE_URL"))
        if has_custom_base:
            base_urls = [self.base_url.rstrip("/")]
        elif is_subscription_key:
            base_urls = [DEFAULT_MINIMAX_MPLAN_BASE_URL, "https://api.minimax.io"]
        else:
            base_urls = [self.base_url.rstrip("/"), DEFAULT_MINIMAX_MPLAN_BASE_URL]

        candidate_endpoints = [f"{base}{endpoint_path}" for base in base_urls]

        logger.info(
            f"Calling MiniMax image generation: model={api_model_id}, aspect_ratio={aspect_ratio}, "
            f"endpoint_path={endpoint_path}, refs={len(resolved_bytes)}, is_subscription={is_subscription_key}"
        )

        resp = None
        last_err = None
        for endpoint in candidate_endpoints:
            try:
                if use_edits_endpoint:
                    form_data: Dict[str, Any] = {
                        "model": api_model_id,
                        "prompt": prompt,
                        "aspect_ratio": aspect_ratio,
                        "response_format": "url",
                    }
                    if "seed" in kwargs and kwargs["seed"] is not None:
                        form_data["seed"] = str(kwargs["seed"])
                    files = [("images", (fname, content, mime)) for fname, content, mime in resolved_bytes]
                    resp = requests.post(
                        endpoint,
                        data=form_data,
                        files=files,
                        headers={"Authorization": f"Bearer {api_key}", "Accept": "application/json"},
                        timeout=120,
                    )
                else:
                    payload: Dict[str, Any] = {
                        "model": api_model_id,
                        "prompt": prompt,
                        "aspect_ratio": aspect_ratio,
                        "response_format": "url",
                    }
                    if is_legacy_image01:
                        payload["prompt_optimizer"] = kwargs.get("prompt_optimizer", True)
                    else:
                        payload["n"] = 1
                    if "seed" in kwargs and kwargs["seed"] is not None:
                        payload["seed"] = kwargs["seed"]
                    resp = requests.post(
                        endpoint,
                        json=payload,
                        headers={
                            "Authorization": f"Bearer {api_key}",
                            "Content-Type": "application/json",
                            "Accept": "application/json",
                        },
                        timeout=120,
                    )
                if resp.status_code == 200:
                    break
                elif resp.status_code in (401, 403) and len(candidate_endpoints) > 1:
                    last_err = f"HTTP {resp.status_code}: {resp.text[:200]}"
                    continue
                else:
                    last_err = f"HTTP {resp.status_code}: {resp.text[:200]}"
                    break
            except Exception as e:
                last_err = str(e)
                continue

        if resp is None or resp.status_code != 200:
            if is_subscription_key and (resp is not None and resp.status_code in (401, 403)):
                raise RuntimeError(
                    f"MiniMax 生图认证失败 ({resp.status_code})：您的 Key 为 M Plan 订阅 Key (sk-cp-)，"
                    f"系统已自动尝试连接官方订阅端点。请检查 M Plan Explore 订阅是否有效。详情: {last_err}"
                )
            raise RuntimeError(
                f"MiniMax image generation failed: {last_err or (f'HTTP {resp.status_code}' if resp else 'No response')}"
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

        # Extract generated image URL or base64 (supports both OpenAI-style list and legacy dict)
        data = res_json.get("data")
        items = res_json.get("items") or []

        image_url = None
        b64_str = None

        if isinstance(data, list) and data:
            first = data[0] if isinstance(data[0], dict) else {}
            image_url = first.get("url")
            b64_str = first.get("b64_json")
        elif isinstance(data, dict):
            image_urls = data.get("image_urls") or []
            image_base64_list = data.get("image_base64") or []
            if image_urls and isinstance(image_urls[0], str):
                image_url = image_urls[0]
            elif image_base64_list and isinstance(image_base64_list[0], str):
                b64_str = image_base64_list[0]

        if not image_url and not b64_str and items and isinstance(items[0], dict):
            image_url = items[0].get("url")

        if image_url:
            dl_resp = requests.get(image_url, timeout=60)
            if dl_resp.status_code != 200:
                raise RuntimeError(f"Failed to download generated image from {image_url}")
            with open(output_path, "wb") as f:
                f.write(dl_resp.content)
        elif b64_str:
            b64_data = base64.b64decode(b64_str)
            with open(output_path, "wb") as f:
                f.write(b64_data)
        else:
            raise RuntimeError(f"MiniMax returned unrecognized image response: {res_json}")

        if not os.path.isfile(output_path) or os.path.getsize(output_path) == 0:
            raise RuntimeError("MiniMax image generation produced an empty image file")

        elapsed = time.time() - start_time
        return output_path, elapsed
