'use strict';

const IDLE_TIMEOUT_MS = 60 * 60 * 1000;
const ABSOLUTE_CAP_MS = 3 * 60 * 60 * 1000;

const sessions = new Map();

function create(sessionId, ip) {
  sessions.set(sessionId, {
    ip,
    loginAt: Date.now(),
    idleTimer: null,
    absoluteTimer: null,
    onExpire: null,
  });
}

function get(sessionId) {
  return sessions.get(sessionId) || null;
}

function destroy(sessionId) {
  const entry = sessions.get(sessionId);
  if (!entry) return;
  clearTimeout(entry.idleTimer);
  clearTimeout(entry.absoluteTimer);
  if (entry.onExpire) entry.onExpire('destroyed');
  sessions.delete(sessionId);
}

function startTimers(sessionId, onExpire) {
  const entry = sessions.get(sessionId);
  if (!entry) return;
  entry.onExpire = onExpire;
  entry.absoluteTimer = setTimeout(() => {
    onExpire('absolute');
    destroy(sessionId);
  }, ABSOLUTE_CAP_MS);
  resetIdle(sessionId);
}

function resetIdle(sessionId) {
  const entry = sessions.get(sessionId);
  if (!entry) return;
  clearTimeout(entry.idleTimer);
  entry.idleTimer = setTimeout(() => {
    if (entry.onExpire) entry.onExpire('idle');
    destroy(sessionId);
  }, IDLE_TIMEOUT_MS);
}

function exists(sessionId) {
  return sessions.has(sessionId);
}

module.exports = { create, get, destroy, startTimers, resetIdle, exists };
