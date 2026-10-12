-- Up Migration
-- Срок жизни сессий: токен устройства действует, пока им пользуются; без использования 90 дней сессия считается истёкшей.
-- last_used_at обновляется не чаще раза в сутки (см. authenticateToken), у существующих сессий отсчёт с момента миграции.
alter table sessions add column last_used_at timestamptz not null default now();
create index sessions_last_used_idx on sessions (last_used_at);

-- Down Migration
drop index sessions_last_used_idx;
alter table sessions drop column last_used_at;
