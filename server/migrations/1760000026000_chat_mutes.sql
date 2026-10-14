-- Up Migration
-- Чаты, у которых участник отключил уведомления (общий и личные; ключ чата как в messages.chat_key).
-- Строка есть: push о новых сообщениях этому участнику не ставятся (счётчик непрочитанного остаётся).
create table chat_mutes (
  member_id uuid not null references members (id) on delete cascade,
  chat_key text not null,
  created_at timestamptz not null default now(),
  primary key (member_id, chat_key)
);

-- Down Migration
drop table chat_mutes;
