-- Up Migration
-- Награда монетами за выполнение задания (только когда исполнитель ребёнок; 0 — без награды).
-- За каждое выполнение повторяющегося задания награда выдаётся отдельно.
alter table tasks add column reward integer not null default 0 check (reward between 0 and 1000);

-- Связь записи журнала монет с заданием и его вхождением: так выдачу награды можно ровно один раз отменить
-- (снятие отметки, смена графика). При удалении задания записи остаются, ребёнок награду уже получил.
alter table coin_transactions
  add column task_id uuid references tasks (id) on delete set null,
  add column occurrence_date date;

create index coin_transactions_task_idx on coin_transactions (task_id, occurrence_date) where task_id is not null;

-- Down Migration
drop index coin_transactions_task_idx;
alter table coin_transactions drop column occurrence_date, drop column task_id;
alter table tasks drop column reward;
