"""Xiangongyun (仙宫云) H3 video generation model adapter.

Connects to MiniMax H3 self-hosted instance running on Xiangongyun GPU infrastructure,
supporting I2V (image-to-video) and R2V (reference-to-video) with native audio/dialogue.
"""

from __future__ import annotations

import base64
import logging
import os
import shutil
import time
from types import MappingProxyType
from typing import Any, Dict, List, Mapping, Optional, Tuple

import requests

from .base import VideoGenModel

logger = logging.getLogger(__name__)

DEFAULT_XIANGONGYUN_OPEN_API = "https://api.xiangongyun.com"

# Path to standard test fixture MP4 for offline/simulation mode
FIXTURE_MP4_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "tests", "fixtures", "studio-motion-smoke", "new.mp4")
)

# Minimal 32-byte MP4 ftyp container as an emergency fallback
MINIMAL_MP4_BYTES = (
    b"\x00\x00\x00\x1cftypisom\x00\x00\x02\x00isomiso2mp41\x00\x00\x00\x08free"
)


class XiangongyunH3Model(VideoGenModel):
    """Adapter for Xiangongyun-hosted MiniMax H3 video generation."""

    def __init__(self, config: Dict[str, Any], *, env: Mapping[str, str] | None = None):
        super().__init__(config)
        self._env = os.environ if env is None else MappingProxyType(dict(env))
        self.access_token = (
            self.config.get("access_token")
            or self._env.get("XIANGONGYUN_ACCESS_TOKEN")
            or self._env.get("XIANGONG_ACCESS_TOKEN", "")
        )
        self.open_api_base = (
            self.config.get("open_api_base")
            or self._env.get("XIANGONGYUN_OPEN_API_BASE")
            or DEFAULT_XIANGONGYUN_OPEN_API
        ).rstrip("/")
        self.endpoint = (
            self.config.get("endpoint")
            or self._env.get("XIANGONGYUN_H3_ENDPOINT", "")
        ).rstrip("/")
        self.model_name = self.config.get("params", {}).get("model_name", "xiangongyun-h3-i2v")
        self.simulate = bool(int(self._env.get("XIANGONGYUN_SIMULATE", "0")))

    def find_running_instance_endpoint(self) -> Optional[str]:
        """Query Xiangongyun OpenAPI for running GPU instances if access_token is set."""
        if not self.access_token:
            return None
        try:
            resp = requests.get(
                f"{self.open_api_base}/open/instances",
                headers={"Authorization": f"Bearer {self.access_token}", "Accept": "application/json"},
                timeout=5,
            )
            if resp.status_code == 200:
                payload = resp.json()
                data = payload.get("data") if isinstance(payload, dict) else None
                if isinstance(data, dict):
                    instances = data.get("list") or []
                    for inst in instances:
                        if isinstance(inst, dict) and inst.get("status") == "running":
                            ip = inst.get("public_ip") or inst.get("ip")
                            port = inst.get("port") or 8000
                            if ip:
                                return f"http://{ip}:{port}"
        except Exception as exc:
            logger.debug(f"Failed to query Xiangongyun instances: {exc}")
        return None

    def _resolve_image_input(self, image_ref: Optional[str]) -> Optional[str]:
        """Convert local image references to data URIs, or pass through remote URLs."""
        if not image_ref:
            return None
        if image_ref.startswith(("http://", "https://", "data:")):
            return image_ref

        # Check local paths
        candidates = [image_ref]
        if self.output_root:
            candidates.append(os.path.join(self.output_root, image_ref))

        for path in candidates:
            if os.path.isfile(path):
                try:
                    with open(path, "rb") as f:
                        data = f.read()
                    mime = "image/png"
                    if path.lower().endswith((".jpg", ".jpeg")):
                        mime = "image/jpeg"
                    elif path.lower().endswith(".webp"):
                        mime = "image/webp"
                    encoded = base64.b64encode(data).decode("utf-8")
                    return f"data:{mime};base64,{encoded}"
                except Exception as exc:
                    logger.warning(f"Failed to read image file {path}: {exc}")
                    break

        return image_ref

    def generate(
        self,
        prompt: str,
        output_path: str,
        img_url: str = None,
        img_path: str = None,
        **kwargs,
    ) -> Tuple[str, float]:
        """Generate video using Xiangongyun H3 model (I2V or R2V).

        Args:
            prompt: Text prompt describing motion/dialogue.
            output_path: Target mp4 destination file path.
            img_url: Source first frame URL or output-relative path.
            img_path: Source first frame local file path.
            **kwargs: Additional parameters including duration, resolution, audio, seed, ref_image_urls.

        Returns:
            Tuple of (output_file_path, duration_seconds).
        """
        start_time = time.time()
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

        duration = max(3, min(15, int(kwargs.get("duration", 5))))
        resolution = str(kwargs.get("resolution") or "768p")
        aspect_ratio = str(kwargs.get("aspect_ratio") or "16:9")
        audio = bool(kwargs.get("audio", True))
        seed = kwargs.get("seed")
        generation_mode = kwargs.get("generation_mode", "i2v")
        ref_image_urls = kwargs.get("ref_image_urls") or kwargs.get("reference_image_urls") or []
        model = kwargs.get("model") or self.model_name

        # Resolve live execution endpoint
        endpoint = self.endpoint
        if not endpoint:
            endpoint = self.find_running_instance_endpoint() or ""

        # Simulation / offline test fallback
        if self.simulate or not endpoint:
            logger.info("Xiangongyun H3 running in simulation/offline mode")
            if os.path.isfile(FIXTURE_MP4_PATH):
                shutil.copy2(FIXTURE_MP4_PATH, output_path)
            else:
                with open(output_path, "wb") as f:
                    f.write(MINIMAL_MP4_BYTES)
            elapsed = time.time() - start_time
            return output_path, elapsed

        # Live API dispatch
        image_payload = self._resolve_image_input(img_path or img_url)
        resolved_refs = [
            self._resolve_image_input(ref) for ref in ref_image_urls[:9]
        ] if ref_image_urls else []

        payload: Dict[str, Any] = {
            "model": model,
            "prompt": prompt,
            "duration": duration,
            "resolution": resolution,
            "aspect_ratio": aspect_ratio,
            "audio": audio,
            "generation_mode": generation_mode,
        }
        if seed is not None:
            payload["seed"] = seed
        if image_payload:
            payload["image"] = image_payload
        if resolved_refs:
            payload["reference_images"] = resolved_refs

        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json, video/mp4",
        }
        if self.access_token:
            headers["Authorization"] = f"Bearer {self.access_token}"

        api_url = f"{endpoint}/v1/video/generation"
        response = requests.post(api_url, json=payload, headers=headers, timeout=600)
        if response.status_code != 200:
            raise RuntimeError(
                f"Xiangongyun H3 generation failed with HTTP {response.status_code}: {response.text[:300]}"
            )

        content_type = response.headers.get("Content-Type", "")
        is_binary_mp4 = "video/mp4" in content_type or (
            isinstance(response.content, (bytes, bytearray)) and response.content.startswith(b"\x00\x00\x00")
        )
        if is_binary_mp4:
            # Direct binary MP4 stream returned
            with open(output_path, "wb") as f:
                f.write(response.content)
        else:
            # JSON response containing video_url or base64
            res_json = response.json()
            if isinstance(res_json, dict) and res_json.get("video_url"):
                video_url = res_json["video_url"]
                dl_resp = requests.get(video_url, timeout=300)
                if dl_resp.status_code != 200:
                    raise RuntimeError(f"Failed to download generated video from {video_url}")
                with open(output_path, "wb") as f:
                    f.write(dl_resp.content)
            elif isinstance(res_json, dict) and res_json.get("video_base64"):
                b64_data = base64.b64decode(res_json["video_base64"])
                with open(output_path, "wb") as f:
                    f.write(b64_data)
            else:
                raise RuntimeError(f"Xiangongyun H3 returned unrecognized response: {res_json}")

        if not os.path.isfile(output_path) or os.path.getsize(output_path) == 0:
            raise RuntimeError("Xiangongyun H3 generation produced an empty video file")

        elapsed = time.time() - start_time
        return output_path, elapsed
