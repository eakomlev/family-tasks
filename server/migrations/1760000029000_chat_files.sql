-- Up Migration
-- Файлы в чатах (документы, архивы и т. п.) лежат рядом с фото: та же таблица media, та же квота семьи, те же сироты и уборка.
-- У файла нет размеров картинки, зато есть имя (size это размер самого файла).
alter table media alter column width drop not null;
alter table media alter column height drop not null;
alter table media add column kind text not null default 'image' check (kind in ('image', 'file'));
alter table media add column file_name text;
alter table media add constraint media_shape_check check (
  (kind = 'image' and width is not null and height is not null) or (kind = 'file' and file_name is not null)
);

-- Down Migration
alter table media drop constraint media_shape_check;
delete from media where kind = 'file';
alter table media drop column file_name;
alter table media drop column kind;
alter table media alter column height set not null;
alter table media alter column width set not null;
