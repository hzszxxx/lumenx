"""Read-only Atelier adapter for the Core artifact resolver contract."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from ...core.artifact_resolver import (
    ArtifactLookup,
    ArtifactProduct,
    ArtifactResolutionError,
    ResolvedArtifact,
)


OwnershipCheck = Callable[[str, str], bool]
MediaVerifier = Callable[[str, str, int], None]


class AtelierArtifactResolver:
    """Resolve only completed, published Atelier sequence exports.

    Ownership and managed-media verification are injected deliberately. The
    current platform has no implicit platform-user-to-project mapping, so the
    adapter fails closed when the application does not provide one.
    """

    def __init__(
        self,
        storage: Any,
        *,
        ownership_check: OwnershipCheck | None,
        media_verifier: MediaVerifier | None,
    ) -> None:
        self._storage = storage
        self._ownership_check = ownership_check
        self._media_verifier = media_verifier

    def resolve(self, actor_id: str, lookup: ArtifactLookup) -> ResolvedArtifact:
        self._require_product(lookup)
        if self._ownership_check is None or self._media_verifier is None:
            raise ArtifactResolutionError("artifact_resolver_unconfigured", "Atelier artifact ownership or media verification is unavailable")
        if not self._ownership_check(actor_id, lookup.project_id):
            raise ArtifactResolutionError("artifact_forbidden", "Atelier artifact does not belong to the current user")
        try:
            project = self._storage.get_project(lookup.project_id)
        except Exception as exc:  # product storage maps its own not-found types
            raise ArtifactResolutionError("artifact_not_found", "Atelier project was not found") from exc

        export = next((item for item in project.exports if item.id == lookup.artifact_id), None)
        if export is None or export.deletion is not None:
            raise ArtifactResolutionError("artifact_not_found", "Atelier export was not found")
        proof = export.publication_proof
        if proof is None or proof.project_id != project.id or export.snapshot_digest is None:
            raise ArtifactResolutionError("artifact_unverified", "Atelier export has no valid publication proof")
        expected_version = f"snapshot:{export.snapshot_digest}"
        if lookup.artifact_version != expected_version:
            raise ArtifactResolutionError("artifact_version_mismatch", "Atelier export version does not match the server snapshot")
        if lookup.sha256 != proof.sha256:
            raise ArtifactResolutionError("artifact_hash_mismatch", "Atelier export hash does not match the server proof")
        try:
            self._media_verifier(proof.relative_path, proof.sha256, proof.size_bytes)
        except Exception as exc:
            raise ArtifactResolutionError("artifact_media_unavailable", "Atelier export media could not be verified") from exc
        return ResolvedArtifact(
            product=ArtifactProduct.ATELIER,
            project_id=project.id,
            artifact_id=export.id,
            artifact_version=expected_version,
            sha256=proof.sha256,
            media_type="video/mp4",
            media_ref=proof.relative_path,
            title=project.title,
            owner_id=actor_id,
            source_kind="sequence_export",
            contract_version="artifact-resolver-v1",
        )

    @staticmethod
    def _require_product(lookup: ArtifactLookup) -> None:
        if lookup.product is not ArtifactProduct.ATELIER:
            raise ArtifactResolutionError("artifact_product_mismatch", "Atelier resolver cannot resolve another product")

