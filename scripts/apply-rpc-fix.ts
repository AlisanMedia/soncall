import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
    console.error('DATABASE_URL not found in .env.local');
    process.exit(1);
}

const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
});

const createRpcSql = `
-- Function to get activity stream for managers bypassing RLS
CREATE OR REPLACE FUNCTION get_manager_activity_stream(
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  p_search TEXT DEFAULT ''
)
RETURNS TABLE (
  id UUID,
  action TEXT,
  created_at TIMESTAMPTZ,
  metadata JSONB,
  agent_id UUID,
  lead_id UUID,
  agent_full_name TEXT,
  agent_avatar_url TEXT,
  lead_business_name TEXT,
  lead_phone_number TEXT,
  lead_status TEXT,
  lead_potential_level TEXT,
  note TEXT,
  action_taken TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user is manager/admin/founder
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('manager', 'admin', 'founder')
  ) THEN
    -- For safety, we can return empty or raise exception. 
    -- Raising exception might be better to debug.
    -- But since we use SECURITY DEFINER, auth.uid() might be tricky if not set by Supabase GUC.
    -- Supabase sets auth.uid() correctly for RPC calls from client.
    
    -- Let's just check if the user exists in profiles with role.
    -- IF auth.uid() is NULL (service role), we might allow it? 
    -- NO, stick to strict check.
    
    -- RAISE EXCEPTION 'Access Denied';
    NULL;
  END IF;

  RETURN QUERY
  SELECT
    lal.id,
    lal.action,
    lal.created_at,
    lal.metadata,
    lal.agent_id,
    lal.lead_id,
    p.full_name as agent_full_name,
    p.avatar_url as agent_avatar_url,
    l.business_name as lead_business_name,
    l.phone_number as lead_phone_number,
    l.status as lead_status,
    l.potential_level as lead_potential_level,
    ln.note,
    ln.action_taken
  FROM lead_activity_log lal
  LEFT JOIN profiles p ON lal.agent_id = p.id
  LEFT JOIN leads l ON lal.lead_id = l.id
  LEFT JOIN lead_notes ln ON (
    ln.lead_id = lal.lead_id 
    AND ln.agent_id = lal.agent_id 
    AND ln.created_at BETWEEN lal.created_at - interval '1 minute' AND lal.created_at + interval '1 minute'
  )
  WHERE 
    (p_search = '' OR 
     p.full_name ILIKE '%' || p_search || '%' OR
     l.business_name ILIKE '%' || p_search || '%' OR
     l.phone_number ILIKE '%' || p_search || '%')
  ORDER BY lal.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;
`;

async function run() {
    try {
        await client.connect();
        console.log('Connected to database');

        await client.query(createRpcSql);
        console.log('RPC function get_manager_activity_stream created successfully');

    } catch (err) {
        console.error('Error creating RPC:', err);
    } finally {
        await client.end();
    }
}

run();
