CREATE TABLE platform_skill_binding_history (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    scope TEXT NOT NULL CHECK (scope IN ('system','workspace','user','project')),
    owner_id TEXT REFERENCES platform_users(id),
    project_id TEXT,
    skill_version_id TEXT NOT NULL REFERENCES platform_skill_versions(id),
    replaced_at TEXT NOT NULL,
    replaced_by TEXT REFERENCES platform_users(id)
);
CREATE INDEX idx_platform_skill_binding_history_lookup
    ON platform_skill_binding_history(name, scope, owner_id, project_id, replaced_at DESC);
