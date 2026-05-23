'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PlayerPublicInfo, BuiltDistrict, Character, LogEntry } from '@citadels/game-logic';
import { DistrictCardView } from './Card';
import { getCharacterImagePath, CHARACTER_ICON } from '@/lib/cardImages';

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
  const [cityExpanded, setCityExpanded] = useState(false);
  const char = player.revealedCharacter;
  const charIcon = char ? (CHARACTER_ICON[char.name] || '\u2726') : null;

  return (
    <div
      className={`
        relative rounded-lg overflow-hidden select-none
        ${isActive ? 'ring-2 ring-yellow-400/80 shadow-lg shadow-yellow-500/20' : isMe ? 'ring-1 ring-cyan-400/40' : ''}
        ${isMurdered ? 'opacity-50' : ''}
      `}
      style={{
        background: 'linear-gradient(180deg, rgba(60,40,28,0.95) 0%, rgba(30,20,12,0.95) 100%)',
        border: '1px solid rgba(100,70,40,0.5)',
      }}
    >
      {isActive && (
        <motion.div
          className="absolute inset-0 rounded-lg pointer-events-none"
          style={{ border: '2px solid rgba(250,204,21,0.5)' }}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ repeat: Infinity, duration: 2 }}
        />
      )}

      <div className="p-2">
        {/* Row 1: Portrait + Name + Gold */}
        <div className="flex items-center gap-2">
          <button onClick={onCharacterClick} className="shrink-0">
            <div className={`w-9 h-9 rounded-full overflow-hidden border-2 ${
              isActive ? 'border-yellow-400' : char ? 'border-amber-700' : 'border-slate-600'
            }`}>
              {char && !charImgError ? (
                <img src={getCharacterImagePath(char.name)} alt={char.name}
                  className="w-full h-full object-cover" onError={() => setCharImgError(true)} />
              ) : char ? (
                <div className="w-full h-full bg-slate-800 flex items-center justify-center text-sm">{charIcon}</div>
              ) : (
                <div className="w-full h-full bg-slate-800 flex items-center justify-center text-slate-600 text-sm">?</div>
              )}
            </div>
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              {hasCrown && <span className="text-yellow-400 text-sm">&#9813;</span>}
              <span className={`text-xs font-bold truncate ${isMe ? 'text-cyan-300' : 'text-amber-100'}`}>{player.name}</span>
              {player.isBot && <span className="text-[9px] text-slate-500">BOT</span>}
            </div>
            {char && <div className="text-[10px] text-amber-400/80 truncate">{char.name}</div>}
            {isMurdered && <div className="text-[10px] text-red-400">{'\u2620'} Murdered</div>}
            {isRobbed && !isMurdered && <div className="text-[10px] text-amber-400">{'\u2666'} Robbed</div>}
          </div>

          <div className="shrink-0 text-right">
            <div className="flex items-center gap-1 justify-end">
              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-yellow-300 to-amber-500 flex items-center justify-center shadow-sm">
                <span className="text-[7px] font-black text-yellow-900">G</span>
              </div>
              <span className="text-sm font-bold text-amber-200 tabular-nums">{player.gold}</span>
            </div>
            <div className="flex items-center gap-0.5 justify-end mt-0.5">
              <div className="w-3 h-3.5 rounded-[2px] bg-slate-500/60 border border-slate-400/30" />
              <span className="text-[10px] text-slate-400 tabular-nums">{player.handSize}</span>
            </div>
          </div>
        </div>

        {/* Latest action */}
        {latestActions.length > 0 && (
          <div className="mt-1 text-[10px] text-slate-400 truncate pl-11">
            <span className="text-slate-600">&rsaquo;</span> {latestActions[0]}
          </div>
        )}

        {/* City: colored dots (mobile) + toggle to expand, always expanded on lg */}
        {player.city.length > 0 && (
          <div className="mt-1.5 pl-11">
            {/* Dots row — clickable to toggle on mobile, hidden on lg */}
            <button
              onClick={() => setCityExpanded(!cityExpanded)}
              className="flex items-center gap-0.5 lg:hidden"
            >
              {player.city.map(d => {
                const col = { noble: 'bg-yellow-500', religious: 'bg-blue-500', trade: 'bg-green-500', military: 'bg-red-500', special: 'bg-purple-500' }[d.type] || 'bg-slate-500';
                return <div key={d.id} className={`w-3.5 h-4 rounded-[2px] ${col} opacity-80 border border-white/10`} />;
              })}
              <span className="text-[9px] text-slate-500 ml-1">{player.city.length}/8</span>
              <span className="text-[9px] text-slate-600 ml-0.5">{cityExpanded ? '\u25B2' : '\u25BC'}</span>
            </button>

            {/* Expanded cards — always visible on lg, toggled on mobile */}
            <div className={`${cityExpanded ? 'block' : 'hidden'} lg:block mt-1`}>
              <div className="flex flex-wrap gap-1">
                {player.city.map(d => (
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

            {/* Count label on lg when cards are shown */}
            <div className="hidden lg:block text-[9px] text-slate-500 mt-0.5">{player.city.length}/8 districts</div>
          </div>
        )}
      </div>
    </div>
  );
}

export function getPlayerActions(log: LogEntry[], playerName: string, maxActions = 2): string[] {
  const actions: string[] = [];
  for (let i = log.length - 1; i >= 0 && actions.length < maxActions; i--) {
    const msg = log[i].message;
    if (msg.startsWith(playerName + ' ')) {
      actions.push(msg.slice(playerName.length + 1));
    } else if (msg.includes(playerName) && !msg.startsWith('Round') && !msg.startsWith('Game') && !msg.startsWith('Character')) {
      actions.push(msg);
    }
  }
  return actions;
}
