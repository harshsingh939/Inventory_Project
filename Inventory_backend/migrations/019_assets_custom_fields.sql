-- Per-asset values for admin-defined inventory columns (`inventories.custom_columns`).
-- Run after 018. Safe updates: WHERE uses primary key on INFORMATION_SCHEMA check only.

SET @inv_schema = DATABASE();

SET @has_cf = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @inv_schema AND TABLE_NAME = 'assets' AND COLUMN_NAME = 'custom_fields'
);
SET @ddl_cf = IF(
  @has_cf = 0,
  'ALTER TABLE assets ADD COLUMN custom_fields JSON NULL DEFAULT NULL COMMENT ''Values for inventory custom column labels'' AFTER storage',
  'SELECT 1'
);
PREPARE ast_add_cf FROM @ddl_cf;
EXECUTE ast_add_cf;
DEALLOCATE PREPARE ast_add_cf;
