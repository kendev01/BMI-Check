const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const FROM = process.env.MAIL_FROM || 'BMI Check <no-reply@bmicheck.local>';
const OUTBOX = process.env.MAIL_OUTBOX || path.join(__dirname, '..', 'outbox');

let transportPromise = null;

// Three tiers, in order of preference:
//   1. a real SMTP server, when SMTP_HOST is configured;
//   2. an Ethereal test inbox, which needs outbound internet;
//   3. writing the message to ./outbox, which always works offline.
// Tier 3 matters because the reset flow must never fail just because mail is
// unavailable — see the try/catch in authRoutes.
async function getTransport() {
  if (transportPromise) return transportPromise;

  transportPromise = (async () => {
    if (process.env.SMTP_HOST) {
      return {
        kind: 'smtp',
        transport: nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: String(process.env.SMTP_SECURE || '') === 'true',
          auth: process.env.SMTP_USER
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            : undefined,
        }),
      };
    }

    try {
      const account = await nodemailer.createTestAccount();
      console.log('[mail] No SMTP_HOST set — using an Ethereal test inbox.');
      return {
        kind: 'ethereal',
        transport: nodemailer.createTransport({
          host: account.smtp.host,
          port: account.smtp.port,
          secure: account.smtp.secure,
          auth: { user: account.user, pass: account.pass },
        }),
      };
    } catch (err) {
      console.log(`[mail] Ethereal unavailable (${err.code || err.message}) — writing to ${OUTBOX}.`);
      fs.mkdirSync(OUTBOX, { recursive: true });
      return {
        kind: 'file',
        transport: nodemailer.createTransport({ streamTransport: true, buffer: true }),
      };
    }
  })();

  return transportPromise;
}

function buildMessage(to, resetUrl) {
  return {
    from: FROM,
    to,
    subject: 'Reset your BMI Check password',
    text: [
      'We received a request to reset your BMI Check password.',
      '',
      `Open this link to choose a new one: ${resetUrl}`,
      '',
      'The link expires in 1 hour and can only be used once.',
      'If you did not request this, you can ignore this email.',
    ].join('\n'),
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:480px">
        <h2 style="margin:0 0 12px">Reset your password</h2>
        <p style="color:#475569">We received a request to reset your BMI Check password.</p>
        <p style="margin:24px 0">
          <a href="${resetUrl}"
             style="background:#10b981;color:#02140c;padding:12px 20px;border-radius:10px;
                    text-decoration:none;font-weight:700;display:inline-block">Choose a new password</a>
        </p>
        <p style="color:#64748b;font-size:13px">
          The link expires in 1 hour and can only be used once.
          If you did not request this, you can ignore this email.
        </p>
      </div>`,
  };
}

async function sendPasswordReset(to, resetUrl) {
  const { kind, transport } = await getTransport();
  const info = await transport.sendMail(buildMessage(to, resetUrl));

  if (kind === 'ethereal') {
    const preview = nodemailer.getTestMessageUrl(info);
    console.log(`[mail] Password reset for ${to} — preview: ${preview}`);
    return { previewUrl: preview, resetUrl: null };
  }

  if (kind === 'file') {
    const file = path.join(OUTBOX, `reset-${Date.now()}.eml`);
    fs.writeFileSync(file, info.message);
    console.log(`[mail] Wrote reset email to ${file}`);
    console.log(`[mail] Reset link for ${to}: ${resetUrl}`);
    // Surfaced in the UI only because no mail server exists to deliver it.
    return { previewUrl: null, resetUrl };
  }

  console.log(`[mail] Password reset sent to ${to} (${info.messageId})`);
  return { previewUrl: null, resetUrl: null };
}

module.exports = { sendPasswordReset };
