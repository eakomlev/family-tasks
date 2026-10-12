-- Up Migration
-- Цели детей: родитель ставит цель (название, цена в монетах, ссылка, картинка), ребёнок оплачивает её накопленными монетами.
-- Купленная цель остаётся в списке (purchased_at), пока родитель её не удалит.
create table goals (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (id) on delete cascade,
  member_id uuid not null references members (id) on delete cascade,
  title text not null check (length(title) between 1 and 80),
  price integer not null check (price between 1 and 100000),
  url text check (url is null or length(url) <= 500),
  image text check (image is null or length(image) <= 70000),
  created_by uuid references members (id) on delete set null,
  created_at timestamptz not null default now(),
  purchased_at timestamptz
);

create index goals_member_idx on goals (member_id, created_at);

-- списание за покупку связано с целью (удалили цель: запись в истории остаётся)
alter table coin_transactions add column goal_id uuid references goals (id) on delete set null;

-- Down Migration
alter table coin_transactions drop column goal_id;
drop table goals;
