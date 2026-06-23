'use strict';

const nodemailer = require('nodemailer');

let _transport = null;

function getTransport() {
  if (_transport) return _transport;
  _transport = nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   parseInt(process.env.SMTP_PORT, 10),
    secure: parseInt(process.env.SMTP_PORT, 10) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return _transport;
}

async function sendMagicLink(magicUrl) {
  await getTransport().sendMail({
    from:    process.env.SMTP_FROM,
    to:      process.env.MAGIC_LINK_TO,
    subject: '[Browser Terminal] Your login link',
    text: `Your one-time login link (expires in 5 minutes):\n\n${magicUrl}\n\nIf you did not request this, ignore this email.`,
    html: `<p>Your one-time login link (<strong>expires in 5 minutes</strong>):</p>
           <p><a href="${magicUrl}">${magicUrl}</a></p>
           <p>If you did not request this, ignore this email.</p>`,
  });
}

module.exports = { sendMagicLink };
