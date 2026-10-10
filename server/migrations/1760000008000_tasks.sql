-- Up Migration
-- Задания семьи. Исполнитель и автор — участники семьи. Дата и время необязательны (задание «без срока»),
-- повтор: none / daily / weekly (дни недели в repeat_days, 1 = понедельник ... 7 = воскресенье) / monthly (то же число).
create table tasks (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (id) on delete cascade,
  author_id uuid not null references members (id) on delete cascade,
  assignee_id uuid not null references members (id) on delete cascade,
  title text not null check (length(title) between 1 and 100),
  due_date date check (due_date is null or due_date >= date '1900-01-01'),
  due_time time,
  repeat_type text not null default 'none' check (repeat_type in ('none', 'daily', 'weekly', 'monthly')),
  repeat_days smallint[] not null default '{}',
  repeat_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (due_time is null or due_date is not null),
  check (repeat_type = 'none' or due_date is not null),
  check (repeat_until is null or (repeat_type <> 'none' and repeat_until >= due_date)),
  check ((repeat_type = 'weekly') = (cardinality(repeat_days) > 0))
);

create index tasks_family_idx on tasks (family_id);
create index tasks_assignee_idx on tasks (assignee_id);

-- Отметки о выполнении по каждому вхождению: повторяющееся задание выполняется отдельно в каждый день.
-- Для задания без даты occurrence_date = 1970-01-01.
create table task_completions (
  task_id uuid not null references tasks (id) on delete cascade,
  occurrence_date date not null,
  done_by uuid not null references members (id) on delete cascade,
  done_at timestamptz not null default now(),
  primary key (task_id, occurrence_date)
);

create index task_completions_done_at_idx on task_completions (done_at);

-- Down Migration
drop table task_completions;
drop table tasks;
