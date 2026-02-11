insert into parishes (id, name, slug)
values
  ('11111111-1111-1111-1111-111111111111', 'St. Mark Parish', 'st-mark'),
  ('22222222-2222-2222-2222-222222222222', 'Holy Family Parish', 'holy-family')
on conflict (id) do nothing;

insert into courses (id, title, description, published, scope)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Diocese Onboarding', 'Core formation for all parishes', true, 'DIOCESE'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'St. Mark Confirmation Prep', 'Parish-specific preparation track', true, 'PARISH')
on conflict (id) do nothing;

insert into course_parishes (course_id, parish_id)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111')
on conflict do nothing;

insert into modules (id, course_id, title, descriptor, thumbnail_url, sort_order)
values
  ('cccccccc-cccc-cccc-cccc-ccccccccccc1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Welcome Module', 'Introduces diocesan mission and platform basics.', '/globe.svg', 1),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc2', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Foundations', 'Core principles and sacramental overview for learners.', '/window.svg', 1)
on conflict (id) do nothing;

insert into lessons (id, module_id, title, descriptor, thumbnail_url, youtube_video_id, sort_order, passing_score)
values
  ('dddddddd-dddd-dddd-dddd-ddddddddddd1', 'cccccccc-cccc-cccc-cccc-ccccccccccc1', 'Welcome to the Diocese', 'Orientation to diocesan learning expectations and flow.', '/next.svg', 'dQw4w9WgXcQ', 1, 80),
  ('dddddddd-dddd-dddd-dddd-ddddddddddd2', 'cccccccc-cccc-cccc-cccc-ccccccccccc2', 'Sacrament Basics', 'Covers the essential sacramental framework for beginners.', '/file.svg', 'ysz5S6PUM-U', 1, 80)
on conflict (id) do nothing;

insert into questions (id, lesson_id, prompt, options, correct_option_index, sort_order)
values
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1', 'dddddddd-dddd-dddd-dddd-ddddddddddd1', 'Who can access diocese-wide courses?', '["Only parish admins","All parish learners","Only diocese admins"]'::jsonb, 1, 1),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2', 'dddddddd-dddd-dddd-dddd-ddddddddddd2', 'What is the completion threshold in this MVP?', '["50%","80%","90% video + passing score"]'::jsonb, 2, 1)
on conflict (id) do nothing;
