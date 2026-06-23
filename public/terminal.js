'use strict';

const term = new Terminal({
  cursorBlink: true,
  fontFamily:  'JetBrains Mono, Fira Code, Cascadia Code, Consolas, monospace',
  fontSize:    14,
  theme: {
    background: '#0d1117',
    foreground: '#c9d1d9',
    cursor:     '#58a6ff',
    black:      '#484f58',
    red:        '#ff7b72',
    green:      '#3fb950',
    yellow:     '#d29922',
    blue:       '#58a6ff',
    magenta:    '#bc8cff',
    cyan:       '#39c5cf',
    white:      '#b1bac4',
  },
});

const fitAddon      = new FitAddon.FitAddon();
const webLinksAddon = new WebLinksAddon.WebLinksAddon();
term.loadAddon(fitAddon);
term.loadAddon(webLinksAddon);
term.open(document.getElementById('terminal-container'));
fitAddon.fit();

window.addEventListener('resize', () => fitAddon.fit());

const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws    = new WebSocket(`${proto}//${location.host}`);

ws.addEventListener('open', () => {
  term.focus();
  sendResize();
});

ws.addEventListener('message', evt => {
  let msg;
  try {
    msg = JSON.parse(evt.data);
    if (typeof msg !== 'object' || msg === null) throw new Error();
  } catch {
    term.write(evt.data);
    return;
  }
  if (msg.type === 'expired') {
    const reason = msg.reason === 'idle' ? 'idle timeout (1 hour)' : 'absolute session cap (3 hours)';
    showOverlay('Session Expired', `Disconnected due to ${reason}. Please log in again.`);
  }
});

ws.addEventListener('close', () => {
  if (!overlayShown) showOverlay('Disconnected', 'The terminal connection was closed. Please log in again.');
});

ws.addEventListener('error', () => {
  if (!overlayShown) showOverlay('Connection Error', 'Lost connection to the server. Please log in again.');
});

ws.addEventListener('message', evt => {
  if (evt.data === '__ping__') ws.send('__pong__');
});

term.onData(data => {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'input', data }));
});

term.attachCustomKeyEventHandler((e) => {
  if (e.type === 'keydown' && e.key.length === 1 && /[0-9!@#$%^&*()]/.test(e.key) && !e.ctrlKey && !e.altKey && !e.metaKey) {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'input', data: e.key }));
    return false;
  }
  return true;
});

term.onResize(({ cols, rows }) => sendResize(cols, rows));

function sendResize(cols, rows) {
  cols = cols || term.cols;
  rows = rows || term.rows;
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'resize', cols, rows }));
}

let overlayShown = false;

function showOverlay(title, msg) {
  overlayShown = true;
  document.getElementById('overlay-title').textContent = title;
  document.getElementById('overlay-msg').textContent   = msg;
  document.getElementById('overlay').classList.add('show');
}

document.getElementById('logout-btn').addEventListener('click', async () => {
  if (!confirm('Log out and end your terminal session?')) return;
  try { await fetch('/api/logout', { method: 'POST' }); } finally {
    ws.close();
    location.href = '/';
  }
});

setInterval(async () => {
  try {
    const res = await fetch('/api/ping');
    if (res.status === 401 && !overlayShown) showOverlay('Session Ended', 'Your session is no longer valid. Please log in again.');
  } catch {}
}, 30_000);
