create table if not exists sales (
  id uuid default gen_random_uuid() primary key,
  lead_id uuid references leads(id),
  agent_id uuid references profiles(id),
  amount decimal not null,
  commission decimal,
  status text default 'pending', -- pending, approved, rejected
  approved_at timestamp with time zone,
  manager_notes text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- RLS
alter table sales enable row level security;

-- Policies
create policy "Agents can insert their own sales"
  on sales for insert
  with check (auth.uid() = agent_id);

create policy "Agents can view their own sales"
  on sales for select
  using (auth.uid() = agent_id);

create policy "Managers can view all sales"
  on sales for select
  using (exists (select 1 from profiles where id = auth.uid() and role = 'manager'));

create policy "Managers can update sales"
  on sales for update
  using (exists (select 1 from profiles where id = auth.uid() and role = 'manager'));

-- Add Indexes
create index idx_sales_agent_id on sales(agent_id);
create index idx_sales_status on sales(status);
