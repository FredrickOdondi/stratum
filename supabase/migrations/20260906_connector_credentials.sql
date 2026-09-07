-- Run this in your Supabase SQL editor
-- Table to store encrypted connector credentials per user

create table if not exists connector_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  connector_id text not null,            -- e.g. 'shopify', 'klaviyo'
  display_name text,                      -- e.g. 'myshop.myshopify.com'
  credentials jsonb not null default '{}', -- encrypted key/value store
  status text not null default 'connected', -- 'connected' | 'error'
  connected_at timestamptz default now(),
  unique(user_id, connector_id)
);

-- Enable Row Level Security
alter table connector_credentials enable row level security;

-- Users can only see and manage their own connections
create policy "Users own their connectors" on connector_credentials
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
