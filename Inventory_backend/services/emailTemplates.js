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
 */
exports.assignmentRequestAdminEmailHtml = (p) => {
  const types = esc(p.typesLine || 'Equipment');
  const name = esc(p.requesterName || 'User');
  const email = esc(p.requesterEmail || '');
  const note = p.userMessage ? `<p style="margin:16px 0 0;color:#94a3b8;font-size:14px;line-height:1.5;"><strong style="color:#e2e8f0;">Note</strong><br/>${esc(p.userMessage)}</p>` : '';
  const dash = esc(p.dashboardUrl || '#');

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
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:28px;">
                <tr>
                  <td style="border-radius:10px;background:linear-gradient(180deg,#38bdf8,#0284c7);">
                    <a href="${dash}" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:600;color:#020617;text-decoration:none;">Open assignment requests</a>
                  </td>
                </tr>
              </table>
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
