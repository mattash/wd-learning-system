create extension if not exists "pgcrypto";

create table if not exists parishes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists user_profiles (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text unique not null,
  email text,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists parish_memberships (
  id uuid primary key default gen_random_uuid(),
  parish_id uuid not null references parishes(id) on delete cascade,
  clerk_user_id text not null,
  role text not null check (role in ('parish_admin','instructor','student')),
  created_at timestamptz not null default now(),
  unique (parish_id, clerk_user_id)
);

create table if not exists diocese_admins (
  clerk_user_id text primary key,
  created_at timestamptz not null default now()
);

create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  published boolean not null default false,
  scope text not null check (scope in ('DIOCESE','PARISH')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists course_parishes (
  course_id uuid not null references courses(id) on delete cascade,
  parish_id uuid not null references parishes(id) on delete cascade,
  primary key (course_id, parish_id)
);

create table if not exists modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  title text not null,
  sort_order int not null default 0
);

create table if not exists lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references modules(id) on delete cascade,
  title text not null,
  youtube_video_id text not null,
  sort_order int not null default 0,
  passing_score int not null default 80
);

create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id) on delete cascade,
  prompt text not null,
  options jsonb not null,
  correct_option_index int not null,
  sort_order int not null default 0
);

create table if not exists video_progress (
  id uuid primary key default gen_random_uuid(),
  parish_id uuid not null references parishes(id) on delete cascade,
  clerk_user_id text not null,
  lesson_id uuid not null references lessons(id) on delete cascade,
  percent_watched int not null default 0,
  last_position_seconds int not null default 0,
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  unique(parish_id, clerk_user_id, lesson_id)
);

create table if not exists quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  parish_id uuid not null references parishes(id) on delete cascade,
  clerk_user_id text not null,
  lesson_id uuid not null references lessons(id) on delete cascade,
  answers jsonb not null,
  score int not null,
  created_at timestamptz not null default now()
);

create table if not exists enrollments (
  id uuid primary key default gen_random_uuid(),
  parish_id uuid references parishes(id) on delete cascade,
  clerk_user_id text not null,
  course_id uuid not null references courses(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(parish_id, clerk_user_id, course_id)
);

alter table parishes enable row level security;
alter table user_profiles enable row level security;
alter table parish_memberships enable row level security;
alter table diocese_admins enable row level security;
alter table courses enable row level security;
alter table course_parishes enable row level security;
alter table modules enable row level security;
alter table lessons enable row level security;
alter table questions enable row level security;
alter table video_progress enable row level security;
alter table quiz_attempts enable row level security;
alter table enrollments enable row level security;

-- Service-role-only MVP approach: block anon/authenticated direct access.
create policy "deny all" on parishes for all using (false) with check (false);
create policy "deny all" on user_profiles for all using (false) with check (false);
create policy "deny all" on parish_memberships for all using (false) with check (false);
create policy "deny all" on diocese_admins for all using (false) with check (false);
create policy "deny all" on courses for all using (false) with check (false);
create policy "deny all" on course_parishes for all using (false) with check (false);
create policy "deny all" on modules for all using (false) with check (false);
create policy "deny all" on lessons for all using (false) with check (false);
create policy "deny all" on questions for all using (false) with check (false);
create policy "deny all" on video_progress for all using (false) with check (false);
create policy "deny all" on quiz_attempts for all using (false) with check (false);
create policy "deny all" on enrollments for all using (false) with check (false);

create or replace function get_visible_courses(p_parish_id uuid)
returns table (
  id uuid,
  title text,
  description text,
  published boolean,
  scope text
)
language sql
security definer
as $$
  select c.id, c.title, c.description, c.published, c.scope
  from courses c
  where c.published = true and (
    c.scope = 'DIOCESE'
    or exists (
      select 1 from course_parishes cp
      where cp.course_id = c.id and cp.parish_id = p_parish_id
    )
  )
  order by c.created_at desc;
$$;

create or replace function parish_course_metrics(p_parish_id uuid)
returns table (
  course_id uuid,
  learners_started bigint,
  learners_completed bigint
)
language sql
security definer
as $$
  with lesson_to_course as (
    select l.id as lesson_id, m.course_id
    from lessons l
    join modules m on m.id = l.module_id
  )
  select ltc.course_id,
         count(distinct vp.clerk_user_id) as learners_started,
         count(distinct case when vp.completed then vp.clerk_user_id end) as learners_completed
  from lesson_to_course ltc
  left join video_progress vp on vp.lesson_id = ltc.lesson_id and vp.parish_id = p_parish_id
  group by ltc.course_id;
$$;

create or replace function diocese_course_metrics()
returns table (
  parish_id uuid,
  course_id uuid,
  learners_started bigint,
  learners_completed bigint
)
language sql
security definer
as $$
  with lesson_to_course as (
    select l.id as lesson_id, m.course_id
    from lessons l
    join modules m on m.id = l.module_id
  )
  select vp.parish_id,
         ltc.course_id,
         count(distinct vp.clerk_user_id) as learners_started,
         count(distinct case when vp.completed then vp.clerk_user_id end) as learners_completed
  from video_progress vp
  join lesson_to_course ltc on ltc.lesson_id = vp.lesson_id
  group by vp.parish_id, ltc.course_id;
$$;

create or replace function diocese_lesson_metrics()
returns table (
  parish_id uuid,
  lesson_id uuid,
  completion_rate numeric,
  avg_best_score numeric
)
language sql
security definer
as $$
  with best_scores as (
    select parish_id, clerk_user_id, lesson_id, max(score) as best_score
    from quiz_attempts
    group by parish_id, clerk_user_id, lesson_id
  )
  select vp.parish_id,
         vp.lesson_id,
         coalesce(avg(case when vp.completed then 1 else 0 end), 0) as completion_rate,
         coalesce(avg(bs.best_score), 0) as avg_best_score
  from video_progress vp
  left join best_scores bs
    on bs.parish_id = vp.parish_id
   and bs.lesson_id = vp.lesson_id
   and bs.clerk_user_id = vp.clerk_user_id
  group by vp.parish_id, vp.lesson_id;
$$;
