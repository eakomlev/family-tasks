-- Up Migration
-- Участник без семьи: взрослого, которого создатель убрал из семьи, не удаляем, а оставляем с family_id = null.
-- Он входит как обычно, а приложение ведёт его на страницу «Создать семью или присоединиться по ссылке».
alter table members alter column family_id drop not null;

-- без семьи на один email и один номер не больше одной записи (с семьёй уникальность по-прежнему в рамках семьи)
create unique index members_detached_email_idx on members (email) where family_id is null and email is not null;
create unique index members_detached_phone_idx on members (phone) where family_id is null and phone is not null;

-- Down Migration
drop index members_detached_phone_idx;
drop index members_detached_email_idx;
delete from members where family_id is null;
alter table members alter column family_id set not null;
