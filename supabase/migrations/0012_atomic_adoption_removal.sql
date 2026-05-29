-- Acquire transaction-level advisory lock for adoption operations.
-- Both enrollment creation and adoption removal must call this
-- to serialize on the same (parish_id, course_id) key.
create or replace function acquire_adoption_lock(
  p_parish_id uuid,
  p_course_id uuid
)
returns void
language sql
as $$
  select pg_advisory_xact_lock(hashtext('adoption:' || p_parish_id::text || ':' || p_course_id::text));
$$;

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
  -- Serialize with concurrent enrollment creation
  perform acquire_adoption_lock(p_parish_id, p_course_id);

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
