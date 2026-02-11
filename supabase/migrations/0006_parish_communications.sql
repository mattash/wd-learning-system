create table if not exists parish_message_sends (
  id uuid primary key default gen_random_uuid(),
  parish_id uuid not null references parishes(id) on delete cascade,
  created_by_clerk_user_id text not null,
  audience_type text not null check (audience_type in ('all_members','stalled_learners','cohort','course')),
  audience_value text,
  subject text not null,
  body text not null,
  recipient_count int not null default 0,
  delivery_status text not null default 'not_configured' check (delivery_status in ('not_configured','queued','sent','failed')),
  provider text,
  created_at timestamptz not null default now()
);

create index if not exists parish_message_sends_parish_created_idx on parish_message_sends (parish_id, created_at desc);

create table if not exists parish_message_recipients (
  send_id uuid not null references parish_message_sends(id) on delete cascade,
  parish_id uuid not null references parishes(id) on delete cascade,
  clerk_user_id text not null,
  primary key (send_id, clerk_user_id)
);

create index if not exists parish_message_recipients_parish_user_idx on parish_message_recipients (parish_id, clerk_user_id);

alter table parish_message_sends enable row level security;
alter table parish_message_recipients enable row level security;

create policy "deny all" on parish_message_sends for all using (false) with check (false);
create policy "deny all" on parish_message_recipients for all using (false) with check (false);
