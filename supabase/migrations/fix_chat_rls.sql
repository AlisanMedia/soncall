-- Simplify RLS policies for messages to fix visibility issues

-- Drop complicated policies first
DROP POLICY IF EXISTS "users_can_view_sent_messages" ON messages;
DROP POLICY IF EXISTS "users_can_view_received_messages" ON messages;
DROP POLICY IF EXISTS "users_can_view_broadcasts" ON messages;
DROP POLICY IF EXISTS "users_can_view_lead_comments" ON messages;
DROP POLICY IF EXISTS "managers_can_view_all_messages" ON messages;

-- Create a consolidated policy for viewing messages
-- Users can see:
-- 1. Messages they sent
-- 2. Direct messages sent to them
-- 3. Broadcast messages (receiver_id is null)
-- 4. Lead comments (if they are assigned to the lead OR if they sent it)
-- 5. Managers see everything
CREATE POLICY "consolidated_view_messages_policy"
  ON messages FOR SELECT
  USING (
    sender_id = auth.uid() OR 
    receiver_id = auth.uid() OR
    (message_type = 'broadcast') OR
    (
        message_type = 'lead_comment' AND 
        (
            sender_id = auth.uid() OR
            lead_id IN (SELECT id FROM leads WHERE assigned_to = auth.uid())
        )
    ) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')
  );

-- Ensure insert policy allows sending to anyone
DROP POLICY IF EXISTS "users_can_send_messages" ON messages;
CREATE POLICY "users_can_send_messages"
  ON messages FOR INSERT
  WITH CHECK (sender_id = auth.uid());
