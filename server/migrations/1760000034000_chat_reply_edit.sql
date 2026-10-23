-- Up Migration
-- Ответ на сообщение (reply_to; если исходное удалили, ссылка обнуляется) и пометка «изменено» (edited_at).
alter table messages add column reply_to uuid references messages (id) on delete set null;
alter table messages add column edited_at timestamptz;

-- Down Migration
alter table messages drop column edited_at;
alter table messages drop column reply_to;
