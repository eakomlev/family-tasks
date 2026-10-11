-- Up Migration
-- Сообщения чатов. chat_key: 'family' — общий чат семьи, иначе личный чат двух участников: их id через двоеточие
-- в порядке возрастания (один ключ для обоих собеседников). Пока только текст.
create table messages (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (id) on delete cascade,
  chat_key text not null,
  sender_id uuid not null references members (id) on delete cascade,
  text text not null check (length(text) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index messages_chat_idx on messages (family_id, chat_key, created_at desc, id desc);

-- до какого момента участник прочитал чат (для счётчиков непрочитанного)
create table chat_reads (
  member_id uuid not null references members (id) on delete cascade,
  chat_key text not null,
  last_read_at timestamptz not null default now(),
  primary key (member_id, chat_key)
);

-- Down Migration
drop table chat_reads;
drop table messages;
