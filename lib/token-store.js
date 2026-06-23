'use strict';

const store = new Map();
const MAGIC_LINK_TTL_MS = 5 * 60 * 1000;

function create(token, ip) {
  store.set(token, { ip, expiresAt: Date.now() + MAGIC_LINK_TTL_MS });
}

function consume(token) {
  const entry = store.get(token);
  if (!entry) return null;
  store.delete(token);
  if (Date.now() > entry.expiresAt) return null;
  return entry;
}

setInterval(() => {
  const now = Date.now();
  for (const [tok, entry] of store) {
    if (now > entry.expiresAt) store.delete(tok);
  }
}, 60_000);

module.exports = { create, consume };
