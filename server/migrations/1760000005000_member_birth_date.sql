-- Up Migration
alter table members
  add column birth_date date check (birth_date is null or birth_date >= date '1900-01-01');

-- Down Migration
alter table members drop column birth_date;
