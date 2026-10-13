-- Up Migration
-- Итоги отправки по суткам (UTC) и каналам: сколько ушло и сколько окончательно не ушло. Результат строки очереди не хранится,
-- поэтому для страницы «Сервис» notifier после каждого прохода добавляет сюда счётчики.
create table delivery_stats (
  channel text not null check (channel in ('email', 'push')),
  day date not null,
  sent integer not null default 0 check (sent >= 0),
  failed integer not null default 0 check (failed >= 0),
  primary key (channel, day)
);

-- Down Migration
drop table delivery_stats;
