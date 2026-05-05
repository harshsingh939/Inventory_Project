const { sendAssignmentRequestEmailToAdmins } = require('./mailer');

/**
 * After a request is committed: load summary and email admins (if SMTP configured).
 * Fire-and-forget; does not block HTTP response.
 */
exports.notifyAdminsNewRequest = (db, requestId) => {
  const rid = Number(requestId);
  if (!Number.isFinite(rid)) return;

  const sql = `
    SELECT r.id, r.user_message, au.username, au.email
    FROM assignment_requests r
    JOIN auth_users au ON au.id = r.auth_user_id
    WHERE r.id = ?
    LIMIT 1
  `;
  db.query(sql, [rid], (e1, rows) => {
    if (e1 || !rows?.length) {
      if (e1) console.error('[assignmentRequestNotify] load request:', e1.message);
      return;
    }
    const row = rows[0];
    db.query(
      'SELECT asset_type FROM assignment_request_asset_types WHERE request_id = ? ORDER BY asset_type',
      [rid],
      (e2, types) => {
        if (e2 && e2.code !== 'ER_NO_SUCH_TABLE') {
          console.error('[assignmentRequestNotify] types:', e2.message);
        }
        const typeList = !e2 && types?.length ? types.map((t) => String(t.asset_type || '').trim()).filter(Boolean) : [];
        const typesLine = typeList.length ? typeList.join(', ') : 'Equipment';

        const base =
          process.env.PUBLIC_APP_URL ||
          process.env.FRONTEND_URL ||
          'http://localhost:4200';
        const dashboardUrl = `${String(base).replace(/\/$/, '')}/assignment-requests`;

        sendAssignmentRequestEmailToAdmins(db, {
          requestId: rid,
          requesterName: row.username || 'User',
          requesterEmail: row.email || '',
          typesLine,
          userMessage: row.user_message || '',
          dashboardUrl,
        });
      },
    );
  });
};
