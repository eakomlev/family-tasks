-- Up Migration
-- Подписки на Web Push: по одной на устройство, с часовым поясом устройства (по нему считаем 10:00 и 17:00).
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  time_zone text not null,
  created_at timestamptz not null default now()
);

create index push_subscriptions_member_idx on push_subscriptions (member_id);

-- Журнал отправленного, чтобы одно и то же уведомление не уходило дважды в один день.
-- kind: birthday:<id именинника> или lessons; day: локальная дата подписки.
create table notification_log (
  subscription_id uuid not null references push_subscriptions (id) on delete cascade,
  kind text not null,
  day date not null,
  sent_at timestamptz not null default now(),
  primary key (subscription_id, kind, day)
);

-- Down Migration
drop table notification_log;
drop table push_subscriptions;
