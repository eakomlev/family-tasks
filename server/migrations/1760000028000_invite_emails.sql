-- Up Migration
-- Журнал приглашений по email: не даёт слать одному адресу слишком часто и ограничивает число писем семьи за сутки
create table invite_emails (
  id bigserial primary key,
  family_id uuid not null references families (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);
create index invite_emails_family_idx on invite_emails (family_id, created_at desc);

-- Down Migration
drop table invite_emails;
