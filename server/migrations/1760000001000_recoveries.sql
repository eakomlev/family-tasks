-- Up Migration
-- одноразовые ссылки для входа участника на новом устройстве
create table recoveries (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null unique references members (id) on delete cascade,
  code text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- Down Migration
drop table recoveries;
