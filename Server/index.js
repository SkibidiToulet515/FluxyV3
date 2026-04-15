import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import { Server } from 'socket.io';
import { scramjetPath } from '@mercuryworkshop/scramjet';
import { uvPath } from '@titaniumnetwork-dev/ultraviolet';
import { baremuxPath } from '@mercuryworkshop/bare-mux/node';
import { server as wisp } from '@mercuryworkshop/wisp-js/server';
import gamesRouter from './routes/games.js';
import chatRouter, { recentMessages } from './routes/chat.js';
import providersRouter from './routes/providers.js';
import giphyRouter from './routes/giphy.js';
import adminRouter from './routes/admin.js';
import moderationRouter from './routes/moderation.js';
import rolesRouter from './routes/roles.js';
import authResolveRouter from './routes/authResolve.js';
import exportRouter from './routes/export.js';
import onboardingRouter from './routes/onboarding.js';
import { initFirebase, ensureDefaultRoleDefinitions } from './config/firebase.js';
import { UGS_DIR } from './config/paths.js';
import { ugsLfsGuard } from './middleware/ugsLfsGuard.js';

initFirebase();
ensureDefaultRoleDefinitions().catch((err) =>
  console.error('[Firebase] ensureDefaultRoleDefinitions:', err?.message || err),
);

const PORT = Number(process.env.PORT) || 3000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const ALLOWED_ORIGINS = CLIENT_ORIGIN.split(',').map(s => s.trim());
const MIRROR_DOMAINS = ['fluxyv3.online', 'fluxyv3.store', 'fluxyv3.space', 'fluxyv3.site'];

const app = express();
app.use(
  cors({
    origin(origin, cb) {
      if (
        !origin ||
        ALLOWED_ORIGINS.some((o) => origin === o) ||
        origin.endsWith('.hosted.app') ||
        origin.endsWith('.web.app') ||
        origin.endsWith('.firebaseapp.com') ||
        MIRROR_DOMAINS.some((d) => origin === `https://${d}` || origin === `http://${d}`)
      ) {
        cb(null, true);
      } else {
        cb(null, false);
      }
    },
    credentials: true,
  }),
);
app.use(express.json());

// --- Static library files for proxy providers ---
app.use('/scram/', express.static(scramjetPath));
app.use('/uv/', express.static(uvPath));
app.use('/baremux/', express.static(baremuxPath));

// Serve epoxy-transport module (setTransport needs the ESM adapter, not raw wasm)
const epoxyTransportPath = path.resolve(
  import.meta.dirname,
  'node_modules',
  '@mercuryworkshop',
  'epoxy-transport',
  'dist',
);
app.use('/epoxy/', express.static(epoxyTransportPath));

// --- Game files (see Server/config/paths.js — prefers Client/UGS Files) ---
app.use('/games', ugsLfsGuard(UGS_DIR), express.static(UGS_DIR));

// --- API routes ---
app.use('/api/auth', authResolveRouter);
app.use('/api/games', gamesRouter);
app.use('/api/chat', chatRouter);
app.use('/api/providers', providersRouter);
app.use('/api/giphy', giphyRouter);
app.use('/api/admin', adminRouter);
app.use('/api/moderation', moderationRouter);
app.use('/api/roles', rolesRouter);
app.use('/api', exportRouter);
app.use('/api', onboardingRouter);

// --- Serve built frontend in production ---
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.resolve(import.meta.dirname, '..', 'Client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.url.startsWith('/api') || req.url.startsWith('/socket.io')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// --- HTTP server ---
const httpServer = http.createServer();

httpServer.on('request', (req, res) => {
  app(req, res);
});

// --- Wisp WebSocket transport (used by both Scramjet & UV via bare-mux) ---
httpServer.on('upgrade', (req, socket, head) => {
  if (req.url.endsWith('/wisp/')) {
    wisp.routeRequest(req, socket, head);
  } else {
    socket.end();
  }
});

// --- Socket.io (chat) — attach after wisp so wisp gets first crack at upgrades ---
const io = new Server(httpServer, {
  cors: {
    origin(origin, cb) {
      if (
        !origin ||
        ALLOWED_ORIGINS.some((o) => origin === o) ||
        origin.endsWith('.hosted.app') ||
        origin.endsWith('.web.app') ||
        origin.endsWith('.firebaseapp.com') ||
        MIRROR_DOMAINS.some((d) => origin === `https://${d}` || origin === `http://${d}`)
      ) {
        cb(null, true);
      } else {
        cb(null, false);
      }
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// --- Channel-based chat ---
const CHANNELS = ['general', 'memes'];
const channelHistory = { general: [], memes: [] };
const MAX_HISTORY = 150;

function trimChannel(ch) {
  while (channelHistory[ch].length > MAX_HISTORY) channelHistory[ch].shift();
}

const onlineUsers = new Map();

io.on('connection', (socket) => {
  socket.on('join', (username) => {
    const name =
      typeof username === 'string' && username.trim()
        ? username.trim().slice(0, 64)
        : 'Anonymous';
    socket.data.username = name;
    socket.data.channel = 'general';
    socket.join('general');
    onlineUsers.set(socket.id, name);
    io.emit('onlineUsers', [...new Set(onlineUsers.values())]);
    socket.emit('history', { channel: 'general', messages: [...channelHistory.general] });
  });

  socket.on('switchChannel', (channel) => {
    if (!CHANNELS.includes(channel)) return;
    const prev = socket.data.channel;
    if (prev) socket.leave(prev);
    socket.data.channel = channel;
    socket.join(channel);
    socket.emit('history', { channel, messages: [...(channelHistory[channel] || [])] });
  });

  socket.on('message', (payload) => {
    const user = socket.data.username ?? 'Anonymous';
    const channel = socket.data.channel || 'general';
    let text = '';
    let gif = null;
    if (typeof payload === 'string') {
      text = payload;
    } else if (payload && typeof payload === 'object') {
      text = payload.text ?? payload.message ?? '';
      if (payload.gif) gif = payload.gif;
    }
    text = String(text).trim().slice(0, 2000);
    if (!text && !gif) return;

    const msg = { user, text, gif, channel, ts: Date.now() };
    if (!channelHistory[channel]) channelHistory[channel] = [];
    channelHistory[channel].push(msg);
    trimChannel(channel);
    io.to(channel).emit('message', msg);
  });

  socket.on('disconnect', () => {
    onlineUsers.delete(socket.id);
    io.emit('onlineUsers', [...new Set(onlineUsers.values())]);
    socket.data.username = undefined;
  });
});

httpServer.listen(PORT, () => {
  console.log(`Fluxy server listening on http://localhost:${PORT}`);
  console.log(`Games static: http://localhost:${PORT}/games/`);
  console.log(`Scramjet dist: http://localhost:${PORT}/scram/`);
  console.log(`Ultraviolet dist: http://localhost:${PORT}/uv/`);
  console.log(`Wisp transport: ws://localhost:${PORT}/wisp/`);
});
