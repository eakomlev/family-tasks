-- Up Migration
-- Миграция 1760000048000 была создана без заголовка Up Migration: раннер выполнял также SQL отката.
-- Восстанавливаем колонку и индекс, если ранняя миграция уже отметилась выполненной.
alter table members add column if not exists blocked_at timestamptz;
create index if not exists members_blocked_idx on members (blocked_at) where blocked_at is not null;

-- Down Migration
drop index if exists members_blocked_idx;
alter table members drop column if exists blocked_at;
