-- Up Migration
-- Игры двух участников семьи (пока шахматы). Один участник приглашает другого: invited → active (принял) или declined / cancelled;
-- active → finished. state зависит от игры (шахматы: список ходов и позиция в нотации FEN), result заполняется при завершении.
create table games (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (id) on delete cascade,
  kind text not null check (kind in ('chess')),
  inviter_id uuid not null references members (id) on delete cascade,
  invitee_id uuid not null references members (id) on delete cascade,
  status text not null default 'invited' check (status in ('invited', 'active', 'finished', 'declined', 'cancelled')),
  -- кто играет белыми (шахматы); назначается при принятии приглашения
  white_id uuid references members (id) on delete cascade,
  -- чей сейчас ход; null, пока игра не началась или уже закончилась
  turn_id uuid references members (id) on delete set null,
  state jsonb not null default '{}',
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (inviter_id <> invitee_id)
);

-- Между двумя участниками в одну игру одновременно играется или ожидает ответа одна партия
create unique index games_open_pair_idx on games (kind, least(inviter_id, invitee_id), greatest(inviter_id, invitee_id)) where status in ('invited', 'active');
create index games_inviter_idx on games (inviter_id);
create index games_invitee_idx on games (invitee_id);

-- Down Migration
drop table games;
