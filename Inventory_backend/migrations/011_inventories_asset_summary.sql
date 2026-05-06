-- Summary columns on inventories: how many assets and human-readable names (from `assets.inventory_id`).
-- Run on `inventory_system` after 001. Triggers keep values in sync on every asset INSERT/UPDATE/DELETE.
--
-- Idempotent: safe to run again if `asset_count` / `asset_names` already exist (skips ALTER for those columns).

SET @inv_schema = DATABASE();

SET @has_ac = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @inv_schema AND TABLE_NAME = 'inventories' AND COLUMN_NAME = 'asset_count'
);
SET @ddl_ac = IF(
  @has_ac = 0,
  'ALTER TABLE inventories ADD COLUMN asset_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER details',
  'SELECT 1'
);
PREPARE inv_add_ac FROM @ddl_ac;
EXECUTE inv_add_ac;
DEALLOCATE PREPARE inv_add_ac;

SET @has_an = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @inv_schema AND TABLE_NAME = 'inventories' AND COLUMN_NAME = 'asset_names'
);
SET @ddl_an = IF(
  @has_an = 0,
  'ALTER TABLE inventories ADD COLUMN asset_names TEXT NULL COMMENT ''Comma-separated type/brand/model labels for assets in this inventory'' AFTER asset_count',
  'SELECT 1'
);
PREPARE inv_add_an FROM @ddl_an;
EXECUTE inv_add_an;
DEALLOCATE PREPARE inv_add_an;

-- WHERE uses primary key `id` so MySQL Workbench “safe updates” mode accepts this statement.
UPDATE inventories i
SET
  asset_count = (SELECT COUNT(*) FROM assets a WHERE a.inventory_id = i.id),
  asset_names = (
    SELECT GROUP_CONCAT(
      TRIM(CONCAT_WS(' ',
        NULLIF(TRIM(a.asset_type), ''),
        NULLIF(TRIM(a.brand), ''),
        NULLIF(TRIM(a.model), '')
      ))
      ORDER BY a.id SEPARATOR ', '
    )
    FROM assets a
    WHERE a.inventory_id = i.id
  )
WHERE i.id > 0;

DELIMITER |

DROP TRIGGER IF EXISTS tr_assets_inv_summary_ai |
CREATE TRIGGER tr_assets_inv_summary_ai
AFTER INSERT ON assets
FOR EACH ROW
BEGIN
  IF NEW.inventory_id IS NOT NULL THEN
    UPDATE inventories i
    SET
      asset_count = (SELECT COUNT(*) FROM assets a WHERE a.inventory_id = i.id),
      asset_names = (
        SELECT GROUP_CONCAT(
          TRIM(CONCAT_WS(' ',
            NULLIF(TRIM(a.asset_type), ''),
            NULLIF(TRIM(a.brand), ''),
            NULLIF(TRIM(a.model), '')
          ))
          ORDER BY a.id SEPARATOR ', '
        )
        FROM assets a
        WHERE a.inventory_id = i.id
      )
    WHERE i.id = NEW.inventory_id;
  END IF;
END|

DROP TRIGGER IF EXISTS tr_assets_inv_summary_au |
CREATE TRIGGER tr_assets_inv_summary_au
AFTER UPDATE ON assets
FOR EACH ROW
BEGIN
  IF OLD.inventory_id IS NOT NULL THEN
    UPDATE inventories i
    SET
      asset_count = (SELECT COUNT(*) FROM assets a WHERE a.inventory_id = i.id),
      asset_names = (
        SELECT GROUP_CONCAT(
          TRIM(CONCAT_WS(' ',
            NULLIF(TRIM(a.asset_type), ''),
            NULLIF(TRIM(a.brand), ''),
            NULLIF(TRIM(a.model), '')
          ))
          ORDER BY a.id SEPARATOR ', '
        )
        FROM assets a
        WHERE a.inventory_id = i.id
      )
    WHERE i.id = OLD.inventory_id;
  END IF;
  IF NEW.inventory_id IS NOT NULL THEN
    UPDATE inventories i
    SET
      asset_count = (SELECT COUNT(*) FROM assets a WHERE a.inventory_id = i.id),
      asset_names = (
        SELECT GROUP_CONCAT(
          TRIM(CONCAT_WS(' ',
            NULLIF(TRIM(a.asset_type), ''),
            NULLIF(TRIM(a.brand), ''),
            NULLIF(TRIM(a.model), '')
          ))
          ORDER BY a.id SEPARATOR ', '
        )
        FROM assets a
        WHERE a.inventory_id = i.id
      )
    WHERE i.id = NEW.inventory_id;
  END IF;
END|

DROP TRIGGER IF EXISTS tr_assets_inv_summary_ad |
CREATE TRIGGER tr_assets_inv_summary_ad
AFTER DELETE ON assets
FOR EACH ROW
BEGIN
  IF OLD.inventory_id IS NOT NULL THEN
    UPDATE inventories i
    SET
      asset_count = (SELECT COUNT(*) FROM assets a WHERE a.inventory_id = i.id),
      asset_names = (
        SELECT GROUP_CONCAT(
          TRIM(CONCAT_WS(' ',
            NULLIF(TRIM(a.asset_type), ''),
            NULLIF(TRIM(a.brand), ''),
            NULLIF(TRIM(a.model), '')
          ))
          ORDER BY a.id SEPARATOR ', '
        )
        FROM assets a
        WHERE a.inventory_id = i.id
      )
    WHERE i.id = OLD.inventory_id;
  END IF;
END|

DELIMITER ;
