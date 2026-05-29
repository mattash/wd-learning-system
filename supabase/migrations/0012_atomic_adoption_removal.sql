create or replace function remove_course_adoption(
  p_parish_id uuid,
  p_course_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Lock the adoption row to prevent concurrent enrollment inserts
  perform 1
  from course_parishes
  where parish_id = p_parish_id and course_id = p_course_id
  for update;

  -- Check for existing enrollments under the lock
  if exists (
    select 1
    from enrollments
    where parish_id = p_parish_id and course_id = p_course_id
  ) then
    return jsonb_build_object(
      'error', 'Remove learner enrollments from this course before removing adoption.',
      'code', 'ENROLLMENTS_EXIST'
    );
  end if;

  delete from course_parishes
  where parish_id = p_parish_id and course_id = p_course_id;

  if not found then
    return jsonb_build_object('error', 'Adoption not found.', 'code', 'NOT_FOUND');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;
