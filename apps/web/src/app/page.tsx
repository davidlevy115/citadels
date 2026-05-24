'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSocket } from '@/hooks/useSocket';
import { useGameStore } from '@/hooks/useGameState';
import { GameBoard } from '@/components/GameBoard';

export default function Home() {
  const { createGame, createMultiplayerRoom, joinRoom, sendAction, loadGame, listSaves } = useSocket();
  const { roomId, playerId, gameView, lobbyState, error, actionError, savedGames } = useGameStore();

  const [playerName, setPlayerName] = useState('');
  const [botCount, setBotCount] = useState(3);
  const [tab, setTab] = useState<'single' | 'multi' | 'join' | 'load'>('single');
  const [joinCode, setJoinCode] = useState('');
  const [totalHumans, setTotalHumans] = useState(2);
  const [multiBots, setMultiBots] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem('citadels-name');
    if (saved) setPlayerName(saved);
  }, []);

  // In game — show game board
  if (roomId && gameView) {
    return (
      <GameBoard
        view={gameView}
        onAction={sendAction}
        actionError={actionError}
        roomId={roomId}
      />
    );
  }

  // Waiting room — show lobby
  if (roomId && lobbyState && lobbyState.waiting) {
    return (
      <div className="h-[100dvh] overflow-y-auto flex items-start justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-800/80 backdrop-blur rounded-2xl p-8 max-w-md w-full border border-slate-600 shadow-2xl text-center my-4"
        >
          <h1 className="text-3xl font-bold text-amber-400 mb-2">Citadels</h1>
          <p className="text-slate-400 text-sm mb-6">Waiting for players to join...</p>

          {/* Room code */}
          <div className="bg-slate-900/60 rounded-xl p-5 mb-6">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Share this room code</p>
            <button
              onClick={() => navigator.clipboard.writeText(lobbyState.roomId)}
              className="text-4xl font-bold text-amber-400 tracking-[0.3em] hover:text-amber-300 transition-colors"
              title="Click to copy"
            >
              {lobbyState.roomId}
            </button>
            <p className="text-xs text-slate-500 mt-2">Click to copy</p>
          </div>

          {/* Player list */}
          <div className="space-y-2 mb-6">
            {Array.from({ length: lobbyState.totalHumansNeeded }, (_, i) => {
              const name = lobbyState.joined[i];
              return (
                <div
                  key={i}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border ${
                    name
                      ? 'bg-green-900/30 border-green-700/50'
                      : 'bg-slate-700/30 border-slate-600/50'
                  }`}
                >
                  <div className={`w-3 h-3 rounded-full ${name ? 'bg-green-400' : 'bg-slate-600 animate-pulse'}`} />
                  <span className={`text-sm ${name ? 'text-green-300 font-medium' : 'text-slate-500 italic'}`}>
                    {name || 'Waiting for player...'}
                  </span>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-slate-500">
            {lobbyState.joined.length} / {lobbyState.totalHumansNeeded} players joined
          </p>

          <motion.div
            className="mt-4 flex justify-center gap-1.5"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          >
            {[0, 1, 2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-amber-400" />
            ))}
          </motion.div>
        </motion.div>
      </div>
    );
  }

  const saveName = () => {
    if (playerName.trim()) localStorage.setItem('citadels-name', playerName.trim());
  };

  return (
    <div className="h-[100dvh] overflow-y-auto flex items-start justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-slate-800/80 backdrop-blur rounded-2xl p-8 max-w-md w-full border border-slate-600 shadow-2xl my-4"
      >
        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-amber-400 mb-2">Citadels</h1>
          <p className="text-slate-400 text-sm">Build the most prosperous city in the realm</p>
        </div>

        {/* Player name */}
        <div className="mb-6">
          <label className="block text-sm text-slate-300 mb-1">Your Name</label>
          <input
            type="text"
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            onBlur={saveName}
            placeholder="Enter your name"
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-slate-900/50 rounded-lg p-1">
          {([
            ['single', 'Solo'],
            ['multi', 'Host'],
            ['join', 'Join'],
            ['load', 'Load'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => { setTab(key); if (key === 'load') listSaves(); }}
              className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === key ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'single' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-300 mb-1">Number of Bots</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5, 6].map(n => (
                  <button
                    key={n}
                    onClick={() => setBotCount(n)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                      botCount === n ? 'bg-amber-600' : 'bg-slate-700 hover:bg-slate-600'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-1">{botCount + 1} total players</p>
            </div>
            <button
              onClick={() => { saveName(); createGame(playerName.trim() || 'Player', botCount); }}
              disabled={!playerName.trim()}
              className="w-full py-3 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
            >
              Start Game
            </button>
          </div>
        )}

        {tab === 'multi' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-300 mb-1">Human Players</label>
              <div className="flex gap-2">
                {[2, 3, 4, 5, 6, 7].map(n => (
                  <button
                    key={n}
                    onClick={() => setTotalHumans(n)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                      totalHumans === n ? 'bg-amber-600' : 'bg-slate-700 hover:bg-slate-600'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1">Additional Bots</label>
              <div className="flex gap-2">
                {Array.from({ length: Math.min(6, 8 - totalHumans) }, (_, i) => i).map(n => (
                  <button
                    key={n}
                    onClick={() => setMultiBots(n)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                      multiBots === n ? 'bg-amber-600' : 'bg-slate-700 hover:bg-slate-600'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-1">{totalHumans + multiBots} total players</p>
            </div>
            <button
              onClick={() => { saveName(); createMultiplayerRoom(playerName.trim() || 'Player', totalHumans, multiBots); }}
              disabled={!playerName.trim() || totalHumans + multiBots < 2 || totalHumans + multiBots > 7}
              className="w-full py-3 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
            >
              Create Room
            </button>
          </div>
        )}

        {tab === 'join' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-300 mb-1">Room Code</label>
              <input
                type="text"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Enter room code"
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 uppercase tracking-widest text-center text-lg"
                maxLength={6}
              />
            </div>
            <button
              onClick={() => { saveName(); joinRoom(joinCode, playerName.trim() || 'Player'); }}
              disabled={!playerName.trim() || joinCode.length < 4}
              className="w-full py-3 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
            >
              Join Game
            </button>
          </div>
        )}

        {tab === 'load' && (
          <div className="space-y-4">
            {savedGames.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No saved games found</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {savedGames.map(id => (
                  <button
                    key={id}
                    onClick={() => { saveName(); loadGame(id, playerName.trim() || 'Player'); }}
                    className="w-full px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-left text-sm transition-colors"
                  >
                    Game {id}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Room code display */}
        {roomId && !gameView && (
          <div className="mt-4 p-4 bg-slate-900/50 rounded-lg text-center">
            <p className="text-sm text-slate-400 mb-1">Room Code</p>
            <p className="text-2xl font-bold text-amber-400 tracking-widest">{roomId}</p>
            <p className="text-xs text-slate-500 mt-1">Share this code with other players</p>
          </div>
        )}

        {/* Error display */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 p-3 bg-red-900/30 border border-red-700 rounded-lg text-sm text-red-300"
          >
            {error}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
