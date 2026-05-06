-- Rename repair handoff status from WithAuthority to Under repair (UI + API wording).
-- repairs.status is VARCHAR; safe to UPDATE in place.

UPDATE repairs SET status = 'Under repair' WHERE status = 'WithAuthority';
