create table if not exists parish_message_delivery_jobs (
  id uuid primary key default gen_random_uuid(),
  send_id uuid not null unique references parish_message_sends(id) on delete cascade,
  parish_id uuid not null references parishes(id) on delete cascade,
  provider text not null,
  status text not null default 'pending' check (status in ('pending','processing','sent','failed')),
  attempts int not null default 0,
  max_attempts int not null default 5 check (max_attempts >= 1),
  next_attempt_at timestamptz not null default now(),
  last_error text,
  locked_at timestamptz,
  locked_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists parish_message_delivery_jobs_pending_idx
  on parish_message_delivery_jobs (status, next_attempt_at);

create index if not exists parish_message_delivery_jobs_parish_idx
  on parish_message_delivery_jobs (parish_id, created_at desc);

alter table parish_message_delivery_jobs enable row level security;
create policy "deny all" on parish_message_delivery_jobs for all using (false) with check (false);

alter table parish_message_recipients
  add column if not exists delivery_status text not null default 'pending'
    check (delivery_status in ('not_configured','pending','sent','failed'));

alter table parish_message_recipients
  add column if not exists delivery_attempted_at timestamptz;

alter table parish_message_recipients
  add column if not exists provider_message_id text;

alter table parish_message_recipients
  add column if not exists delivery_error text;

create index if not exists parish_message_recipients_send_status_idx
  on parish_message_recipients (send_id, delivery_status);
