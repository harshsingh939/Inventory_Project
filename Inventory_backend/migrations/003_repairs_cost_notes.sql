-- Run once against your DB. Adds columns the app expects when closing repairs (cost + notes + completed time).
-- Safe for tables that only have: id, asset_id, issue, status, reported_at, added_by
-- (no AFTER clauses — avoids errors if optional columns are missing.)

ALTER TABLE repairs
  ADD COLUMN repair_cost DECIMAL(12, 2) NULL DEFAULT NULL,
  ADD COLUMN repair_notes TEXT NULL,
  ADD COLUMN fixed_at DATETIME NULL DEFAULT NULL;
