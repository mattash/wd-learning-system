-- Real-Supabase E2E seed.
--
-- Mirrors src/lib/e2e-fixtures.ts so the DB-backed Playwright suite
-- (npm run test:e2e:db) can reuse the same IDs, URLs, and journeys while
-- exercising the real schema, RLS policies, and RPC functions instead of
-- the fixture smoke mode.

-- The app accesses the database exclusively through the service-role key
-- ("deny all" RLS; see 0001_init.sql). Recent local Supabase stacks grant
-- the service role only limited default table privileges, so grant it the
-- access production has.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;
grant all on all routines in schema public to service_role;

insert into parishes (id, name, slug)
values
  ('11111111-1111-4111-8111-111111111111', 'Saint Mark Parish', 'saint-mark'),
  ('aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'Holy Cross Parish', 'holy-cross')
on conflict (id) do nothing;

insert into courses (id, title, description, instructor, duration_hours, category, published, scope, publicly_browseable)
values
  (
    '22222222-2222-4222-8222-222222222222',
    'Foundations of Parish Leadership',
    'Core formation for mission, service, and pastoral leadership.',
    'Formation Team',
    1,
    'Leadership',
    true,
    'PARISH',
    true
  ),
  (
    '99999999-9999-4999-8999-999999999999',
    'Holy Cross Private Course',
    'Visible only to Holy Cross parish members.',
    'Parish Catechist',
    1,
    'Catechesis',
    true,
    'PARISH',
    false
  )
on conflict (id) do nothing;

insert into course_parishes (course_id, parish_id)
values
  ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111'),
  ('99999999-9999-4999-8999-999999999999', 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1')
on conflict do nothing;

insert into modules (id, course_id, title, sort_order)
values ('33333333-3333-4333-8333-333333333333', '22222222-2222-4222-8222-222222222222', 'Orientation', 1)
on conflict (id) do nothing;

insert into lessons (id, module_id, title, content_type, youtube_video_id, sort_order, passing_score)
values (
  '44444444-4444-4444-8444-444444444444',
  '33333333-3333-4333-8333-333333333333',
  'Welcome Lesson',
  'VIDEO',
  'dQw4w9WgXcQ',
  1,
  80
)
on conflict (id) do nothing;

insert into questions (id, lesson_id, prompt, options, correct_option_index, sort_order)
values
  ('55555555-5555-4555-8555-555555555555', '44444444-4444-4444-8444-444444444444', 'Primary source for Christian teaching?', '["Myth","Scripture","Rumor"]'::jsonb, 1, 1),
  ('66666666-6666-4666-8666-666666666666', '44444444-4444-4444-8444-444444444444', 'Best posture for parish leadership?', '["Serve and learn","Control and isolate","Avoid responsibility"]'::jsonb, 0, 2)
on conflict (id) do nothing;

insert into user_profiles (clerk_user_id, email, display_name, onboarding_completed_at)
values ('e2e-user', 'e2e@example.com', 'E2E User', now())
on conflict (clerk_user_id) do update set onboarding_completed_at = now();

insert into parish_memberships (parish_id, clerk_user_id, role)
values ('11111111-1111-4111-8111-111111111111', 'e2e-user', 'student')
on conflict (parish_id, clerk_user_id) do nothing;
