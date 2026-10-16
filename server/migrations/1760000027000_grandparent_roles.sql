-- Up Migration
-- Роли бабушка и дедушка; в семье не больше 6 участников проверяет сервер
alter table members drop constraint members_role_check;
alter table members add constraint members_role_check check (role in ('mama', 'papa', 'grandma', 'grandpa', 'child'));

-- Down Migration
alter table members drop constraint members_role_check;
alter table members add constraint members_role_check check (role in ('mama', 'papa', 'child'));
