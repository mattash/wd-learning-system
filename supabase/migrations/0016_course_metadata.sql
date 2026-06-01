alter table courses
  add column if not exists instructor text,
  add column if not exists duration_hours numeric,
  add column if not exists category text;

alter table courses
  add constraint courses_duration_hours_positive
  check (duration_hours is null or duration_hours > 0);

alter table courses
  add constraint courses_category_known
  check (
    category is null
    or category in ('Scripture', 'Catechesis', 'Leadership', 'Seasonal')
  );
