import { createServer } from 'http';
import { Server } from 'socket.io';
import { setupRoomHandlers } from './rooms.js';
import express from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const PORT = parseInt(process.env.PORT || '3001', 10);
const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();

// Serve static frontend in production (built Next.js export)
const staticDir = join(__dirname, '../../web/out');
if (existsSync(staticDir)) {
  console.log(`Serving static files from ${staticDir}`);
  app.use(express.static(staticDir));
  // SPA fallback — serve index.html for any non-file route
  app.get('{*path}', (_req, res) => {
    res.sendFile(join(staticDir, 'index.html'));
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
