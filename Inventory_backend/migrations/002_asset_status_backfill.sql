-- Optional one-time: legacy rows with no status (never matched GET /assets/available).
UPDATE assets a
LEFT JOIN assignments x ON x.asset_id = a.id AND x.status = 'Active'
SET a.status = 'Available'
WHERE (a.status IS NULL OR TRIM(IFNULL(a.status, '')) = '')
  AND x.id IS NULL;

UPDATE assets a
INNER JOIN assignments x ON x.asset_id = a.id AND x.status = 'Active'
SET a.status = 'Assigned'
WHERE a.status IS NULL OR TRIM(IFNULL(a.status, '')) = '';
