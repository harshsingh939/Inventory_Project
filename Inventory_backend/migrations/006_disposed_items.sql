  -- Non-reusable items: snapshot when an assignment is ended as disposed.
  -- POST /api/disposals logs a row here, then deletes the asset from `assets` (and related `repairs`).
  -- Columns align with Disposed UI: #, Device (type/brand/model/SN), Inventory, Assigned to, Condition, Notes, Disposed time.
  -- Run against `inventory_system` after prior migrations.

  CREATE TABLE IF NOT EXISTS disposed_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    former_asset_id INT NOT NULL,
    inventory_id INT NULL,
    inventory_name VARCHAR(255) NULL,
    asset_type VARCHAR(255) NOT NULL,
    brand VARCHAR(255) NOT NULL,
    model VARCHAR(255) NOT NULL,
    serial_number VARCHAR(255) NULL,
    assignment_id INT NULL,
    user_name VARCHAR(255) NULL,
    employee_id VARCHAR(64) NULL,
    department VARCHAR(255) NULL,
    condition_after VARCHAR(255) NULL,
    notes TEXT NULL,
    disposed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_disposed_at (disposed_at),
    KEY idx_inventory_id (inventory_id),
    KEY idx_former_asset (former_asset_id)
  );
