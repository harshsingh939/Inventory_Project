const db = require('../db');

function isMissingTable(err) {
  return (
    err &&
    (err.code === 'ER_NO_SUCH_TABLE' ||
      err.errno === 1146 ||
      String(err.message || '').includes("doesn't exist"))
  );
}

let cached = {
  cols: null,
  loadedAt: 0,
  loading: null,
};

function loadHistoryColumns() {
  const now = Date.now();
  if (cached.cols && now - cached.loadedAt < 5 * 60 * 1000) return Promise.resolve(cached.cols);
  if (cached.loading) return cached.loading;

  cached.loading = new Promise((resolve) => {
    db.query('SHOW COLUMNS FROM `history`', (err, rows) => {
      cached.loading = null;
      if (err) {
        if (!isMissingTable(err)) {
          console.warn('[history] SHOW COLUMNS failed:', err.message);
        }
        cached.cols = null;
        cached.loadedAt = now;
        return resolve(null);
      }
      const cols = new Set((rows || []).map((r) => String(r.Field || '').trim()).filter(Boolean));
      cached.cols = cols;
      cached.loadedAt = now;
      resolve(cols);
    });
  });

  return cached.loading;
}

function normalizeStr(v, max) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.slice(0, max);
}

function normalizePositiveInt(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

/**
 * Best-effort insert to `history`.
 * Automatically adapts to your schema (keeps only existing columns).
 */
async function writeHistory(input) {
  const cols = await loadHistoryColumns();
  if (!cols) return; // table missing or introspection failed

  const asset_id = normalizePositiveInt(input.asset_id);
  const employee_id = normalizePositiveInt(input.employee_id);
  const employee_name = normalizeStr(input.employee_name, 255);
  const action = normalizeStr(input.action, 255);
  const status = normalizeStr(input.status, 100);
  const notes = normalizeStr(input.notes, 1000);

  if (!asset_id || !employee_id || !action) {
    console.warn('[history] skip insert (missing required fields)', {
      asset_id,
      employee_id,
      action,
    });
    return;
  }

  const actionLower = String(action || '').toLowerCase();
  const isAssigned = actionLower.includes('assign') || actionLower === 'assigned';
  const isReturned = actionLower.includes('return') || actionLower === 'returned';

  // If table supports returned_at, prefer updating the latest open checkout row instead of inserting a new "Returned" row.
  // This makes one checkout row contain BOTH assigned_at and returned_at.
  if (isReturned && cols.has('returned_at')) {
    const updated = await new Promise((resolve) => {
      db.query(
        `SELECT id, assigned_at, created_at
         FROM \`history\`
         WHERE asset_id = ?
           AND employee_id = ?
           AND returned_at IS NULL
         ORDER BY id DESC
         LIMIT 1`,
        [asset_id, employee_id],
        (selErr, rows) => {
          if (selErr) {
            console.warn('[history] select for return-update failed:', selErr.message);
            return resolve(false);
          }
          if (!rows || !rows.length) return resolve(false);

          const row = rows[0];
          const id = row.id;

          const sets = [];
          const params = [];
          const addSet = (k, v) => {
            if (!cols.has(k)) return;
            sets.push(`${k} = ?`);
            params.push(v);
          };

          // Ensure assigned_at exists for display (fallback to created_at/now if missing)
          if (cols.has('assigned_at') && (row.assigned_at == null || String(row.assigned_at).trim() === '')) {
            addSet('assigned_at', row.created_at || new Date());
          }

          addSet('returned_at', new Date());
          addSet('status', status || 'Completed');
          if (notes) addSet('notes', notes);

          if (!sets.length) return resolve(true);

          params.push(id);
          db.query(`UPDATE \`history\` SET ${sets.join(', ')} WHERE id = ?`, params, (upErr) => {
            if (upErr) console.warn('[history] return-update failed:', upErr.message);
            return resolve(!upErr);
          });
        },
      );
    });

    // If we updated an existing open row, we're done. Do NOT insert a separate Returned row.
    if (updated) return;
  }

  const payload = {};
  const put = (k, v) => {
    if (!cols.has(k)) return;
    if (v === undefined) return;
    payload[k] = v;
  };

  put('asset_id', asset_id);
  put('employee_id', employee_id);
  put('employee_name', employee_name);
  put('action', action);
  put('status', status);
  put('notes', notes);

  // Timestamps: if columns exist, populate sensible defaults based on action
  if (cols.has('created_at') && payload.created_at === undefined) {
    put('created_at', new Date());
  }
  if (cols.has('assigned_at') && payload.assigned_at === undefined) {
    if (isAssigned) {
      put('assigned_at', new Date());
    } else if (isReturned) {
      // If a return is being recorded as its own row (no open checkout row found),
      // still populate assigned_at so UI/queries have a non-null assign timestamp.
      put('assigned_at', payload.created_at || new Date());
    }
  }
  if (cols.has('returned_at') && payload.returned_at === undefined) {
    if (isReturned) {
      put('returned_at', new Date());
    }
  }

  const keys = Object.keys(payload);
  if (!keys.length) return;

  const placeholders = keys.map(() => '?').join(', ');
  const sql = `INSERT INTO \`history\` (${keys.join(', ')}) VALUES (${placeholders})`;
  const params = keys.map((k) => payload[k]);

  return new Promise((resolve) => {
    db.query(sql, params, (err) => {
      if (err) {
        console.warn('[history] insert failed:', err.message);
      }
      resolve();
    });
  });
}

module.exports = { writeHistory };

