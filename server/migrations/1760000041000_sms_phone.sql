-- Up Migration
-- Вход по телефону (SMS Aero): у участника появляется номер, email перестаёт быть обязательным, но один из двух должен быть.
-- Номер хранится нормализованным: «+7» и десять цифр.
alter table members alter column email drop not null;
alter table members add column phone text;
alter table members add constraint members_contact_check check (email is not null or phone is not null);
alter table members add constraint members_phone_format check (phone is null or phone ~ '^\+79\d{9}$');
create unique index members_family_phone_idx on members (family_id, phone) where phone is not null;
create index members_phone_idx on members (phone) where phone is not null;

-- В очередь добавляется канал sms (коды входа), у итогов отправки тоже
alter table outbox drop constraint outbox_channel_check;
alter table outbox add constraint outbox_channel_check check (channel in ('email', 'push', 'sms'));
alter table delivery_stats drop constraint delivery_stats_channel_check;
alter table delivery_stats add constraint delivery_stats_channel_check check (channel in ('email', 'push', 'sms'));

-- Down Migration
delete from outbox where channel = 'sms';
delete from delivery_stats where channel = 'sms';
alter table delivery_stats drop constraint delivery_stats_channel_check;
alter table delivery_stats add constraint delivery_stats_channel_check check (channel in ('email', 'push'));
alter table outbox drop constraint outbox_channel_check;
alter table outbox add constraint outbox_channel_check check (channel in ('email', 'push'));

drop index members_phone_idx;
drop index members_family_phone_idx;
alter table members drop constraint members_phone_format;
alter table members drop constraint members_contact_check;
-- участников без email вернуть в прежний вид нельзя: их удаляем
delete from members where email is null;
alter table members drop column phone;
alter table members alter column email set not null;
