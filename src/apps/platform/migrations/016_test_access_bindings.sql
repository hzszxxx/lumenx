CREATE TABLE platform_test_access_bindings (
    access_code_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE REFERENCES platform_users(id),
    created_at TEXT NOT NULL
);

CREATE INDEX idx_platform_test_access_bindings_user ON platform_test_access_bindings(user_id);
