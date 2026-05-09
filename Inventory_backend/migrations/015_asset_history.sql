-- Canonical per-asset timeline for History UI and GET /api/assets/:id/history.
-- event_type: checkout | return | repair | disposal
-- Run once against your inventory DB after prior migrations.

CREATE TABLE IF NOT EXISTS asset_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  asset_id INT NOT NULL COMMENT 'Inventory asset id (former_asset_id after delete)',
  event_type VARCHAR(24) NOT NULL,
  occurred_at DATETIME NOT NULL,
  assignment_id INT NULL,
  repair_id INT NULL,
  disposed_item_id INT NULL,
  user_id INT NULL,
  user_name VARCHAR(255) NULL,
  employee_id VARCHAR(64) NULL,
  department VARCHAR(255) NULL,
  start_time DATETIME NULL,
  end_time DATETIME NULL,
  working_minutes INT NULL,
  condition_before VARCHAR(255) NULL,
  condition_after VARCHAR(255) NULL,
  status VARCHAR(64) NULL,
  asset_type VARCHAR(255) NULL,
  brand VARCHAR(255) NULL,
  model VARCHAR(255) NULL,
  serial_number VARCHAR(255) NULL,
  issue TEXT NULL,
  fixed_at DATETIME NULL,
  cost DECIMAL(12,2) NULL,
  notes TEXT NULL,
  inventory_id INT NULL,
  inventory_name VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_asset_occurred (asset_id, occurred_at),
  KEY idx_assignment (assignment_id),
  KEY idx_repair (repair_id),
  KEY idx_disposed (disposed_item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Backfill checkouts (skip if already present)
INSERT INTO asset_history (
  asset_id, event_type, occurred_at, assignment_id, user_id, user_name, employee_id, department,
  start_time, condition_before, status, asset_type, brand, model, serial_number
)
SELECT
  COALESCE(a.asset_id, di.former_asset_id),
  'checkout',
  a.start_time,
  a.id,
  a.user_id,
  u.name,
  u.employee_id,
  u.department,
  a.start_time,
  a.condition_before,
  a.status,
  COALESCE(ast.asset_type, di.asset_type),
  COALESCE(ast.brand, di.brand),
  COALESCE(ast.model, di.model),
  COALESCE(ast.serial_number, di.serial_number)
FROM assignments a
JOIN users u ON u.id = a.user_id
LEFT JOIN assets ast ON ast.id = a.asset_id
LEFT JOIN disposed_items di ON di.assignment_id = a.id
WHERE COALESCE(a.asset_id, di.former_asset_id) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM asset_history h
    WHERE h.assignment_id = a.id AND h.event_type = 'checkout'
  );

-- Backfill returns (completed assignments with end_time)
INSERT INTO asset_history (
  asset_id, event_type, occurred_at, assignment_id, user_id, user_name, employee_id, department,
  start_time, end_time, working_minutes, condition_before, condition_after, status,
  asset_type, brand, model, serial_number
)
SELECT
  COALESCE(a.asset_id, di.former_asset_id),
  'return',
  a.end_time,
  a.id,
  a.user_id,
  u.name,
  u.employee_id,
  u.department,
  a.start_time,
  a.end_time,
  a.working_minutes,
  a.condition_before,
  a.condition_after,
  a.status,
  COALESCE(ast.asset_type, di.asset_type),
  COALESCE(ast.brand, di.brand),
  COALESCE(ast.model, di.model),
  COALESCE(ast.serial_number, di.serial_number)
FROM assignments a
JOIN users u ON u.id = a.user_id
LEFT JOIN assets ast ON ast.id = a.asset_id
LEFT JOIN disposed_items di ON di.assignment_id = a.id
WHERE a.end_time IS NOT NULL
  AND COALESCE(a.asset_id, di.former_asset_id) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM asset_history h
    WHERE h.assignment_id = a.id AND h.event_type = 'return'
  );

-- Backfill repairs (current rows only; fixed_at/cost omitted for broad schema compatibility)
INSERT INTO asset_history (
  asset_id, event_type, occurred_at, repair_id, issue, status,
  asset_type, brand, model, serial_number, fixed_at, cost
)
SELECT
  r.asset_id,
  'repair',
  COALESCE(r.reported_at, r.created_at, NOW()),
  r.id,
  r.issue,
  r.status,
  a.asset_type,
  a.brand,
  a.model,
  a.serial_number,
  NULL,
  NULL
FROM repairs r
LEFT JOIN assets a ON a.id = r.asset_id
WHERE r.asset_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM asset_history h WHERE h.repair_id = r.id AND h.event_type = 'repair');

-- Backfill disposals
INSERT INTO asset_history (
  asset_id, event_type, occurred_at, assignment_id, disposed_item_id,
  user_name, employee_id, department, condition_after, notes,
  asset_type, brand, model, serial_number, inventory_id, inventory_name, status
)
SELECT
  d.former_asset_id,
  'disposal',
  d.disposed_at,
  d.assignment_id,
  d.id,
  d.user_name,
  d.employee_id,
  d.department,
  d.condition_after,
  d.notes,
  d.asset_type,
  d.brand,
  d.model,
  d.serial_number,
  d.inventory_id,
  d.inventory_name,
  'Disposed'
FROM disposed_items d
WHERE NOT EXISTS (
  SELECT 1 FROM asset_history h
  WHERE h.disposed_item_id = d.id AND h.event_type = 'disposal'
);
