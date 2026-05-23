import { createServer } from 'http';
import { Server } from 'socket.io';
import { setupRoomHandlers } from './rooms.js';
import express from 'express';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readdirSync } from 'fs';

const PORT = parseInt(process.env.PORT || '3001', 10);
const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();

// Try multiple possible paths for the static frontend
const candidates = [
  join(__dirname, '../../web/out'),
  join(process.cwd(), 'apps/web/out'),
  join(__dirname, '../../../apps/web/out'),
];

const staticDir = candidates.find(dir => existsSync(join(dir, 'index.html')));

if (staticDir) {
  const resolved = resolve(staticDir);
  console.log(`Serving static files from ${resolved}`);
  console.log(`Contents: ${readdirSync(resolved).join(', ')}`);

  // Serve all static files — set immutable cache for hashed assets
  app.use('/_next', express.static(join(resolved, '_next'), {
    maxAge: '1y',
    immutable: true,
  }));
  app.use('/images', express.static(join(resolved, 'images'), {
    maxAge: '1d',
  }));
  app.use(express.static(resolved));

  // SPA fallback — only for non-asset routes
  app.use((_req, res) => {
    res.sendFile(join(resolved, 'index.html'));
  });
} else {
  console.warn('Static frontend not found. Tried:', candidates.map(c => resolve(c)));
  app.use((_req, res) => {
    res.status(404).send('Frontend not built. Run: pnpm --filter @citadels/web build');
  });
}

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);
  setupRoomHandlers(io, socket);

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Citadels server running on port ${PORT}`);
});
