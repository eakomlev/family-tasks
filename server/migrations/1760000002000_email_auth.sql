-- Up Migration
-- Приложение ещё не выпущено, поэтому старые тестовые семьи без email удаляем
-- (members, invites и recoveries удаляются каскадом).
delete from families;

drop table recoveries;

alter table members drop column token_hash;
alter table members add column email text not null;
create unique index members_family_email_idx on members (family_id, email);
create index members_email_idx on members (email);

-- по одной сессии на устройство
create table sessions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members (id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now()
);

create index sessions_member_idx on sessions (member_id);

-- одноразовые коды из писем: purpose = signup (создание/присоединение) или login
create table email_codes (
  email text not null,
  purpose text not null check (purpose in ('signup', 'login')),
  code_hash text not null,
  attempts int not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (email, purpose)
);

-- Down Migration
drop table email_codes;
drop table sessions;

delete from families;
drop index members_email_idx;
drop index members_family_email_idx;
alter table members drop column email;
alter table members add column token_hash text not null unique;

create table recoveries (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null unique references members (id) on delete cascade,
  code text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
