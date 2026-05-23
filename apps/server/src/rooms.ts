import type { Server, Socket } from 'socket.io';
import {
  createGame, processAction, getPlayerView, getAvailableActions, getBotAction,
  type GameState, type GameConfig, type GameAction, type PlayerGameView,
} from '@citadels/game-logic';
import { saveGame, loadGame, listSavedGames } from './storage.js';

interface RoomPlayer {
  socketId: string;
  playerId: string;
  name: string;
}

interface GameRoom {
  id: string;
  state: GameState;
  players: RoomPlayer[];
  isSinglePlayer: boolean;
  autoSave: boolean;
}

const rooms = new Map<string, GameRoom>();

function generateRoomId(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function broadcastState(io: Server, room: GameRoom): void {
  for (const rp of room.players) {
    const view = getPlayerView(room.state, rp.playerId);
    io.to(rp.socketId).emit('gameState', view);
  }
}

function processBotTurns(io: Server, room: GameRoom): void {
  let safety = 0;
  const maxIterations = 100;

  while (safety++ < maxIterations) {
    // Find if a bot needs to act
    const state = room.state;
    let botPlayer: { id: string } | null = null;

    if (state.phase === 'chooseCharacters') {
      const chooser = state.players[state.choosingPlayerIndex];
      if (chooser?.isBot) botPlayer = chooser;
    } else if (state.phase === 'playerTurns' && state.turnState) {
      const active = state.players.find(p => p.characterCard?.rank === state.currentCharacterRank);
      if (active?.isBot) botPlayer = active;
    }

    if (!botPlayer) break;

    const action = getBotAction(state, botPlayer.id);
    if (!action) break;

    try {
      room.state = processAction(room.state, action);
    } catch (e) {
      console.error('Bot action error:', e);
      break;
    }
  }

  broadcastState(io, room);

  // Auto-save single player games
  if (room.isSinglePlayer && room.autoSave) {
    saveGame(room.id, room.state);
  }
}

export function setupRoomHandlers(io: Server, socket: Socket): void {
  // Create new game
  socket.on('createGame', (config: {
    playerName: string;
    botCount: number;
    botDifficulty?: 'easy' | 'medium' | 'hard';
  }) => {
    const roomId = generateRoomId();
    const players: GameConfig['players'] = [
      { name: config.playerName, isBot: false },
    ];
    for (let i = 0; i < config.botCount; i++) {
      players.push({
        name: `Bot ${i + 1}`,
        isBot: true,
        botDifficulty: config.botDifficulty ?? 'medium',
      });
    }

    if (players.length < 2) {
      socket.emit('error', 'Need at least 2 players.');
      return;
    }

    const state = createGame({ players });
    const room: GameRoom = {
      id: roomId,
      state,
      players: [{
        socketId: socket.id,
        playerId: state.players[0].id,
        name: config.playerName,
      }],
      isSinglePlayer: config.botCount > 0 && players.filter(p => !p.isBot).length === 1,
      autoSave: true,
    };

    rooms.set(roomId, room);
    socket.join(roomId);
    socket.emit('roomJoined', { roomId, playerId: state.players[0].id });

    // Process bot turns if bots go first
    processBotTurns(io, room);
  });

  // Join existing room (multiplayer)
  socket.on('joinRoom', (data: { roomId: string; playerName: string }) => {
    const room = rooms.get(data.roomId);
    if (!room) {
      socket.emit('error', 'Room not found.');
      return;
    }

    // Find an unoccupied non-bot player slot, or error
    const occupiedPlayerIds = new Set(room.players.map(p => p.playerId));
    const availableSlot = room.state.players.find(
      p => !p.isBot && !occupiedPlayerIds.has(p.id)
    );

    if (!availableSlot) {
      socket.emit('error', 'Room is full.');
      return;
    }

    room.players.push({
      socketId: socket.id,
      playerId: availableSlot.id,
      name: data.playerName,
    });

    socket.join(data.roomId);
    socket.emit('roomJoined', { roomId: data.roomId, playerId: availableSlot.id });
    broadcastState(io, room);
  });

  // Create multiplayer room (lobby waiting for players)
  socket.on('createMultiplayerRoom', (config: {
    playerName: string;
    totalHumans: number;
    botCount: number;
    botDifficulty?: 'easy' | 'medium' | 'hard';
  }) => {
    const roomId = generateRoomId();
    const players: GameConfig['players'] = [];

    for (let i = 0; i < config.totalHumans; i++) {
      players.push({
        name: i === 0 ? config.playerName : `Player ${i + 1}`,
        isBot: false,
      });
    }
    for (let i = 0; i < config.botCount; i++) {
      players.push({
        name: `Bot ${i + 1}`,
        isBot: true,
        botDifficulty: config.botDifficulty ?? 'medium',
      });
    }

    if (players.length < 2 || players.length > 7) {
      socket.emit('error', 'Need 2-7 total players.');
      return;
    }

    const state = createGame({ players });
    const room: GameRoom = {
      id: roomId,
      state,
      players: [{
        socketId: socket.id,
        playerId: state.players[0].id,
        name: config.playerName,
      }],
      isSinglePlayer: false,
      autoSave: false,
    };

    rooms.set(roomId, room);
    socket.join(roomId);
    socket.emit('roomJoined', { roomId, playerId: state.players[0].id });
    broadcastState(io, room);

    // Process bot turns if bots go first
    processBotTurns(io, room);
  });

  // Player action
  socket.on('gameAction', (data: { roomId: string; action: GameAction }) => {
    const room = rooms.get(data.roomId);
    if (!room) {
      socket.emit('error', 'Room not found.');
      return;
    }

    // Verify the player belongs to this room
    const rp = room.players.find(p => p.socketId === socket.id);
    if (!rp) {
      socket.emit('error', 'You are not in this room.');
      return;
    }

    // Ensure the action's playerId matches this socket's player
    const action = { ...data.action, playerId: rp.playerId } as GameAction;

    try {
      room.state = processAction(room.state, action);
      broadcastState(io, room);

      // Process bot turns after human action
      processBotTurns(io, room);
    } catch (e: any) {
      socket.emit('actionError', e.message);
    }
  });

  // Load saved game
  socket.on('loadGame', (data: { gameId: string; playerName: string }) => {
    const state = loadGame(data.gameId);
    if (!state) {
      socket.emit('error', 'Saved game not found.');
      return;
    }

    // Find the human player in the saved state
    const humanPlayer = state.players.find(p => !p.isBot);
    if (!humanPlayer) {
      socket.emit('error', 'No human player found in saved game.');
      return;
    }

    const room: GameRoom = {
      id: data.gameId,
      state,
      players: [{
        socketId: socket.id,
        playerId: humanPlayer.id,
        name: data.playerName,
      }],
      isSinglePlayer: true,
      autoSave: true,
    };

    rooms.set(data.gameId, room);
    socket.join(data.gameId);
    socket.emit('roomJoined', { roomId: data.gameId, playerId: humanPlayer.id });
    broadcastState(io, room);

    // Process bot turns if it's a bot's turn
    processBotTurns(io, room);
  });

  // List saved games
  socket.on('listSaves', () => {
    const saves = listSavedGames();
    socket.emit('savedGames', saves);
  });

  // Disconnect handling
  socket.on('disconnect', () => {
    for (const [roomId, room] of rooms.entries()) {
      const idx = room.players.findIndex(p => p.socketId === socket.id);
      if (idx !== -1) {
        room.players.splice(idx, 1);
        if (room.players.length === 0 && !room.isSinglePlayer) {
          rooms.delete(roomId);
        }
      }
    }
  });
}
