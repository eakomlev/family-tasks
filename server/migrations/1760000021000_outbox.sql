-- Up Migration
-- Очередь отправки писем и push (docs/notification-queue-plan.md). Пишет server, читает и удаляет сервис notifier.
-- Строка живёт только до результата: успех, третья неудача или expires_at удаляют её.
-- Аренда: забирая строку, notifier сдвигает next_attempt_at вперёд и увеличивает attempts;
-- если он упал, по истечении аренды строка снова становится доступной (но попытка уже посчитана).
create table outbox (
  id bigserial primary key,
  channel text not null check (channel in ('email', 'push')),
  -- 0 коды входа, 1 реакции на действия, 2 плановые; меньше значит раньше
  priority smallint not null default 1,
  payload jsonb not null,
  attempts smallint not null default 0,
  next_attempt_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_error text,
  created_at timestamptz not null default now()
);

create index outbox_due_idx on outbox (priority, id) where attempts < 3;

-- Метка живости: каждый экземпляр notifier раз в несколько секунд обновляет свою строку.
create table notifier_heartbeat (
  instance text primary key,
  beat_at timestamptz not null default now()
);

-- Down Migration
drop table notifier_heartbeat;
drop table outbox;
