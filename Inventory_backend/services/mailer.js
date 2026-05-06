const { assignmentRequestAdminEmailHtml } = require('./emailTemplates');

function smtpConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

/**
 * Send HTML mail if nodemailer + SMTP env are available. Never throws to caller.
 * Env: SMTP_HOST, SMTP_PORT (default 587), SMTP_SECURE (0|1), SMTP_USER, SMTP_PASS,
 *      MAIL_FROM (default SMTP_USER), ADMIN_NOTIFY_EMAIL (comma-separated; else all admin auth_users emails)
 */
exports.sendMailSafe = ({ to, subject, html, text }) => {
  if (!smtpConfigured()) {
    return;
  }
  let nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch {
    console.warn('[mailer] nodemailer not installed; run npm install in Inventory_backend');
    return;
  }
  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = process.env.SMTP_SECURE === '1' || process.env.SMTP_SECURE === 'true';
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  const recipients = Array.isArray(to) ? to : [to];
  transporter.sendMail(
    {
      from,
      to: recipients.join(', '),
      subject,
      text: text || '',
      html,
    },
    (err) => {
      if (err) console.error('[mailer] send failed:', err.message);
    },
  );
};

/**
 * Notify admins by email about a new assignment request (optional SMTP).
 */
exports.sendAssignmentRequestEmailToAdmins = (db, payload, cb) => {
  const done = typeof cb === 'function' ? cb : () => {};
  if (!smtpConfigured()) {
    return done();
  }
  const explicit = process.env.ADMIN_NOTIFY_EMAIL
    ? process.env.ADMIN_NOTIFY_EMAIL.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
    : null;
  if (explicit && explicit.length) {
    const html = assignmentRequestAdminEmailHtml(payload);
    exports.sendMailSafe({
      to: explicit,
      subject: `[InvenTrack] New assignment request #${payload.requestId}`,
      html,
      text: `Request #${payload.requestId} from ${payload.requesterName} (${payload.requesterEmail}). Types: ${payload.typesLine || ''}`,
    });
    return done();
  }
  db.query(
    "SELECT email FROM auth_users WHERE role = 'admin' AND email IS NOT NULL AND TRIM(email) <> ''",
    (err, rows) => {
      if (err) {
        console.error('[mailer] admin lookup:', err.message);
        return done();
      }
      const emails = (rows || []).map((r) => String(r.email).trim()).filter(Boolean);
      if (!emails.length) return done();
      const html = assignmentRequestAdminEmailHtml(payload);
      exports.sendMailSafe({
        to: emails,
        subject: `[InvenTrack] New assignment request #${payload.requestId}`,
        html,
        text: `Request #${payload.requestId} from ${payload.requesterName} (${payload.requesterEmail}). Types: ${payload.typesLine || ''}`,
      });
      done();
    },
  );
};
