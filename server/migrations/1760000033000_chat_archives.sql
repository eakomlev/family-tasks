-- Up Migration
-- Чаты, которые участник убрал в архив (общий, личные и чаты событий; ключ чата как в messages.chat_key).
-- Архив только у этого участника: чат пропадает из его списка, но писать в него можно и уведомления приходят как обычно.
create table chat_archives (
  member_id uuid not null references members (id) on delete cascade,
  chat_key text not null,
  created_at timestamptz not null default now(),
  primary key (member_id, chat_key)
);

-- Down Migration
drop table chat_archives;
