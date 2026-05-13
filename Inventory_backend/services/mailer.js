const { assignmentRequestAdminEmailHtml, signupNotifyAdminEmailHtml } = require('./emailTemplates');

function smtpConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

/** Exposed for controllers / health checks */
exports.isSmtpConfigured = () => smtpConfigured();

/**
 * Send HTML mail if nodemailer + SMTP env are available. Never throws to caller.
 * Env: SMTP_HOST, SMTP_PORT (default 587), SMTP_SECURE (0|1), SMTP_USER, SMTP_PASS,
 *      MAIL_FROM (default SMTP_USER), ADMIN_NOTIFY_EMAIL (comma-separated; else all admin auth_users emails)
 */
exports.sendMailSafe = ({ to, subject, html, text }) => {
  if (!smtpConfigured()) {
    console.warn(
      '[mailer] Email skipped: set SMTP_HOST, SMTP_USER, and SMTP_PASS in Inventory_backend/.env (same settings used for admin request emails).',
    );
    return false;
  }
  let nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch {
    console.warn('[mailer] nodemailer not installed; run npm install in Inventory_backend');
    return false;
  }
  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = process.env.SMTP_SECURE === '1' || process.env.SMTP_SECURE === 'true';
  const tlsRejectUnauthorized =
    process.env.SMTP_TLS_REJECT_UNAUTHORIZED === '0' ||
    process.env.SMTP_TLS_REJECT_UNAUTHORIZED === 'false';
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    ...(tlsRejectUnauthorized ? { tls: { rejectUnauthorized: false } } : {}),
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
    (err, info) => {
      if (err) {
        console.error('[mailer] send failed:', err.message);
        return;
      }
      if (info?.messageId) {
        console.log('[mailer] sent OK, messageId=', info.messageId);
      }
    },
  );
  return true;
};

function normalizeEmailAddr(s) {
  return String(s || '').trim().toLowerCase();
}

/**
 * Same logical mailbox (Gmail: ignores dots in local part and +tags). Other providers: full lowercased address.
 * e.g. singhharsh998877@gmail.com vs singhharsh6256@gmail.com → different keys.
 */
function mailboxKey(email) {
  const raw = normalizeEmailAddr(email);
  if (!raw || !raw.includes('@')) return raw;
  const at = raw.lastIndexOf('@');
  const local = raw.slice(0, at);
  let domain = raw.slice(at + 1);
  if (domain === 'googlemail.com') domain = 'gmail.com';
  if (domain === 'gmail.com') {
    const plus = local.indexOf('+');
    const base = plus >= 0 ? local.slice(0, plus) : local;
    return `${base.replace(/\./g, '')}@${domain}`;
  }
  return `${local}@${domain}`;
}

/** Do not send “new request / approve link” admin mail to the person who submitted the ticket. */
function filterAdminRecipientsExcludeRequester(recipients, requesterEmail) {
  const list = (Array.isArray(recipients) ? recipients : [])
    .map((e) => String(e || '').trim())
    .filter(Boolean);
  const reqKey = mailboxKey(requesterEmail);
  if (!reqKey) return list;
  return list.filter((e) => mailboxKey(e) !== reqKey);
}

function assignmentRequestPlainText(payload) {
  const lines = [
    `Request #${payload.requestId} from ${payload.requesterName} (${payload.requesterEmail}).`,
    `Types: ${payload.typesLine || ''}`,
    '',
    'Open this request:',
    payload.queueUrl || payload.dashboardUrl || '',
  ];
  if (payload.emailApproveUrl) {
    lines.push('', 'Approve & auto-assign (open, then confirm in browser):', payload.emailApproveUrl);
  }
  lines.push('', 'Full queue:', payload.dashboardUrl || '');
  return lines.join('\n');
}

/**
 * Notify admins by email about a new assignment request (optional SMTP).
 */
exports.sendAssignmentRequestEmailToAdmins = (db, payload, cb) => {
  const done = typeof cb === 'function' ? cb : () => {};
  if (!smtpConfigured()) {
    console.warn('[mailer] Admin notify email skipped: SMTP not configured.');
    return done();
  }
  const explicit = process.env.ADMIN_NOTIFY_EMAIL
    ? process.env.ADMIN_NOTIFY_EMAIL.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
    : null;
  if (explicit && explicit.length) {
    const to = filterAdminRecipientsExcludeRequester(explicit, payload.requesterEmail);
    if (!to.length) {
      console.warn(
        '[mailer] Admin notify skipped: every ADMIN_NOTIFY_EMAIL address matches the requester login (no other ops inbox).',
      );
      return done();
    }
    const html = assignmentRequestAdminEmailHtml(payload);
    exports.sendMailSafe({
      to,
      subject: `[InvenTrack] New assignment request #${payload.requestId}`,
      html,
      text: assignmentRequestPlainText(payload),
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
      const raw = (rows || []).map((r) => String(r.email).trim()).filter(Boolean);
      const emails = filterAdminRecipientsExcludeRequester(raw, payload.requesterEmail);
      if (!emails.length) {
        console.warn(
          '[mailer] Admin notify skipped: only admin recipient is the requester (excluded so they do not get approve-queue mail on their employee login).',
        );
        return done();
      }
      const html = assignmentRequestAdminEmailHtml(payload);
      exports.sendMailSafe({
        to: emails,
        subject: `[InvenTrack] New assignment request #${payload.requestId}`,
        html,
        text: assignmentRequestPlainText(payload),
      });
      done();
    },
  );
};

function signupNotifyPlainText(payload) {
  const root = (process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || '').replace(/\/$/, '');
  const teamUrl = payload.teamUrl || (root ? `${root}/users` : '');
  const lines = [
    `New InvenTrack signup: ${payload.username} <${payload.email}>, mobile ${payload.mobile}.`,
    `Use auth_users.id = ${payload.authUserId} in Team registration → Login user id after you add their employee row.`,
    '',
    teamUrl ? `Open Team registration: ${teamUrl}` : 'Open Team registration in the app (Users in the admin bar).',
  ];
  return lines.join('\n');
}

/**
 * Email admins when a new auth account is created (public signup). Uses same SMTP / ADMIN_NOTIFY_EMAIL as assignment alerts.
 */
exports.sendNewSignupEmailToAdmins = (db, payload, cb) => {
  const done = typeof cb === 'function' ? cb : () => {};
  if (!smtpConfigured()) {
    console.warn('[mailer] New signup admin email skipped: SMTP not configured.');
    return done();
  }
  const root = (process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || '').replace(/\/$/, '');
  const teamUrl = root ? `${root}/users` : '';
  const enriched = { ...payload, teamUrl };

  const explicit = process.env.ADMIN_NOTIFY_EMAIL
    ? process.env.ADMIN_NOTIFY_EMAIL.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
    : null;

  const sendTo = (to) => {
    if (!to.length) {
      console.warn('[mailer] New signup notify skipped: no admin recipient addresses.');
      return done();
    }
    exports.sendMailSafe({
      to,
      subject: `[InvenTrack] New signup: ${payload.username} (${payload.email})`,
      html: signupNotifyAdminEmailHtml(enriched),
      text: signupNotifyPlainText(enriched),
    });
    done();
  };

  if (explicit && explicit.length) {
    sendTo(explicit);
    return;
  }
  db.query(
    "SELECT email FROM auth_users WHERE role = 'admin' AND email IS NOT NULL AND TRIM(email) <> ''",
    (err, rows) => {
      if (err) {
        console.error('[mailer] admin lookup (signup):', err.message);
        return done();
      }
      const emails = (rows || []).map((r) => String(r.email).trim()).filter(Boolean);
      sendTo(emails);
    },
  );
};
