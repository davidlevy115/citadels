'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { Character, PlayerPublicInfo } from '@citadels/game-logic';
import { CharacterCardView } from './Card';

interface CharacterSelectProps {
  characters: Character[];
  removedFaceUp: Character[];
  players: PlayerPublicInfo[];
  myIndex: number;
  crownPlayerIndex: number;
  onSelect: (rank: number) => void;
  onDetail?: (character: Character) => void;
}

export function CharacterSelect({ characters, removedFaceUp, players, myIndex, crownPlayerIndex, onSelect, onDetail }: CharacterSelectProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
    >
      <div className="bg-slate-800 rounded-xl p-6 max-w-4xl w-full mx-4 border border-slate-600 max-h-[90dvh] overflow-y-auto">
        <h2 className="text-xl font-bold text-center mb-2">Choose Your Character</h2>
        <p className="text-slate-400 text-sm text-center mb-3">
          Click to select. Your choice is secret.
        </p>

        {/* Player resources summary */}
        <div className="mb-4 flex flex-wrap gap-2 justify-center">
          {players.map((p, i) => {
            const isMe = i === myIndex;
            const hasCrown = i === crownPlayerIndex;
            return (
              <div
                key={p.id}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs ${
                  isMe ? 'bg-cyan-900/40 border border-cyan-700/50' : 'bg-slate-700/50 border border-slate-600/50'
                }`}
              >
                {hasCrown && <span className="text-yellow-400 text-[10px]">&#9813;</span>}
                <span className={`font-medium truncate max-w-[80px] ${isMe ? 'text-cyan-300' : 'text-slate-300'}`}>
                  {isMe ? 'You' : p.name}
                </span>
                <span className="text-yellow-400 tabular-nums">{p.gold}g</span>
                <span className="text-slate-400 tabular-nums">{p.handSize}c</span>
                {p.city.length > 0 && (
                  <span className="text-emerald-400 tabular-nums">{p.city.length}d</span>
                )}
              </div>
            );
          })}
        </div>

        {removedFaceUp.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-slate-500 mb-2 text-center">Removed (face up):</p>
            <div className="flex gap-2 justify-center">
              {removedFaceUp.map(c => (
                <CharacterCardView
                  key={c.rank}
                  character={c}
                  disabled
                  small
                  onDetail={onDetail ? () => onDetail(c) : undefined}
                />
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3 justify-center">
          <AnimatePresence>
            {characters.map((char, i) => (
              <motion.div
                key={char.rank}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <CharacterCardView
                  character={char}
                  onClick={() => onSelect(char.rank)}
                  onDetail={onDetail ? () => onDetail(char) : undefined}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
