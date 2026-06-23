'use strict';

const { WebSocketServer } = require('ws');
const pty                 = require('node-pty');
const cookie              = require('cookie');

const sessionStore = require('./session-store');
const logger       = require('./logger');

function attach(httpServer) {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    const cookies   = cookie.parse(req.headers.cookie || '');
    const sessionId = cookies.sid;

    if (!sessionId || !sessionStore.exists(sessionId)) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, ws => {
      wss.emit('connection', ws, req, sessionId);
    });
  });

  wss.on('connection', (ws, req, sessionId) => {
    const session = sessionStore.get(sessionId);
    const ip      = session?.ip || 'unknown';

    const isWindows = process.platform === 'win32';
    const shellBin  = isWindows ? 'cmd.exe' : 'bash';
    const shellCwd  = process.env.HOME || (isWindows ? process.env.USERPROFILE : '/home/ubuntu');

    const safeEnv = {
      HOME:    shellCwd,
      USER:    process.env.USER || 'ubuntu',
      SHELL:   process.env.SHELL || '/bin/bash',
      PATH:    process.env.PATH,
      LANG:    process.env.LANG || 'en_US.UTF-8',
      TERM:    'xterm-256color',
      LOGNAME: process.env.LOGNAME || process.env.USER || 'ubuntu',
    };

    let shell;
    try {
      shell = pty.spawn(shellBin, [], {
        name: 'xterm-256color',
        cols:  80,
        rows:  24,
        cwd:   shellCwd,
        env:   safeEnv,
      });
    } catch (err) {
      console.error('[ws-terminal] spawn failed:', err.message);
      ws.close(1011, 'Shell spawn failed');
      return;
    }

    console.log(`[ws-terminal] shell pid=${shell.pid} session=${sessionId} ip=${ip}`);

    shell.onData(data => {
      if (ws.readyState === ws.OPEN) ws.send(data);
    });

    shell.onExit(({ exitCode }) => {
      sessionStore.destroy(sessionId);
      if (ws.readyState === ws.OPEN) ws.close(1000, 'Shell exited');
    });

    ws.on('message', raw => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      if (msg.type === 'input') {
        if (typeof msg.data !== 'string' || msg.data.length > 4096) return;
        sessionStore.resetIdle(sessionId);
        shell.write(msg.data);
      } else if (msg.type === 'resize') {
        const cols = Math.max(1, Math.min(msg.cols || 80, 512));
        const rows = Math.max(1, Math.min(msg.rows || 24, 256));
        shell.resize(cols, rows);
      }
    });

    const pingInterval = setInterval(() => {
      if (ws.readyState === ws.OPEN) ws.ping();
    }, 30_000);

    sessionStore.startTimers(sessionId, reason => {
      logger.log('SESSION_EXPIRED', ip, `reason=${reason} session=${sessionId}`);
      try { shell.kill(); } catch {}
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'expired', reason }));
        ws.close(1000, `Session expired: ${reason}`);
      }
    });

    ws.on('close', () => {
      clearInterval(pingInterval);
      try { shell.kill(); } catch {}
    });

    ws.on('error', err => console.error('[ws-terminal] error:', err.message));
  });
}

module.exports = { attach };
