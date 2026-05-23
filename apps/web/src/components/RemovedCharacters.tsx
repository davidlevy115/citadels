'use client';

import { motion } from 'framer-motion';
import type { Character } from '@citadels/game-logic';
import { CharacterCardView } from './Card';
import { CHARACTER_ICON } from '@/lib/cardImages';

interface RemovedCharactersProps {
  faceUp: Character[];
  faceDownCount: number;
  onCharacterClick?: (character: Character) => void;
}

function FaceDownCard({ index }: { index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, rotateY: 180 }}
      animate={{ opacity: 1, rotateY: 0 }}
      transition={{ delay: index * 0.1 }}
      className="w-[52px] h-[72px] rounded-lg border-2 border-slate-600 overflow-hidden select-none"
      style={{
        background: `
          repeating-linear-gradient(
            45deg,
            #1e293b,
            #1e293b 4px,
            #334155 4px,
            #334155 8px
          )`,
        boxShadow: 'inset 0 0 12px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.3)',
      }}
    >
      <div className="w-full h-full flex items-center justify-center">
        <div
          className="w-9 h-9 rounded-full border border-slate-500/40 flex items-center justify-center"
          style={{
            background: 'radial-gradient(circle, #475569 0%, #1e293b 100%)',
          }}
        >
          <span className="text-slate-400 text-lg">?</span>
        </div>
      </div>
    </motion.div>
  );
}

export function RemovedCharacters({ faceUp, faceDownCount, onCharacterClick }: RemovedCharactersProps) {
  if (faceUp.length === 0 && faceDownCount === 0) return null;

  return (
    <div className="flex items-start gap-4 justify-center">
      {/* Face-down cards */}
      {faceDownCount > 0 && (
        <div>
          <div className="text-[10px] text-slate-500 text-center mb-1.5 uppercase tracking-wider">
            Hidden ({faceDownCount})
          </div>
          <div className="flex gap-1.5 justify-center">
            {Array.from({ length: faceDownCount }, (_, i) => (
              <FaceDownCard key={i} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* Divider */}
      {faceUp.length > 0 && faceDownCount > 0 && (
        <div className="h-20 w-px bg-slate-700 self-center" />
      )}

      {/* Face-up cards */}
      {faceUp.length > 0 && (
        <div>
          <div className="text-[10px] text-slate-500 text-center mb-1.5 uppercase tracking-wider">
            Out of play ({faceUp.length})
          </div>
          <div className="flex gap-1.5 justify-center">
            {faceUp.map((char) => (
              <motion.div
                key={char.rank}
                initial={{ opacity: 0, rotateY: -180 }}
                animate={{ opacity: 1, rotateY: 0 }}
                transition={{ delay: 0.2 }}
              >
                <CharacterCardView
                  character={char}
                  small
                  disabled
                  onDetail={onCharacterClick ? () => onCharacterClick(char) : undefined}
                />
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
