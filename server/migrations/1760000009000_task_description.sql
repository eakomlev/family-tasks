-- Up Migration
-- Описание задания: необязательный свободный текст.
alter table tasks add column description text not null default '' check (length(description) <= 1000);

-- Down Migration
alter table tasks drop column description;
