'use strict';

const fs   = require('fs');
const path = require('path');

const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = val;
  }
}

const required = [
  'PASSWORD_HASH',
  'SESSION_SECRET',
  'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM', 'MAGIC_LINK_TO',
  'APP_URL',
];

const missing = required.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`[browser-terminal] Missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.warn('[browser-terminal] TELEGRAM_BOT_TOKEN not set — login notifications disabled');
}
