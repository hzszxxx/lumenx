-- 025_commercial_contracts.sql
-- 商业任务极简线上电子合同签署与存证
CREATE TABLE commercial_contracts (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES commercial_tasks(id),
    creator_id TEXT NOT NULL REFERENCES platform_users(id),
    contract_type TEXT NOT NULL DEFAULT 'commercial_undertaking_nda',
    status TEXT NOT NULL DEFAULT 'signed' CHECK (status IN ('draft','signed','fulfilled','terminated')),
    digest_hash TEXT NOT NULL,
    terms_snapshot_json TEXT NOT NULL DEFAULT '{}',
    signer_name TEXT NOT NULL,
    signed_ip TEXT DEFAULT '127.0.0.1',
    signed_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(task_id, creator_id)
);

ALTER TABLE commercial_tasks ADD COLUMN contract_id TEXT REFERENCES commercial_contracts(id);
ALTER TABLE commercial_tasks ADD COLUMN contract_signed_at TEXT;
