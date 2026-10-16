-- Up Migration
-- Семейный календарь: события с датами, необязательным временем и списком участников.
-- Событие видят участники и автор; all_family = видят все в семье (тогда участники не хранятся).
create table events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (id) on delete cascade,
  author_id uuid not null references members (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  start_date date not null,
  end_date date not null,
  -- время задано у начала и конца вместе; без времени событие на весь день (или несколько дней)
  start_time time,
  end_time time,
  all_family boolean not null default false,
  created_at timestamptz not null default now(),
  check (end_date >= start_date),
  check ((start_time is null) = (end_time is null)),
  -- в один день конец позже начала; многодневное может заканчиваться «раньше» по часам
  check (start_date <> end_date or start_time is null or end_time > start_time)
);

create index events_family_range_idx on events (family_id, start_date, end_date);

create table event_members (
  event_id uuid not null references events (id) on delete cascade,
  member_id uuid not null references members (id) on delete cascade,
  primary key (event_id, member_id)
);

create index event_members_member_idx on event_members (member_id);

-- Down Migration
drop table event_members;
drop table events;
