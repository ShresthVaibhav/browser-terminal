'use strict';

require('./lib/env');

const express      = require('express');
const cookieParser = require('cookie-parser');
const http         = require('http');
const path         = require('path');

const authRoutes  = require('./lib/auth-routes');
const wsTerminal  = require('./lib/ws-terminal');

const app    = express();
const server = http.createServer(app);

app.set('trust proxy', 1);
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', authRoutes);

wsTerminal.attach(server);

const PORT = parseInt(process.env.PORT || '3001', 10);
server.listen(PORT, '127.0.0.1', () => {
  console.log(`[browser-terminal] listening on 127.0.0.1:${PORT}`);
});
