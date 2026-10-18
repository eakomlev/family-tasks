-- Up Migration
-- Push на телефон: подписки бывают двух видов. web: адрес и ключи браузера (Web Push). fcm: токен устройства Firebase Cloud Messaging
-- (Android; iPhone добавится видом apns). У нативных подписок ключей нет, а токен лежит в endpoint (он по-прежнему уникален).
-- Сообщения в очереди ссылаются на подписку по id, поэтому формат очереди не меняется: вид читает notifier из строки подписки.
alter table push_subscriptions add column kind text not null default 'web' check (kind in ('web', 'fcm'));
alter table push_subscriptions alter column p256dh drop not null;
alter table push_subscriptions alter column auth drop not null;
alter table push_subscriptions add constraint push_subscriptions_keys_check
  check (kind <> 'web' or (p256dh is not null and auth is not null));

-- Down Migration
alter table push_subscriptions drop constraint push_subscriptions_keys_check;
delete from push_subscriptions where kind <> 'web';
alter table push_subscriptions alter column auth set not null;
alter table push_subscriptions alter column p256dh set not null;
alter table push_subscriptions drop column kind;
