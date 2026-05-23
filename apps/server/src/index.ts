import { createServer } from 'http';
import { Server } from 'socket.io';
import { setupRoomHandlers } from './rooms.js';
import express from 'express';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const PORT = parseInt(process.env.PORT || '3001', 10);
const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();

// Try multiple possible paths for the static frontend
const candidates = [
  join(__dirname, '../../web/out'),         // relative to dist/
  join(process.cwd(), 'apps/web/out'),      // from project root
  join(__dirname, '../../../apps/web/out'),  // if nested deeper
];

const staticDir = candidates.find(dir => existsSync(join(dir, 'index.html')));

if (staticDir) {
  console.log(`Serving static files from ${resolve(staticDir)}`);
  app.use(express.static(staticDir));
  app.get('{*path}', (_req, res) => {
    res.sendFile(join(staticDir, 'index.html'));
  });
} else {
  console.warn('Static frontend not found. Tried:', candidates.map(c => resolve(c)));
  app.get('{*path}', (_req, res) => {
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
