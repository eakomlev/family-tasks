-- Up Migration
-- Страница «Сервис»: сколько денег ушло на SMS и сколько осталось у провайдера.
-- spend: стоимость отправленного за сутки (по ответам провайдера, рубли); у почты и push ноль.
alter table delivery_stats add column spend numeric(10, 2) not null default 0 check (spend >= 0);

-- Остаток на счёте у платного провайдера: notifier раз в несколько минут спрашивает его и пишет сюда, server только читает.
-- error: последняя ошибка проверки (balance и checked_at при этом остаются от прошлой удачной).
create table provider_balance (
  provider text primary key,
  balance numeric(12, 2),
  currency text not null default 'RUB',
  checked_at timestamptz not null default now(),
  error text
);

-- Down Migration
drop table provider_balance;
alter table delivery_stats drop column spend;
