-- Up Migration
-- Администратор может временно закрыть участнику доступ к входу и приложению.
alter table members add column blocked_at timestamptz;

create index members_blocked_idx on members (blocked_at) where blocked_at is not null;

-- Down Migration
drop index members_blocked_idx;
alter table members drop column blocked_at;
