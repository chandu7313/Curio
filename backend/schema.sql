-- ============================================================================
-- Curio — Personal Learning Intelligence Schema (PostgreSQL)
-- ============================================================================
-- Architecture:
--   Supports authenticated cloud synchronization of the personal glossary,
--   knowledge graph relationships, understanding metrics, and temporal history.
--
-- Note on Hybrid Mode:
--   Curio functions 100% offline via Chrome extension storage. This schema
--   powers optional authenticated accounts for cross-device sync.
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── 1. Users & Authentication ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_sync_at TIMESTAMPTZ
);

-- ─── 2. Personal Learning Glossary ──────────────────────────────────────────
CREATE TYPE understanding_status AS ENUM ('need_explanation', 'reviewing', 'understood');

CREATE TABLE IF NOT EXISTS concepts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id VARCHAR(64) NOT NULL, -- Matches local extension ID (e.g. c_173000...)
    term VARCHAR(255) NOT NULL,
    selected_text TEXT NOT NULL,
    category VARCHAR(64) DEFAULT 'General',
    understanding_level understanding_status DEFAULT 'reviewing',
    is_saved BOOLEAN DEFAULT FALSE,
    notes TEXT DEFAULT '',
    explore_count INT DEFAULT 1,
    first_explored_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_explored_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    source_url TEXT,
    source_title VARCHAR(512),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_client_concept UNIQUE (user_id, client_id)
);

CREATE INDEX idx_concepts_user_id ON concepts(user_id);
CREATE INDEX idx_concepts_category ON concepts(user_id, category);
CREATE INDEX idx_concepts_understanding ON concepts(user_id, understanding_level);
CREATE INDEX idx_concepts_last_explored ON concepts(user_id, last_explored_at DESC);

-- Full-text search index for fast glossary queries
CREATE INDEX idx_concepts_fts ON concepts USING GIN (to_tsvector('english', term || ' ' || selected_text || ' ' || notes));

-- ─── 3. Explanations (Cached Formatted Explanations) ────────────────────────
CREATE TABLE IF NOT EXISTS explanations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    concept_id UUID NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
    mode VARCHAR(32) NOT NULL, -- 'simple', 'intermediate', 'advanced'
    title VARCHAR(255) NOT NULL,
    summary TEXT NOT NULL,
    key_points JSONB DEFAULT '[]'::jsonb,
    code_example JSONB,
    deep_dive TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_explanations_concept_id ON explanations(concept_id);

-- ─── 4. Knowledge Graph Concept Relations ───────────────────────────────────
CREATE TYPE relationship_type AS ENUM (
    'prerequisite',
    'used_with',
    'alternative',
    'subconcept',
    'paradigm'
);

CREATE TABLE IF NOT EXISTS concept_relations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    from_concept_id UUID REFERENCES concepts(id) ON DELETE CASCADE,
    to_term VARCHAR(255) NOT NULL,
    relation_type relationship_type NOT NULL,
    label VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_concept_relations_user ON concept_relations(user_id);
CREATE INDEX idx_concept_relations_from ON concept_relations(from_concept_id);

-- ─── 5. Temporal Learning History / Review Timeline ─────────────────────────
CREATE TABLE IF NOT EXISTS exploration_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    concept_id UUID NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
    explored_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    trigger_source VARCHAR(64) DEFAULT 'shortcut', -- 'shortcut', 'popup', 'glossary_revisit'
    mode VARCHAR(32) DEFAULT 'intermediate'
);

CREATE INDEX idx_exploration_events_user_time ON exploration_events(user_id, explored_at DESC);

-- ─── 6. Synchronization Log ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_name VARCHAR(128),
    records_synced INT DEFAULT 0,
    synced_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

