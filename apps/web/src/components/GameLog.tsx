'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { LogEntry } from '@citadels/game-logic';

interface GameLogProps {
  log: LogEntry[];
  currentRound: number;
}

const ROUND_HEADER = /^Round (\d+):/;

interface RoundSlice {
  round: number;
  entries: LogEntry[];
}

/**
 * The most recent round that actually has something in it. Early in a round
 * only the header exists, so we fall back to the round before it rather than
 * showing an empty panel.
 */
function latestRoundWithEntries(log: LogEntry[]): RoundSlice | null {
  const slices: RoundSlice[] = [];
  let current: RoundSlice | null = null;

  for (const entry of log) {
    const header = entry.message.match(ROUND_HEADER);
    if (header) {
      current = { round: parseInt(header[1], 10), entries: [] };
      slices.push(current);
      continue;
    }
    if (current) current.entries.push(entry);
  }

  for (let i = slices.length - 1; i >= 0; i--) {
    if (slices[i].entries.length > 0) return slices[i];
  }
  return null;
}

export function GameLog({ log, currentRound }: GameLogProps) {
  const [expanded, setExpanded] = useState(false);
  const slice = latestRoundWithEntries(log);

  if (!slice) return null;

  // Newest first, so the latest action is always the top line.
  const entries = [...slice.entries].reverse();

  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition-colors mx-auto"
      >
        <span>{expanded ? '▼' : '▶'}</span>
        <span>Round {slice.round} log</span>
        <span className="text-slate-600">({entries.length})</span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 max-h-48 overflow-y-auto space-y-0.5 px-1">
              <div className="text-[10px] font-bold text-amber-400/70 uppercase tracking-wide sticky top-0 bg-[#1a3a2a] py-0.5">
                Round {slice.round}
                {slice.round !== currentRound && (
                  <span className="ml-1 text-slate-500 normal-case font-normal">(previous)</span>
                )}
              </div>
              {entries.map((entry, i) => (
                <div
                  key={`${entry.timestamp}-${i}`}
                  className={`text-[10px] leading-relaxed pl-2 border-l ${
                    i === 0
                      ? 'text-slate-200 border-amber-500/60'
                      : 'text-slate-400 border-slate-700/50'
                  }`}
                >
                  {entry.message}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
