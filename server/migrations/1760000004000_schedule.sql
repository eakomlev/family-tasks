-- Up Migration
-- Расписание уроков ребёнка: день недели (1 = понедельник ... 6 = суббота), порядок урока в дне, предмет и время.
create table schedule_lessons (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members (id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 6),
  position smallint not null check (position >= 1),
  subject text not null check (length(subject) between 1 and 60),
  starts_at time,
  ends_at time,
  created_at timestamptz not null default now(),
  unique (member_id, weekday, position),
  check (starts_at is null or ends_at is null or ends_at > starts_at)
);

-- Down Migration
drop table schedule_lessons;
