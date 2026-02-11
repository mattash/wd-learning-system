create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_clerk_user_id text not null,
  action text not null,
  resource_type text not null,
  resource_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_at_idx on audit_logs (created_at desc);
create index if not exists audit_logs_actor_idx on audit_logs (actor_clerk_user_id);
create index if not exists audit_logs_resource_type_idx on audit_logs (resource_type);
create index if not exists audit_logs_action_idx on audit_logs (action);

alter table audit_logs enable row level security;
create policy "deny all" on audit_logs for all using (false) with check (false);
