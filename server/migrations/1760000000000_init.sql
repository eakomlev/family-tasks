-- Up Migration
create table families (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  created_at timestamptz not null default now()
);

create table members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (id) on delete cascade,
  name text not null,
  role text not null check (role in ('mama', 'papa', 'child')),
  is_owner boolean not null default false,
  token_hash text not null unique,
  created_at timestamptz not null default now()
);

-- имена в рамках семьи не должны повторяться, чтобы участников можно было различать
create unique index members_family_name_idx on members (family_id, lower(name));

create table invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (id) on delete cascade,
  code text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index invites_family_idx on invites (family_id);

-- Down Migration
drop table invites;
drop table members;
drop table families;
