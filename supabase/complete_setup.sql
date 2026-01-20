-- ============================================
-- ArtificAgent Cold Calling System
-- Complete Setup Script (Including Messaging)
-- ============================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('manager', 'agent');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE lead_status AS ENUM ('pending', 'in_progress', 'contacted', 'appointment', 'not_interested', 'callback');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE potential_level AS ENUM ('high', 'medium', 'low', 'not_assessed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'agent',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Upload batches table
CREATE TABLE IF NOT EXISTS upload_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    uploaded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    total_leads INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    address TEXT,
    category TEXT,
    website TEXT,
    rating NUMERIC(2, 1),
    raw_data JSONB,
    status lead_status NOT NULL DEFAULT 'pending',
    potential_level potential_level NOT NULL DEFAULT 'not_assessed',
    assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
    current_agent_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    locked_at TIMESTAMP WITH TIME ZONE,
    batch_id UUID REFERENCES upload_batches(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Lead notes table
CREATE TABLE IF NOT EXISTS lead_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    action_taken TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lead activity log table
CREATE TABLE IF NOT EXISTS lead_activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- MESSAGING SYSTEM TABLES
-- ============================================

-- Messages table for all types of messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES profiles(id) ON DELETE CASCADE, -- NULL for broadcasts
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL, -- NULL for general messages
  message TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('direct', 'broadcast', 'lead_comment')),
  mentions JSONB DEFAULT '[]'::jsonb, -- Array of mentioned user IDs
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Message participants for tracking reads in broadcasts
CREATE TABLE IF NOT EXISTS message_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

-- ============================================
-- INDEXES
-- ============================================

-- Lead indexes
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_batch_id ON leads(batch_id);
CREATE INDEX IF NOT EXISTS idx_lead_notes_lead_id ON lead_notes(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_notes_agent_id ON lead_notes(agent_id);
CREATE INDEX IF NOT EXISTS idx_lead_activity_log_lead_id ON lead_activity_log(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_activity_log_agent_id ON lead_activity_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_lead_activity_log_created_at ON lead_activity_log(created_at);

-- Message indexes
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_lead ON messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(message_type);
CREATE INDEX IF NOT EXISTS idx_message_participants_user ON message_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_message_participants_message ON message_participants(message_id);

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_participants ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES - PROFILES & LEADS
-- ============================================

DROP POLICY IF EXISTS "Anyone can view profiles" ON profiles;
CREATE POLICY "Anyone can view profiles" ON profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Managers can view all leads" ON leads;
CREATE POLICY "Managers can view all leads" ON leads FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'manager'));

DROP POLICY IF EXISTS "Agents can view assigned leads" ON leads;
CREATE POLICY "Agents can view assigned leads" ON leads FOR SELECT USING (assigned_to = auth.uid());

DROP POLICY IF EXISTS "Managers can insert leads" ON leads;
CREATE POLICY "Managers can insert leads" ON leads FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'manager'));

DROP POLICY IF EXISTS "Managers can update leads" ON leads;
CREATE POLICY "Managers can update leads" ON leads FOR UPDATE
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'manager'));

DROP POLICY IF EXISTS "Agents can update assigned leads" ON leads;
CREATE POLICY "Agents can update assigned leads" ON leads FOR UPDATE USING (assigned_to = auth.uid());

DROP POLICY IF EXISTS "Managers can view all batches" ON upload_batches;
CREATE POLICY "Managers can view all batches" ON upload_batches FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'manager'));

DROP POLICY IF EXISTS "Managers can insert batches" ON upload_batches;
CREATE POLICY "Managers can insert batches" ON upload_batches FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'manager'));

DROP POLICY IF EXISTS "Anyone can view notes" ON lead_notes;
CREATE POLICY "Anyone can view notes" ON lead_notes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Agents can insert notes for assigned leads" ON lead_notes;
CREATE POLICY "Agents can insert notes for assigned leads" ON lead_notes FOR INSERT
    WITH CHECK (agent_id = auth.uid() AND EXISTS (SELECT 1 FROM leads WHERE leads.id = lead_id AND leads.assigned_to = auth.uid()));

DROP POLICY IF EXISTS "Anyone can view activity logs" ON lead_activity_log;
CREATE POLICY "Anyone can view activity logs" ON lead_activity_log FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert activity logs" ON lead_activity_log;
CREATE POLICY "Authenticated users can insert activity logs" ON lead_activity_log FOR INSERT WITH CHECK (auth.uid() = agent_id);

-- ============================================
-- RLS POLICIES - MESSAGES
-- ============================================

-- Users can view messages they sent
DROP POLICY IF EXISTS "users_can_view_sent_messages" ON messages;
CREATE POLICY "users_can_view_sent_messages"
  ON messages FOR SELECT
  USING (sender_id = auth.uid());

-- Users can view messages they received (direct)
DROP POLICY IF EXISTS "users_can_view_received_messages" ON messages;
CREATE POLICY "users_can_view_received_messages"
  ON messages FOR SELECT
  USING (receiver_id = auth.uid());

-- Users can view broadcast messages
DROP POLICY IF EXISTS "users_can_view_broadcasts" ON messages;
CREATE POLICY "users_can_view_broadcasts"
  ON messages FOR SELECT
  USING (message_type = 'broadcast' AND receiver_id IS NULL);

-- Users can view lead comments on their assigned leads
DROP POLICY IF EXISTS "users_can_view_lead_comments" ON messages;
CREATE POLICY "users_can_view_lead_comments"
  ON messages FOR SELECT
  USING (
    message_type = 'lead_comment' AND 
    lead_id IN (SELECT id FROM leads WHERE assigned_to = auth.uid())
  );

-- Managers can view all messages (for audit)
DROP POLICY IF EXISTS "managers_can_view_all_messages" ON messages;
CREATE POLICY "managers_can_view_all_messages"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- Users can send messages
DROP POLICY IF EXISTS "users_can_send_messages" ON messages;
CREATE POLICY "users_can_send_messages"
  ON messages FOR INSERT
  WITH CHECK (sender_id = auth.uid());

-- Only sender can delete their own messages
DROP POLICY IF EXISTS "users_can_delete_own_messages" ON messages;
CREATE POLICY "users_can_delete_own_messages"
  ON messages FOR DELETE
  USING (sender_id = auth.uid());

-- Users can update their sent messages (mark as read for receiver)
DROP POLICY IF EXISTS "users_can_update_messages" ON messages;
CREATE POLICY "users_can_update_messages"
  ON messages FOR UPDATE
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

-- ============================================
-- RLS POLICIES - MESSAGE PARTICIPANTS
-- ============================================

-- Users can view their own participations
DROP POLICY IF EXISTS "users_can_view_own_participations" ON message_participants;
CREATE POLICY "users_can_view_own_participations"
  ON message_participants FOR SELECT
  USING (user_id = auth.uid());

-- System can create participations (via service role or authenticated user)
DROP POLICY IF EXISTS "system_can_create_participations" ON message_participants;
CREATE POLICY "system_can_create_participations"
  ON message_participants FOR INSERT
  WITH CHECK (true);

-- Users can update their own participation (mark as read)
DROP POLICY IF EXISTS "users_can_update_own_participations" ON message_participants;
CREATE POLICY "users_can_update_own_participations"
  ON message_participants FOR UPDATE
  USING (user_id = auth.uid());

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically create participants for broadcasts
CREATE OR REPLACE FUNCTION create_broadcast_participants()
RETURNS TRIGGER AS $$
BEGIN
  -- Only for broadcast messages
  IF NEW.message_type = 'broadcast' THEN
    -- Insert a participant record for each agent
    INSERT INTO message_participants (message_id, user_id)
    SELECT NEW.id, id 
    FROM profiles 
    WHERE role = 'agent' AND id != NEW.sender_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create broadcast participants
DROP TRIGGER IF EXISTS trg_create_broadcast_participants ON messages;
CREATE TRIGGER trg_create_broadcast_participants
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION create_broadcast_participants();

-- Function to update messages updated_at timestamp
CREATE OR REPLACE FUNCTION update_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update messages updated_at
DROP TRIGGER IF EXISTS trg_update_messages_updated_at ON messages;
CREATE TRIGGER trg_update_messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_messages_updated_at();

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

GRANT ALL ON profiles TO authenticated;
GRANT ALL ON leads TO authenticated;
GRANT ALL ON upload_batches TO authenticated;
GRANT ALL ON lead_notes TO authenticated;
GRANT ALL ON lead_activity_log TO authenticated;
GRANT ALL ON messages TO authenticated;
GRANT ALL ON message_participants TO authenticated;

-- ============================================
-- CREATE DEFAULT USERS (OPTIONAL - Only for testing)
-- ============================================

-- Manager user and profile
DO $$
DECLARE
    manager_id UUID;
    existing_manager UUID;
BEGIN
    -- Check if manager already exists
    SELECT id INTO existing_manager FROM profiles WHERE email = 'manager@artificagent.com';
    
    IF existing_manager IS NULL THEN
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_user_meta_data,
            created_at,
            updated_at,
            confirmation_token,
            email_change,
            email_change_token_new,
            recovery_token
        )
        VALUES (
            '00000000-0000-0000-0000-000000000000',
            gen_random_uuid(),
            'authenticated',
            'authenticated',
            'manager@artificagent.com',
            crypt('password123', gen_salt('bf')),
            NOW(),
            '{"full_name": "Test Manager"}'::jsonb,
            NOW(),
            NOW(),
            '',
            '',
            '',
            ''
        )
        RETURNING id INTO manager_id;

        INSERT INTO profiles (id, email, full_name, role)
        VALUES (manager_id, 'manager@artificagent.com', 'Test Manager', 'manager');
    END IF;
END $$;

-- Agent 1 user and profile
DO $$
DECLARE
    agent_id UUID;
    existing_agent UUID;
BEGIN
    SELECT id INTO existing_agent FROM profiles WHERE email = 'agent1@artificagent.com';
    
    IF existing_agent IS NULL THEN
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_user_meta_data,
            created_at,
            updated_at,
            confirmation_token,
            email_change,
            email_change_token_new,
            recovery_token
        )
        VALUES (
            '00000000-0000-0000-0000-000000000000',
            gen_random_uuid(),
            'authenticated',
            'authenticated',
            'agent1@artificagent.com',
            crypt('password123', gen_salt('bf')),
            NOW(),
            '{"full_name": "Ahmet Yılmaz"}'::jsonb,
            NOW(),
            NOW(),
            '',
            '',
            '',
            ''
        )
        RETURNING id INTO agent_id;

        INSERT INTO profiles (id, email, full_name, role)
        VALUES (agent_id, 'agent1@artificagent.com', 'Ahmet Yılmaz', 'agent');
    END IF;
END $$;

-- Agent 2 user and profile
DO $$
DECLARE
    agent_id UUID;
    existing_agent UUID;
BEGIN
    SELECT id INTO existing_agent FROM profiles WHERE email = 'agent2@artificagent.com';
    
    IF existing_agent IS NULL THEN
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_user_meta_data,
            created_at,
            updated_at,
            confirmation_token,
            email_change,
            email_change_token_new,
            recovery_token
        )
        VALUES (
            '00000000-0000-0000-0000-000000000000',
            gen_random_uuid(),
            'authenticated',
            'authenticated',
            'agent2@artificagent.com',
            crypt('password123', gen_salt('bf')),
            NOW(),
            '{"full_name": "Mehmet Demir"}'::jsonb,
            NOW(),
            NOW(),
            '',
            '',
            '',
            ''
        )
        RETURNING id INTO agent_id;

        INSERT INTO profiles (id, email, full_name, role)
        VALUES (agent_id, 'agent2@artificagent.com', 'Mehmet Demir', 'agent');
    END IF;
END $$;

-- Agent 3 user and profile
DO $$
DECLARE
    agent_id UUID;
    existing_agent UUID;
BEGIN
    SELECT id INTO existing_agent FROM profiles WHERE email = 'agent3@artificagent.com';
    
    IF existing_agent IS NULL THEN
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_user_meta_data,
            created_at,
            updated_at,
            confirmation_token,
            email_change,
            email_change_token_new,
            recovery_token
        )
        VALUES (
            '00000000-0000-0000-0000-000000000000',
            gen_random_uuid(),
            'authenticated',
            'authenticated',
            'agent3@artificagent.com',
            crypt('password123', gen_salt('bf')),
            NOW(),
            '{"full_name": "Ayşe Kaya"}'::jsonb,
            NOW(),
            NOW(),
            '',
            '',
            '',
            ''
        )
        RETURNING id INTO agent_id;

        INSERT INTO profiles (id, email, full_name, role)
        VALUES (agent_id, 'agent3@artificagent.com', 'Ayşe Kaya', 'agent');
    END IF;
END $$;

-- ============================================
-- VERIFY SETUP
-- ============================================

SELECT 
    'Setup Complete!' as status,
    (SELECT COUNT(*) FROM auth.users) as total_users,
    (SELECT COUNT(*) FROM profiles) as total_profiles,
    (SELECT COUNT(*) FROM profiles WHERE role = 'manager') as managers,
    (SELECT COUNT(*) FROM profiles WHERE role = 'agent') as agents,
    (SELECT COUNT(*) FROM pg_tables WHERE tablename = 'messages') as messages_table_exists,
    (SELECT COUNT(*) FROM pg_tables WHERE tablename = 'message_participants') as participants_table_exists;
