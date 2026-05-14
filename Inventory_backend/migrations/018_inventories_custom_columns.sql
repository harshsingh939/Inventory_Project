-- Admin-defined column labels per inventory (JSON array of strings).
-- Run after 001. Safe updates: WHERE uses primary key.

SET @inv_schema = DATABASE();

SET @has_cc = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @inv_schema AND TABLE_NAME = 'inventories' AND COLUMN_NAME = 'custom_columns'
);
SET @ddl_cc = IF(
  @has_cc = 0,
  'ALTER TABLE inventories ADD COLUMN custom_columns JSON NULL DEFAULT NULL COMMENT ''Admin-defined asset field labels'' AFTER details',
  'SELECT 1'
);
PREPARE inv_add_cc FROM @ddl_cc;
EXECUTE inv_add_cc;
DEALLOCATE PREPARE inv_add_cc;
