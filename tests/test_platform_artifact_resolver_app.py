from types import SimpleNamespace

from src.apps.comic_gen.api import _configure_platform_artifact_resolver
from src.core.artifact_resolver import ProductArtifactResolver


def test_app_composition_injects_product_resolver_into_platform_service():
    class Platform:
        def set_artifact_resolver(self, resolver):
            self.resolver = resolver

        def is_project_bound(self, **_kwargs):
            return True

    platform = Platform()
    app = SimpleNamespace(state=SimpleNamespace(platform_service=platform))
    pipeline = SimpleNamespace(
        read_committed_script=lambda _project_id: None,
        _provider_media_storage_guard=None,
        _writer_lock=None,
        data_dir="/tmp/lumenx-output",
        _output_ref_path=lambda ref: ref,
    )
    atelier_storage = SimpleNamespace()

    _configure_platform_artifact_resolver(app, pipeline, atelier_storage, "storage-1")

    assert isinstance(platform.resolver, ProductArtifactResolver)
    assert app.state.platform_artifact_resolver is platform.resolver
