-- Up Migration
alter table families add column surname text;

create table family_connection_requests (
  id uuid primary key default gen_random_uuid(),
  from_family_id uuid not null references families(id) on delete cascade,
  to_family_id uuid not null references families(id) on delete cascade,
  from_surname text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_by uuid not null references members(id) on delete cascade,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (from_family_id <> to_family_id)
);
create unique index family_connection_requests_pending_idx
  on family_connection_requests (from_family_id, to_family_id) where status = 'pending';
create index family_connection_requests_inbox_idx on family_connection_requests (to_family_id, status, created_at desc);

create table event_family_targets (
  event_id uuid not null references events(id) on delete cascade,
  family_id uuid not null references families(id) on delete cascade,
  primary key (event_id, family_id)
);
create index event_family_targets_family_idx on event_family_targets (family_id, event_id);

create table family_connections (
  id uuid primary key default gen_random_uuid(),
  family_a_id uuid not null references families(id) on delete cascade,
  family_b_id uuid not null references families(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (family_a_id < family_b_id),
  unique (family_a_id, family_b_id)
);

-- Down Migration
drop table family_connections;
drop table event_family_targets;
drop table family_connection_requests;
alter table families drop column surname;
