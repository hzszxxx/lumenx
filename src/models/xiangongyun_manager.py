"""Xiangongyun (仙宫云) GPU instance lifecycle manager and batch scheduler.

Manages instance status discovery, on-demand booting (/open/instance/boot),
safe shutdown & GPU release (/open/instance/shutdown_release_gpu), and
batch task orchestration for up to 10 video generation jobs per session.
"""

from __future__ import annotations

import logging
import os
import threading
import time
from typing import Any, Callable, Dict, List, Optional, Tuple
import requests

logger = logging.getLogger(__name__)

DEFAULT_XIANGONGYUN_OPEN_API = "https://api.xiangongyun.com"
MAX_BATCH_SIZE = 10


class XiangongyunManagerError(RuntimeError):
    """Base error for Xiangongyun management operations."""
    pass


class XiangongyunClient:
    """HTTP client for Xiangongyun OpenAPI instance lifecycle."""

    def __init__(self, access_token: str, open_api_base: str = DEFAULT_XIANGONGYUN_OPEN_API):
        if not access_token:
            raise XiangongyunManagerError("未配置仙宫云 Access Token，请在平台设置中先绑定账号。")
        self.access_token = access_token.strip()
        self.open_api_base = open_api_base.rstrip("/")

    def _headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

    def get_balance(self) -> float:
        """Fetch current balance in CNY."""
        try:
            resp = requests.get(
                f"{self.open_api_base}/open/balance",
                headers=self._headers(),
                timeout=10,
            )
            if resp.status_code != 200:
                raise XiangongyunManagerError(f"查询仙宫云余额失败 (HTTP {resp.status_code})")
            payload = resp.json()
            data = payload.get("data") if isinstance(payload, dict) else None
            if isinstance(data, dict) and "balance" in data:
                return float(data["balance"])
            raise XiangongyunManagerError("仙宫云余额响应格式异常")
        except Exception as exc:
            if isinstance(exc, XiangongyunManagerError):
                raise
            raise XiangongyunManagerError(f"无法连接仙宫云余额接口: {exc}") from exc

    def list_instances(self) -> List[Dict[str, Any]]:
        """List all instances under the account."""
        try:
            resp = requests.get(
                f"{self.open_api_base}/open/instances",
                headers=self._headers(),
                timeout=10,
            )
            if resp.status_code != 200:
                raise XiangongyunManagerError(f"查询仙宫云实例列表失败 (HTTP {resp.status_code})")
            payload = resp.json()
            data = payload.get("data") if isinstance(payload, dict) else None
            if isinstance(data, dict):
                raw_list = data.get("list")
                if isinstance(raw_list, list):
                    return [item for item in raw_list if isinstance(item, dict)]
            return []
        except Exception as exc:
            if isinstance(exc, XiangongyunManagerError):
                raise
            raise XiangongyunManagerError(f"无法连接仙宫云实例接口: {exc}") from exc

    def get_instance(self, instance_id: str) -> Optional[Dict[str, Any]]:
        """Get details of a single instance."""
        instances = self.list_instances()
        for inst in instances:
            if inst.get("id") == instance_id:
                return inst
        return None

    def boot_instance(self, instance_id: str, gpu_model: Optional[str] = None) -> Dict[str, Any]:
        """Boot a stopped/shutdown instance."""
        payload: Dict[str, Any] = {"id": instance_id}
        if gpu_model:
            payload["gpu_model"] = gpu_model
        try:
            resp = requests.post(
                f"{self.open_api_base}/open/instance/boot",
                json=payload,
                headers=self._headers(),
                timeout=15,
            )
            if resp.status_code != 200:
                raise XiangongyunManagerError(
                    f"仙宫云实例开机请求失败 (HTTP {resp.status_code}): {resp.text[:200]}"
                )
            result = resp.json()
            if isinstance(result, dict) and result.get("success") is False:
                msg = result.get("message") or result.get("msg") or "未知错误"
                raise XiangongyunManagerError(f"仙宫云开机拒绝: {msg}")
            return result
        except Exception as exc:
            if isinstance(exc, XiangongyunManagerError):
                raise
            raise XiangongyunManagerError(f"开机请求网络异常: {exc}") from exc

    def shutdown_release_gpu(self, instance_id: str) -> Dict[str, Any]:
        """Shutdown instance and release GPU to immediately stop billing."""
        try:
            resp = requests.post(
                f"{self.open_api_base}/open/instance/shutdown_release_gpu",
                json={"id": instance_id},
                headers=self._headers(),
                timeout=15,
            )
            if resp.status_code != 200:
                logger.warning(
                    f"仙宫云关机释放 GPU 失败 (HTTP {resp.status_code}): {resp.text[:200]}"
                )
            return resp.json() if resp.status_code == 200 else {}
        except Exception as exc:
            logger.warning(f"关机释放 GPU 网络异常: {exc}")
            return {}

    def wait_until_ready(
        self,
        instance_id: str,
        timeout_sec: int = 300,
        poll_interval: int = 4,
        probe_fn: Optional[Callable[[str], bool]] = None,
    ) -> str:
        """Poll instance until it is running and service endpoint responds.
        
        Returns the resolved endpoint URL (e.g. 'http://1.2.3.4:8000').
        """
        start_time = time.time()
        logger.info(f"Waiting for Xiangongyun instance {instance_id} to become ready...")

        while time.time() - start_time < timeout_sec:
            inst = self.get_instance(instance_id)
            if inst:
                status = str(inst.get("status", "")).lower()
                if status == "running":
                    ip = inst.get("public_ip") or inst.get("ip")
                    port = inst.get("port") or 8000
                    if ip:
                        endpoint = f"http://{ip}:{port}"
                        # Check endpoint accessibility if probe_fn is provided, else check /health
                        is_ready = False
                        if probe_fn:
                            is_ready = probe_fn(endpoint)
                        else:
                            try:
                                h_resp = requests.get(f"{endpoint}/health", timeout=2)
                                if h_resp.status_code in {200, 404, 405}:
                                    is_ready = True
                            except Exception:
                                # Port might still be initializing container startup
                                is_ready = False

                        if is_ready:
                            logger.info(f"Xiangongyun instance {instance_id} ready at {endpoint}")
                            return endpoint

                elif status in {"error", "failed", "aborted"}:
                    raise XiangongyunManagerError(f"仙宫云实例启动失败，状态异常: {status}")

            time.sleep(poll_interval)

        raise XiangongyunManagerError(
            f"仙宫云实例开机超时（超过 {timeout_sec} 秒未就绪）。请登录仙宫云控制台检查实例日志。"
        )


_H3_PREFERRED_GPU_KEYWORDS = ("4090", "a100", "l40", "h100", "h800", "4090d")


def resolve_gpu_model_for_instance(inst: Optional[Dict[str, Any]]) -> Optional[str]:
    """Return the instance's GPU model or recommended H3 default for auto-boot."""
    if not isinstance(inst, dict):
        return None
    raw_gpu = str(inst.get("gpu_model") or inst.get("gpu") or "").strip()
    if raw_gpu:
        return raw_gpu
    name = str(inst.get("name") or "").lower()
    for kw in _H3_PREFERRED_GPU_KEYWORDS:
        if kw in name:
            return kw.upper()
    return "RTX 4090"


def select_best_h3_instance(instances: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Automatically match the best Xiangongyun instance (running + H3-capable GPU first)."""
    if not instances:
        return None

    def _score(inst: Dict[str, Any]) -> tuple[int, int, int]:
        status = str(inst.get("status") or "").lower()
        is_running = 1 if status == "running" else 0
        gpu_text = f"{inst.get('gpu_model', '')} {inst.get('name', '')}".lower()
        is_h3 = 1 if ("h3" in gpu_text or "minimax" in gpu_text) else 0
        gpu_rank = 0
        for idx, kw in enumerate(_H3_PREFERRED_GPU_KEYWORDS):
            if kw in gpu_text:
                gpu_rank = len(_H3_PREFERRED_GPU_KEYWORDS) - idx
                break
        return (is_running, is_h3, gpu_rank)

    return max(instances, key=_score)


class XiangongyunBatchRegistry:
    """In-memory thread-safe state registry for active and recent batch jobs."""

    def __init__(self):
        self._lock = threading.Lock()
        self._batches: Dict[str, Dict[str, Any]] = {}

    def register_batch(
        self,
        batch_id: str,
        project_id: str,
        frame_ids: List[str],
        task_ids: List[str],
        instance_id: str,
        auto_shutdown: bool = True,
    ) -> Dict[str, Any]:
        with self._lock:
            record = {
                "batch_id": batch_id,
                "project_id": project_id,
                "instance_id": instance_id,
                "frame_ids": list(frame_ids),
                "task_ids": list(task_ids),
                "auto_shutdown": auto_shutdown,
                "status": "queued",  # queued, booting, running, completed, failed, cancelled
                "current_step": "准备中",
                "completed_count": 0,
                "total_count": len(frame_ids),
                "error": None,
                "created_at": time.time(),
                "updated_at": time.time(),
            }
            self._batches[batch_id] = record
            return dict(record)

    def get_batch(self, batch_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            record = self._batches.get(batch_id)
            return dict(record) if record else None

    def update_batch(self, batch_id: str, **kwargs: Any) -> Optional[Dict[str, Any]]:
        with self._lock:
            record = self._batches.get(batch_id)
            if not record:
                return None
            record.update(kwargs)
            record["updated_at"] = time.time()
            return dict(record)

    def find_active_batch_for_project(self, project_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            for b in self._batches.values():
                if b["project_id"] == project_id and b["status"] in {"queued", "booting", "running"}:
                    return dict(b)
            return None


batch_registry = XiangongyunBatchRegistry()
