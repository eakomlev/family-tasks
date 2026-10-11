-- Up Migration
-- Виртуальные монеты детей. Баланс не хранится числом, а считается по журналу: каждая запись это начисление (amount > 0)
-- или списание (amount < 0) с причиной, так всегда видно, откуда взялась сумма.
create table coin_transactions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members (id) on delete cascade,
  amount integer not null check (amount <> 0),
  reason text not null default '' check (length(reason) <= 200),
  created_at timestamptz not null default now()
);

create index coin_transactions_member_idx on coin_transactions (member_id, created_at desc);

-- Down Migration
drop table coin_transactions;
