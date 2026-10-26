-- Up Migration
-- Приглашения по email убраны (остались только ссылка и телефон/email при регистрации): журнал отправленных приглашений не нужен
drop table invite_emails;

-- Down Migration
create table invite_emails (
  id bigserial primary key,
  family_id uuid not null references families (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

create index invite_emails_family_idx on invite_emails (family_id, created_at);
