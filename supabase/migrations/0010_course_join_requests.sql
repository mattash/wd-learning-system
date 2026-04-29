-- Migration: Course Join Requests
-- Students request to join a course → parish_admin approves or rejects

create table if not exists course_join_requests (
  id uuid primary key default gen_random_uuid(),
  parish_id uuid not null references parishes(id) on delete cascade,
  clerk_user_id text not null,
  course_id uuid not null references courses(id) on delete cascade,
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (parish_id, clerk_user_id, course_id, status)
);

create index if not exists course_join_requests_parish_id_idx on course_join_requests (parish_id);
create index if not exists course_join_requests_course_id_idx on course_join_requests (course_id);
create index if not exists course_join_requests_clerk_user_id_idx on course_join_requests (clerk_user_id);
create index if not exists course_join_requests_status_idx on course_join_requests (status);

alter table course_join_requests enable row level security;

create policy "deny all" on course_join_requests for all using (false) with check (false);

-- Unique constraint: only one PENDING request per student/course
create or replace function course_join_requests_pending_unique()
returns trigger as $$
begin
  -- If there's already a PENDING request for this student/course, reject
  if exists (
    select 1 from course_join_requests
    where parish_id = new.parish_id
      and clerk_user_id = new.clerk_user_id
      and course_id = new.course_id
      and status = 'PENDING'
      and id != coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) then
    raise exception 'A pending request already exists for this student and course';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger course_join_requests_pending_unique_trigger
  before insert or update on course_join_requests
  for each row execute function course_join_requests_pending_unique();

-- Updated_at trigger
create or replace function update_course_join_requests_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger course_join_requests_updated_at_trigger
  before update on course_join_requests
  for each row execute function update_course_join_requests_timestamp();