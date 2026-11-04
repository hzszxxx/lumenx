CREATE TABLE platform_xiangongyun_bindings (
    user_id TEXT PRIMARY KEY REFERENCES platform_users(id),
    credential_id TEXT NOT NULL REFERENCES platform_credentials(id),
    account_ciphertext_b64 TEXT,
    account_nonce_b64 TEXT,
    balance REAL,
    instances_json TEXT NOT NULL DEFAULT '[]',
    checked_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX idx_platform_xiangongyun_bindings_credential ON platform_xiangongyun_bindings(credential_id);
