PRAGMA foreign_keys=OFF;

CREATE TABLE platform_users_new (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT UNIQUE,
    phone TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    nickname TEXT,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'creator', 'reviewer', 'client', 'admin', 'agent')),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

INSERT INTO platform_users_new SELECT id, username, email, phone, password_hash, password_salt, nickname, role, is_active, created_at, updated_at FROM platform_users;
DROP TABLE platform_users;
ALTER TABLE platform_users_new RENAME TO platform_users;

PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS agent_profiles (
    user_id TEXT PRIMARY KEY REFERENCES platform_users(id),
    agency_type TEXT NOT NULL DEFAULT 'individual' CHECK (agency_type IN ('individual', 'institution')),
    institution_name TEXT NOT NULL,
    contact_name TEXT,
    contact_phone TEXT,
    discount_rate REAL NOT NULL DEFAULT 1.0 CHECK (discount_rate > 0 AND discount_rate <= 1.0),
    commission_rate REAL NOT NULL DEFAULT 0.0 CHECK (commission_rate >= 0 AND commission_rate <= 1.0),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'disabled')),
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_invite_batches (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES platform_users(id),
    batch_no TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    package_type TEXT NOT NULL DEFAULT 'standard',
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price_cents INTEGER NOT NULL DEFAULT 0,
    total_price_cents INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled')),
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_agent_invite_batches_agent ON agent_invite_batches(agent_id, created_at DESC);

ALTER TABLE registration_invites ADD COLUMN batch_id TEXT REFERENCES agent_invite_batches(id);
ALTER TABLE registration_invites ADD COLUMN student_note TEXT;

CREATE TABLE IF NOT EXISTS agent_students (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES platform_users(id),
    student_user_id TEXT NOT NULL REFERENCES platform_users(id),
    invite_id TEXT NOT NULL REFERENCES registration_invites(id),
    invite_code TEXT NOT NULL,
    batch_id TEXT REFERENCES agent_invite_batches(id),
    notes TEXT,
    registered_at TEXT NOT NULL,
    UNIQUE(student_user_id)
);
CREATE INDEX IF NOT EXISTS idx_agent_students_agent ON agent_students(agent_id, registered_at DESC);
