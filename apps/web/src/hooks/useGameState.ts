'use client';

import { create } from 'zustand';
import type { PlayerGameView, GameAction } from '@citadels/game-logic';

interface GameStore {
  roomId: string | null;
  playerId: string | null;
  gameView: PlayerGameView | null;
  error: string | null;
  actionError: string | null;
  savedGames: string[];

  setRoom: (roomId: string, playerId: string) => void;
  setGameView: (view: PlayerGameView) => void;
  setError: (error: string | null) => void;
  setActionError: (error: string | null) => void;
  setSavedGames: (games: string[]) => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  roomId: null,
  playerId: null,
  gameView: null,
  error: null,
  actionError: null,
  savedGames: [],

  setRoom: (roomId, playerId) => set({ roomId, playerId, error: null }),
  setGameView: (view) => set({ gameView: view, actionError: null }),
  setError: (error) => set({ error }),
  setActionError: (error) => set({ actionError: error }),
  setSavedGames: (games) => set({ savedGames: games }),
  reset: () => set({ roomId: null, playerId: null, gameView: null, error: null, actionError: null }),
}));
