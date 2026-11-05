"""Composition-root wiring for paid admission.

This module is the only place that joins platform identity, Atelier ownership,
and provider callbacks. Domain modules remain independent.
"""
from __future__ import annotations

from typing import Any, Callable

from ..atelier.paid_admission_coordinator import (
    PaidAdmissionCoordinator,
    PaidAdmissionIdentity,
    require_identity_ownership,
)


def build_paid_admission_coordinator(
    *,
    identity: PaidAdmissionIdentity,
    actor_user_id: str,
    project_owner_id: str,
    attempt_owner_id: str,
    save_receipt: Callable[[PaidAdmissionIdentity], None],
    reserve_credits: Callable[[PaidAdmissionIdentity], str],
    submit_provider: Callable[[PaidAdmissionIdentity], Any],
    save_handle: Callable[[PaidAdmissionIdentity, Any], None],
    release_credits: Callable[[str], None],
    load_receipt: Callable[[str], dict[str, Any]],
    load_reservation: Callable[[str], dict[str, Any]],
    query_provider: Callable[[Any, dict[str, str]], Any],
) -> PaidAdmissionCoordinator:
    require_identity_ownership(
        identity,
        owner_user_id=actor_user_id,
        owner_project_id=project_owner_id,
        owner_attempt_id=attempt_owner_id,
    )
    return PaidAdmissionCoordinator(
        save_receipt=lambda key: save_receipt(identity),
        reserve_credits=lambda key: reserve_credits(identity),
        submit_provider=lambda key: submit_provider(identity),
        save_handle=lambda key, handle: save_handle(identity, handle),
        release_credits=release_credits,
        load_receipt=load_receipt,
        load_reservation=load_reservation,
        query_provider=query_provider,
        save_receipt_for_identity=save_receipt,
        reserve_credits_for_identity=reserve_credits,
        submit_provider_for_identity=submit_provider,
        save_handle_for_identity=save_handle,
    )

def resolve_paid_admission_coordinator(
    *,
    platform_enabled: bool,
    actor_user_id: str,
    identity: PaidAdmissionIdentity,
    project_owner_id: str,
    attempt_owner_id: str,
    **callbacks,
) -> PaidAdmissionCoordinator:
    if not platform_enabled:
        raise ValueError("paid_admission_platform_disabled")
    return build_paid_admission_coordinator(
        identity=identity,
        actor_user_id=actor_user_id,
        project_owner_id=project_owner_id,
        attempt_owner_id=attempt_owner_id,
        **callbacks,
    )

def make_paid_admission_request_resolver(
    *,
    platform_enabled: bool,
    callbacks_factory: Callable[..., dict[str, Any]],
) -> Callable[..., PaidAdmissionCoordinator]:
    """Create a request-scoped resolver; no actor/project is captured."""
    if not platform_enabled:
        raise ValueError("paid_admission_platform_disabled")

    def resolve(
        *,
        actor_user_id: str,
        identity: PaidAdmissionIdentity,
        project_owner_id: str,
        attempt_owner_id: str,
    ) -> PaidAdmissionCoordinator:
        callbacks = callbacks_factory(
            actor_user_id=actor_user_id,
            identity=identity,
            project_owner_id=project_owner_id,
            attempt_owner_id=attempt_owner_id,
        )
        if not isinstance(callbacks, dict):
            raise ValueError("paid_admission_callbacks_invalid")
        return resolve_paid_admission_coordinator(
            platform_enabled=True,
            actor_user_id=actor_user_id,
            identity=identity,
            project_owner_id=project_owner_id,
            attempt_owner_id=attempt_owner_id,
            **callbacks,
        )

    return resolve
