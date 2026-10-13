-- Up Migration
-- Фото в чатах (docs/chat-photos-plan.md). Сами файлы лежат в сервисе media (S3), здесь только записи о них.
-- Загруженное, но не прикреплённое к сообщению (attached_at is null) считается сиротой и через сутки убирается.
create table media (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (id) on delete cascade,
  uploader_id uuid not null references members (id) on delete cascade,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  -- размер полноразмерного варианта в байтах (для квоты семьи)
  size integer not null check (size > 0),
  created_at timestamptz not null default now(),
  attached_at timestamptz
);

create index media_family_idx on media (family_id);
create index media_orphans_idx on media (created_at) where attached_at is null;

-- Фото сообщения по порядку. Один файл может быть только в одном сообщении.
create table message_media (
  message_id uuid not null references messages (id) on delete cascade,
  media_id uuid not null unique references media (id) on delete cascade,
  position smallint not null check (position >= 0),
  primary key (message_id, position)
);

-- Сообщение только с фото, без подписи: в text лежит заглушка («📷 Фото»), чтобы старая версия клиента не показала пустой пузырь;
-- новый клиент берёт подпись из caption, который API считает по этому признаку.
alter table messages add column photo_only boolean not null default false;

-- Down Migration
alter table messages drop column photo_only;
drop table message_media;
drop table media;
