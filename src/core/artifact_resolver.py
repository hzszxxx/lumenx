"""Neutral contracts for server-side Studio/Atelier artifact resolution.

The platform may ask Core to resolve a client-provided locator, but it must
store only the immutable result returned by a product-owned resolver.  This
module intentionally has no imports from Studio, Atelier, or platform code.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Protocol

from pydantic import BaseModel, ConfigDict, Field


class ArtifactProduct(StrEnum):
    STUDIO = "studio"
    ATELIER = "atelier"


class ArtifactLookup(BaseModel):
    """Client locator accepted by a resolver adapter.

    A lookup identifies a claimed artifact but deliberately carries no URL,
    filesystem path, title, or media type.  Those values must come from the
    owning product's authoritative state.
    """

    model_config = ConfigDict(frozen=True, extra="forbid", strict=True)

    product: ArtifactProduct
    project_id: str = Field(min_length=1, max_length=128)
    artifact_id: str = Field(min_length=1, max_length=128)
    artifact_version: str = Field(min_length=1, max_length=128)
    sha256: str = Field(pattern=r"^[0-9a-f]{64}$")


class ResolvedArtifact(BaseModel):
    """Immutable server-owned artifact snapshot returned by Core."""

    model_config = ConfigDict(frozen=True, extra="forbid", strict=True)

    product: ArtifactProduct
    project_id: str = Field(min_length=1, max_length=128)
    artifact_id: str = Field(min_length=1, max_length=128)
    artifact_version: str = Field(min_length=1, max_length=128)
    sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    media_type: str = Field(min_length=1, max_length=128)
    media_ref: str = Field(min_length=1, max_length=2048)
    title: str = Field(min_length=1, max_length=200)
    owner_id: str = Field(min_length=1, max_length=128)
    source_kind: str = Field(min_length=1, max_length=64)
    contract_version: str = Field(min_length=1, max_length=64)


class ArtifactResolutionError(ValueError):
    """A product-owned artifact cannot be resolved or verified."""

    def __init__(self, code: str, message: str):
        if not code or not message:
            raise ValueError("artifact resolution errors require a code and message")
        self.code = code
        super().__init__(message)


class ArtifactResolver(Protocol):
    """Product adapter contract injected by the application composition root."""

    def resolve(self, actor_id: str, lookup: ArtifactLookup) -> ResolvedArtifact:
        """Resolve and ownership-check one artifact without mutating state."""


class ProductArtifactResolver:
    """Dispatch artifact lookups to product-owned read-only adapters."""

    def __init__(self, *, studio: ArtifactResolver, atelier: ArtifactResolver) -> None:
        self._adapters = {
            ArtifactProduct.STUDIO: studio,
            ArtifactProduct.ATELIER: atelier,
        }

    def resolve(self, actor_id: str, lookup: ArtifactLookup) -> ResolvedArtifact:
        adapter = self._adapters.get(lookup.product)
        if adapter is None:
            raise ArtifactResolutionError("artifact_product_unavailable", "No resolver is registered for this product")
        return adapter.resolve(actor_id, lookup)

