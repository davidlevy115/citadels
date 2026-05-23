'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { Socket } from 'socket.io-client';
import type { GameAction } from '@citadels/game-logic';
import { getSocket } from '@/lib/socket';
import { useGameStore } from './useGameState';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const { setRoom, setGameView, setLobbyState, setError, setActionError, setSavedGames, roomId, playerId } = useGameStore();

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    socket.on('roomJoined', (data: { roomId: string; playerId: string }) => {
      setRoom(data.roomId, data.playerId);
    });

    socket.on('gameState', (view: any) => {
      setGameView(view);
    });

    socket.on('lobbyState', (lobby: any) => {
      setLobbyState(lobby);
    });

    socket.on('error', (msg: string) => {
      setError(msg);
    });

    socket.on('actionError', (msg: string) => {
      setActionError(msg);
    });

    socket.on('savedGames', (games: string[]) => {
      setSavedGames(games);
    });

    socket.connect();

    return () => {
      socket.off('roomJoined');
      socket.off('gameState');
      socket.off('lobbyState');
      socket.off('error');
      socket.off('actionError');
      socket.off('savedGames');
    };
  }, [setRoom, setGameView, setLobbyState, setError, setActionError, setSavedGames]);

  const createGame = useCallback((playerName: string, botCount: number) => {
    socketRef.current?.emit('createGame', { playerName, botCount });
  }, []);

  const createMultiplayerRoom = useCallback((playerName: string, totalHumans: number, botCount: number) => {
    socketRef.current?.emit('createMultiplayerRoom', { playerName, totalHumans, botCount });
  }, []);

  const joinRoom = useCallback((roomId: string, playerName: string) => {
    socketRef.current?.emit('joinRoom', { roomId, playerName });
  }, []);

  const sendAction = useCallback((action: Omit<GameAction, 'playerId'> & { playerId?: string }) => {
    if (!roomId) return;
    socketRef.current?.emit('gameAction', {
      roomId,
      action: { ...action, playerId: playerId ?? '' },
    });
  }, [roomId, playerId]);

  const loadGame = useCallback((gameId: string, playerName: string) => {
    socketRef.current?.emit('loadGame', { gameId, playerName });
  }, []);

  const listSaves = useCallback(() => {
    socketRef.current?.emit('listSaves');
  }, []);

  return { createGame, createMultiplayerRoom, joinRoom, sendAction, loadGame, listSaves };
}
