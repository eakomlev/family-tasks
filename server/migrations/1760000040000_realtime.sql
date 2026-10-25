-- Up Migration
-- Сервис живых обновлений (realtime/) держит сокеты сам, а server и он общаются через БД.
-- realtime_viewing: какой чат открыт на экране устройства (запись ведёт realtime, каждый ping освежает updated_at;
-- server решает по ней, нужен ли push). Строка без освежения дольше минуты считается устаревшей.
create table realtime_viewing (
  connection_id uuid primary key,
  member_id uuid not null references members (id) on delete cascade,
  chat text not null,
  updated_at timestamptz not null default now()
);
create index realtime_viewing_member_idx on realtime_viewing (member_id, chat);

-- метка живости экземпляров realtime и число подключений (страница «Сервис»)
create table realtime_state (
  instance text primary key,
  beat_at timestamptz not null default now(),
  connections integer not null default 0
);

-- Down Migration
drop table realtime_state;
drop table realtime_viewing;
