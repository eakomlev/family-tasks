-- Up Migration
-- Заявки на удаление семьи: создатель семьи оставляет заявку, а саму работу (файлы в хранилище, затем все данные семьи)
-- делает планировщик на ближайшем проходе. Строка исчезает вместе с семьёй. При сбое планировщик повторяет попытку позже.
create table family_deletions (
  family_id uuid primary key references families (id) on delete cascade,
  -- кто попросил (если его аккаунт уже удалён, пусто)
  requested_by uuid references members (id) on delete set null,
  requested_at timestamptz not null default now(),
  attempts integer not null default 0,
  last_error text,
  next_attempt_at timestamptz not null default now()
);

create index family_deletions_due_idx on family_deletions (next_attempt_at);

-- Down Migration
drop table family_deletions;
