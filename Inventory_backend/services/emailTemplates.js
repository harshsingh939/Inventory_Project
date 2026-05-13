/**
 * HTML email bodies (inline styles for common clients).
 * Do not embed secrets or PII beyond what the admin already has access to.
 */

function esc(s) {
  if (s == null || s === '') return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {object} p
 * @param {number} p.requestId
 * @param {string} p.requesterName
 * @param {string} p.requesterEmail
 * @param {string} p.typesLine - e.g. "Desktop, Laptop"
 * @param {string} [p.userMessage]
 * @param {string} [p.dashboardUrl] - link to assignment-requests admin UI
 * @param {string} [p.queueUrl] - deep link to highlight one request
 * @param {string} [p.emailApproveUrl] - open app + signed token (confirm assign in browser)
 */
exports.assignmentRequestAdminEmailHtml = (p) => {
  const types = esc(p.typesLine || 'Equipment');
  const name = esc(p.requesterName || 'User');
  const email = esc(p.requesterEmail || '');
  const note = p.userMessage ? `<p style="margin:16px 0 0;color:#94a3b8;font-size:14px;line-height:1.5;"><strong style="color:#e2e8f0;">Note</strong><br/>${esc(p.userMessage)}</p>` : '';
  const dash = esc(p.dashboardUrl || '#');
  const queue = esc(p.queueUrl || p.dashboardUrl || '#');
  const approve = p.emailApproveUrl ? esc(p.emailApproveUrl) : '';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;background:#020617;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#020617;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:linear-gradient(165deg,#0f172a 0%,#020617 100%);border-radius:16px;border:1px solid rgba(56,189,248,0.25);overflow:hidden;box-shadow:0 24px 48px rgba(0,0,0,0.45);">
          <tr>
            <td style="padding:28px 32px 8px;background:linear-gradient(90deg,rgba(14,165,233,0.15),transparent);">
              <p style="margin:0;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#7dd3fc;font-weight:600;">InvenTrack</p>
              <h1 style="margin:8px 0 0;font-size:22px;font-weight:700;color:#f8fafc;letter-spacing:-0.02em;">New assignment request</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 28px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#cbd5e1;">
                <strong style="color:#f1f5f9;">${name}</strong>${email ? ` <span style="color:#64748b;">&lt;${email}&gt;</span>` : ''} submitted request <strong style="color:#38bdf8;">#${esc(String(p.requestId))}</strong>.
              </p>
              <table role="presentation" width="100%" style="border-radius:12px;background:rgba(2,6,23,0.6);border:1px solid rgba(51,65,85,0.8);">
                <tr>
                  <td style="padding:16px 18px;">
                    <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#64748b;font-weight:600;">Requested types</p>
                    <p style="margin:0;font-size:16px;font-weight:600;color:#e2e8f0;">${types}</p>
                  </td>
                </tr>
              </table>
              ${note}
              <p style="margin:20px 0 0;font-size:14px;line-height:1.55;color:#94a3b8;">
                <strong style="color:#e2e8f0;">Auto-assign:</strong> the green button opens a short page that <strong style="color:#e2e8f0;">completes assignment without signing in</strong> (same as <strong style="color:#e2e8f0;">Assigned</strong> in the admin queue). Use “Open this request” if you prefer to sign in first, then click <strong style="color:#e2e8f0;">Assigned</strong> on that ticket.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:20px;">
                <tr>
                  ${
                    approve
                      ? `<td style="border-radius:10px;background:linear-gradient(180deg,#34d399,#059669);padding:0 12px 12px 0;">
                    <a href="${approve}" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:600;color:#022c22;text-decoration:none;">Approve &amp; auto-assign</a>
                  </td>`
                      : ''
                  }
                  <td style="border-radius:10px;background:linear-gradient(180deg,#38bdf8,#0284c7);padding:0 0 12px 0;">
                    <a href="${queue}" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:600;color:#020617;text-decoration:none;">Open this request</a>
                  </td>
                </tr>
              </table>
              <p style="margin:14px 0 0;font-size:12px;color:#64748b;"><a href="${dash}" style="color:#7dd3fc;text-decoration:none;">Full queue</a></p>
              <p style="margin:24px 0 0;font-size:12px;color:#475569;line-height:1.5;">You are receiving this because you are an administrator in InvenTrack. If SMTP is not configured, use the in-app bell for alerts.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

/**
 * @param {object} p
 * @param {string} p.username
 * @param {string} p.email
 * @param {string} p.mobile
 * @param {number} p.authUserId — auth_users.id (use in Team registration → Login user id)
 * @param {string} [p.teamUrl] — deep link to /users for admins
 */
exports.signupNotifyAdminEmailHtml = (p) => {
  const name = esc(p.username || 'User');
  const email = esc(p.email || '');
  const mobile = esc(p.mobile || '');
  const aid = esc(String(p.authUserId ?? ''));
  const team = esc(p.teamUrl || '#');
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;background:#020617;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#020617;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:linear-gradient(165deg,#0f172a 0%,#020617 100%);border-radius:16px;border:1px solid rgba(56,189,248,0.25);overflow:hidden;">
          <tr>
            <td style="padding:28px 32px 8px;">
              <p style="margin:0;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#7dd3fc;font-weight:600;">InvenTrack</p>
              <h1 style="margin:8px 0 0;font-size:22px;font-weight:700;color:#f8fafc;">New account signup</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 28px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#cbd5e1;">
                Someone created a login. Add them in <strong style="color:#f1f5f9;">Team registration</strong> and set <strong style="color:#38bdf8;">Login user id</strong> to <strong style="color:#e2e8f0;">${aid}</strong> so My workspace and requests work.
              </p>
              <table role="presentation" width="100%" style="border-radius:12px;background:rgba(2,6,23,0.6);border:1px solid rgba(51,65,85,0.8);">
                <tr><td style="padding:14px 18px;font-size:14px;color:#e2e8f0;"><strong>Username</strong><br/><span style="color:#94a3b8;">${name}</span></td></tr>
                <tr><td style="padding:14px 18px;font-size:14px;color:#e2e8f0;border-top:1px solid rgba(51,65,85,0.6);"><strong>Email</strong><br/><span style="color:#94a3b8;">${email}</span></td></tr>
                <tr><td style="padding:14px 18px;font-size:14px;color:#e2e8f0;border-top:1px solid rgba(51,65,85,0.6);"><strong>Mobile</strong><br/><span style="color:#94a3b8;">${mobile}</span></td></tr>
                <tr><td style="padding:14px 18px;font-size:14px;color:#e2e8f0;border-top:1px solid rgba(51,65,85,0.6);"><strong>auth_users.id</strong><br/><span style="color:#94a3b8;">${aid}</span></td></tr>
              </table>
              <p style="margin:20px 0 0;font-size:14px;">
                <a href="${team}" style="display:inline-block;padding:12px 24px;border-radius:10px;background:linear-gradient(180deg,#38bdf8,#0284c7);font-size:14px;font-weight:600;color:#020617;text-decoration:none;">Open Team registration</a>
              </p>
              <p style="margin:24px 0 0;font-size:12px;color:#475569;line-height:1.5;">You receive this because you are configured as an InvenTrack admin notify recipient. Configure SMTP and ADMIN_NOTIFY_EMAIL in the server environment if mail is not arriving.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};
