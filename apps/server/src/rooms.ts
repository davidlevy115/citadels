import type { Server, Socket } from 'socket.io';
import {
  createGame, processAction, getPlayerView, getBotAction,
  hasPendingDecision, pendingDecisionPlayerId,
  type GameState, type GameConfig, type GameAction, type BotTurnSummary,
} from '@citadels/game-logic';
import { saveGame, loadGame, listSavedGames } from './storage.js';

interface RoomPlayer {
  socketId: string;
  playerId: string;
  name: string;
  age?: number;
}

/** A finished turn being shown to the table, waiting to be acknowledged. */
interface PendingSummary {
  id: string;
  summary: BotTurnSummary;
  acked: Set<string>;               // player ids that have dismissed it
  timer: ReturnType<typeof setTimeout>;
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
  characterSetId: string;
  includeRank9: boolean;
  // Turn narration
  currentTurnKey: string | null;
  currentTurn: BotTurnSummary | null;
  finishedTurns: BotTurnSummary[];
  pendingSummary: PendingSummary | null;
  summarySeq: number;
}

/**
 * Safety net for a player who never dismisses a recap — the client auto-closes
 * after ten seconds, so this only fires for someone who has gone away.
 */
const SUMMARY_ACK_TIMEOUT_MS = 14_000;

const rooms = new Map<string, GameRoom>();

function generateRoomId(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ── Turn narration ──────────────────────────────────────────────
// Every completed turn (bot or human) is summarised from the log entries it
// produced, so clients can flash a short "here is what just happened" popup.

/** Identifies the turn in progress. Changes exactly when the turn changes. */
function turnKey(state: GameState | null): string | null {
  if (!state || state.phase !== 'playerTurns' || !state.turnState) return null;
  const t = state.turnState;
  return `${t.playerId}:${t.characterRank}:${t.isWitchResume ? 'w' : t.isBewitchedTurn ? 'b' : 'n'}`;
}

/**
 * Lines that mark the start of a new turn. A single action can finish one turn
 * and begin the next, so entries after this line belong to the turn that is
 * only just starting.
 */
const TURN_BOUNDARY = [
  / is called\. .* reveals\.$/,
  /\(Witch\) resumes their turn as the /,
];

/** Log lines that describe the round rather than any one player's actions. */
const NARRATION_NOISE = [
  /^Round \d+:/,
  /chose a character\.$/,
  /^Character selection/,
  /^Game started/,
  /^Characters in play:/,
  / was killed! .* skips their turn\.$/,   // happens between turns
  /'s heir\) takes the Crown\.$/,          // resolved at the end of the round
  /^Game over!/,
];

const isBoundary = (m: string) => TURN_BOUNDARY.some(re => re.test(m));
const isNoise = (m: string) => NARRATION_NOISE.some(re => re.test(m));

function startTurnNarration(room: GameRoom, key: string | null): void {
  if (!key || !room.state?.turnState) {
    room.currentTurnKey = null;
    room.currentTurn = null;
    return;
  }
  const turn = room.state.turnState;
  const player = room.state.players.find(p => p.id === turn.playerId);
  room.currentTurnKey = key;
  room.currentTurn = {
    playerName: player?.name ?? 'Someone',
    characterName: turn.effectiveCharacter.name,
    characterRank: turn.effectiveCharacter.rank,
    round: room.state.round,
    actions: [],
  };
}

function flushTurnNarration(room: GameRoom): void {
  if (room.currentTurn && room.currentTurn.actions.length > 0) {
    room.finishedTurns.push(room.currentTurn);
  }
  room.currentTurn = null;
  room.currentTurnKey = null;
}

/**
 * Apply one action and attribute the log entries it produced to whichever turn
 * they belong to. An action such as ending a turn produces lines for both the
 * turn that just finished and the one that follows, so the entries are split at
 * the turn boundary rather than lumped together.
 */
function applyAction(room: GameRoom, action: GameAction): void {
  if (!room.state) return;

  const keyBefore = turnKey(room.state);
  if (keyBefore !== room.currentTurnKey) {
    flushTurnNarration(room);
    startTurnNarration(room, keyBefore);
  }

  const logBefore = room.state.log.length;
  room.state = processAction(room.state, action);
  const produced = room.state.log.slice(logBefore).map(e => e.message);

  const boundary = produced.findIndex(isBoundary);
  const beforeBoundary = boundary === -1 ? produced : produced.slice(0, boundary);
  const afterBoundary = boundary === -1 ? [] : produced.slice(boundary + 1);

  if (room.currentTurn) {
    room.currentTurn.actions.push(...beforeBoundary.filter(m => !isNoise(m)));
  }

  const keyAfter = turnKey(room.state);
  if (keyAfter !== room.currentTurnKey) {
    flushTurnNarration(room);
    startTurnNarration(room, keyAfter);
    if (room.currentTurn) {
      room.currentTurn.actions.push(...afterBoundary.filter(m => !isNoise(m)));
    }
  }
}

// ── Broadcasting ────────────────────────────────────────────────

function broadcastState(io: Server, room: GameRoom): void {
  if (!room.state) {
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

/** Which bot, if any, is due to act right now. */
function nextBotToAct(state: GameState): string | null {
  let candidate: { id: string; isBot: boolean } | undefined;

  if (hasPendingDecision(state)) {
    const deciderId = pendingDecisionPlayerId(state);
    candidate = state.players.find(p => p.id === deciderId);
  } else if (state.phase === 'chooseCharacters') {
    candidate = state.players[state.choosingPlayerIndex];
  } else if (state.phase === 'playerTurns' && state.turnState) {
    candidate = state.players.find(p => p.id === state.turnState!.playerId);
  }

  return candidate?.isBot ? candidate.id : null;
}

function humanPlayerIds(room: GameRoom): string[] {
  return room.players.map(p => p.playerId).filter(Boolean);
}

/**
 * Put the oldest finished turn on screen and hold the game there until every
 * human has dismissed it. Returns false when there is nothing to show.
 */
function showNextSummary(io: Server, room: GameRoom): boolean {
  const summary = room.finishedTurns.shift();
  if (!summary) return false;

  const id = `${room.id}:${++room.summarySeq}`;
  room.pendingSummary = {
    id,
    summary,
    acked: new Set(),
    timer: setTimeout(() => resolveSummary(io, room, id), SUMMARY_ACK_TIMEOUT_MS),
  };

  for (const rp of room.players) {
    io.to(rp.socketId).emit('turnSummary', { id, ...summary });
  }
  return true;
}

/** Everyone has seen it (or run out of time) — let the game move on. */
function resolveSummary(io: Server, room: GameRoom, id: string): void {
  if (!room.pendingSummary || room.pendingSummary.id !== id) return;
  clearTimeout(room.pendingSummary.timer);
  room.pendingSummary = null;
  advanceRoom(io, room);
}

/**
 * Drive the game forward: show any finished turn that is waiting, otherwise let
 * bots play. Bots stop the moment a turn completes, so recaps stay in step with
 * the board instead of arriving in a burst once the round is already over.
 */
function advanceRoom(io: Server, room: GameRoom): void {
  if (!room.state) return;
  if (room.pendingSummary) return;          // the table is still reading

  if (showNextSummary(io, room)) return;

  let safety = 0;
  while (safety++ < 500) {
    const botId = nextBotToAct(room.state);
    if (!botId) break;

    const action = getBotAction(room.state, botId);
    if (!action) break;

    try {
      applyAction(room, action);
    } catch (e) {
      console.error('Bot action error:', e);
      break;
    }

    // Show every step as it happens rather than only the end result.
    broadcastState(io, room);

    if (room.finishedTurns.length > 0) {
      showNextSummary(io, room);
      autoSave(room);
      return;
    }
  }

  broadcastState(io, room);
  autoSave(room);
}

function autoSave(room: GameRoom): void {
  if (room.isSinglePlayer && room.autoSave && room.state) {
    saveGame(room.id, room.state);
  }
}

function makeRoom(overrides: Partial<GameRoom> & { id: string }): GameRoom {
  return {
    state: null,
    players: [],
    isSinglePlayer: false,
    autoSave: false,
    waitingForPlayers: false,
    totalHumansNeeded: 1,
    pendingConfig: null,
    characterSetId: 'classic',
    includeRank9: false,
    currentTurnKey: null,
    currentTurn: null,
    finishedTurns: [],
    pendingSummary: null,
    summarySeq: 0,
    ...overrides,
  };
}

function tryStartGame(io: Server, room: GameRoom): void {
  if (!room.waitingForPlayers || !room.pendingConfig) return;
  if (room.players.length < room.totalHumansNeeded) return;

  // All humans joined — fill in their real names and ages.
  let humanIdx = 0;
  const config = room.pendingConfig.map(p => {
    if (!p.isBot && humanIdx < room.players.length) {
      const joined = room.players[humanIdx++];
      return { ...p, name: joined.name, age: joined.age };
    }
    return p;
  });

  const state = createGame({
    players: config,
    characterSetId: room.characterSetId,
    includeRank9: room.includeRank9,
  });
  room.state = state;
  room.waitingForPlayers = false;

  humanIdx = 0;
  for (const rp of room.players) {
    const gamePlayer = state.players.filter(p => !p.isBot)[humanIdx];
    if (gamePlayer) rp.playerId = gamePlayer.id;
    humanIdx++;
  }

  console.log(`Game started in room ${room.id} with ${state.players.length} players (${room.characterSetId})`);
  advanceRoom(io, room);
}

export function setupRoomHandlers(io: Server, socket: Socket): void {
  // Create single-player game (starts immediately)
  socket.on('createGame', (config: {
    playerName: string;
    playerAge?: number;
    botCount: number;
    botDifficulty?: 'easy' | 'medium' | 'hard';
    characterSetId?: string;
    includeRank9?: boolean;
  }) => {
    const roomId = generateRoomId();
    const players: GameConfig['players'] = [
      { name: config.playerName, isBot: false, age: config.playerAge },
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

    let state: GameState;
    try {
      state = createGame({
        players,
        characterSetId: config.characterSetId ?? 'classic',
        includeRank9: !!config.includeRank9,
      });
    } catch (e: any) {
      socket.emit('error', e.message);
      return;
    }

    const room = makeRoom({
      id: roomId,
      state,
      players: [{
        socketId: socket.id,
        playerId: state.players[0].id,
        name: config.playerName,
        age: config.playerAge,
      }],
      isSinglePlayer: true,
      autoSave: true,
      characterSetId: config.characterSetId ?? 'classic',
      includeRank9: !!config.includeRank9,
    });

    rooms.set(roomId, room);
    socket.join(roomId);
    socket.emit('roomJoined', { roomId, playerId: state.players[0].id });

    advanceRoom(io, room);
  });

  // Join existing room (multiplayer)
  socket.on('joinRoom', (data: { roomId: string; playerName: string; playerAge?: number }) => {
    const room = rooms.get(data.roomId);
    if (!room) {
      socket.emit('error', 'Room not found.');
      return;
    }

    if (room.players.length >= room.totalHumansNeeded) {
      socket.emit('error', 'Room is full.');
      return;
    }

    room.players.push({
      socketId: socket.id,
      playerId: '',
      name: data.playerName,
      age: data.playerAge,
    });

    socket.join(data.roomId);
    socket.emit('roomJoined', { roomId: data.roomId, playerId: '' });

    broadcastState(io, room);
    tryStartGame(io, room);
  });

  // Create multiplayer room (lobby waiting for players)
  socket.on('createMultiplayerRoom', (config: {
    playerName: string;
    playerAge?: number;
    totalHumans: number;
    botCount: number;
    botDifficulty?: 'easy' | 'medium' | 'hard';
    characterSetId?: string;
    includeRank9?: boolean;
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

    const room = makeRoom({
      id: roomId,
      players: [{ socketId: socket.id, playerId: '', name: config.playerName, age: config.playerAge }],
      waitingForPlayers: true,
      totalHumansNeeded: config.totalHumans,
      pendingConfig,
      characterSetId: config.characterSetId ?? 'classic',
      includeRank9: !!config.includeRank9,
    });

    rooms.set(roomId, room);
    socket.join(roomId);
    socket.emit('roomJoined', { roomId, playerId: '' });

    tryStartGame(io, room);

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
      applyAction(room, action);
      broadcastState(io, room);
      advanceRoom(io, room);
    } catch (e: any) {
      socket.emit('actionError', e.message);
    }
  });

  // A player has closed the turn recap. The game resumes once everyone has.
  socket.on('turnSummaryAck', (data: { roomId: string; summaryId: string }) => {
    const room = rooms.get(data.roomId);
    const pending = room?.pendingSummary;
    if (!room || !pending || pending.id !== data.summaryId) return;

    const rp = room.players.find(p => p.socketId === socket.id);
    if (!rp || !rp.playerId) return;

    pending.acked.add(rp.playerId);
    if (humanPlayerIds(room).every(id => pending.acked.has(id))) {
      resolveSummary(io, room, pending.id);
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

    const room = makeRoom({
      id: data.gameId,
      state,
      players: [{ socketId: socket.id, playerId: humanPlayer.id, name: data.playerName }],
      isSinglePlayer: true,
      autoSave: true,
      characterSetId: state.characterSetId ?? 'classic',
      includeRank9: state.maxRank >= 9,
    });

    rooms.set(data.gameId, room);
    socket.join(data.gameId);
    socket.emit('roomJoined', { roomId: data.gameId, playerId: humanPlayer.id });
    broadcastState(io, room);
    advanceRoom(io, room);
  });

  // List saved games
  socket.on('listSaves', () => {
    socket.emit('savedGames', listSavedGames());
  });

  // Rejoin room (reconnect after mobile background)
  socket.on('rejoinRoom', (data: { roomId: string; playerId: string }) => {
    const room = rooms.get(data.roomId);
    if (!room) return;

    const rp = room.players.find(p => p.playerId === data.playerId);
    if (rp) {
      rp.socketId = socket.id;
      socket.join(data.roomId);
      if (room.state) {
        socket.emit('gameState', getPlayerView(room.state, rp.playerId));
        // Re-send whatever the table is currently waiting on, so a reconnecting
        // player can dismiss it rather than stalling everyone until the timeout.
        if (room.pendingSummary && !room.pendingSummary.acked.has(rp.playerId)) {
          socket.emit('turnSummary', { id: room.pendingSummary.id, ...room.pendingSummary.summary });
        }
      } else if (room.waitingForPlayers) {
        socket.emit('lobbyState', {
          roomId: room.id,
          joined: room.players.map(p => p.name),
          totalHumansNeeded: room.totalHumansNeeded,
          waiting: true,
        });
      }
    }
  });

  // Disconnect handling — keep player in room for reconnect, only clean up if empty
  socket.on('disconnect', () => {
    for (const [roomId, room] of rooms.entries()) {
      const rp = room.players.find(p => p.socketId === socket.id);
      if (rp) {
        if (room.isSinglePlayer && !room.state) {
          rooms.delete(roomId);
        }
      }
    }
  });
}
