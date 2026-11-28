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
from requests.adapters import HTTPAdapter

logger = logging.getLogger(__name__)

DEFAULT_XIANGONGYUN_OPEN_API = "https://api.xiangongyun.com"
DEFAULT_H3_IMAGE_ID = os.environ.get("XIANGONGYUN_H3_IMAGE_ID", "4750495f-12bf-4bd7-93f4-f05b20dcbb77")
MAX_BATCH_SIZE = 10
_ORIG_REQUESTS_GET = requests.get
_ORIG_REQUESTS_POST = requests.post


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
        self._session = requests.Session()
        adapter = HTTPAdapter(pool_connections=8, pool_maxsize=8)
        self._session.mount("http://", adapter)
        self._session.mount("https://", adapter)

    def _headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

    def _get(self, url: str, **kwargs):
        if requests.get is _ORIG_REQUESTS_GET:
            return self._session.get(url, **kwargs)
        return requests.get(url, **kwargs)

    def _post(self, url: str, **kwargs):
        if requests.post is _ORIG_REQUESTS_POST:
            return self._session.post(url, **kwargs)
        return requests.post(url, **kwargs)

    def get_balance(self) -> float:
        """Fetch current balance in CNY."""
        try:
            resp = self._get(
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
            resp = self._get(
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
            resp = self._post(
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
            resp = self._post(
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

    def list_gpus(self) -> List[Dict[str, Any]]:
        """List available GPU models and stock counts across datacenters."""
        try:
            resp = self._get(
                f"{self.open_api_base}/open/gpus",
                headers=self._headers(),
                timeout=10,
            )
            if resp.status_code != 200:
                raise XiangongyunManagerError(f"查询仙宫云 GPU 库存失败 (HTTP {resp.status_code})")
            payload = resp.json()
            data = payload.get("data") if isinstance(payload, dict) else None
            if isinstance(data, list):
                return [item for item in data if isinstance(item, dict)]
            return []
        except Exception as exc:
            if isinstance(exc, XiangongyunManagerError):
                raise
            raise XiangongyunManagerError(f"无法连接仙宫云 GPU 库存接口: {exc}") from exc

    def select_available_gpu_for_deploy(self, preferred_dc_id: int = 1) -> Optional[Tuple[str, int]]:
        """Select the best in-stock GPU model and data_center_id (preferring 48G for H3)."""
        gpus = self.list_gpus()
        candidates: List[Tuple[int, float, str, int]] = []
        for g in gpus:
            gpu_model = str(g.get("gpu_model") or g.get("name") or "").strip()
            if not gpu_model:
                continue
            gpu_mem = int(g.get("gpu_memory") or 0)
            price = float(g.get("price_per_hour") or 999.0)
            dcs = g.get("data_centers")
            if isinstance(dcs, list) and dcs:
                for dc in dcs:
                    if not isinstance(dc, dict):
                        continue
                    avail = int(dc.get("available") or 0)
                    if avail > 0:
                        dc_id = int(dc.get("data_center_id") or preferred_dc_id)
                        mem_tier = 2 if gpu_mem >= 48 else (1 if gpu_mem >= 24 else 0)
                        candidates.append((mem_tier, -price, gpu_model, dc_id))
            elif int(g.get("available") or 0) > 0:
                mem_tier = 2 if gpu_mem >= 48 else (1 if gpu_mem >= 24 else 0)
                candidates.append((mem_tier, -price, gpu_model, preferred_dc_id))
        if not candidates:
            return None
        candidates.sort(key=lambda item: (item[0], item[1]), reverse=True)
        _, _, best_gpu, best_dc = candidates[0]
        return best_gpu, best_dc

    def deploy_instance(
        self,
        *,
        gpu_model: str,
        data_center_id: int = 1,
        image_id: str = DEFAULT_H3_IMAGE_ID,
        name: Optional[str] = None,
    ) -> str:
        """Automatically deploy a new H3 GPU instance and return its instance ID."""
        payload: Dict[str, Any] = {
            "image_id": image_id,
            "image_type": "community",
            "gpu_model": gpu_model,
            "gpu_used": 1,
            "data_center_id": data_center_id,
            "name": name or f"LumenX-H3-{int(time.time())}",
        }
        try:
            resp = self._post(
                f"{self.open_api_base}/open/instance/deploy",
                json=payload,
                headers=self._headers(),
                timeout=20,
            )
            if resp.status_code != 200:
                raise XiangongyunManagerError(
                    f"仙宫云自动部署 H3 实例失败 (HTTP {resp.status_code}): {resp.text[:200]}"
                )
            result = resp.json()
            if isinstance(result, dict) and result.get("success") is False:
                msg = result.get("message") or result.get("msg") or "未知错误"
                raise XiangongyunManagerError(f"仙宫云自动部署拒绝: {msg}")
            data = result.get("data") if isinstance(result, dict) else None
            inst_id = (
                data.get("id") if isinstance(data, dict)
                else (result.get("id") if isinstance(result, dict) else None)
            )
            if not inst_id:
                raise XiangongyunManagerError(f"仙宫云部署返回格式异常（未包含实例 ID）: {result}")
            return str(inst_id)
        except Exception as exc:
            if isinstance(exc, XiangongyunManagerError):
                raise
            raise XiangongyunManagerError(f"自动部署实例网络异常: {exc}") from exc

    def list_running_endpoints(self) -> List[str]:
        """Return all currently running instance endpoint URLs."""
        endpoints: List[str] = []
        for inst in self.list_instances():
            if str(inst.get("status") or "").lower() == "running":
                ip = inst.get("public_ip") or inst.get("ip")
                port = inst.get("port") or 8000
                if ip:
                    endpoints.append(f"http://{ip}:{port}")
        return endpoints

    def wait_until_ready(
        self,
        instance_id: str,
        timeout_sec: int = 300,
        poll_interval: Optional[float] = None,
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
                                h_resp = self._get(f"{endpoint}/health", timeout=1.5)
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

            elapsed = time.time() - start_time
            sleep_for = poll_interval if poll_interval is not None else (1.5 if elapsed < 30 else 2.5)
            time.sleep(sleep_for)

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


def ensure_h3_instance(client: XiangongyunClient) -> Tuple[str, Optional[str], bool]:
    """Return (instance_id, matched_gpu_model, newly_deployed) by auto-matching or auto-deploying."""
    instances = client.list_instances()
    if instances:
        best = select_best_h3_instance(instances)
        if best is not None:
            inst_id = str(best.get("id"))
            gpu_model = resolve_gpu_model_for_instance(best)
            if str(best.get("status") or "").lower() != "running":
                client.boot_instance(inst_id, gpu_model=gpu_model)
            return inst_id, gpu_model, False

    available = client.select_available_gpu_for_deploy()
    if not available:
        raise XiangongyunManagerError(
            "仙宫云当前机房 GPU 算力库存已满（可用数为 0），暂时无法自动部署 H3 实例，请稍后再试或切换 Wan / Kling 等云端模型。"
        )
    gpu_model, dc_id = available
    inst_id = client.deploy_instance(gpu_model=gpu_model, data_center_id=dc_id)
    return inst_id, gpu_model, True


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
