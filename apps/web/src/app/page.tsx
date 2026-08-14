'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Character } from '@citadels/game-logic';
import { useSocket } from '@/hooks/useSocket';
import { useGameStore } from '@/hooks/useGameState';
import { useT, useLocaleStore, useRestoreLocale } from '@/hooks/useI18n';
import { LOCALES } from '@/lib/i18n';
import { GameBoard } from '@/components/GameBoard';
import { CharacterSetPicker } from '@/components/CharacterSetPicker';
import { CharacterDetailModal } from '@/components/CardDetailModal';

export default function Home() {
  const {
    createGame, createMultiplayerRoom, joinRoom, sendAction, loadGame, listSaves, ackTurnSummary,
  } = useSocket();
  const { roomId, playerId, gameView, lobbyState, error, actionError, savedGames } = useGameStore();

  useRestoreLocale();
  const t = useT();
  const { locale, setLocale } = useLocaleStore();

  const [playerName, setPlayerName] = useState('');
  const [playerAge, setPlayerAge] = useState('');
  const [botCount, setBotCount] = useState(3);
  const [tab, setTab] = useState<'single' | 'multi' | 'join' | 'load'>('single');
  const [joinCode, setJoinCode] = useState('');
  const [totalHumans, setTotalHumans] = useState(2);
  const [multiBots, setMultiBots] = useState(0);
  const [characterSetId, setCharacterSetId] = useState('classic');
  const [includeRank9, setIncludeRank9] = useState(false);
  const [detailCharacter, setDetailCharacter] = useState<Character | null>(null);

  useEffect(() => {
    const savedName = localStorage.getItem('citadels-name');
    if (savedName) setPlayerName(savedName);
    const savedAge = localStorage.getItem('citadels-age');
    if (savedAge) setPlayerAge(savedAge);
  }, []);

  // In game — show game board
  if (roomId && gameView) {
    return (
      <GameBoard
        view={gameView}
        onAction={sendAction}
        actionError={actionError}
        roomId={roomId}
        onDismissTurnSummary={ackTurnSummary}
      />
    );
  }

  // Waiting room — show lobby
  if (roomId && lobbyState && lobbyState.waiting) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-800/80 backdrop-blur rounded-2xl p-8 max-w-md w-full border border-slate-600 shadow-2xl text-center"
        >
          <h1 className="text-3xl font-bold text-amber-400 mb-2">{t('app.title')}</h1>
          <p className="text-slate-400 text-sm mb-6">{t('lobby.waiting')}</p>

          <div className="bg-slate-900/60 rounded-xl p-5 mb-6">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">{t('lobby.shareCode')}</p>
            <button
              onClick={() => navigator.clipboard.writeText(lobbyState.roomId)}
              className="text-4xl font-bold text-amber-400 tracking-[0.3em] hover:text-amber-300 transition-colors"
              title={t('lobby.clickToCopy')}
            >
              {lobbyState.roomId}
            </button>
            <p className="text-xs text-slate-500 mt-2">{t('lobby.clickToCopy')}</p>
          </div>

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
                    {name || t('lobby.waitingForPlayer')}
                  </span>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-slate-500">
            {t('lobby.playersJoined', { joined: lobbyState.joined.length, total: lobbyState.totalHumansNeeded })}
          </p>
          <p className="text-[11px] text-slate-600 mt-1">{t('lobby.oldestWillStart')}</p>

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

  const savePlayer = () => {
    if (playerName.trim()) localStorage.setItem('citadels-name', playerName.trim());
    if (playerAge.trim()) localStorage.setItem('citadels-age', playerAge.trim());
  };

  const parsedAge = (() => {
    const n = parseInt(playerAge, 10);
    return Number.isFinite(n) && n > 0 && n < 130 ? n : undefined;
  })();

  const setup = {
    playerName: playerName.trim() || 'Player',
    playerAge: parsedAge,
    characterSetId,
    includeRank9,
  };

  const detailsReady = !!playerName.trim() && parsedAge !== undefined;

  return (
    <div className="min-h-screen flex items-start justify-center p-4 py-8">
      <AnimatePresence>
        {detailCharacter && (
          <CharacterDetailModal character={detailCharacter} onClose={() => setDetailCharacter(null)} />
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-slate-800/80 backdrop-blur rounded-2xl p-8 max-w-md w-full border border-slate-600 shadow-2xl"
      >
        {/* Title */}
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-amber-400 mb-2">{t('app.title')}</h1>
          <p className="text-slate-400 text-sm">{t('app.tagline')}</p>
        </div>

        {/* Language — applies immediately and is remembered for the next game */}
        <div className="mb-6">
          <label className="block text-sm text-slate-300 mb-1">{t('setup.language')}</label>
          <div className="flex gap-2">
            {LOCALES.map(option => (
              <button
                key={option.id}
                onClick={() => setLocale(option.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${
                  locale === option.id ? 'bg-amber-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                }`}
              >
                <span aria-hidden>{option.flag}</span>
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Player identity */}
        <div className="mb-2 flex gap-3">
          <div className="flex-1">
            <label className="block text-sm text-slate-300 mb-1">{t('setup.yourName')}</label>
            <input
              type="text"
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              onBlur={savePlayer}
              placeholder={t('setup.namePlaceholder')}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div className="w-24">
            <label className="block text-sm text-slate-300 mb-1">{t('setup.age')}</label>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={129}
              value={playerAge}
              onChange={e => setPlayerAge(e.target.value)}
              onBlur={savePlayer}
              placeholder={t('setup.agePlaceholder')}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 text-center focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>
        <p className="mb-6 text-[11px] text-slate-500">{t('setup.oldestStarts')}</p>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-slate-900/50 rounded-lg p-1">
          {([
            ['single', t('setup.tabSolo')],
            ['multi', t('setup.tabHost')],
            ['join', t('setup.tabJoin')],
            ['load', t('setup.tabLoad')],
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
              <label className="block text-sm text-slate-300 mb-1">{t('setup.numberOfBots')}</label>
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
              <p className="text-xs text-slate-500 mt-1">{t('setup.totalPlayers', { count: botCount + 1 })}</p>
            </div>

            <CharacterSetPicker
              value={characterSetId}
              onChange={setCharacterSetId}
              includeRank9={includeRank9}
              onIncludeRank9Change={setIncludeRank9}
              playerCount={botCount + 1}
              onDetail={setDetailCharacter}
            />

            <button
              onClick={() => { savePlayer(); createGame(setup, botCount); }}
              disabled={!detailsReady}
              className="w-full py-3 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
            >
              {t('setup.startGame')}
            </button>
            {!detailsReady && (
              <p className="text-[11px] text-slate-500 text-center">{t('setup.needNameAndAge')}</p>
            )}
          </div>
        )}

        {tab === 'multi' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-300 mb-1">{t('setup.humanPlayers')}</label>
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
              <label className="block text-sm text-slate-300 mb-1">{t('setup.additionalBots')}</label>
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
              <p className="text-xs text-slate-500 mt-1">{t('setup.totalPlayers', { count: totalHumans + multiBots })}</p>
            </div>

            <CharacterSetPicker
              value={characterSetId}
              onChange={setCharacterSetId}
              includeRank9={includeRank9}
              onIncludeRank9Change={setIncludeRank9}
              playerCount={totalHumans + multiBots}
              onDetail={setDetailCharacter}
            />

            <button
              onClick={() => { savePlayer(); createMultiplayerRoom(setup, totalHumans, multiBots); }}
              disabled={!detailsReady || totalHumans + multiBots < 2 || totalHumans + multiBots > 7}
              className="w-full py-3 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
            >
              {t('setup.createRoom')}
            </button>
          </div>
        )}

        {tab === 'join' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-300 mb-1">{t('setup.roomCode')}</label>
              <input
                type="text"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                placeholder={t('setup.roomCodePlaceholder')}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 uppercase tracking-widest text-center text-lg"
                maxLength={6}
              />
            </div>
            <p className="text-[11px] text-slate-500">{t('setup.hostPicksSet')}</p>
            <button
              onClick={() => { savePlayer(); joinRoom(joinCode, playerName.trim() || 'Player', parsedAge); }}
              disabled={!detailsReady || joinCode.length < 4}
              className="w-full py-3 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
            >
              {t('setup.joinGame')}
            </button>
          </div>
        )}

        {tab === 'load' && (
          <div className="space-y-4">
            {savedGames.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">{t('setup.noSavedGames')}</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {savedGames.map(id => (
                  <button
                    key={id}
                    onClick={() => { savePlayer(); loadGame(id, playerName.trim() || 'Player'); }}
                    className="w-full px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-left text-sm transition-colors"
                  >
                    {t('setup.savedGame', { id })}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Room code display */}
        {roomId && !gameView && (
          <div className="mt-4 p-4 bg-slate-900/50 rounded-lg text-center">
            <p className="text-sm text-slate-400 mb-1">{t('setup.roomCode')}</p>
            <p className="text-2xl font-bold text-amber-400 tracking-widest">{roomId}</p>
            <p className="text-xs text-slate-500 mt-1">{t('lobby.shareCode')}</p>
          </div>
        )}

        {/* Error display */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 p-3 bg-red-900/30 border border-red-700 rounded-lg text-sm text-red-300"
          >
            {t.error(error)}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
