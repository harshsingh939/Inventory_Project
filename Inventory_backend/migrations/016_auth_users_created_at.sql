-- Signup ordering for admin /notifications feed. Existing rows get default at migration time.
ALTER TABLE auth_users
  ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
