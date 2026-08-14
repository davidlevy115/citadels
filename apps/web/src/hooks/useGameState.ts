'use client';

import { create } from 'zustand';
import type { PlayerGameView, BotTurnSummary } from '@citadels/game-logic';
import type { WireError } from '@/lib/i18n';

export interface LobbyState {
  roomId: string;
  joined: string[];
  totalHumansNeeded: number;
  waiting: boolean;
}

interface GameStore {
  roomId: string | null;
  playerId: string | null;
  gameView: PlayerGameView | null;
  lobbyState: LobbyState | null;
  error: WireError | null;
  actionError: WireError | null;
  savedGames: string[];
  /** The turn recap currently on screen. The server sends one at a time and
   *  waits for every player to dismiss it before the game moves on. */
  turnSummary: (BotTurnSummary & { id: string }) | null;

  setRoom: (roomId: string, playerId: string) => void;
  setGameView: (view: PlayerGameView) => void;
  setLobbyState: (lobby: LobbyState) => void;
  setError: (error: WireError | null) => void;
  setActionError: (error: WireError | null) => void;
  setSavedGames: (games: string[]) => void;
  setTurnSummary: (summary: (BotTurnSummary & { id: string }) | null) => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  roomId: null,
  playerId: null,
  gameView: null,
  lobbyState: null,
  error: null,
  actionError: null,
  savedGames: [],
  turnSummary: null,

  setRoom: (roomId, playerId) => set({ roomId, playerId, error: null }),
  setGameView: (view) => set({ gameView: view, lobbyState: null, actionError: null }),
  setLobbyState: (lobby) => set({ lobbyState: lobby }),
  setError: (error) => set({ error }),
  setActionError: (error) => set({ actionError: error }),
  setSavedGames: (games) => set({ savedGames: games }),
  setTurnSummary: (summary) => set({ turnSummary: summary }),
  reset: () => set({
    roomId: null, playerId: null, gameView: null, lobbyState: null,
    error: null, actionError: null, turnSummary: null,
  }),
}));
