-- Links inventory employee (users) to login (auth_users), assignment requests from users,
-- and repair authority handoff. Run on `inventory_system` after 006.

-- 1) Employee ↔ login (admin sets this so "My workspace" can resolve assignments)
ALTER TABLE users ADD COLUMN auth_user_id INT NULL DEFAULT NULL;
CREATE UNIQUE INDEX ux_users_auth_user_id ON users (auth_user_id);

-- 2) User asks admin to assign checked-out available assets
CREATE TABLE IF NOT EXISTS assignment_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  auth_user_id INT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'Pending',
  user_message TEXT NULL,
  admin_note TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME NULL,
  KEY idx_ar_auth (auth_user_id),
  KEY idx_ar_status (status)
);

CREATE TABLE IF NOT EXISTS assignment_request_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  asset_id INT NOT NULL,
  KEY idx_ari_req (request_id),
  CONSTRAINT fk_ari_req FOREIGN KEY (request_id) REFERENCES assignment_requests(id) ON DELETE CASCADE
);

-- 3) Repairs: admin assigns a repair job to a repair-authority login
ALTER TABLE repairs ADD COLUMN assigned_authority_auth_user_id INT NULL DEFAULT NULL;
ALTER TABLE repairs ADD COLUMN authority_resolution TEXT NULL;
ALTER TABLE repairs ADD COLUMN authority_updated_at DATETIME NULL;
