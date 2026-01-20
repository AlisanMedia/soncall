-- Team Chat & Messaging System Schema
-- This migration adds internal communication capabilities

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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_lead ON messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(message_type);
CREATE INDEX IF NOT EXISTS idx_message_participants_user ON message_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_message_participants_message ON message_participants(message_id);

-- Enable Row Level Security
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_participants ENABLE ROW LEVEL SECURITY;

-- RLS Policies for messages
-- Users can view messages they sent
CREATE POLICY "users_can_view_sent_messages"
  ON messages FOR SELECT
  USING (sender_id = auth.uid());

-- Users can view messages they received (direct)
CREATE POLICY "users_can_view_received_messages"
  ON messages FOR SELECT
  USING (receiver_id = auth.uid());

-- Users can view broadcast messages
CREATE POLICY "users_can_view_broadcasts"
  ON messages FOR SELECT
  USING (message_type = 'broadcast' AND receiver_id IS NULL);

-- Users can view lead comments on their assigned leads
CREATE POLICY "users_can_view_lead_comments"
  ON messages FOR SELECT
  USING (
    message_type = 'lead_comment' AND 
    lead_id IN (SELECT id FROM leads WHERE assigned_to = auth.uid())
  );

-- Managers can view all messages (for audit)
CREATE POLICY "managers_can_view_all_messages"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- Users can send messages
CREATE POLICY "users_can_send_messages"
  ON messages FOR INSERT
  WITH CHECK (sender_id = auth.uid());

-- Only sender can delete their own messages
CREATE POLICY "users_can_delete_own_messages"
  ON messages FOR DELETE
  USING (sender_id = auth.uid());

-- Users can update their sent messages (mark as read for receiver)
CREATE POLICY "users_can_update_messages"
  ON messages FOR UPDATE
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

-- RLS Policies for message_participants
-- Users can view their own participations
CREATE POLICY "users_can_view_own_participations"
  ON message_participants FOR SELECT
  USING (user_id = auth.uid());

-- System can create participations (via service role or authenticated user)
CREATE POLICY "system_can_create_participations"
  ON message_participants FOR INSERT
  WITH CHECK (true);

-- Users can update their own participation (mark as read)
CREATE POLICY "users_can_update_own_participations"
  ON message_participants FOR UPDATE
  USING (user_id = auth.uid());

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

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at
DROP TRIGGER IF EXISTS trg_update_messages_updated_at ON messages;
CREATE TRIGGER trg_update_messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_messages_updated_at();

-- Grant permissions
GRANT ALL ON messages TO authenticated;
GRANT ALL ON message_participants TO authenticated;
