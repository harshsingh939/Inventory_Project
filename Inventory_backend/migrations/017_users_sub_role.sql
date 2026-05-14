-- Sub-role under each main department (Team registration).
ALTER TABLE users
  ADD COLUMN sub_role VARCHAR(100) NULL DEFAULT NULL AFTER department;

-- Backfill legacy rows so directory saves stay valid.
-- `id > 0` satisfies Workbench / sql_safe_updates (WHERE must use a KEY column).
UPDATE users
SET sub_role = 'General'
WHERE id > 0
  AND (sub_role IS NULL OR TRIM(sub_role) = '');
