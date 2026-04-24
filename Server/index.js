import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
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
import giveawaysRouter from './routes/giveaways.js';
import appealsRouter from './routes/appeals.js';
import notificationsRouter from './routes/notifications.js';
import reviewsRouter from './routes/reviews.js';
import analyticsRouter from './routes/analytics.js';
import cmsRouter from './routes/cms.js';
import referralPublicRouter from './routes/referralPublic.js';
import inclidesRouter from './routes/inclides.js';
import { initFirebase, ensureDefaultRoleDefinitions, verifyToken } from './config/firebase.js';
import { UGS_DIR } from './config/paths.js';
import { ugsLfsGuard } from './middleware/ugsLfsGuard.js';

initFirebase();
ensureDefaultRoleDefinitions().catch((err) =>
  console.error('[Firebase] ensureDefaultRoleDefinitions:', err?.message || err),
);

const PORT = Number(process.env.PORT) || 3000;

function parseOriginList(raw) {
  if (!raw || typeof raw !== 'string') return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

const ALLOWED_ORIGINS = (() => {
  const list = [
    ...parseOriginList(process.env.CLIENT_ORIGIN),
    ...parseOriginList(process.env.CORS_EXTRA_ORIGINS),
  ];
  return list.length ? list : ['http://localhost:5173'];
})();
const MIRROR_DOMAINS = ['fluxyv3.online', 'fluxyv3.store', 'fluxyv3.space', 'fluxyv3.site'];

function isCorsOriginAllowed(origin) {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.some((o) => origin === o)) return true;
  if (MIRROR_DOMAINS.some((d) => origin === `https://${d}` || origin === `http://${d}`)) return true;
  return false;
}

const SOCKET_AUTH_REQUIRED = process.env.SOCKET_AUTH_REQUIRED !== 'false';

const app = express();
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.API_RATE_LIMIT_PER_MIN) || 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, try again shortly.' },
});

app.use(
  cors({
    origin(origin, cb) {
      cb(null, isCorsOriginAllowed(origin));
    },
    credentials: true,
  }),
);
app.use(express.json());
app.use('/api', apiLimiter);

// --- Static library files for proxy providers ---
// Custom config overlays must be served BEFORE npm package files so that
// project-specific prefix/path settings (e.g. /uv/service/ instead of /service/)
// take priority over the defaults shipped inside the npm packages.
const clientPublic = path.resolve(import.meta.dirname, '..', 'Client', 'public');
app.use('/uv/', express.static(path.join(clientPublic, 'uv')));
app.use('/scram/', express.static(path.join(clientPublic, 'scram')));
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
app.use('/api', giveawaysRouter);
app.use('/api/appeals', appealsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api', reviewsRouter);
app.use('/api', analyticsRouter);
app.use('/api', cmsRouter);
app.use('/api', referralPublicRouter);
app.use('/api', inclidesRouter);

// --- Serve built frontend in production ---
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.resolve(import.meta.dirname, '..', 'Client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    const p = req.path;
    // Never serve index.html for API, socket, or proxy-library paths
    if (
      p.startsWith('/api') || p.startsWith('/socket.io') ||
      p.startsWith('/uv/') || p.startsWith('/scram/') ||
      p.startsWith('/baremux/') || p.startsWith('/epoxy/') ||
      p.startsWith('/wisp/') || p === '/sw.js'
    ) return next();
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
  if (req.url.endsWith('/wisp/') || req.url.startsWith('/wisp/')) {
    wisp.routeRequest(req, socket, head);
  }
  // Non-wisp upgrades (e.g. Socket.io) fall through to their own handlers
});

// --- Socket.io (chat) — attach after wisp so wisp gets first crack at upgrades ---
const io = new Server(httpServer, {
  cors: {
    origin(origin, cb) {
      cb(null, isCorsOriginAllowed(origin));
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

if (SOCKET_AUTH_REQUIRED) {
  io.use(async (socket, next) => {
    const raw =
      socket.handshake.auth?.token
      ?? socket.handshake.query?.token
      ?? socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');
    const token = typeof raw === 'string' ? raw.trim() : '';
    if (!token) {
      return next(new Error('Unauthorized'));
    }
    const decoded = await verifyToken(token);
    if (!decoded?.uid) {
      return next(new Error('Unauthorized'));
    }
    socket.data.uid = decoded.uid;
    next();
  });
}

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
