-- Up Migration
-- Push на iPhone: ещё один вид подписки apns (токен устройства Apple Push Notification service лежит в endpoint, как токен FCM у fcm).
alter table push_subscriptions drop constraint push_subscriptions_kind_check;
alter table push_subscriptions add constraint push_subscriptions_kind_check check (kind in ('web', 'fcm', 'apns'));

-- Down Migration
delete from push_subscriptions where kind = 'apns';
alter table push_subscriptions drop constraint push_subscriptions_kind_check;
alter table push_subscriptions add constraint push_subscriptions_kind_check check (kind in ('web', 'fcm'));
