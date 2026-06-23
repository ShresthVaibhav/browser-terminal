'use strict';

const express      = require('express');
const bcrypt       = require('bcrypt');
const { v4: uuid } = require('uuid');
const rateLimit    = require('express-rate-limit');
const path         = require('path');

const tokenStore   = require('./token-store');
const sessionStore = require('./session-store');
const mailer       = require('./mailer');
const telegram     = require('./telegram');
const logger       = require('./logger');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             5,
  standardHeaders: true,
  legacyHeaders:   false,
  handler: (req, res) => {
    logger.log('FAILURE', req.ip, 'rate-limited');
    res.status(429).json({ error: 'Too many login attempts. Try again in 15 minutes.' });
  },
});

const magicLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             20,
  standardHeaders: true,
  legacyHeaders:   false,
});

function makeSessionCookie(res, sessionId) {
  res.cookie('sid', sessionId, {
    httpOnly: true,
    secure:   true,
    sameSite: 'lax',
    maxAge:   3 * 60 * 60 * 1000,
  });
}

function requireSession(req, res, next) {
  const sid = req.cookies?.sid;
  if (!sid || !sessionStore.exists(sid)) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  req.sessionId = sid;
  next();
}

router.get('/', (req, res) => {
  const sid = req.cookies?.sid;
  if (sid && sessionStore.exists(sid)) return res.redirect('/terminal');
  res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
});

router.get('/terminal', (req, res) => {
  const sid = req.cookies?.sid;
  if (!sid || !sessionStore.exists(sid)) return res.redirect('/');
  res.sendFile(path.join(__dirname, '..', 'public', 'terminal.html'));
});

router.post('/api/login', loginLimiter, async (req, res) => {
  const ip = req.ip;
  const { password } = req.body || {};

  if (typeof password !== 'string' || !password) {
    logger.log('FAILURE', ip, 'missing password');
    return res.status(400).json({ error: 'Password required.' });
  }

  let match = false;
  try {
    match = await bcrypt.compare(password, process.env.PASSWORD_HASH);
  } catch (err) {
    console.error('[auth] bcrypt error:', err);
    return res.status(500).json({ error: 'Internal error.' });
  }

  if (!match) {
    logger.log('FAILURE', ip, 'wrong password');
    return res.status(200).json({ ok: true });
  }

  const token    = uuid();
  tokenStore.create(token, ip);
  const magicUrl = `${process.env.APP_URL}/api/verify?token=${token}`;

  try {
    await mailer.sendMagicLink(magicUrl);
    logger.log('SUCCESS', ip, 'magic link sent');
  } catch (err) {
    console.error('[mailer] failed:', err.message);
    return res.status(500).json({ error: 'Failed to send login email.' });
  }

  res.json({ ok: true });
});

router.get('/api/verify', magicLimiter, async (req, res) => {
  const ip    = req.ip;
  const token = req.query.token;

  if (!token) return res.redirect('/?error=invalid');

  const entry = tokenStore.consume(token);
  if (!entry) {
    logger.log('FAILURE', ip, 'invalid or expired magic token');
    return res.redirect('/?error=invalid');
  }

  const sessionId = uuid();
  sessionStore.create(sessionId, ip);
  makeSessionCookie(res, sessionId);

  logger.log('MAGIC_USED', ip, `session=${sessionId}`);
  telegram.notifyLogin(ip);

  res.redirect('/terminal');
});

router.post('/api/logout', requireSession, (req, res) => {
  logger.log('LOGOUT', req.ip, `session=${req.sessionId}`);
  sessionStore.destroy(req.sessionId);
  res.clearCookie('sid', { httpOnly: true, secure: true, sameSite: 'lax' });
  res.json({ ok: true });
});

router.get('/api/ping', requireSession, (req, res) => {
  res.json({ ok: true });
});

module.exports = router;
module.exports.requireSession = requireSession;
