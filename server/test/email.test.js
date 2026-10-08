import test from 'node:test';
import assert from 'node:assert/strict';
import { passwordResetEmail, emailLayout } from '../src/lib/mailer.js';

const URL_ = 'https://betbooks.co.uk/reset-password?token=abc123def456';

test('the reset email has a clear subject, a button to the link, a fallback link and a plain-text version', () => {
  const m = passwordResetEmail(URL_);
  assert.equal(m.subject, 'Reset your Betbooks password');
  assert.match(m.html, /<a href="https:\/\/betbooks\.co\.uk\/reset-password\?token=abc123def456"[^>]*>Choose a new password<\/a>/);
  assert.ok(m.html.split(URL_).length >= 3, 'the link appears as the button AND as a visible fallback');
  assert.match(m.html, /expires in <strong>1 hour<\/strong>/);
  assert.match(m.html, /won't change/);
  assert.match(m.html, /BeGambleAware/);
  assert.ok(m.text.includes(URL_) && /1 hour/.test(m.text) && !/<[a-z]/i.test(m.text), 'plain text carries the link and has no markup');
});

test('the preview line (shown beside the subject in inboxes) is set', () => {
  assert.match(passwordResetEmail(URL_).html, /display:none[^>]*>Choose a new password\. This link works once/);
});

test('anything put into the email is escaped, so it can never inject markup', () => {
  const html = emailLayout({ heading: '<img src=x onerror=alert(1)>', bodyHtml: '<p>ok</p>', button: { label: '"><script>x</script>', url: 'https://x.test/?a=1&b="2"' } });
  assert.ok(!html.includes('<img src=x'), 'heading escaped');
  assert.ok(!html.includes('<script'), 'button label escaped');
  assert.ok(html.includes('?a=1&amp;b=&quot;2&quot;'), 'url escaped in the attribute');
});

test('it is built for email clients: tables, inline styles, a width cap and no external CSS or scripts', () => {
  const html = passwordResetEmail(URL_).html;
  assert.match(html, /<table role="presentation"/);
  assert.match(html, /max-width:560px/);
  assert.ok(!/<link |<script|<style/i.test(html));
});
