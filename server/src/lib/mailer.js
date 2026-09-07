import nodemailer from 'nodemailer';
import { config } from './config.js';

let transporter = null;
if (config.smtp.host) {
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  });
}

export const emailEnabled = !!transporter;

// Sends an email if SMTP is configured; otherwise logs it so local
// development still works. Never throws to the caller.
export async function sendMail({ to, subject, text, html }) {
  if (!transporter) {
    console.log(
      `\n[mailer] SMTP not configured — email not sent.\n  To: ${to}\n  Subject: ${subject}\n  ${text}\n`
    );
    return { delivered: false };
  }
  try {
    await transporter.sendMail({ from: config.smtp.from, to, subject, text, html });
    return { delivered: true };
  } catch (err) {
    console.error('[mailer] Failed to send email:', err.message);
    return { delivered: false };
  }
}

export function passwordResetEmail(resetUrl) {
  return {
    subject: 'Reset your Betfolio password',
    text: `You asked to reset your password.\n\nOpen this link to choose a new one (valid for 1 hour):\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`,
    html: `<p>You asked to reset your password.</p>
<p><a href="${resetUrl}">Choose a new password</a> — this link is valid for 1 hour.</p>
<p style="color:#666">If you didn't request this, you can safely ignore this email.</p>`,
  };
}
