-- Migration: Course certificates
-- Tracks issued certificates for course completions and serves as
-- the record of completion for audit/verification purposes.

create table if not exists certificates (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null,
  parish_id uuid not null references parishes(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  issued_at timestamptz not null default now(),
  download_url text,
  unique (course_id, clerk_user_id, parish_id)
);

create index if not exists certificates_parish_id_idx on certificates (parish_id);
create index if not exists certificates_clerk_user_id_idx on certificates (clerk_user_id);
create index if not exists certificates_course_id_idx on certificates (course_id);

alter table certificates enable row level security;

-- Students and parish admins can see certificates for their own enrollments
create policy "students_can_view_own_certificates" on certificates
  for select using (
    auth.uid() = clerk_user_id
    or exists (
      select 1 from parish_memberships
      where parish_memberships.clerk_user_id = auth.uid()
        and parish_memberships.parish_id = certificates.parish_id
        and parish_memberships.role in ('parish_admin', 'diocesan_admin')
    )
  );

create policy "parish_admins_can_manage_own_certificates" on certificates
  for all using (
    exists (
      select 1 from parish_memberships
      where parish_memberships.clerk_user_id = auth.uid()
        and parish_memberships.parish_id = certificates.parish_id
        and parish_memberships.role in ('parish_admin', 'diocesan_admin')
    )
  );

-- Tracking column on enrollments to prevent duplicate completion emails
alter table enrollments add column if not exists completion_email_sent_at timestamptz;