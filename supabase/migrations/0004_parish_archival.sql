alter table parishes
add column if not exists archived_at timestamptz;

create index if not exists parishes_archived_at_idx on parishes (archived_at);
