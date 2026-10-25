-- Up Migration
-- Третья игра: шашки (русские). Состояние (поле, записи ходов, счётчик тихих ходов) лежит в state; первым ходит и играет белыми тот, кто в white_id.
alter table games drop constraint games_kind_check;
alter table games add constraint games_kind_check check (kind in ('chess', 'tictactoe', 'checkers'));

-- Down Migration
delete from games where kind = 'checkers';
alter table games drop constraint games_kind_check;
alter table games add constraint games_kind_check check (kind in ('chess', 'tictactoe'));
