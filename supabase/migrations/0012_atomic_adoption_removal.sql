-- Transaction-level advisory lock for adoption operations.
-- Held for the full RPC transaction by create_parish_course_enrollment
-- and remove_course_adoption to serialize on (parish_id, course_id).
create or replace function acquire_adoption_lock(
  p_parish_id uuid,
  p_course_id uuid
)
returns void
language sql
as $$
  select pg_advisory_xact_lock(hashtext('adoption:' || p_parish_id::text || ':' || p_course_id::text));
$$;

create or replace function create_parish_course_enrollment(
  p_parish_id uuid,
  p_course_id uuid,
  p_clerk_user_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enrollment enrollments%rowtype;
begin
  perform acquire_adoption_lock(p_parish_id, p_course_id);

  if not exists (
    select 1
    from course_parishes
    where parish_id = p_parish_id and course_id = p_course_id
  ) then
    return jsonb_build_object(
      'error', 'Adopt this parish-scoped course before enrolling learners.'
    );
  end if;

  insert into enrollments (parish_id, clerk_user_id, course_id)
  values (p_parish_id, p_clerk_user_id, p_course_id)
  on conflict (parish_id, clerk_user_id, course_id)
  do update set clerk_user_id = excluded.clerk_user_id
  returning * into v_enrollment;

  return jsonb_build_object(
    'ok', true,
    'enrollment', jsonb_build_object(
      'id', v_enrollment.id,
      'clerk_user_id', v_enrollment.clerk_user_id,
      'course_id', v_enrollment.course_id,
      'cohort_id', v_enrollment.cohort_id,
      'created_at', v_enrollment.created_at
    )
  );
end;
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
