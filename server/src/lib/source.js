// Where a visitor came from, as a short human label for the Insights page.
// The browser sends an explicit tag (?ref=x / ?utm_source=…) and/or the referring
// site's hostname; this turns them into one tidy source (or null for "direct").
const BY_TAG = {
  x: 'X / Twitter', twitter: 'X / Twitter', tw: 'X / Twitter',
  google: 'Google', bing: 'Bing', duckduckgo: 'DuckDuckGo',
  facebook: 'Facebook', fb: 'Facebook', instagram: 'Instagram', ig: 'Instagram',
  reddit: 'Reddit', youtube: 'YouTube', tiktok: 'TikTok', linkedin: 'LinkedIn',
  whatsapp: 'WhatsApp', telegram: 'Telegram', discord: 'Discord', email: 'Email', friends: 'Friends',
};

// [hostname test, label]
const BY_HOST = [
  [/^(t\.co|(www\.|mobile\.|m\.)?(twitter|x)\.com)$/, 'X / Twitter'],
  [/(^|\.)google\.[a-z.]+$/, 'Google'],
  [/(^|\.)bing\.com$/, 'Bing'],
  [/(^|\.)duckduckgo\.com$/, 'DuckDuckGo'],
  [/(^|\.)(facebook|fb)\.com$|^l\.facebook\.com$/, 'Facebook'],
  [/(^|\.)instagram\.com$/, 'Instagram'],
  [/(^|\.)reddit\.com$/, 'Reddit'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'YouTube'],
  [/(^|\.)tiktok\.com$/, 'TikTok'],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, 'LinkedIn'],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, 'WhatsApp'],
  [/(^|\.)(t\.me|telegram\.org)$/, 'Telegram'],
  [/(^|\.)discord(app)?\.com$/, 'Discord'],
];

// Our own site, payment and mail hops aren't a "source".
const IGNORED = /(^|\.)(betbooks\.co\.uk|stripe\.com|onrender\.com|localhost|resend\.com)$/;

export function cleanSource(ref, host) {
  const tag = typeof ref === 'string' ? ref.trim().toLowerCase().replace(/[^a-z0-9._ -]/g, '').slice(0, 40) : '';
  if (tag) return BY_TAG[tag] || tag;
  const h = typeof host === 'string' ? host.trim().toLowerCase().replace(/^www\./, '').slice(0, 80) : '';
  if (!h || !/^[a-z0-9.-]+$/.test(h) || IGNORED.test(h)) return null;
  for (const [re, label] of BY_HOST) if (re.test(h)) return label;
  return h;
}
