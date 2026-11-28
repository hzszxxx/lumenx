import pytest
from src.models.xiangongyun_manager import (
    XiangongyunClient,
    XiangongyunManagerError,
    XiangongyunBatchRegistry,
    MAX_BATCH_SIZE,
)


def test_batch_size_limit():
    assert MAX_BATCH_SIZE == 10


def test_client_init_requires_token():
    with pytest.raises(XiangongyunManagerError, match="未配置仙宫云 Access Token"):
        XiangongyunClient("")


def test_batch_registry_lifecycle():
    registry = XiangongyunBatchRegistry()
    batch = registry.register_batch(
        batch_id="b-1",
        project_id="p-1",
        frame_ids=["f-1", "f-2"],
        task_ids=["t-1", "t-2"],
        instance_id="inst-1",
        auto_shutdown=True,
    )
    assert batch["batch_id"] == "b-1"
    assert batch["total_count"] == 2
    assert batch["status"] == "queued"

    active = registry.find_active_batch_for_project("p-1")
    assert active is not None
    assert active["batch_id"] == "b-1"

    updated = registry.update_batch("b-1", status="running", completed_count=1)
    assert updated["status"] == "running"
    assert updated["completed_count"] == 1

    registry.update_batch("b-1", status="completed")
    assert registry.find_active_batch_for_project("p-1") is None


def test_client_mock_methods(monkeypatch):
    client = XiangongyunClient("test_token_12345678")

    class MockResponse:
        def __init__(self, status_code, json_data):
            self.status_code = status_code
            self._json = json_data
            self.text = "ok"

        def json(self):
            return self._json

    # Test get_balance
    monkeypatch.setattr(
        "requests.get",
        lambda url, **kw: MockResponse(200, {"success": True, "data": {"balance": 52.5}}),
    )
    assert client.get_balance() == 52.5

    # Test list_instances
    monkeypatch.setattr(
        "requests.get",
        lambda url, **kw: MockResponse(
            200,
            {
                "success": True,
                "data": {
                    "list": [
                        {"id": "inst-1", "name": "4090", "status": "stopped", "public_ip": "1.2.3.4", "port": 8000}
                    ]
                },
            },
        ),
    )
    instances = client.list_instances()
    assert len(instances) == 1
    assert instances[0]["id"] == "inst-1"

    # Test boot_instance
    monkeypatch.setattr(
        "requests.post",
        lambda url, **kw: MockResponse(200, {"success": True, "message": "booting"}),
    )
    boot_res = client.boot_instance("inst-1")
    assert boot_res.get("success") is True

    # Test shutdown_release_gpu
    monkeypatch.setattr(
        "requests.post",
        lambda url, **kw: MockResponse(200, {"success": True}),
    )
    shutdown_res = client.shutdown_release_gpu("inst-1")
    assert shutdown_res.get("success") is True


def test_ensure_h3_instance_auto_deploys_when_empty(monkeypatch):
    from src.models.xiangongyun_manager import XiangongyunClient, ensure_h3_instance

    client = XiangongyunClient("tok_test")
    monkeypatch.setattr(client, "list_instances", lambda: [])
    monkeypatch.setattr(
        client,
        "list_gpus",
        lambda: [
            {"gpu_model": "NVIDIA GeForce RTX 4090", "gpu_memory": 24, "price_per_hour": 1.89, "data_centers": [{"data_center_id": 1, "available": 2}]},
            {"gpu_model": "NVIDIA GeForce RTX 4090 D 48G", "gpu_memory": 48, "price_per_hour": 2.59, "data_centers": [{"data_center_id": 1, "available": 1}]},
        ],
    )
    deployed = {}

    def fake_deploy(*, gpu_model, data_center_id=1, image_id=None, name=None):
        deployed["gpu_model"] = gpu_model
        deployed["data_center_id"] = data_center_id
        return "inst_new_48g"

    monkeypatch.setattr(client, "deploy_instance", fake_deploy)
    inst_id, gpu_model, newly_deployed = ensure_h3_instance(client)
    assert inst_id == "inst_new_48g"
    assert gpu_model == "NVIDIA GeForce RTX 4090 D 48G"
    assert newly_deployed is True
    assert deployed["data_center_id"] == 1
