"""Configuration-driven three-stage compute routing for storyboard shots.

This module only resolves a route and estimates cost. It does not submit work
to a provider, reserve credits, or mutate a project. The source of truth is
``docs/routing.yaml`` so route policy and pricing stay reviewable together.
"""

from __future__ import annotations

from enum import StrEnum
from pathlib import Path
from typing import Any, Mapping

import yaml
from pydantic import BaseModel, ConfigDict, Field, field_validator


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_ROUTING_PATH = REPO_ROOT / "docs" / "routing.yaml"


class ComputeStage(StrEnum):
    DRAFT = "draft"
    FINAL = "final"
    POST = "post"


class ShotType(StrEnum):
    CONSISTENCY_LONG = "consistency_long"
    ACTION_HARD = "action_hard"
    EMOTION_CLOSEUP = "emotion_closeup"
    DIALOGUE_AV = "dialogue_av"
    HERO_COVER = "hero_cover"
    FILLER = "filler"


class Urgency(StrEnum):
    HIGH = "high"
    LOW = "low"


class PostOperation(StrEnum):
    UPSCALE = "upscale"
    FRAME_INTERPOLATION = "frame_interpolation"
    ASSEMBLY = "assembly"


class ShotRoutingRequest(BaseModel):
    """The minimum immutable contract required before choosing a route."""

    model_config = ConfigDict(frozen=True, extra="forbid", strict=True)

    stage: ComputeStage
    shot_type: ShotType
    urgency: Urgency
    duration_sec: float = Field(gt=0, le=300)
    has_dialogue: bool = False
    has_audio: bool = False
    closeup_or_hero: bool = False
    prefer_libtv_promo: bool = False
    post_operation: PostOperation | None = None

    @field_validator("stage", "shot_type", "urgency", "post_operation", mode="before")
    @classmethod
    def _parse_enum_values(cls, value, info):
        if value is None:
            return None
        target = {
            "stage": ComputeStage,
            "shot_type": ShotType,
            "urgency": Urgency,
            "post_operation": PostOperation,
        }[info.field_name]
        if isinstance(value, target):
            return value
        if type(value) is not str:
            raise TypeError(f"{info.field_name} must be a string enum")
        try:
            return target(value)
        except ValueError as exc:
            raise ValueError(f"invalid {info.field_name}") from exc


class RouteDecision(BaseModel):
    """A provider decision suitable for a generation admission preview."""

    model_config = ConfigDict(frozen=True, extra="forbid", strict=True)

    stage: ComputeStage
    shot_type: ShotType
    urgency: Urgency
    provider: str = Field(min_length=1, max_length=64)
    model: str = Field(min_length=1, max_length=128)
    resolution: str | None = Field(default=None, max_length=32)
    audio: bool = False
    promo: bool = False
    rule_id: str = Field(min_length=1, max_length=128)
    fallback: list[str] = Field(default_factory=list)
    billed_duration_sec: float = Field(gt=0)
    est_cost_cny: float = Field(ge=0)
    cost_note: str = Field(min_length=1, max_length=240)


class RouteRuntimeBinding(BaseModel):
    """Mapping from a canonical route model to a generation entry contract."""

    model_config = ConfigDict(frozen=True, extra="forbid", strict=True)

    provider: str = Field(min_length=1, max_length=64)
    model: str = Field(min_length=1, max_length=128)
    contract_version: str = Field(min_length=1, max_length=64)
    request_model_ids: tuple[str, ...] = Field(min_length=1, max_length=8)


class RouteAdmissionRequest(BaseModel):
    """Generation-time preflight inputs layered over a resolved route."""

    model_config = ConfigDict(frozen=True, extra="forbid", strict=True)

    routing: ShotRoutingRequest
    batch_size: int = Field(gt=0, le=6)
    budget_cny: float = Field(ge=0)
    requested_provider: str | None = Field(default=None, min_length=1, max_length=64)
    requested_model: str | None = Field(default=None, min_length=1, max_length=128)
    requested_resolution: str | None = Field(default=None, min_length=1, max_length=32)
    requested_runtime_model: str | None = Field(default=None, min_length=1, max_length=128)


class RouteAdmissionDecision(BaseModel):
    """A successful, non-mutating route and budget admission preflight."""

    model_config = ConfigDict(frozen=True, extra="forbid", strict=True)

    route: RouteDecision
    batch_size: int = Field(gt=0, le=6)
    budget_cny: float = Field(ge=0)
    estimated_total_cny: float = Field(ge=0)
    remaining_cny: float = Field(ge=0)


class RouteResolutionError(ValueError):
    """Raised when the reviewed routing document cannot satisfy a request."""

    def __init__(self, code: str, message: str):
        self.code = code
        super().__init__(message)


class ComputeRouteResolver:
    """Resolve storyboard routes from a loaded ``routing.yaml`` mapping."""

    def __init__(self, config: Mapping[str, Any], *, source: str = "routing.yaml") -> None:
        self._config = dict(config)
        self.source = source
        self._validate_config()

    @classmethod
    def from_yaml(cls, path: str | Path = DEFAULT_ROUTING_PATH) -> "ComputeRouteResolver":
        path = Path(path)
        try:
            config = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        except OSError as exc:
            raise RouteResolutionError("routing_config_unavailable", f"Cannot read routing config: {path}") from exc
        except yaml.YAMLError as exc:
            raise RouteResolutionError("routing_config_invalid", f"Cannot parse routing config: {path}") from exc
        if not isinstance(config, dict):
            raise RouteResolutionError("routing_config_invalid", "Routing config must be a mapping")
        return cls(config, source=str(path))

    def resolve(self, request: ShotRoutingRequest) -> RouteDecision:
        if request.stage is ComputeStage.DRAFT:
            route = self._resolve_draft(request)
        elif request.stage is ComputeStage.FINAL:
            route = self._resolve_final(request)
        else:
            route = self._resolve_post(request)
        return self._decision(request, **route)

    def runtime_binding(self, decision: RouteDecision) -> RouteRuntimeBinding:
        """Return the explicit runtime contract for a canonical route model."""

        model_config = self._config.get("models", {}).get(decision.model)
        runtime = model_config.get("runtime") if isinstance(model_config, dict) else None
        if not isinstance(runtime, dict):
            raise RouteResolutionError(
                "route_runtime_unmapped",
                f"No generation runtime binding for {decision.provider}/{decision.model}",
            )
        try:
            request_model_ids = tuple(runtime["request_model_ids"])
            contract_version = runtime["contract_version"]
        except (KeyError, TypeError):
            raise RouteResolutionError(
                "routing_config_invalid",
                f"Runtime binding for {decision.model} is incomplete",
            ) from None
        if (
            not isinstance(contract_version, str)
            or not contract_version
            or not request_model_ids
            or any(not isinstance(item, str) or not item for item in request_model_ids)
        ):
            raise RouteResolutionError(
                "routing_config_invalid",
                f"Runtime binding for {decision.model} is invalid",
            )
        return RouteRuntimeBinding(
            provider=decision.provider,
            model=decision.model,
            contract_version=contract_version,
            request_model_ids=request_model_ids,
        )

    def admit(self, request: RouteAdmissionRequest) -> RouteAdmissionDecision:
        """Validate a route choice and batch budget without submitting work."""

        decision = self.resolve(request.routing)
        mismatches = []
        for field, requested, expected in (
            ("provider", request.requested_provider, decision.provider),
            ("model", request.requested_model, decision.model),
            ("resolution", request.requested_resolution, decision.resolution),
        ):
            if requested is not None and requested != expected:
                mismatches.append(f"{field}={requested!r} expected {expected!r}")
        if mismatches:
            raise RouteResolutionError("route_request_mismatch", "; ".join(mismatches))
        if request.requested_runtime_model is not None:
            binding = self.runtime_binding(decision)
            if request.requested_runtime_model not in binding.request_model_ids:
                raise RouteResolutionError(
                    "route_runtime_model_mismatch",
                    f"runtime_model={request.requested_runtime_model!r} not allowed for "
                    f"{binding.provider}/{binding.model}",
                )
        estimated_total = round(decision.est_cost_cny * request.batch_size, 2)
        if estimated_total > request.budget_cny:
            raise RouteResolutionError(
                "route_budget_exceeded",
                f"estimated_total_cny={estimated_total:.2f} exceeds budget_cny={request.budget_cny:.2f}",
            )
        return RouteAdmissionDecision(
            route=decision,
            batch_size=request.batch_size,
            budget_cny=request.budget_cny,
            estimated_total_cny=estimated_total,
            remaining_cny=round(request.budget_cny - estimated_total, 2),
        )

    def _resolve_draft(self, request: ShotRoutingRequest) -> dict[str, Any]:
        draft = self._config["stage_rules"]["draft"]
        content_key = "with_dialogue_or_audio" if request.has_dialogue or request.has_audio else "silent"
        default = draft["default"]
        model = default["model_by_content"][content_key]
        return {
            "provider": default["provider"],
            "model": model,
            "resolution": default["resolution"],
            "audio": request.has_dialogue or request.has_audio,
            "promo": False,
            "rule_id": f"draft.default.{content_key}",
            "fallback": [],
            "cost_note": "草稿按仙宫云开机成本估算，单镜边际成本不按供应商秒价计费",
        }

    def _resolve_final(self, request: ShotRoutingRequest) -> dict[str, Any]:
        final = self._config["stage_rules"]["final"]
        route = next((item for item in final["routes"] if item.get("shot_type") == request.shot_type.value), None)
        if route is None:
            raise RouteResolutionError("shot_type_unconfigured", f"No final route for {request.shot_type.value}")
        use = dict(route["use"])
        promo = False
        rule_id = f"final.{request.shot_type.value}"

        if request.shot_type is ShotType.DIALOGUE_AV and request.closeup_or_hero:
            upgrade = use.get("upgrade_to_2k_if")
            if upgrade:
                use["resolution"] = "2k"
                rule_id += ".upgrade_2k"

        if request.urgency is Urgency.HIGH and request.shot_type is ShotType.FILLER:
            use = {"provider": "bailian", "model": "wan3", "resolution": "480p"}
            rule_id = "final.filler.high_direct_fallback"

        eligible = final.get("urgency_modifier", {}).get("low", {}).get("eligible_for_libtv_promo", [])
        if (
            request.urgency is Urgency.LOW
            and request.prefer_libtv_promo
            and request.shot_type.value in eligible
            and request.shot_type is not ShotType.HERO_COVER
        ):
            promo_price = final["urgency_modifier"]["low"]["libtv_promo_model_price"]
            use = {
                "provider": "libtv",
                "model": promo_price["model"],
                "resolution": promo_price["resolution"],
            }
            promo = True
            rule_id += ".libtv_promo"

        return {
            "provider": use["provider"],
            "model": use["model"],
            "resolution": use.get("resolution"),
            "audio": bool(use.get("audio", request.has_audio or request.has_dialogue)),
            "promo": promo,
            "rule_id": rule_id,
            "fallback": list(route.get("fallback", [])),
            "cost_note": "正片按单价、2 秒 padding 和 1.5 倍返工系数估算",
        }

    def _resolve_post(self, request: ShotRoutingRequest) -> dict[str, Any]:
        operation = request.post_operation or PostOperation.UPSCALE
        if operation is PostOperation.FRAME_INTERPOLATION:
            model = "RIFE"
            rule_id = "post.frame_interpolation"
        elif operation is PostOperation.ASSEMBLY:
            model = "local-assembly"
            rule_id = "post.assembly"
        else:
            model = self._config["stage_rules"]["post"]["upscale"]["tool"]
            rule_id = "post.upscale"
        return {
            "provider": "local" if operation is PostOperation.ASSEMBLY else self._config["stage_rules"]["post"]["upscale"]["provider"],
            "model": model,
            "resolution": "1080p" if operation is PostOperation.UPSCALE else None,
            "audio": False,
            "promo": False,
            "rule_id": rule_id,
            "fallback": [],
            "cost_note": "后期处理不按单镜供应商秒价计费，成本由本地/仙宫云运行时另行核算",
        }

    def _decision(self, request: ShotRoutingRequest, **route: Any) -> RouteDecision:
        padding = float(self._config["guardrails"]["generate_duration_padding_sec"])
        billed_duration = round(request.duration_sec + padding, 6)
        reroll = float(self._config["guardrails"]["final_reroll_factor_budget"]) if request.stage is ComputeStage.FINAL else 1.0
        price = self._price_cny_per_sec(route["provider"], route["model"], route["resolution"], route["audio"], route["promo"])
        estimated = round(billed_duration * price * reroll, 2)
        return RouteDecision(
            stage=request.stage,
            shot_type=request.shot_type,
            urgency=request.urgency,
            billed_duration_sec=billed_duration,
            est_cost_cny=estimated,
            **route,
        )

    def _price_cny_per_sec(self, provider: str, model: str, resolution: str | None, audio: bool, promo: bool) -> float:
        if promo:
            return float(self._config["stage_rules"]["final"]["urgency_modifier"]["low"]["libtv_promo_model_price"]["price_cny_per_sec"])
        if provider in {"local", "xiangong"}:
            return 0.0
        if provider == "libtv":
            return 0.0
        model_config = self._config["models"].get(model)
        if not isinstance(model_config, dict):
            raise RouteResolutionError("model_unpriced", f"No price entry for model {model}")
        if "price_cny_per_sec" in model_config:
            prices = model_config["price_cny_per_sec"]
            if isinstance(prices, dict) and "silent" in prices:
                family = "with_audio" if audio else "silent"
                value = prices[family].get(resolution) if isinstance(prices[family], dict) else None
            else:
                value = prices.get(resolution) if isinstance(prices, dict) else None
            if value is not None:
                return float(value)
        if "price_usd_per_sec" in model_config:
            value = model_config["price_usd_per_sec"].get(resolution) if isinstance(model_config["price_usd_per_sec"], dict) else None
            if value is not None:
                return float(value) * float(self._config.get("fx_usd_cny", 1.0))
        raise RouteResolutionError("model_unpriced", f"No price for {model}@{resolution}")

    def _validate_config(self) -> None:
        required = ("stage_rules", "models", "guardrails", "fx_usd_cny")
        missing = [key for key in required if key not in self._config]
        if missing:
            raise RouteResolutionError("routing_config_invalid", f"Missing routing keys: {', '.join(missing)}")
        if not isinstance(self._config["stage_rules"], dict) or not isinstance(self._config["models"], dict):
            raise RouteResolutionError("routing_config_invalid", "stage_rules and models must be mappings")
        try:
            if float(self._config["guardrails"]["generate_duration_padding_sec"]) < 0:
                raise ValueError
            if float(self._config["guardrails"]["final_reroll_factor_budget"]) < 1:
                raise ValueError
        except (KeyError, TypeError, ValueError) as exc:
            raise RouteResolutionError("routing_config_invalid", "routing guardrails are invalid") from exc


def default_compute_route_resolver() -> ComputeRouteResolver:
    """Load the reviewed repository routing document."""

    return ComputeRouteResolver.from_yaml()


__all__ = [
    "ComputeRouteResolver",
    "ComputeStage",
    "DEFAULT_ROUTING_PATH",
    "PostOperation",
    "RouteDecision",
    "RouteAdmissionDecision",
    "RouteAdmissionRequest",
    "RouteRuntimeBinding",
    "RouteResolutionError",
    "ShotRoutingRequest",
    "ShotType",
    "Urgency",
    "default_compute_route_resolver",
]
