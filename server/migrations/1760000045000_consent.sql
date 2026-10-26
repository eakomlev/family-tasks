-- Up Migration
-- Согласие на обработку персональных данных (152-ФЗ): с какой редакцией текста согласился участник и когда.
-- У прежних участников пусто: при ближайшем открытии приложения им покажут экран согласия.
alter table members add column consent_version text;
alter table members add column consent_at timestamptz;

-- Down Migration
alter table members drop column consent_at;
alter table members drop column consent_version;
