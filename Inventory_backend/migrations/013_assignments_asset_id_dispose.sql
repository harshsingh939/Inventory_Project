-- Dispose flow deletes the `assets` row. `assignments.asset_id` must not block that DELETE.
-- Run on `inventory_system` after 006 (and your existing `assignments` table + FK).
--
-- If DROP fails with "Unknown constraint", find the real name:
--   SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
--   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assignments'
--     AND REFERENCED_TABLE_NAME = 'assets' AND COLUMN_NAME = 'asset_id';

USE inventory_system;

ALTER TABLE assignments DROP FOREIGN KEY assignments_ibfk_2;

ALTER TABLE assignments MODIFY asset_id INT NULL;

ALTER TABLE assignments
  ADD CONSTRAINT assignments_ibfk_2
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE SET NULL;
