-- User requests by inventory list (name/type), not specific asset rows.
-- Run after 007 on `inventory_system`.

CREATE TABLE IF NOT EXISTS assignment_request_inventories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  inventory_id INT NOT NULL,
  KEY idx_ari2_req (request_id),
  CONSTRAINT fk_ari2_req FOREIGN KEY (request_id) REFERENCES assignment_requests(id) ON DELETE CASCADE
);
