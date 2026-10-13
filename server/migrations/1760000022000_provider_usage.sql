-- Up Migration
-- Сколько писем отправлено за сутки (UTC): дневной лимит почтового сервиса. Считает notifier (docs/notification-queue-plan.md).
create table provider_usage (
  provider text not null,
  day date not null,
  count integer not null default 0 check (count >= 0),
  primary key (provider, day)
);

-- Down Migration
drop table provider_usage;
