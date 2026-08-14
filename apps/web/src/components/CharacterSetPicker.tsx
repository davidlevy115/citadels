'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CHARACTER_SETS, getCharacterByName, ALL_CHARACTERS } from '@citadels/game-logic';
import type { Character } from '@citadels/game-logic';

interface CharacterSetPickerProps {
  value: string;
  onChange: (setId: string) => void;
  includeRank9: boolean;
  onIncludeRank9Change: (include: boolean) => void;
  /** Total players at the table — the Queen needs at least five. */
  playerCount: number;
  onDetail?: (character: Character) => void;
}

export function CharacterSetPicker({
  value, onChange, includeRank9, onIncludeRank9Change, playerCount, onDetail,
}: CharacterSetPickerProps) {
  const [expanded, setExpanded] = useState(false);
  const selected = CHARACTER_SETS.find(s => s.id === value) ?? CHARACTER_SETS[0];

  const rank9 = selected.rank9 ? getCharacterByName(selected.rank9) : null;
  const rank9Blocked = !!rank9 && rank9.name === 'Queen' && playerCount < 5;
  const rank9Available = selected.isRandom
    ? ALL_CHARACTERS.filter(c => c.rank === 9)
    : rank9 ? [rank9] : [];

  return (
    <div>
      <label className="block text-sm text-slate-300 mb-1">Characters</label>

      <div className="space-y-1.5">
        {CHARACTER_SETS.map(set => {
          const isSelected = set.id === value;
          return (
            <button
              key={set.id}
              onClick={() => onChange(set.id)}
              className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                isSelected
                  ? 'bg-amber-900/40 border-amber-600'
                  : 'bg-slate-700/40 border-slate-600/50 hover:bg-slate-700/70'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isSelected ? 'bg-amber-400' : 'bg-slate-600'}`} />
                <span className={`text-sm font-medium ${isSelected ? 'text-amber-200' : 'text-slate-300'}`}>
                  {set.name}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 pl-[18px] leading-snug">{set.blurb}</p>
            </button>
          );
        })}
      </div>

      {/* Roster preview */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-2 flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
      >
        <span>{expanded ? '▼' : '▶'}</span>
        <span>{selected.isRandom ? 'Drawn when the game starts' : 'Show the cast'}</span>
      </button>

      <AnimatePresence>
        {expanded && !selected.isRandom && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-1 bg-slate-900/50 rounded-lg p-2.5">
              {selected.characters.map(name => {
                const char = getCharacterByName(name);
                return (
                  <button
                    key={name}
                    onClick={() => onDetail?.(char)}
                    className="w-full flex gap-2 text-left group"
                  >
                    <span className="text-[10px] text-slate-600 font-mono w-3 shrink-0 pt-0.5">{char.rank}</span>
                    <span className="text-[11px] text-amber-300/90 w-20 shrink-0 group-hover:text-amber-200">{char.name}</span>
                    <span className="text-[10px] text-slate-500 leading-snug flex-1">{char.description}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rank 9 toggle */}
      {rank9Available.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => !rank9Blocked && onIncludeRank9Change(!includeRank9)}
            disabled={rank9Blocked}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-colors ${
              rank9Blocked
                ? 'bg-slate-800/40 border-slate-700/50 cursor-not-allowed'
                : includeRank9
                  ? 'bg-amber-900/40 border-amber-600'
                  : 'bg-slate-700/40 border-slate-600/50 hover:bg-slate-700/70'
            }`}
          >
            <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
              includeRank9 && !rank9Blocked ? 'bg-amber-500 border-amber-400' : 'border-slate-500'
            }`}>
              {includeRank9 && !rank9Blocked && <span className="text-[10px] text-slate-900 font-bold">✓</span>}
            </div>
            <div className="text-left min-w-0">
              <div className={`text-xs font-medium ${rank9Blocked ? 'text-slate-500' : 'text-slate-200'}`}>
                Add the rank 9 character
                {!selected.isRandom && rank9 && <span className="text-amber-400/80"> — {rank9.name}</span>}
              </div>
              <div className="text-[10px] text-slate-500 leading-snug">
                {rank9Blocked
                  ? 'The Queen needs 5 or more players.'
                  : selected.isRandom
                    ? 'One of the Queen, Artist or Tax Collector, drawn at random.'
                    : rank9?.description}
              </div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
