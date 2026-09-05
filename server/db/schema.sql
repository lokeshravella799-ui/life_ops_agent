-- ==============================================================================
-- LifeOps Agent — Supabase PostgreSQL Schema Definition
-- ==============================================================================

-- 1. Profiles Table (Primary User Personalization & Config)
CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY,
  active_persona_id TEXT NOT NULL DEFAULT 'personal',
  personas JSONB NOT NULL DEFAULT '{}'::jsonb,
  shopping JSONB NOT NULL DEFAULT '{}'::jsonb,
  travel JSONB NOT NULL DEFAULT '{}'::jsonb,
  staged_inferences JSONB NOT NULL DEFAULT '[]'::jsonb,
  evolution_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  feedback_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Staged Inferences Table (Learned Preferences Pending Approval)
CREATE TABLE IF NOT EXISTS staged_inferences (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  field TEXT NOT NULL,
  inferred_value TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL DEFAULT 'staged',
  evidence_count INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_staged_inferences_user_id ON staged_inferences(user_id);

-- 3. Preference Evolution History Table
CREATE TABLE IF NOT EXISTS preference_evolution_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  field TEXT NOT NULL,
  previous_value JSONB,
  new_value JSONB,
  reason TEXT NOT NULL,
  revertible BOOLEAN NOT NULL DEFAULT TRUE,
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pref_evolution_user_id ON preference_evolution_history(user_id);

-- 4. Recommendation Feedback Table (Explicit & Implicit User Feedback)
CREATE TABLE IF NOT EXISTS recommendation_feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  recommendation_id TEXT NOT NULL,
  rating TEXT NOT NULL CHECK (rating IN ('positive', 'negative')),
  reason TEXT,
  target_brand TEXT,
  target_title TEXT,
  comments TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rec_feedback_user_id ON recommendation_feedback(user_id);

-- 5. Conversations Table
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES profiles(user_id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  current_intent TEXT,
  current_phase TEXT NOT NULL DEFAULT 'IDLE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);

-- 6. Messages Table (Conversation History)
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('user', 'agent', 'system')),
  content TEXT NOT NULL,
  intent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);

-- 7. Standing Watchers Table (Autonomous Monitoring)
CREATE TABLE IF NOT EXISTS standing_watchers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  target_query TEXT NOT NULL,
  target_category TEXT NOT NULL,
  condition_type TEXT NOT NULL,
  target_value NUMERIC,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_checked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_standing_watchers_user_id ON standing_watchers(user_id);

-- 8. Composite Journeys Table (Multi-Segment Operations)
CREATE TABLE IF NOT EXISTS composite_journeys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  segments JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_composite_journeys_user_id ON composite_journeys(user_id);

-- 9. Watcher Trigger History Table
CREATE TABLE IF NOT EXISTS watcher_trigger_history (
  id TEXT PRIMARY KEY,
  watcher_id TEXT NOT NULL REFERENCES standing_watchers(id) ON DELETE CASCADE,
  trigger_reason TEXT NOT NULL,
  item_details JSONB NOT NULL,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_watcher_triggers_watcher_id ON watcher_trigger_history(watcher_id);
