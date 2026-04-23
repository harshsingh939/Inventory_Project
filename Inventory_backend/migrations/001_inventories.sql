-- Run in MySQL against `inventory_system`.
-- If a statement fails because the object already exists, skip that line.

CREATE TABLE IF NOT EXISTS inventories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  details TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Link assets to a named inventory (nullable = not grouped / legacy rows).
ALTER TABLE assets ADD COLUMN inventory_id INT NULL DEFAULT NULL;
CREATE INDEX idx_assets_inventory_id ON assets (inventory_id);
