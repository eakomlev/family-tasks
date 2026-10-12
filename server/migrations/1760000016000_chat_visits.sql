-- Up Migration
-- Когда участник последний раз был в личном чате (открытом на экране): показывается собеседнику в шапке.
-- Отдельно от chat_reads: та таблица отвечает за прочитанное, и строка в ней сдвинула бы «прочитано».
create table chat_visits (
  member_id uuid not null references members (id) on delete cascade,
  chat_key text not null,
  visited_at timestamptz not null default now(),
  primary key (member_id, chat_key)
);

-- Down Migration
drop table chat_visits;
