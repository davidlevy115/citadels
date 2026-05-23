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
  state: GameState | null;           // null while waiting for players
  players: RoomPlayer[];
  isSinglePlayer: boolean;
  autoSave: boolean;
  // Lobby state
  waitingForPlayers: boolean;
  totalHumansNeeded: number;
  pendingConfig: GameConfig['players'] | null;
}

const rooms = new Map<string, GameRoom>();

function generateRoomId(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function broadcastState(io: Server, room: GameRoom): void {
  if (!room.state) {
    // Lobby state — tell everyone who's in and who we're waiting for
    const lobbyInfo = {
      roomId: room.id,
      joined: room.players.map(p => p.name),
      totalHumansNeeded: room.totalHumansNeeded,
      waiting: true,
    };
    for (const rp of room.players) {
      io.to(rp.socketId).emit('lobbyState', lobbyInfo);
    }
    return;
  }
  for (const rp of room.players) {
    const view = getPlayerView(room.state, rp.playerId);
    io.to(rp.socketId).emit('gameState', view);
  }
}

function processBotTurns(io: Server, room: GameRoom): void {
  if (!room.state) return;
  let safety = 0;
  const maxIterations = 100;

  while (safety++ < maxIterations) {
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

  if (room.isSinglePlayer && room.autoSave && room.state) {
    saveGame(room.id, room.state);
  }
}

function tryStartGame(io: Server, room: GameRoom): void {
  if (!room.waitingForPlayers || !room.pendingConfig) return;
  if (room.players.length < room.totalHumansNeeded) return;

  // All humans joined — create the game
  // Update player names from actual joined players
  let humanIdx = 0;
  const config = room.pendingConfig.map(p => {
    if (!p.isBot && humanIdx < room.players.length) {
      return { ...p, name: room.players[humanIdx++].name };
    }
    return p;
  });

  const state = createGame({ players: config });
  room.state = state;
  room.waitingForPlayers = false;

  // Map joined players to game player IDs
  humanIdx = 0;
  for (const rp of room.players) {
    const gamePlayer = state.players.filter(p => !p.isBot)[humanIdx];
    if (gamePlayer) {
      rp.playerId = gamePlayer.id;
    }
    humanIdx++;
  }

  console.log(`Game started in room ${room.id} with ${state.players.length} players`);
  processBotTurns(io, room);
}

export function setupRoomHandlers(io: Server, socket: Socket): void {
  // Create single-player game (starts immediately)
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
      isSinglePlayer: true,
      autoSave: true,
      waitingForPlayers: false,
      totalHumansNeeded: 1,
      pendingConfig: null,
    };

    rooms.set(roomId, room);
    socket.join(roomId);
    socket.emit('roomJoined', { roomId, playerId: state.players[0].id });

    processBotTurns(io, room);
  });

  // Join existing room (multiplayer)
  socket.on('joinRoom', (data: { roomId: string; playerName: string }) => {
    const room = rooms.get(data.roomId);
    if (!room) {
      socket.emit('error', 'Room not found.');
      return;
    }

    // Check if room is full
    if (room.players.length >= room.totalHumansNeeded) {
      socket.emit('error', 'Room is full.');
      return;
    }

    const rp: RoomPlayer = {
      socketId: socket.id,
      playerId: '',  // assigned when game starts
      name: data.playerName,
    };
    room.players.push(rp);

    socket.join(data.roomId);
    socket.emit('roomJoined', { roomId: data.roomId, playerId: '' });

    // Broadcast lobby state to everyone
    broadcastState(io, room);

    // Check if all humans are in — start the game
    tryStartGame(io, room);
  });

  // Create multiplayer room (lobby waiting for players)
  socket.on('createMultiplayerRoom', (config: {
    playerName: string;
    totalHumans: number;
    botCount: number;
    botDifficulty?: 'easy' | 'medium' | 'hard';
  }) => {
    const roomId = generateRoomId();
    const pendingConfig: GameConfig['players'] = [];

    for (let i = 0; i < config.totalHumans; i++) {
      pendingConfig.push({
        name: i === 0 ? config.playerName : `Player ${i + 1}`,
        isBot: false,
      });
    }
    for (let i = 0; i < config.botCount; i++) {
      pendingConfig.push({
        name: `Bot ${i + 1}`,
        isBot: true,
        botDifficulty: config.botDifficulty ?? 'medium',
      });
    }

    if (pendingConfig.length < 2 || pendingConfig.length > 7) {
      socket.emit('error', 'Need 2-7 total players.');
      return;
    }

    const room: GameRoom = {
      id: roomId,
      state: null,  // game not created yet
      players: [{
        socketId: socket.id,
        playerId: '',
        name: config.playerName,
      }],
      isSinglePlayer: false,
      autoSave: false,
      waitingForPlayers: true,
      totalHumansNeeded: config.totalHumans,
      pendingConfig,
    };

    rooms.set(roomId, room);
    socket.join(roomId);
    socket.emit('roomJoined', { roomId, playerId: '' });

    // If only 1 human needed (rest are bots), start immediately
    tryStartGame(io, room);

    // Otherwise broadcast lobby state
    if (room.waitingForPlayers) {
      broadcastState(io, room);
    }
  });

  // Player action
  socket.on('gameAction', (data: { roomId: string; action: GameAction }) => {
    const room = rooms.get(data.roomId);
    if (!room || !room.state) {
      socket.emit('error', 'Game not started yet.');
      return;
    }

    const rp = room.players.find(p => p.socketId === socket.id);
    if (!rp) {
      socket.emit('error', 'You are not in this room.');
      return;
    }

    const action = { ...data.action, playerId: rp.playerId } as GameAction;

    try {
      room.state = processAction(room.state, action);
      broadcastState(io, room);
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
      waitingForPlayers: false,
      totalHumansNeeded: 1,
      pendingConfig: null,
    };

    rooms.set(data.gameId, room);
    socket.join(data.gameId);
    socket.emit('roomJoined', { roomId: data.gameId, playerId: humanPlayer.id });
    broadcastState(io, room);
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
        if (room.players.length === 0) {
          rooms.delete(roomId);
        } else {
          broadcastState(io, room);
        }
      }
    }
  });
}
