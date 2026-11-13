"""Read-only Studio adapter for the Core artifact resolver contract."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from ...core.artifact_resolver import (
    ArtifactLookup,
    ArtifactProduct,
    ArtifactResolutionError,
    ResolvedArtifact,
)


ProjectReader = Callable[[str], Any | None]
OwnershipCheck = Callable[[str, str], bool]
MediaProbe = Callable[[str], tuple[str, int]]


class StudioArtifactResolver:
    """Resolve a merged Studio video or a completed Studio video task.

    The adapter does not infer ownership from a project id or URL. The
    application must inject an ownership check and a managed-media probe.
    """

    def __init__(
        self,
        project_reader: ProjectReader,
        *,
        ownership_check: OwnershipCheck | None,
        media_probe: MediaProbe | None,
    ) -> None:
        self._project_reader = project_reader
        self._ownership_check = ownership_check
        self._media_probe = media_probe

    def resolve(self, actor_id: str, lookup: ArtifactLookup) -> ResolvedArtifact:
        if lookup.product is not ArtifactProduct.STUDIO:
            raise ArtifactResolutionError("artifact_product_mismatch", "Studio resolver cannot resolve another product")
        if self._ownership_check is None or self._media_probe is None:
            raise ArtifactResolutionError("artifact_resolver_unconfigured", "Studio artifact ownership or media verification is unavailable")
        if not self._ownership_check(actor_id, lookup.project_id):
            raise ArtifactResolutionError("artifact_forbidden", "Studio artifact does not belong to the current user")
        project = self._project_reader(lookup.project_id)
        if project is None or getattr(project, "id", None) != lookup.project_id:
            raise ArtifactResolutionError("artifact_not_found", "Studio project was not found")

        media_ref: str | None = None
        source_kind: str | None = None
        expected_version: str | None = None
        if lookup.artifact_id == f"merged:{project.id}":
            media_ref = getattr(project, "merged_video_url", None)
            source_kind = "merged_video"
            expected_version = f"revision:{getattr(project, 'revision', 0)}"
        else:
            task = next((item for item in getattr(project, "video_tasks", []) if item.id == lookup.artifact_id), None)
            if task is not None and task.project_id == project.id and task.status == "completed":
                media_ref = task.video_url
                source_kind = "video_task"
                expected_version = f"created:{task.created_at:.6f}"
        if not media_ref or source_kind is None or expected_version is None:
            raise ArtifactResolutionError("artifact_not_found", "Studio artifact was not found or is not complete")
        if lookup.artifact_version != expected_version:
            raise ArtifactResolutionError("artifact_version_mismatch", "Studio artifact version does not match the server state")
        try:
            sha256, size_bytes = self._media_probe(media_ref)
        except Exception as exc:
            raise ArtifactResolutionError("artifact_media_unavailable", "Studio artifact media could not be verified") from exc
        if lookup.sha256 != sha256:
            raise ArtifactResolutionError("artifact_hash_mismatch", "Studio artifact hash does not match the server media")
        return ResolvedArtifact(
            product=ArtifactProduct.STUDIO,
            project_id=project.id,
            artifact_id=lookup.artifact_id,
            artifact_version=expected_version,
            sha256=sha256,
            media_type="video/mp4",
            media_ref=media_ref,
            title=project.title,
            owner_id=actor_id,
            source_kind=source_kind,
            contract_version="artifact-resolver-v1",
        )

