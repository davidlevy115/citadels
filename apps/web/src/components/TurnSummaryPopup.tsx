'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { BotTurnSummary } from '@citadels/game-logic';
import { getCharacterImagePath, CHARACTER_ICON } from '@/lib/cardImages';
import { useT } from '@/hooks/useI18n';

/** How long a recap stays up before closing itself. */
const DISPLAY_MS = 10_000;

export type LiveTurnSummary = BotTurnSummary & { id: string };

interface TurnSummaryPopupProps {
  /** The turn the server is currently showing the table, if any. */
  summary: LiveTurnSummary | null;
  /** Dismiss it — the game resumes once every player has done so. */
  onDismiss: (summaryId: string) => void;
}

/**
 * Shows the turn that just finished. The server holds the game here until every
 * player has dismissed it, so a recap always describes what just happened
 * rather than something several turns ago.
 */
export function TurnSummaryPopup({ summary, onDismiss }: TurnSummaryPopupProps) {
  const t = useT();
  const [imgError, setImgError] = useState(false);
  const id = summary?.id ?? null;

  useEffect(() => {
    setImgError(false);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const timer = setTimeout(() => onDismiss(id), DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [id, onDismiss]);

  return (
    <div className="fixed inset-x-0 top-12 z-40 flex justify-center px-3 pointer-events-none">
      <AnimatePresence mode="wait">
        {summary && (
          <motion.div
            key={summary.id}
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ type: 'spring', damping: 24, stiffness: 320 }}
            className="w-full max-w-sm rounded-xl border border-amber-700/60 shadow-2xl overflow-hidden"
            style={{ background: 'linear-gradient(180deg, rgba(42,28,18,0.97) 0%, rgba(22,14,9,0.97) 100%)' }}
          >
            <div className="flex items-center gap-2 px-3 py-2 border-b border-amber-900/50">
              <div className="w-8 h-8 rounded-full overflow-hidden border border-amber-700/70 shrink-0 bg-slate-900">
                {!imgError ? (
                  <img
                    src={getCharacterImagePath(summary.characterName)}
                    alt={summary.characterName}
                    className="w-full h-full object-cover"
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm">
                    {CHARACTER_ICON[summary.characterName] ?? '✦'}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-amber-100 truncate">{summary.playerName}</div>
                <div className="text-[10px] text-amber-400/80 truncate">
                  {t.character(summary.characterName)} <span className="text-amber-700">#{summary.characterRank}</span>
                </div>
              </div>

              <button
                onClick={() => onDismiss(summary.id)}
                aria-label={t('recap.close')}
                title={t('recap.closeTitle')}
                className="pointer-events-auto ml-auto shrink-0 w-6 h-6 rounded-full bg-black/30 hover:bg-black/60 text-slate-400 hover:text-amber-200 flex items-center justify-center text-sm leading-none transition-colors"
              >
                ×
              </button>
            </div>

            <ul className="px-3 py-2 space-y-0.5">
              {summary.actions.map((action, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="text-[11px] text-slate-300 leading-snug"
                >
                  <span className="text-amber-700/80 mr-1">›</span>
                  {t.log(action)}
                </motion.li>
              ))}
            </ul>

            {/* Drains over the ten seconds, so the wait is visible */}
            <motion.div
              className="h-0.5 bg-amber-600/70 origin-left"
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: DISPLAY_MS / 1000, ease: 'linear' }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
