-- Up Migration
-- Расписание тренировок ребёнка: день недели (1 = понедельник ... 7 = воскресенье), порядок в дне, название, место и время.
create table training_sessions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members (id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  position smallint not null check (position >= 1),
  title text not null check (length(title) between 1 and 60),
  place text check (place is null or length(place) <= 60),
  starts_at time,
  ends_at time,
  created_at timestamptz not null default now(),
  unique (member_id, weekday, position),
  check (starts_at is null or ends_at is null or ends_at > starts_at)
);

-- Down Migration
drop table training_sessions;
