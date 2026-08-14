'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { Socket } from 'socket.io-client';
import type { GameAction, BotTurnSummary } from '@citadels/game-logic';
import { getSocket } from '@/lib/socket';
import { useGameStore } from './useGameState';

/** Everything the setup screens can configure about a new game. */
export interface GameSetup {
  playerName: string;
  playerAge?: number;
  characterSetId: string;
  includeRank9: boolean;
}

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const {
    setRoom, setGameView, setLobbyState, setError, setActionError, setSavedGames,
    setTurnSummary, roomId, playerId,
  } = useGameStore();

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

    socket.on('turnSummary', (summary: BotTurnSummary & { id: string }) => {
      setTurnSummary(summary);
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

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (!socket.connected) socket.connect();
        if (roomId && playerId) {
          socket.emit('rejoinRoom', { roomId, playerId });
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      socket.off('roomJoined');
      socket.off('gameState');
      socket.off('lobbyState');
      socket.off('turnSummary');
      socket.off('error');
      socket.off('actionError');
      socket.off('savedGames');
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [
    setRoom, setGameView, setLobbyState, setError, setActionError, setSavedGames,
    setTurnSummary, roomId, playerId,
  ]);

  const createGame = useCallback((setup: GameSetup, botCount: number) => {
    socketRef.current?.emit('createGame', {
      playerName: setup.playerName,
      playerAge: setup.playerAge,
      characterSetId: setup.characterSetId,
      includeRank9: setup.includeRank9,
      botCount,
    });
  }, []);

  const createMultiplayerRoom = useCallback((setup: GameSetup, totalHumans: number, botCount: number) => {
    socketRef.current?.emit('createMultiplayerRoom', {
      playerName: setup.playerName,
      playerAge: setup.playerAge,
      characterSetId: setup.characterSetId,
      includeRank9: setup.includeRank9,
      totalHumans,
      botCount,
    });
  }, []);

  const joinRoom = useCallback((roomCode: string, playerName: string, playerAge?: number) => {
    socketRef.current?.emit('joinRoom', { roomId: roomCode, playerName, playerAge });
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

  /** Tell the server this player has read the recap; the game waits for all of them. */
  const ackTurnSummary = useCallback((summaryId: string) => {
    setTurnSummary(null);
    if (!roomId) return;
    socketRef.current?.emit('turnSummaryAck', { roomId, summaryId });
  }, [roomId, setTurnSummary]);

  return { createGame, createMultiplayerRoom, joinRoom, sendAction, loadGame, listSaves, ackTurnSummary };
}
