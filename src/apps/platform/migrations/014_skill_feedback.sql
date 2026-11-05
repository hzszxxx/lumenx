CREATE TABLE platform_skill_feedback (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES platform_users(id),
    project_id TEXT NOT NULL,
    skill_name TEXT NOT NULL,
    skill_version TEXT NOT NULL,
    skill_content_hash TEXT NOT NULL CHECK (length(skill_content_hash) = 64),
    run_id TEXT,
    decision TEXT NOT NULL CHECK (decision IN ('accepted','rejected','revision_requested')),
    qc_score REAL CHECK (qc_score IS NULL OR (qc_score >= 0 AND qc_score <= 1)),
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
);
CREATE INDEX idx_platform_skill_feedback_lookup
    ON platform_skill_feedback(user_id, project_id, skill_name, created_at DESC);
