-- ============================================================
-- Stratum Advisory — Migration: Engagement Stages Table
-- Run this in Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- 1. Create the engagement_stages table
create table if not exists engagement_stages (
  id              uuid primary key default gen_random_uuid(),
  engagement_id   uuid references engagements on delete cascade not null,
  stage           text not null check (stage in (
    'scoping','issue_tree','research','analysis',
    'synthesis','quality_check','deliverable','in_review','delivered'
  )),
  status          text not null default 'pending' check (status in ('pending','in_progress','completed','skipped')),
  started_at      timestamptz,
  completed_at    timestamptz,
  metadata        jsonb default '{}'::jsonb,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique (engagement_id, stage)
);

-- 2. Row Level Security
alter table engagement_stages enable row level security;

create policy "engagement_stages: owner all"
  on engagement_stages for all
  using (
    auth.uid() = (select owner_id from engagements where id = engagement_id)
    or exists (select 1 from user_roles where user_id = auth.uid() and role in ('reviewer','admin'))
  )
  with check (
    auth.uid() = (select owner_id from engagements where id = engagement_id)
  );

create index if not exists engagement_stages_engagement_idx on engagement_stages (engagement_id);
create index if not exists engagement_stages_stage_idx on engagement_stages (stage);

-- 3. Trigger: Automatically seed all 9 stages when an engagement is created
create or replace function initialize_engagement_stages()
returns trigger language plpgsql security definer as $$
begin
  insert into engagement_stages (engagement_id, stage, status, started_at)
  values 
    (new.id, 'scoping', 'in_progress', now()),
    (new.id, 'issue_tree', 'pending', null),
    (new.id, 'research', 'pending', null),
    (new.id, 'analysis', 'pending', null),
    (new.id, 'synthesis', 'pending', null),
    (new.id, 'quality_check', 'pending', null),
    (new.id, 'deliverable', 'pending', null),
    (new.id, 'in_review', 'pending', null),
    (new.id, 'delivered', 'pending', null)
  on conflict (engagement_id, stage) do nothing;
  return new;
end;
$$;

drop trigger if exists on_engagement_created_stages on engagements;
create trigger on_engagement_created_stages
  after insert on engagements
  for each row execute procedure initialize_engagement_stages();

-- 4. Trigger: Automatically update stages progress when engagement.stage advances
create or replace function sync_engagement_stage_progress()
returns trigger language plpgsql security definer as $$
declare
  stage_order text[] := array['scoping','issue_tree','research','analysis','synthesis','quality_check','deliverable','in_review','delivered'];
  old_idx int;
  new_idx int;
  i int;
begin
  if new.stage is distinct from old.stage then
    old_idx := array_position(stage_order, old.stage);
    new_idx := array_position(stage_order, new.stage);

    -- Mark previous stages as completed
    if new_idx is not null and old_idx is not null and new_idx > old_idx then
      for i in old_idx..(new_idx - 1) loop
        update engagement_stages
        set status = 'completed',
            completed_at = coalesce(completed_at, now()),
            updated_at = now()
        where engagement_id = new.id and stage = stage_order[i];
      end loop;
    end if;

    -- Mark current stage as in_progress
    update engagement_stages
    set status = 'in_progress',
        started_at = coalesce(started_at, now()),
        updated_at = now()
    where engagement_id = new.id and stage = new.stage;
  end if;

  return new;
end;
$$;

drop trigger if exists on_engagement_stage_updated on engagements;
create trigger on_engagement_stage_updated
  after update of stage on engagements
  for each row execute procedure sync_engagement_stage_progress();

-- 5. Backfill existing engagements into engagement_stages
insert into engagement_stages (engagement_id, stage, status, started_at, completed_at)
select 
  e.id as engagement_id,
  s.stage,
  case 
    when s.ord < coalesce(array_position(array['scoping','issue_tree','research','analysis','synthesis','quality_check','deliverable','in_review','delivered'], e.stage), 1) then 'completed'
    when s.stage = e.stage then 'in_progress'
    else 'pending'
  end as status,
  case 
    when s.ord <= coalesce(array_position(array['scoping','issue_tree','research','analysis','synthesis','quality_check','deliverable','in_review','delivered'], e.stage), 1) then e.created_at 
    else null 
  end as started_at,
  case 
    when s.ord < coalesce(array_position(array['scoping','issue_tree','research','analysis','synthesis','quality_check','deliverable','in_review','delivered'], e.stage), 1) then e.updated_at 
    else null 
  end as completed_at
from engagements e
cross join (
  values 
    ('scoping', 1), ('issue_tree', 2), ('research', 3), ('analysis', 4),
    ('synthesis', 5), ('quality_check', 6), ('deliverable', 7), ('in_review', 8), ('delivered', 9)
) as s(stage, ord)
on conflict (engagement_id, stage) do update 
set status = excluded.status,
    started_at = coalesce(engagement_stages.started_at, excluded.started_at),
    completed_at = coalesce(engagement_stages.completed_at, excluded.completed_at),
    updated_at = now();
