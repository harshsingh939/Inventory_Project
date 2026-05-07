-- Optional message after fulfill when note asked for specs we could not match (e.g. i7).
ALTER TABLE assignment_requests
  ADD COLUMN fulfillment_notice TEXT NULL
  AFTER admin_note;
