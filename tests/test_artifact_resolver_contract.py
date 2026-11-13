from pydantic import ValidationError

from src.core.artifact_resolver import (
    ArtifactLookup,
    ArtifactProduct,
    ArtifactResolutionError,
    ProductArtifactResolver,
    ResolvedArtifact,
)


def test_artifact_lookup_is_a_client_locator_without_media_url_fields():
    lookup = ArtifactLookup(
        product=ArtifactProduct.STUDIO,
        project_id="project-1",
        artifact_id="video-task-1",
        artifact_version="v3",
        sha256="a" * 64,
    )

    assert lookup.product is ArtifactProduct.STUDIO
    assert "url" not in lookup.model_dump()
    assert "media_ref" not in lookup.model_dump()

    try:
        ArtifactLookup(
            product="studio",
            project_id="project-1",
            artifact_id="video-task-1",
            artifact_version="v3",
            sha256="a" * 64,
            url="/files/video.mp4",
        )
    except ValidationError:
        pass
    else:
        raise AssertionError("client URL cannot be part of the resolver lookup contract")


def test_resolved_artifact_is_immutable_and_contains_server_owned_media_ref():
    resolved = ResolvedArtifact(
        product=ArtifactProduct.ATELIER,
        project_id="atelier-1",
        artifact_id="export-1",
        artifact_version="v1",
        sha256="b" * 64,
        media_type="video/mp4",
        media_ref="video/atelier_export-1.mp4",
        title="Verified export",
        owner_id="user-1",
        source_kind="sequence_export",
        contract_version="artifact-resolver-v1",
    )

    try:
        resolved.title = "tampered"
    except ValidationError:
        pass
    else:
        raise AssertionError("resolved artifacts must be immutable")

    assert resolved.media_ref == "video/atelier_export-1.mp4"
    assert resolved.owner_id == "user-1"


def test_resolution_error_requires_stable_code_and_safe_message():
    error = ArtifactResolutionError("artifact_not_found", "artifact was not found")

    assert error.code == "artifact_not_found"
    assert str(error) == "artifact was not found"


def test_product_resolver_dispatches_by_explicit_product():
    class Stub:
        def __init__(self, product):
            self.product = product

        def resolve(self, actor_id, lookup):
            assert lookup.product is self.product
            return {"actor_id": actor_id, "product": lookup.product.value}

    resolver = ProductArtifactResolver(
        studio=Stub(ArtifactProduct.STUDIO),
        atelier=Stub(ArtifactProduct.ATELIER),
    )
    lookup = ArtifactLookup(
        product=ArtifactProduct.ATELIER,
        project_id="project-1",
        artifact_id="export-1",
        artifact_version="v1",
        sha256="a" * 64,
    )

    assert resolver.resolve("user-1", lookup) == {"actor_id": "user-1", "product": "atelier"}

