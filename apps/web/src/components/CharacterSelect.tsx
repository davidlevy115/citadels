'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { Character } from '@citadels/game-logic';
import { CharacterCardView } from './Card';

interface CharacterSelectProps {
  characters: Character[];
  removedFaceUp: Character[];
  onSelect: (rank: number) => void;
  onDetail?: (character: Character) => void;
}

export function CharacterSelect({ characters, removedFaceUp, onSelect, onDetail }: CharacterSelectProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
    >
      <div className="bg-slate-800 rounded-xl p-6 max-w-4xl w-full mx-4 border border-slate-600">
        <h2 className="text-xl font-bold text-center mb-2">Choose Your Character</h2>
        <p className="text-slate-400 text-sm text-center mb-4">
          Click to select. Your choice is secret.
        </p>

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
