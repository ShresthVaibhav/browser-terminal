'use strict';

const https = require('https');

async function notifyLogin(ip) {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const ts   = new Date().toISOString();
  const text = `Login\nTime: ${ts}\nIP: ${ip}`;

  try {
    await post(`https://api.telegram.org/bot${token}/sendMessage`, { chat_id: chatId, text });
  } catch (err) {
    console.warn('[telegram] notification failed:', err.message);
  }
}

function post(url, body) {
  return new Promise((resolve, reject) => {
    const payload = Buffer.from(JSON.stringify(body));
    const u       = new URL(url);
    const req     = https.request({
      hostname: u.hostname,
      path:     u.pathname,
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': payload.length },
    }, res => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

module.exports = { notifyLogin };
