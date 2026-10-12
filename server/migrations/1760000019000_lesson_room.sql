-- Up Migration
-- Номер кабинета урока (необязательный, текстом: бывают «12а», «спортзал»).
alter table schedule_lessons add column room text check (room is null or length(room) <= 12);

-- Down Migration
alter table schedule_lessons drop column room;
