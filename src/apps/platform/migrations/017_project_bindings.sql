CREATE TABLE platform_project_bindings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES platform_users(id),
    product TEXT NOT NULL CHECK (product IN ('studio', 'atelier')),
    project_id TEXT NOT NULL,
    storage_id TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
    created_by TEXT NOT NULL REFERENCES platform_users(id),
    created_at TEXT NOT NULL,
    revoked_at TEXT
);

CREATE INDEX idx_platform_project_bindings_lookup
    ON platform_project_bindings(user_id, product, project_id, status);
CREATE INDEX idx_platform_project_bindings_user
    ON platform_project_bindings(user_id, created_at);
