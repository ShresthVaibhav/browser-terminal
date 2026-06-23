'use strict';

const fs   = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '..', 'auth.log');

function log(event, ip, detail) {
  const ts   = new Date().toISOString();
  const line = `${ts} | ${event.padEnd(14)} | ${ip}${detail ? ' | ' + detail : ''}\n`;
  fs.appendFile(LOG_FILE, line, err => {
    if (err) console.error('[logger] write failed:', err.message);
  });
  console.log('[auth]', line.trimEnd());
}

module.exports = { log };
