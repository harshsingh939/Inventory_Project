-- Request by device category (asset_type) when stock is not tied to a named inventory.
-- Run after 008 on `inventory_system`.

CREATE TABLE IF NOT EXISTS assignment_request_asset_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  asset_type VARCHAR(255) NOT NULL,
  KEY idx_art_req (request_id),
  CONSTRAINT fk_art_req FOREIGN KEY (request_id) REFERENCES assignment_requests(id) ON DELETE CASCADE
);
