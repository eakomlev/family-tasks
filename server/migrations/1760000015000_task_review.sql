-- Up Migration
-- Подтверждение родителем: задание с наградой ребёнок только отправляет на проверку (pending = true),
-- монеты выдаются, когда любой родитель подтвердит (pending = false, confirmed_by и confirmed_at).
alter table task_completions
  add column pending boolean not null default false,
  add column confirmed_by uuid references members (id) on delete set null,
  add column confirmed_at timestamptz;

create index task_completions_pending_idx on task_completions (task_id) where pending;

-- Down Migration
drop index task_completions_pending_idx;
alter table task_completions drop column confirmed_at, drop column confirmed_by, drop column pending;
