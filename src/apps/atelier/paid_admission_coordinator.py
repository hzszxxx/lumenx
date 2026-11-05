"""Composition-safe paid admission orchestration.

The coordinator owns ordering only. Storage, credits, and providers remain
injected callbacks so Atelier does not import PlatformService or an adapter.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from .paid_admission import (
    PaidAdmissionResult,
    PaidAdmissionState,
    recover_paid_admission,
    replay_paid_admission,
    require_shared_idempotency_key,
    simulate_paid_admission,
)


@dataclass(frozen=True)
class PaidAdmissionIdentity:
    user_id: str
    project_id: str
    attempt_id: str
    request_key: str

    def __post_init__(self) -> None:
        if not all(isinstance(value, str) and value for value in (self.user_id, self.project_id, self.attempt_id, self.request_key)):
            raise ValueError("paid_admission_identity_incomplete")


@dataclass(frozen=True)
class PaidAdmissionCoordinator:
    save_receipt: Callable[[str], None]
    reserve_credits: Callable[[str], str]
    submit_provider: Callable[[str], Any]
    save_handle: Callable[[str, Any], None]
    release_credits: Callable[[str], None]
    load_receipt: Callable[[str], dict[str, Any]]
    load_reservation: Callable[[str], dict[str, Any]]
    query_provider: Callable[[Any, dict[str, str]], Any]
    save_receipt_for_identity: Callable[[PaidAdmissionIdentity], None] | None = None
    reserve_credits_for_identity: Callable[[PaidAdmissionIdentity], str] | None = None
    submit_provider_for_identity: Callable[[PaidAdmissionIdentity], Any] | None = None
    save_handle_for_identity: Callable[[PaidAdmissionIdentity, Any], None] | None = None

    def start(self, *, request_key: str) -> PaidAdmissionResult:
        require_shared_idempotency_key(request_key, request_key)
        return simulate_paid_admission(
            receipt_key=request_key,
            reservation_key=request_key,
            save_receipt=lambda: self.save_receipt(request_key),
            reserve_credits=lambda: self.reserve_credits(request_key),
            submit_provider=lambda: self.submit_provider(request_key),
            save_handle=lambda handle: self.save_handle(request_key, handle),
            release_credits=self.release_credits,
        )

    def start_for_identity(self, identity: PaidAdmissionIdentity) -> PaidAdmissionResult:
        if not isinstance(identity, PaidAdmissionIdentity):
            raise ValueError("paid_admission_identity_incomplete")
        callbacks = (
            self.save_receipt_for_identity,
            self.reserve_credits_for_identity,
            self.submit_provider_for_identity,
            self.save_handle_for_identity,
        )
        if all(callback is not None for callback in callbacks):
            return simulate_paid_admission(
                receipt_key=identity.request_key,
                reservation_key=identity.request_key,
                save_receipt=lambda: callbacks[0](identity),
                reserve_credits=lambda: callbacks[1](identity),
                submit_provider=lambda: callbacks[2](identity),
                save_handle=lambda handle: callbacks[3](identity, handle),
                release_credits=self.release_credits,
            )
        return self.start(request_key=identity.request_key)


    def replay(self, *, request_key: str) -> PaidAdmissionResult:
        return replay_paid_admission(
            receipt_key=request_key,
            reservation_key=request_key,
            load_receipt=lambda: self.load_receipt(request_key),
            load_reservation=lambda: self.load_reservation(request_key),
        )

    def recover_unknown(
        self,
        *,
        state: PaidAdmissionState,
        reservation_id: str | None,
        provider_handle: Any,
        query_identity: dict[str, str] | None,
    ) -> PaidAdmissionResult:
        return recover_paid_admission(
            state=state,
            reservation_id=reservation_id,
            provider_handle=provider_handle,
            query_identity=query_identity,
            query_provider=self.query_provider,
        )
def require_identity_ownership(
    identity: PaidAdmissionIdentity,
    *,
    owner_user_id: str,
    owner_project_id: str,
    owner_attempt_id: str,
) -> None:
    if (
        identity.user_id != owner_user_id
        or identity.project_id != owner_project_id
        or identity.attempt_id != owner_attempt_id
    ):
        raise ValueError("paid_admission_ownership_mismatch")
