-- Up Migration
-- Состояние сервиса scheduler (docs/scheduler-service-plan.md): каждый экземпляр раз в несколько секунд обновляет метку
-- живости, а после прохода пишет его время и итог. Пишет только scheduler, читает страница «Сервис».
create table scheduler_state (
  instance text primary key,
  beat_at timestamptz not null default now(),
  -- когда лидер последний раз выполнил проход и сколько уведомлений поставил (null, пока проходов не было)
  last_tick_at timestamptz,
  last_sent integer,
  last_error text
);

-- Down Migration
drop table scheduler_state;
