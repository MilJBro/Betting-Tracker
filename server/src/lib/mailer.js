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

// ---- Email templates -------------------------------------------------------
// Email clients are stuck in 2005: layout is nested tables and every style is
// inline. The shell below is shared, so any future email looks the same.
const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const BRAND = { green: '#22c55e', ink: '#0b1120', text: '#1f2937', muted: '#6b7280', line: '#e5e7eb', bg: '#f3f4f6' };
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function emailLayout({ preheader = '', heading, bodyHtml, button, afterButtonHtml = '', footerNote = '' }) {
  const site = config.appUrl;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<title>${esc(heading)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(preheader)}&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.bg}" style="background:${BRAND.bg};">
<tr><td align="center" style="padding:28px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
    <tr><td align="center" bgcolor="${BRAND.ink}" style="background:${BRAND.ink};border-radius:14px 14px 0 0;padding:26px 24px;">
      <a href="${esc(site)}" style="text-decoration:none;font-family:${FONT};font-size:26px;font-weight:800;letter-spacing:-0.02em;color:#ffffff;">Bet<span style="color:${BRAND.green};">books</span></a>
    </td></tr>
    <tr><td bgcolor="#ffffff" style="background:#ffffff;padding:34px 32px 30px;border-left:1px solid ${BRAND.line};border-right:1px solid ${BRAND.line};font-family:${FONT};color:${BRAND.text};">
      <h1 style="margin:0 0 14px;font-size:22px;line-height:1.3;font-weight:800;color:${BRAND.ink};">${esc(heading)}</h1>
      <div style="font-size:15px;line-height:1.6;color:${BRAND.text};">${bodyHtml}</div>
      ${button ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 22px;"><tr>
        <td align="center" bgcolor="${BRAND.green}" style="background:${BRAND.green};border-radius:10px;">
          <a href="${esc(button.url)}" style="display:inline-block;padding:14px 30px;font-family:${FONT};font-size:16px;font-weight:700;color:#04210f;text-decoration:none;border-radius:10px;">${esc(button.label)}</a>
        </td></tr></table>` : ''}
      ${afterButtonHtml}
    </td></tr>
    <tr><td bgcolor="#ffffff" style="background:#ffffff;border-left:1px solid ${BRAND.line};border-right:1px solid ${BRAND.line};padding:0 32px;"><div style="border-top:1px solid ${BRAND.line};font-size:0;line-height:0;">&nbsp;</div></td></tr>
    <tr><td bgcolor="#ffffff" style="background:#ffffff;border:1px solid ${BRAND.line};border-top:0;border-radius:0 0 14px 14px;padding:18px 32px 24px;font-family:${FONT};font-size:12.5px;line-height:1.6;color:${BRAND.muted};">
      ${footerNote ? `<div style="margin-bottom:10px;">${footerNote}</div>` : ''}
      <div>Betbooks · the betting tracker for serious punters · <a href="${esc(site)}" style="color:${BRAND.muted};">${esc(site.replace(/^https?:\/\//, ''))}</a></div>
    </td></tr>
    <tr><td align="center" style="padding:16px 12px 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${BRAND.muted};">
      Please gamble responsibly · <a href="https://www.begambleaware.org/" style="color:${BRAND.muted};">BeGambleAware.org</a>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

export function passwordResetEmail(resetUrl) {
  const link = esc(resetUrl);
  return {
    subject: 'Reset your Betbooks password',
    text: [
      'Reset your Betbooks password',
      '',
      'We got a request to reset the password on your Betbooks account.',
      'Use the link below to choose a new one. It works once and expires in 1 hour.',
      '',
      resetUrl,
      '',
      "If you didn't ask for this, you can ignore this email. Your password won't change.",
      '',
      '— Betbooks',
      config.appUrl,
    ].join('\n'),
    html: emailLayout({
      preheader: 'Choose a new password. This link works once and expires in 1 hour.',
      heading: 'Reset your password',
      bodyHtml: `<p style="margin:0 0 12px;">We got a request to reset the password on your Betbooks account.</p>
<p style="margin:0;">Tap the button to choose a new one. For your security the link works <strong>once</strong> and expires in <strong>1 hour</strong>.</p>`,
      button: { label: 'Choose a new password', url: resetUrl },
      afterButtonHtml: `<p style="margin:0 0 6px;font-size:13px;line-height:1.6;color:${BRAND.muted};">Button not working? Copy and paste this link into your browser:</p>
<p style="margin:0 0 20px;font-size:13px;line-height:1.5;word-break:break-all;"><a href="${link}" style="color:#15803d;">${link}</a></p>
<p style="margin:0;font-size:13px;line-height:1.6;color:${BRAND.muted};">Didn't ask for this? You can safely ignore this email — your password won't change.</p>`,
    }),
  };
}
