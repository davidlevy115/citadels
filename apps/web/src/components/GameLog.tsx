'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { LogEntry } from '@citadels/game-logic';

interface GameLogProps {
  log: LogEntry[];
  currentRound: number;
}

interface RoundGroup {
  round: number;
  entries: LogEntry[];
}

function groupByRound(log: LogEntry[]): RoundGroup[] {
  const groups: RoundGroup[] = [];
  let currentRound = 0;

  for (const entry of log) {
    const roundMatch = entry.message.match(/^Round (\d+):/);
    if (roundMatch) {
      currentRound = parseInt(roundMatch[1], 10);
    }
    if (currentRound === 0) {
      // Pre-round entries (game start)
      if (groups.length === 0 || groups[0].round !== 0) {
        groups.unshift({ round: 0, entries: [] });
      }
      groups[0].entries.push(entry);
    } else {
      let group = groups.find(g => g.round === currentRound);
      if (!group) {
        group = { round: currentRound, entries: [] };
        groups.push(group);
      }
      group.entries.push(entry);
    }
  }

  return groups.sort((a, b) => b.round - a.round);
}

export function GameLog({ log, currentRound }: GameLogProps) {
  const [expanded, setExpanded] = useState(false);
  const groups = groupByRound(log);
  // Show last 2 rounds
  const visibleGroups = groups.filter(g => g.round >= currentRound - 1 && g.round > 0);

  if (log.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition-colors mx-auto"
      >
        <span>{expanded ? '\u25BC' : '\u25B6'}</span>
        <span>Game Log</span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 max-h-48 overflow-y-auto space-y-2 px-1">
              {visibleGroups.map(group => (
                <div key={group.round} className="space-y-0.5">
                  <div className="text-[10px] font-bold text-amber-400/70 uppercase tracking-wide sticky top-0 bg-[#1a3a2a] py-0.5">
                    Round {group.round}
                  </div>
                  {group.entries
                    .filter(e => !e.message.match(/^Round \d+:/))
                    .map((entry, i) => (
                      <div key={i} className="text-[10px] text-slate-400 leading-relaxed pl-2 border-l border-slate-700/50">
                        {entry.message}
                      </div>
                    ))}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
