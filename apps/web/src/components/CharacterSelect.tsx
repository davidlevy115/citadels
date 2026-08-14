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
  /** Markers placed by the Magistrate / Blackmailer — public, but their meaning is not. */
  warrantedRanks?: number[];
  threatenedRanks?: number[];
  onSelect: (rank: number) => void;
  onDetail?: (character: Character) => void;
}

export function CharacterSelect({
  characters, removedFaceUp, players, myIndex, crownPlayerIndex,
  warrantedRanks = [], threatenedRanks = [], onSelect, onDetail,
}: CharacterSelectProps) {
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
                  <div className="flex flex-wrap gap-0.5 max-w-[60px]">
                    {p.city.map((d, idx) => (
                      <div
                        key={idx}
                        title={`${d.name} (${d.type})`}
                        className={`w-2 h-2 rounded-full ${
                          d.type === 'noble' ? 'bg-yellow-500' :
                          d.type === 'religious' ? 'bg-blue-500' :
                          d.type === 'trade' ? 'bg-green-500' :
                          d.type === 'military' ? 'bg-red-500' :
                          'bg-purple-500'
                        }`}
                      />
                    ))}
                  </div>
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

        {(warrantedRanks.length > 0 || threatenedRanks.length > 0) && (
          <p className="text-[11px] text-slate-400 text-center mb-3">
            {warrantedRanks.length > 0 && (
              <span className="mr-3">
                <span className="text-amber-400">§</span> Warrant on rank {warrantedRanks.sort((a, b) => a - b).join(', ')}
              </span>
            )}
            {threatenedRanks.length > 0 && (
              <span>
                <span className="text-rose-400">✉</span> Threat on rank {threatenedRanks.sort((a, b) => a - b).join(', ')}
              </span>
            )}
          </p>
        )}

        <div className="flex flex-wrap gap-3 justify-center">
          <AnimatePresence>
            {characters.map((char, i) => (
              <motion.div
                key={char.rank}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="relative"
              >
                <CharacterCardView
                  character={char}
                  onClick={() => onSelect(char.rank)}
                  onDetail={onDetail ? () => onDetail(char) : undefined}
                />
                {(warrantedRanks.includes(char.rank) || threatenedRanks.includes(char.rank)) && (
                  <div className="absolute -top-1.5 -right-1.5 flex gap-0.5 z-10">
                    {warrantedRanks.includes(char.rank) && (
                      <span title="A warrant marker sits on this character"
                        className="w-5 h-5 rounded-full bg-amber-600 border border-amber-300 text-[10px] font-bold flex items-center justify-center shadow">
                        §
                      </span>
                    )}
                    {threatenedRanks.includes(char.rank) && (
                      <span title="A threat marker sits on this character"
                        className="w-5 h-5 rounded-full bg-rose-700 border border-rose-300 text-[10px] font-bold flex items-center justify-center shadow">
                        ✉
                      </span>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
