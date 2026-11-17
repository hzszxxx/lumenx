CREATE TABLE IF NOT EXISTS agent_commissions (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES platform_users(id),
    student_user_id TEXT NOT NULL REFERENCES platform_users(id),
    source_type TEXT NOT NULL,
    source_id TEXT,
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    commission_rate REAL NOT NULL,
    commission_cents INTEGER NOT NULL CHECK (commission_cents > 0),
    status TEXT NOT NULL DEFAULT 'settled' CHECK (status IN ('pending', 'settled', 'cancelled')),
    description TEXT,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_agent_commissions_agent ON agent_commissions(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_commissions_student ON agent_commissions(student_user_id, created_at DESC);

UPDATE agent_profiles SET commission_rate = 0.01 WHERE commission_rate = 0.0;
