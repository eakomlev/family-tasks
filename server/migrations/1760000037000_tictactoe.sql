-- Up Migration
-- Вторая игра: крестики-нолики. Состояние (поле и порядок ходов) лежит в state, как у шахмат; первым ходит тот, кто в white_id (крестики).
alter table games drop constraint games_kind_check;
alter table games add constraint games_kind_check check (kind in ('chess', 'tictactoe'));

-- Down Migration
delete from games where kind = 'tictactoe';
alter table games drop constraint games_kind_check;
alter table games add constraint games_kind_check check (kind in ('chess'));
