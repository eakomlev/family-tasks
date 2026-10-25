-- Up Migration
-- Видео в чатах: ещё один вид записи в media (рядом с фото и файлами). Сжатое видео и кадр-превью лежат в хранилище сервиса media;
-- у записи размеры кадра и длительность в секундах (size это размер сжатого видео, считается в квоте семьи).
alter table media drop constraint media_kind_check;
alter table media add constraint media_kind_check check (kind in ('image', 'file', 'video'));
alter table media add column duration integer check (duration is null or duration > 0);
alter table media drop constraint media_shape_check;
alter table media add constraint media_shape_check check (
  (kind = 'image' and width is not null and height is not null)
  or (kind = 'file' and file_name is not null)
  or (kind = 'video' and width is not null and height is not null and duration is not null)
);

-- Down Migration
delete from media where kind = 'video';
alter table media drop constraint media_shape_check;
alter table media add constraint media_shape_check check (
  (kind = 'image' and width is not null and height is not null) or (kind = 'file' and file_name is not null)
);
alter table media drop column duration;
alter table media drop constraint media_kind_check;
alter table media add constraint media_kind_check check (kind in ('image', 'file'));
