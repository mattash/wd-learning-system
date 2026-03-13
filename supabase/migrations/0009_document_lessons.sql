alter table lessons
  alter column youtube_video_id drop not null;

alter table lessons
  add column if not exists content_type text not null default 'VIDEO',
  add column if not exists document_url text,
  add column if not exists document_page_start int,
  add column if not exists document_page_end int;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'lessons_content_type_check'
  ) then
    alter table lessons
      add constraint lessons_content_type_check
      check (content_type in ('VIDEO', 'DOCUMENT'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'lessons_content_source_check'
  ) then
    alter table lessons
      add constraint lessons_content_source_check
      check (
        (content_type = 'VIDEO' and youtube_video_id is not null and document_url is null)
        or (content_type = 'DOCUMENT' and document_url is not null)
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'lessons_document_page_range_check'
  ) then
    alter table lessons
      add constraint lessons_document_page_range_check
      check (
        document_page_start is null
        or document_page_end is null
        or document_page_end >= document_page_start
      );
  end if;
end $$;
