import pytest

from src.models.provider_tasks import ProviderHandle, ProviderQueryError, ProviderScope, QueryCapability, ResolvedCredential
from src.models.wanx import WanxModel


SCOPE = ProviderScope(
    provider="dashscope", backend="dashscope", gateway="dashscope",
    base_url="https://dashscope.aliyuncs.com", region="cn-beijing",
    workspace_id="workspace-1", account_identity="account-1",
)
CREDENTIAL = ResolvedCredential(scope=SCOPE, credential_ref="credential-1", secret="secret-1")
HANDLE = ProviderHandle(
    provider_model_id="wan2.7-i2v", task_id="task-1", scope=SCOPE,
    credential_ref="credential-1", query_capability=QueryCapability.BY_TASK_ID,
)


def test_wan27_query_uses_persisted_scope_and_credential(monkeypatch):
    calls = []

    class Response:
        status_code = 200
        def json(self):
            return {"request_id": "request-1", "output": {"task_id": "task-1", "task_status": "SUCCEEDED", "video_url": "https://media.example/video.mp4"}}

    def get(url, **kwargs):
        calls.append((url, kwargs))
        return Response()

    monkeypatch.setattr("src.models.wanx.requests.get", get)
    observed = WanxModel({"params": {}}, env={"DASHSCOPE_API_KEY": "wrong-default"}).query(HANDLE, credential=CREDENTIAL)
    assert observed.task_id == "task-1"
    assert calls[0][0] == "https://dashscope.aliyuncs.com/api/v1/tasks/task-1"
    assert calls[0][1]["headers"]["X-DashScope-WorkSpace"] == "workspace-1"


def test_wan27_query_rejects_credential_scope_mismatch(monkeypatch):
    monkeypatch.setattr("src.models.wanx.requests.get", lambda *args, **kwargs: pytest.fail("query must not start"))
    other = ResolvedCredential(scope=ProviderScope("dashscope", "dashscope", "dashscope", "https://other.example", "cn-beijing", "workspace-1", "account-1"), credential_ref="credential-1", secret="secret-1")
    with pytest.raises(Exception, match="Credential binding"):
        WanxModel({"params": {}}, env={}).query(HANDLE, credential=other)


def test_wan27_query_maps_transport_failure(monkeypatch):
    import requests
    monkeypatch.setattr("src.models.wanx.requests.get", lambda *args, **kwargs: (_ for _ in ()).throw(requests.RequestException("network")))
    with pytest.raises(ProviderQueryError, match="transport"):
        WanxModel({"params": {}}, env={}).query(HANDLE, credential=CREDENTIAL)
