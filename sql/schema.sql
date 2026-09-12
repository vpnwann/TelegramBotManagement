-- =========================================================
-- Telegram Bot Admin Panel - PostgreSQL Schema (Neon)
-- =========================================================

-- Drop tables in dependency-safe order (useful for re-running during dev)
DROP TABLE IF EXISTS message_buttons CASCADE;
DROP TABLE IF EXISTS scheduled_messages CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS templates CASCADE;
DROP TABLE IF EXISTS groups CASCADE;
DROP TABLE IF EXISTS telegram_bots CASCADE;

-- =========================================================
-- telegram_bots
-- =========================================================
CREATE TABLE telegram_bots (
    id SERIAL PRIMARY KEY,
    bot_token TEXT NOT NULL,
    bot_id BIGINT,
    username VARCHAR(255),
    first_name VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- active | inactive
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- groups
-- =========================================================
CREATE TABLE groups (
    id SERIAL PRIMARY KEY,
    chat_id VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'group', -- group | supergroup | channel | private
    username VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- active | inactive
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_groups_status ON groups(status);
CREATE INDEX idx_groups_name ON groups(name);

-- =========================================================
-- messages
-- =========================================================
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
    telegram_message_id BIGINT,
    text TEXT,
    parse_mode VARCHAR(20) DEFAULT 'HTML', -- HTML | MarkdownV2 | plain
    media_type VARCHAR(20),                -- photo | document | none
    media_url TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    -- draft | sending | sent | failed | scheduled | cancelled
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_group_id ON messages(group_id);
CREATE INDEX idx_messages_status ON messages(status);

-- =========================================================
-- message_buttons
-- =========================================================
CREATE TABLE message_buttons (
    id SERIAL PRIMARY KEY,
    message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
    button_text VARCHAR(255) NOT NULL,
    button_url TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_message_buttons_message_id ON message_buttons(message_id);

-- =========================================================
-- templates
-- =========================================================
CREATE TABLE templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    text TEXT NOT NULL,
    parse_mode VARCHAR(20) DEFAULT 'HTML',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_templates_name ON templates(name);

-- =========================================================
-- scheduled_messages
-- =========================================================
CREATE TABLE scheduled_messages (
    id SERIAL PRIMARY KEY,
    group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    parse_mode VARCHAR(20) DEFAULT 'HTML',
    scheduled_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    -- scheduled | sending | sent | failed | cancelled
    sent_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scheduled_messages_status ON scheduled_messages(status);
CREATE INDEX idx_scheduled_messages_scheduled_at ON scheduled_messages(scheduled_at);
