-- Preserve existing audiences while allowing explicitly selected enrolled students.
alter table public.parish_message_sends
  drop constraint parish_message_sends_audience_type_check;

alter table public.parish_message_sends
  add constraint parish_message_sends_audience_type_check
  check (audience_type in ('all_members', 'stalled_learners', 'cohort', 'course', 'specific_recipients'));
