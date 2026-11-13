from types import SimpleNamespace

import pytest

from src.apps.atelier.artifact_resolver import AtelierArtifactResolver
from src.apps.comic_gen.artifact_resolver import StudioArtifactResolver
from src.apps.atelier.models import AtelierSequencePublicationProof, ExportRecord
from src.core.artifact_resolver import ArtifactLookup, ArtifactProduct, ArtifactResolutionError


def _lookup(product, project_id, artifact_id, version, sha256):
    return ArtifactLookup(
        product=product,
        project_id=project_id,
        artifact_id=artifact_id,
        artifact_version=version,
        sha256=sha256,
    )


def test_atelier_resolver_requires_ownership_and_media_proof():
    digest = "a" * 64
    proof = AtelierSequencePublicationProof(
        schema_version=1,
        job_id="job-1",
        project_id="atelier-1",
        relative_path="video/atelier_seq_export-1.mp4",
        sha256=digest,
        size_bytes=10,
        duration=1.0,
        width=720,
        height=1280,
        fps=24,
        snapshot_digest="b" * 64,
        prepared_at=1.0,
    )
    export = ExportRecord(
        id="export-1",
        project_id="atelier-1",
        video_url=proof.relative_path,
        filename="atelier_seq_export-1.mp4",
        publication_proof=proof,
        snapshot_digest=proof.snapshot_digest,
    )
    project = SimpleNamespace(id="atelier-1", title="Atelier demo", exports=[export])
    storage = SimpleNamespace(get_project=lambda project_id: project)
    verified = []
    resolver = AtelierArtifactResolver(
        storage,
        ownership_check=lambda actor_id, project_id: actor_id == "user-1" and project_id == "atelier-1",
        media_verifier=lambda path, sha256, size: verified.append((path, sha256, size)),
    )

    result = resolver.resolve(
        "user-1",
        _lookup(ArtifactProduct.ATELIER, "atelier-1", "export-1", f"snapshot:{'b' * 64}", digest),
    )

    assert result.media_ref == proof.relative_path
    assert result.owner_id == "user-1"
    assert verified == [(proof.relative_path, digest, 10)]

    with pytest.raises(ArtifactResolutionError, match="does not belong"):
        resolver.resolve(
            "user-2",
            _lookup(ArtifactProduct.ATELIER, "atelier-1", "export-1", f"snapshot:{'b' * 64}", digest),
        )


def test_studio_resolver_uses_server_revision_and_media_probe():
    digest = "c" * 64
    task = SimpleNamespace(
        id="task-1",
        project_id="studio-1",
        status="completed",
        video_url="video/task-1.mp4",
        created_at=12.5,
    )
    project = SimpleNamespace(
        id="studio-1",
        title="Studio demo",
        revision=4,
        merged_video_url="video/merged.mp4",
        video_tasks=[task],
    )
    resolver = StudioArtifactResolver(
        lambda project_id: project if project_id == "studio-1" else None,
        ownership_check=lambda actor_id, project_id: actor_id == "user-1" and project_id == "studio-1",
        media_probe=lambda ref: (digest, 20) if ref == "video/task-1.mp4" else ("d" * 64, 30),
    )

    result = resolver.resolve(
        "user-1",
        _lookup(ArtifactProduct.STUDIO, "studio-1", "task-1", "created:12.500000", digest),
    )

    assert result.source_kind == "video_task"
    assert result.title == "Studio demo"

    with pytest.raises(ArtifactResolutionError, match="version"):
        resolver.resolve(
            "user-1",
            _lookup(ArtifactProduct.STUDIO, "studio-1", "merged:studio-1", "revision:3", "d" * 64),
        )

