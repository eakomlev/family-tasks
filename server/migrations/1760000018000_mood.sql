-- Up Migration
-- Настроение ребёнка: 1 (грусть) … 5 (радость) и момент, когда он его выбрал. Сервер часовой пояс семьи не знает,
-- поэтому «сегодняшнее ли это настроение» решает клиент по mood_at (на следующий день оно считается не выбранным).
alter table members
  add column mood smallint check (mood between 1 and 5),
  add column mood_at timestamptz;

-- Down Migration
alter table members drop column mood_at, drop column mood;
