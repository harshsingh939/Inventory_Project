/**
 * Derive list/UI status from `assets.status` plus whether an Active assignment exists.
 * Fixes stale `Available` rows when checkout updated assignments but not the asset row.
 */
function effectiveAssetStatus(dbStatus, hasActiveAssignment) {
  const raw = dbStatus == null ? '' : String(dbStatus).trim();
  const s = raw.toLowerCase();
  if (s === 'under repair') {
    return raw || 'Under Repair';
  }
  if (hasActiveAssignment) {
    return 'Assigned';
  }
  if (!s || s === 'available') {
    return 'Available';
  }
  if (s === 'assigned') {
    return 'Available';
  }
  return raw;
}

/**
 * @param {Record<string, unknown>} row - must include `status`; optional `active_assignment_join_id` from SQL join
 * @returns {Record<string, unknown>} row without join id, with corrected `status`
 */
function rowWithEffectiveStatus(row) {
  if (!row || typeof row !== 'object') {
    return row;
  }
  const next = { ...row };
  const joinId = next.active_assignment_join_id;
  delete next.active_assignment_join_id;
  const has = joinId != null && joinId !== '';
  next.status = effectiveAssetStatus(next.status, has);
  return next;
}

module.exports = {
  effectiveAssetStatus,
  rowWithEffectiveStatus,
};
