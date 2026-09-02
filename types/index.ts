// Database Types
export type UserRole = 'founder' | 'admin' | 'manager' | 'agent';

export type SalesRole = 'sdr' | 'closer';

export interface Market {
  id: string;
  code: string;
  name: string;
  country: string;
  default_language: string;
  timezone: string;
  currency: string;
  calling_country_code?: string | null;
}

export type LeadStatus =
  | 'pending'
  | 'in_progress'
  | 'contacted'
  | 'appointment'
  | 'not_interested'
  | 'callback';

export type PotentialLevel =
  | 'high'
  | 'medium'
  | 'low'
  | 'not_assessed';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
  avatar_url?: string;
  nickname?: string;
  theme_color?: string;
  bio?: string;
  tc_number?: string;
  birth_date?: string;
  city?: string;
  district?: string;
  commission_rate?: number;
  phone_number?: string;
  raw_password?: string;
  sales_role?: SalesRole | null;
  market_id?: string | null;
  preferred_language?: string | null;
}

export interface Lead {
  id: string;
  lead_number?: number; // Added via migration
  business_name: string;
  phone_number: string;
  address: string;
  category: string;
  website: string | null;
  rating: number | null;
  raw_data: Record<string, unknown>;
  status: LeadStatus;
  potential_level: PotentialLevel;
  assigned_to: string | null;
  current_agent_id: string | null;
  locked_at: string | null;
  created_at: string;
  updated_at: string;
  processed_at: string | null;
  batch_id: string | null;
  appointment_date?: string | null;
  callback_at?: string | null;
  callback_reason?: string | null;
  callback_reminder_10m_sent?: boolean | null;
  sdr_id?: string | null;
  closer_id?: string | null;
  meeting_url?: string | null;
  meeting_status?: 'scheduled' | 'completed' | 'no_show' | 'won' | 'lost' | null;
  market_id?: string | null;
  country?: string | null;
  timezone?: string | null;
  language?: string | null;
}

export interface LeadNote {
  id: string;
  lead_id: string;
  agent_id: string;
  note: string;
  action_taken: string;
  created_at: string;
}

export interface LeadActivityLog {
  id: string;
  lead_id: string;
  agent_id: string;
  action: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface UploadBatch {
  id: string;
  uploaded_by: string;
  filename: string;
  total_leads: number;
  created_at: string;
}

// UI Types
export interface LeadAssignment {
  agentId: string;
  agentName: string;
  count: number;
}

export interface LeaderboardEntry {
  agent_id: string;
  agent_name: string;
  processed_count: number;
  rank: number;
  sales_role?: SalesRole | null;
  metric_label?: string;
}

export interface CSVRow {
  'Business Name'?: string;
  'Name'?: string;
  'Phone'?: string;
  'Phone Number'?: string;
  'Address'?: string;
  'Category'?: string;
  'Type'?: string;
  'Website'?: string;
  'URL'?: string;
  'Rating'?: string;
  [key: string]: string | undefined;
}

// API Response Types
export interface UploadResponse {
  success: boolean;
  totalLeads: number;
  batchId: string;
  message?: string;
}

export interface AssignResponse {
  success: boolean;
  assignmentDetails: {
    agentId: string;
    assignedCount: number;
  }[];
  message?: string;
}

export interface UpdateLeadResponse {
  success: boolean;
  nextLeadId: string | null;
  message?: string;
}

export interface StatsResponse {
  leaderboard: LeaderboardEntry[];
  currentUserStats: {
    processed_today: number;
    total_assigned: number;
    remaining: number;
    metric_label?: string;
  };
}

export interface AgentProgress {
  agent_id: string;
  total_xp: number;
  current_level: number;
  current_streak: number;
  last_activity_date: string;
}
