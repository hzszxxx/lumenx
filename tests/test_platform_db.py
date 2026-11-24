import pytest

from src.apps.platform import db as platform_db
from src.apps.platform.db import MigrationError, backup_database, check_foreign_keys, connect, migrate


def test_migrate_creates_isolated_schema_with_sqlite_safety(tmp_path):
    db_path = tmp_path / "platform.db"
    expected = [
        "001_initial.sql", "002_business.sql", "003_token_usage.sql", "004_credit_ledger.sql",
        "005_user_credentials.sql", "006_media_pricing.sql", "007_skill_registry.sql",
        "008_skill_runs.sql", "009_skill_run_leases.sql", "010_skill_workers.sql",
        "011_registration_invites.sql", "012_xiangongyun_bindings.sql",
        "013_idempotency_and_xiangongyun_cleanup.sql", "014_skill_feedback.sql",
        "015_skill_binding_history.sql", "016_test_access_bindings.sql",
        "017_project_bindings.sql", "018_artifact_resolution_snapshots.sql",
        "019_credit_reservation_scope.sql", "020_agent_roles_and_invites.sql",
        "021_agent_commissions.sql", "022_platform_system_settings.sql",
        "023_user_registration_source.sql", "024_structured_commercial_demands.sql",
        "025_commercial_contracts.sql", "026_seed_default_commercial_tasks.sql",
    ]
    assert migrate(db_path) == expected
    assert migrate(db_path) == []
    assert check_foreign_keys(db_path) == []
    with connect(db_path) as connection:
        assert connection.execute("PRAGMA foreign_keys").fetchone() == (1,)
        assert connection.execute(
            "SELECT version FROM schema_migrations"
        ).fetchall() == [(f,) for f in expected]
        tables = {row[0] for row in connection.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        )}
    assert {"platform_users", "platform_sessions", "audit_events", "platform_token_usage", "credit_ledger", "credit_reservations", "platform_credentials", "media_pricing", "platform_skill_versions", "platform_skill_bindings", "platform_skill_runs", "platform_skill_workers", "platform_skill_feedback", "platform_skill_binding_history", "registration_invites", "platform_xiangongyun_bindings", "platform_project_bindings", "commercial_tasks", "commercial_contracts"}.issubset(tables)
    with connect(db_path) as connection:
        columns = {row[1] for row in connection.execute("PRAGMA table_info(commercial_tasks)")}
    assert {"demand_type", "deliverable_specs_json", "budget_mode", "settlement_mode", "milestone_specs_json", "acceptance_criteria_json", "reference_media_json", "level_tier", "contract_id", "contract_signed_at"}.issubset(columns)


def test_migrate_rejects_changed_applied_migration(tmp_path, monkeypatch):
    db_path = tmp_path / "platform.db"
    migrate(db_path)
    monkeypatch.setattr(platform_db, "_checksum", lambda _path: "f" * 64)
    with pytest.raises(MigrationError, match="checksum changed"):
        migrate(db_path)


def test_backup_is_explicit_and_does_not_run_on_new_database(tmp_path):
    db_path = tmp_path / "platform.db"
    assert backup_database(db_path, tmp_path / "backups") is None
    db_path.write_bytes(b"sqlite placeholder")
    backup = backup_database(db_path, tmp_path / "backups")
    assert backup is not None
    assert backup.read_bytes() == b"sqlite placeholder"
