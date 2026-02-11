alter table modules
  add column if not exists descriptor text,
  add column if not exists thumbnail_url text;

alter table lessons
  add column if not exists descriptor text,
  add column if not exists thumbnail_url text;
