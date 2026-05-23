'use client';

import { create } from 'zustand';
import type { PlayerGameView, GameAction } from '@citadels/game-logic';

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
  error: string | null;
  actionError: string | null;
  savedGames: string[];

  setRoom: (roomId: string, playerId: string) => void;
  setGameView: (view: PlayerGameView) => void;
  setLobbyState: (lobby: LobbyState) => void;
  setError: (error: string | null) => void;
  setActionError: (error: string | null) => void;
  setSavedGames: (games: string[]) => void;
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

  setRoom: (roomId, playerId) => set({ roomId, playerId, error: null }),
  setGameView: (view) => set({ gameView: view, lobbyState: null, actionError: null }),
  setLobbyState: (lobby) => set({ lobbyState: lobby }),
  setError: (error) => set({ error }),
  setActionError: (error) => set({ actionError: error }),
  setSavedGames: (games) => set({ savedGames: games }),
  reset: () => set({ roomId: null, playerId: null, gameView: null, lobbyState: null, error: null, actionError: null }),
}));
