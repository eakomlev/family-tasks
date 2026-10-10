-- Up Migration
-- Маленькое фото профиля (data URL, клиент сжимает его до нескольких килобайт), хранится прямо в таблице участников.
alter table members
  add column avatar text check (avatar is null or length(avatar) <= 70000);

-- Down Migration
alter table members drop column avatar;
