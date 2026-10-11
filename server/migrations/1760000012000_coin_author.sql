-- Up Migration
-- Кто сделал начисление или списание: участник семьи. null — система (например, стартовый баланс или автоматическая награда).
alter table coin_transactions add column created_by uuid references members (id) on delete set null;

-- Down Migration
alter table coin_transactions drop column created_by;
