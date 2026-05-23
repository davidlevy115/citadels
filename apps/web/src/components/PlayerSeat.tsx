'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { PlayerPublicInfo, BuiltDistrict, Character, LogEntry } from '@citadels/game-logic';
import { DistrictCardView } from './Card';
import { GoldDisplay } from './GoldDisplay';
import { getCharacterImagePath, CHARACTER_ICON } from '@/lib/cardImages';
import { useState } from 'react';

interface PlayerSeatProps {
  player: PlayerPublicInfo;
  isMe: boolean;
  hasCrown: boolean;
  isActive: boolean;
  isMurdered: boolean;
  isRobbed: boolean;
  latestActions: string[];
  onCharacterClick?: () => void;
  onDistrictClick?: (d: BuiltDistrict) => void;
}

export function PlayerSeat({
  player, isMe, hasCrown, isActive, isMurdered, isRobbed, latestActions,
  onCharacterClick, onDistrictClick,
}: PlayerSeatProps) {
  const [charImgError, setCharImgError] = useState(false);
  const char = player.revealedCharacter;
  const charIcon = char ? (CHARACTER_ICON[char.name] || '\u2726') : null;

  return (
    <motion.div
      layout
      className={`
        relative rounded-xl overflow-hidden transition-all duration-300
        ${isActive
          ? 'border-2 border-yellow-400 shadow-lg shadow-yellow-500/20 bg-slate-800/90'
          : isMe
            ? 'border-2 border-cyan-500/40 bg-slate-800/80'
            : 'border border-slate-700 bg-slate-800/60'
        }
      `}
    >
      {/* Active turn glow */}
      {isActive && (
        <motion.div
          className="absolute inset-0 rounded-xl border-2 border-yellow-400 pointer-events-none"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ repeat: Infinity, duration: 2 }}
        />
      )}

      {/* Header: player name + stats */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            {hasCrown && <span className="text-yellow-400 text-base shrink-0" title="Has the Crown">&#9813;</span>}
            <span className={`font-semibold text-sm truncate ${isMe ? 'text-cyan-300' : 'text-white'}`}>
              {player.name}
            </span>
            {isMe && <span className="text-[10px] text-cyan-400/70 shrink-0">(You)</span>}
            {player.isBot && <span className="text-[10px] text-slate-500 shrink-0">BOT</span>}
          </div>

          {/* Cards in hand */}
          <div className="flex items-center gap-0.5 shrink-0" title="Cards in hand">
            <div className="w-4 h-5 rounded-sm bg-gradient-to-b from-slate-400 to-slate-500 border border-slate-300/40 shadow-sm" />
            <span className="text-xs font-semibold text-slate-300 tabular-nums">{player.handSize}</span>
          </div>
        </div>

        {/* Gold pile */}
        <div className="mt-2">
          <GoldDisplay amount={player.gold} size="sm" />
        </div>

        {/* Revealed character badge */}
        {char && (
          <button
            onClick={onCharacterClick}
            className="mt-1.5 flex items-center gap-1.5 w-full group"
          >
            {/* Mini character portrait */}
            <div className="w-7 h-7 rounded-full overflow-hidden border border-white/20 shrink-0 bg-slate-700">
              {!charImgError ? (
                <img
                  src={getCharacterImagePath(char.name)}
                  alt={char.name}
                  className="w-full h-full object-cover"
                  onError={() => setCharImgError(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs">{charIcon}</div>
              )}
            </div>
            <span className="text-xs text-amber-300 group-hover:text-amber-200 transition-colors font-medium">
              {char.name}
            </span>
            <span className="text-[10px] text-slate-500">#{char.rank}</span>
          </button>
        )}

        {/* Unrevealed character indicator */}
        {!char && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <div className="w-7 h-7 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-slate-500 text-xs">?</div>
            <span className="text-xs text-slate-500 italic">Hidden</span>
          </div>
        )}

        {/* Murder / rob status badges */}
        {isMurdered && char && (
          <div className="mt-1.5 flex items-center gap-1 px-2 py-1 bg-red-900/60 border border-red-700/60 rounded text-[10px] text-red-300 font-medium">
            <span>{'\u2620'}</span> Murdered — turn skipped
          </div>
        )}
        {isRobbed && !isMurdered && char && (
          <div className="mt-1.5 flex items-center gap-1 px-2 py-1 bg-amber-900/60 border border-amber-700/60 rounded text-[10px] text-amber-300 font-medium">
            <span>{'\u2666'}</span> Being robbed by the Thief
          </div>
        )}
      </div>

      {/* Action feed */}
      <div className="px-3 pb-2">
        <AnimatePresence mode="popLayout">
          {latestActions.length > 0 ? (
            latestActions.map((action, i) => (
              <motion.div
                key={action + i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className={`text-[11px] leading-relaxed ${i === 0 ? 'text-slate-200' : 'text-slate-500'}`}
              >
                <span className="text-slate-600 mr-1">&rsaquo;</span>
                {action}
              </motion.div>
            ))
          ) : (
            <div className="text-[11px] text-slate-600 italic">Waiting...</div>
          )}
        </AnimatePresence>
      </div>

      {/* City (built districts) */}
      {player.city.length > 0 && (
        <div className="px-2 pb-2 border-t border-slate-700/50 pt-2">
          <div className="flex flex-wrap gap-1 justify-center">
            {player.city.map((d) => (
              <DistrictCardView
                key={d.id}
                card={d}
                small
                disabled
                onDetail={onDistrictClick ? () => onDistrictClick(d) : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {/* City progress bar */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-1.5">
          <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${player.city.length >= 8 ? 'bg-amber-400' : 'bg-cyan-500'}`}
              initial={false}
              animate={{ width: `${(player.city.length / 8) * 100}%` }}
              transition={{ type: 'spring', damping: 20 }}
            />
          </div>
          <span className="text-[10px] text-slate-500">{player.city.length}/8</span>
        </div>
      </div>
    </motion.div>
  );
}

// Utility: extract the latest actions for a specific player from the log
export function getPlayerActions(log: LogEntry[], playerName: string, maxActions = 2): string[] {
  const actions: string[] = [];
  // Scan log from most recent
  for (let i = log.length - 1; i >= 0 && actions.length < maxActions; i--) {
    const msg = log[i].message;
    if (msg.startsWith(playerName + ' ')) {
      // Strip the player name prefix for cleaner display
      actions.push(msg.slice(playerName.length + 1));
    }
    // Also catch messages that reference this player (e.g., "Thief steals from PlayerName")
    else if (msg.includes(playerName) && !msg.startsWith('Round') && !msg.startsWith('Game') && !msg.startsWith('Character')) {
      actions.push(msg);
    }
  }
  return actions;
}
