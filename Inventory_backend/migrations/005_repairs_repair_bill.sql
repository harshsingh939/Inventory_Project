-- Optional repair bill file path (relative to /api/uploads/), set when creating a repair with an upload.
ALTER TABLE repairs
  ADD COLUMN repair_bill VARCHAR(512) NULL DEFAULT NULL;
