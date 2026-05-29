create or replace function record_video_progress(
  p_parish_id uuid,
  p_clerk_user_id text,
  p_lesson_id uuid,
  p_percent_watched int,
  p_last_position_seconds int,
  p_completed boolean
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into video_progress (
    parish_id,
    clerk_user_id,
    lesson_id,
    percent_watched,
    last_position_seconds,
    completed,
    updated_at
  )
  values (
    p_parish_id,
    p_clerk_user_id,
    p_lesson_id,
    p_percent_watched,
    p_last_position_seconds,
    p_completed,
    now()
  )
  on conflict (parish_id, clerk_user_id, lesson_id)
  do update set
    percent_watched = greatest(video_progress.percent_watched, excluded.percent_watched),
    last_position_seconds = greatest(video_progress.last_position_seconds, excluded.last_position_seconds),
    completed = video_progress.completed or excluded.completed,
    updated_at = now();
$$;
