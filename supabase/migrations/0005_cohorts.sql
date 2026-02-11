create table if not exists cohorts (
  id uuid primary key default gen_random_uuid(),
  parish_id uuid not null references parishes(id) on delete cascade,
  name text not null,
  facilitator_clerk_user_id text,
  cadence text not null default 'weekly',
  next_session_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (parish_id, name)
);

create index if not exists cohorts_parish_id_idx on cohorts (parish_id);
create index if not exists cohorts_facilitator_idx on cohorts (facilitator_clerk_user_id);

alter table cohorts enable row level security;

create policy "deny all" on cohorts for all using (false) with check (false);

alter table enrollments
add column if not exists cohort_id uuid references cohorts(id) on delete set null;

create index if not exists enrollments_cohort_id_idx on enrollments (cohort_id);
