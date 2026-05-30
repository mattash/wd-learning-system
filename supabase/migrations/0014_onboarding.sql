alter table parishes
add column if not exists allow_self_signup boolean not null default true;

alter table user_profiles
add column if not exists onboarding_completed_at timestamptz;
