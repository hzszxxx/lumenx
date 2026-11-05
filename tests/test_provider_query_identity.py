import pytest

from src.models.provider_execution import ProviderExecutionRecord
from src.models.provider_recovery import ProviderRecoveryError, query_identity_from_record


def _record(**scope):
    return ProviderExecutionRecord(
        attempt_id="attempt-1",
        phase="submitted",
        provider_model_id="seedance-2.0-t2v",
        scope=scope,
        credential_ref="credential-1",
        fingerprint="a" * 64,
        handle=None,
    )


def test_query_identity_comes_only_from_persisted_scope():
    record = _record(
        provider="seedance",
        backend="seedance_http",
        gateway="seedance_http",
        base_url="https://provider.example",
        region="cn-beijing",
        workspace_id="workspace-1",
        account_identity="account-1",
    )
    assert query_identity_from_record(record) == {
        "provider": "seedance",
        "account": "account-1",
        "region": "cn-beijing",
        "workspace": "workspace-1",
        "endpoint": "https://provider.example",
    }


def test_query_identity_rejects_legacy_scope_without_authority():
    record = _record(
        provider="seedance",
        backend="seedance_http",
        gateway="seedance_http",
        base_url="https://provider.example",
        region="cn-beijing",
    )
    with pytest.raises(ProviderRecoveryError, match="provider_query_identity_incomplete"):
        query_identity_from_record(record)
