-- Up Migration
-- Коды подтверждения нового телефона в профиле (purpose = verify) живут отдельно от кодов входа и регистрации
alter table email_codes drop constraint email_codes_purpose_check;
alter table email_codes add constraint email_codes_purpose_check check (purpose in ('signup', 'login', 'verify'));

-- Down Migration
delete from email_codes where purpose = 'verify';
alter table email_codes drop constraint email_codes_purpose_check;
alter table email_codes add constraint email_codes_purpose_check check (purpose in ('signup', 'login'));
