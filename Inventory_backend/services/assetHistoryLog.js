/**
 * Append-only asset_history rows (mirrors History modal / GET /api/assets/:id/history).
 * Fails soft if table is missing (older DBs without migration 015).
 */

function isMissingAssetHistoryTable(err) {
  if (!err) return false;
  if (err.code === 'ER_NO_SUCH_TABLE' || err.errno === 1146) return true;
  const msg = String(err.message || '');
  return msg.includes("doesn't exist") && msg.includes('asset_history');
}

function run(db, sql, params, cb) {
  db.query(sql, params, (err) => {
    if (err && isMissingAssetHistoryTable(err)) {
      return cb ? cb(null) : undefined;
    }
    if (cb) cb(err);
  });
}

/** @param row from SESSION_JOIN_SELECT (checkout / active assignment snapshot) */
exports.logCheckout = (db, row, cb) => {
  if (!row || row.asset_id == null) {
    return cb ? cb(null) : undefined;
  }
  const aid = Number(row.asset_id);
  if (!Number.isFinite(aid)) {
    return cb ? cb(null) : undefined;
  }
  const sql = `
    INSERT INTO asset_history (
      asset_id, event_type, occurred_at, assignment_id, user_id, user_name, employee_id, department,
      start_time, condition_before, status, asset_type, brand, model, serial_number
    ) VALUES (?, 'checkout', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const p = [
    aid,
    row.start_time || new Date(),
    row.assignment_id,
    row.user_id ?? null,
    row.user_name ?? null,
    row.employee_id ?? null,
    row.department ?? null,
    row.start_time || null,
    row.condition_before ?? null,
    row.status ?? 'Active',
    row.asset_type ?? null,
    row.brand ?? null,
    row.model ?? null,
    row.serial_number ?? null,
  ];
  run(db, sql, p, cb);
};

/** @param row same shape as SESSION_JOIN_SELECT after return */
exports.logReturn = (db, row, cb) => {
  if (!row) return cb ? cb(null) : undefined;
  const aid = Number(row.asset_id ?? row.former_asset_id);
  if (!Number.isFinite(aid)) {
    return cb ? cb(null) : undefined;
  }
  const sql = `
    INSERT INTO asset_history (
      asset_id, event_type, occurred_at, assignment_id, user_id, user_name, employee_id, department,
      start_time, end_time, working_minutes, condition_before, condition_after, status,
      asset_type, brand, model, serial_number
    ) VALUES (?, 'return', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const p = [
    aid,
    row.end_time || row.start_time || new Date(),
    row.assignment_id,
    row.user_id ?? null,
    row.user_name ?? null,
    row.employee_id ?? null,
    row.department ?? null,
    row.start_time ?? null,
    row.end_time ?? null,
    row.working_minutes ?? null,
    row.condition_before ?? null,
    row.condition_after ?? null,
    row.status ?? 'Completed',
    row.asset_type ?? null,
    row.brand ?? null,
    row.model ?? null,
    row.serial_number ?? null,
  ];
  run(db, sql, p, cb);
};

exports.logRepair = (db, payload, cb) => {
  const aid = Number(payload.asset_id);
  if (!Number.isFinite(aid) || !payload.repair_id) {
    return cb ? cb(null) : undefined;
  }
  const sql = `
    INSERT INTO asset_history (
      asset_id, event_type, occurred_at, repair_id, issue, status,
      asset_type, brand, model, serial_number, fixed_at, cost
    ) VALUES (?, 'repair', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const p = [
    aid,
    payload.occurred_at || new Date(),
    payload.repair_id,
    payload.issue ?? null,
    payload.status ?? 'Pending',
    payload.asset_type ?? null,
    payload.brand ?? null,
    payload.model ?? null,
    payload.serial_number ?? null,
    payload.fixed_at ?? null,
    payload.cost != null ? Number(payload.cost) : null,
  ];
  run(db, sql, p, cb);
};

exports.logDisposal = (db, payload, cb) => {
  const aid = Number(payload.former_asset_id ?? payload.asset_id);
  if (!Number.isFinite(aid)) {
    return cb ? cb(null) : undefined;
  }
  const sql = `
    INSERT INTO asset_history (
      asset_id, event_type, occurred_at, assignment_id, disposed_item_id,
      user_name, employee_id, department, condition_after, notes,
      asset_type, brand, model, serial_number, inventory_id, inventory_name, status
    ) VALUES (?, 'disposal', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Disposed')
  `;
  const p = [
    aid,
    payload.disposed_at || new Date(),
    payload.assignment_id ?? null,
    payload.disposed_item_id ?? null,
    payload.user_name ?? null,
    payload.employee_id ?? null,
    payload.department ?? null,
    payload.condition_after ?? null,
    payload.notes ?? null,
    payload.asset_type ?? null,
    payload.brand ?? null,
    payload.model ?? null,
    payload.serial_number ?? null,
    payload.inventory_id ?? null,
    payload.inventory_name ?? null,
  ];
  run(db, sql, p, cb);
};

/**
 * Merge checkout + return rows into assignment-shaped objects (same keys as GET /sessions/all rows).
 */
exports.mergeAssignmentsFromHistory = (rows) => {
  const list = (rows || []).filter(
    (r) => r.event_type === 'checkout' || r.event_type === 'return',
  );
  const byAssign = new Map();
  for (const r of list) {
    const id = r.assignment_id;
    if (!id) continue;
    let m = byAssign.get(id);
    if (!m) {
      m = {
        assignment_id: id,
        user_id: r.user_id,
        asset_id: r.asset_id,
        start_time: null,
        end_time: null,
        working_minutes: null,
        condition_before: null,
        condition_after: null,
        status: null,
        user_name: r.user_name,
        employee_id: r.employee_id,
        department: r.department,
        asset_type: r.asset_type,
        brand: r.brand,
        model: r.model,
        serial_number: r.serial_number,
      };
      byAssign.set(id, m);
    }
    m = byAssign.get(id);
    if (r.event_type === 'checkout') {
      m.user_id = r.user_id ?? m.user_id;
      m.user_name = r.user_name ?? m.user_name;
      m.employee_id = r.employee_id ?? m.employee_id;
      m.department = r.department ?? m.department;
      m.start_time = r.start_time || r.occurred_at;
      m.condition_before = r.condition_before ?? m.condition_before;
      m.asset_type = r.asset_type ?? m.asset_type;
      m.brand = r.brand ?? m.brand;
      m.model = r.model ?? m.model;
      m.serial_number = r.serial_number ?? m.serial_number;
      m.asset_id = r.asset_id ?? m.asset_id;
      if (r.status) m.status = r.status;
    }
    if (r.event_type === 'return') {
      m.end_time = r.end_time || r.occurred_at;
      m.working_minutes = r.working_minutes ?? m.working_minutes;
      m.condition_after = r.condition_after ?? m.condition_after;
      if (r.status) m.status = r.status;
      m.user_name = r.user_name ?? m.user_name;
      m.employee_id = r.employee_id ?? m.employee_id;
      m.department = r.department ?? m.department;
      m.asset_type = r.asset_type ?? m.asset_type;
      m.brand = r.brand ?? m.brand;
      m.model = r.model ?? m.model;
      m.serial_number = r.serial_number ?? m.serial_number;
      m.asset_id = r.asset_id ?? m.asset_id;
    }
  }
  return [...byAssign.values()].sort((a, b) => {
    const ta = new Date(a.start_time || 0).getTime();
    const tb = new Date(b.start_time || 0).getTime();
    return tb - ta;
  });
};

exports.repairsFromHistory = (rows) =>
  (rows || [])
    .filter((r) => r.event_type === 'repair')
    .map((r) => ({
      id: r.repair_id,
      asset_id: r.asset_id,
      issue: r.issue,
      status: r.status,
      occurred_at: r.occurred_at,
      reported_at: r.occurred_at,
      created_at: r.occurred_at,
      fixed_at: r.fixed_at,
      cost: r.cost,
    }))
    .sort((a, b) => {
      const ta = new Date(a.occurred_at || 0).getTime();
      const tb = new Date(b.occurred_at || 0).getTime();
      return tb - ta;
    });

exports.latestDisposalFromHistory = (rows) => {
  const dis = (rows || [])
    .filter((r) => r.event_type === 'disposal')
    .sort((a, b) => {
      const ta = new Date(a.occurred_at || 0).getTime();
      const tb = new Date(b.occurred_at || 0).getTime();
      return tb - ta;
    });
  const d = dis[0];
  if (!d) return null;
  return {
    id: d.disposed_item_id,
    former_asset_id: d.asset_id,
    inventory_id: d.inventory_id,
    inventory_name: d.inventory_name,
    asset_type: d.asset_type,
    brand: d.brand,
    model: d.model,
    serial_number: d.serial_number,
    assignment_id: d.assignment_id,
    user_name: d.user_name,
    employee_id: d.employee_id,
    department: d.department,
    condition_after: d.condition_after,
    notes: d.notes,
    disposed_at: d.occurred_at,
  };
};

exports.eventsFromHistorySlices = (assignments, repairs, disposed) => {
  const events = [];
  for (const a of assignments || []) {
    if (a.start_time) {
      events.push({
        kind: 'checkout',
        at: a.start_time,
        assignment_id: a.assignment_id,
        user_id: a.user_id,
        user_name: a.user_name,
        employee_id: a.employee_id,
        department: a.department,
        condition_before: a.condition_before,
        asset_type: a.asset_type,
        brand: a.brand,
        model: a.model,
        serial_number: a.serial_number,
      });
    }
    if (a.end_time) {
      events.push({
        kind: 'assignment_end',
        at: a.end_time,
        assignment_id: a.assignment_id,
        status: a.status,
        condition_after: a.condition_after,
        working_minutes: a.working_minutes,
        user_name: a.user_name,
      });
    }
  }
  for (const r of repairs || []) {
    const at = r.occurred_at || r.reported_at || r.created_at || null;
    events.push({
      kind: 'repair',
      at,
      repair_id: r.id,
      issue: r.issue,
      status: r.status,
      fixed_at: r.fixed_at ?? null,
      cost: r.cost ?? null,
    });
  }
  if (disposed && disposed.disposed_at) {
    events.push({
      kind: 'disposal',
      at: disposed.disposed_at,
      disposed_item_id: disposed.id,
      former_asset_id: disposed.former_asset_id,
      assignment_id: disposed.assignment_id,
      user_name: disposed.user_name,
      employee_id: disposed.employee_id,
      condition_after: disposed.condition_after,
      notes: disposed.notes,
    });
  }
  events.sort((x, y) => {
    const tx = x.at ? new Date(x.at).getTime() : 0;
    const ty = y.at ? new Date(y.at).getTime() : 0;
    return ty - tx;
  });
  return events;
};
