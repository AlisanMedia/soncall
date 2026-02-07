
-- Migration: Add Contacts Table and Update SMS Logs for Chat

-- 1. Create Contacts Table
CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    title TEXT,
    company TEXT,
    notes TEXT,
    avatar_url TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for contacts
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Contacts Policies
CREATE POLICY "Managers and Admin can view contacts" ON public.contacts
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('manager', 'admin', 'founder'))
    );

CREATE POLICY "Managers and Admin can manage contacts" ON public.contacts
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('manager', 'admin', 'founder'))
    );

-- 2. Update sms_logs for Chat Functionality
ALTER TABLE public.sms_logs 
ADD COLUMN IF NOT EXISTS direction TEXT CHECK (direction IN ('inbound', 'outbound')) DEFAULT 'outbound';

ALTER TABLE public.sms_logs 
ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL;

ALTER TABLE public.sms_logs 
ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

-- Add comments
COMMENT ON TABLE public.contacts IS 'VIP contacts and General Managers phonebook';
COMMENT ON COLUMN public.sms_logs.direction IS 'Direction of the message: inbound or outbound';

-- Add Indexes
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON public.contacts(phone_number);
CREATE INDEX IF NOT EXISTS idx_sms_logs_contact_id ON public.sms_logs(contact_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_direction ON public.sms_logs(direction);
