-- Up Migration
-- Реакции родителей на сообщения детей (одна реакция участника на сообщение) и привязка начисленных монет к сообщению.
create table message_reactions (
  message_id uuid not null references messages (id) on delete cascade,
  member_id uuid not null references members (id) on delete cascade,
  emoji text not null check (length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (message_id, member_id)
);

alter table coin_transactions add column message_id uuid references messages (id) on delete set null;
create index coin_transactions_message_idx on coin_transactions (message_id) where message_id is not null;

-- Down Migration
drop index coin_transactions_message_idx;
alter table coin_transactions drop column message_id;
drop table message_reactions;
