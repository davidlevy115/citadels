'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { RoundEvent, Character } from '@citadels/game-logic';
import { useT } from '@/hooks/useI18n';
import type { Translator } from '@/lib/i18n';

interface RoundEventsProps {
  events: RoundEvent[];
  murderedCharacter: number | null;
  robbedCharacter: number | null;
  bewitchedCharacter?: number | null;
  myCharacter: Character | null;
  cast?: Character[];
}

const EVENT_STYLES: Record<RoundEvent['type'], { icon: string; color: string; bg: string; border: string }> = {
  murder:     { icon: '\u2620', color: 'text-red-300',    bg: 'bg-red-950/60',    border: 'border-red-800' },
  steal:      { icon: '\u2666', color: 'text-amber-300',  bg: 'bg-amber-950/60',  border: 'border-amber-800' },
  swap:       { icon: '\u2728', color: 'text-indigo-300', bg: 'bg-indigo-950/60', border: 'border-indigo-800' },
  destroy:    { icon: '\u2694', color: 'text-red-400',    bg: 'bg-red-950/60',    border: 'border-red-800' },
  bewitch:    { icon: '\u2698', color: 'text-purple-300', bg: 'bg-purple-950/60', border: 'border-purple-800' },
  confiscate: { icon: '\u00a7', color: 'text-amber-200',  bg: 'bg-amber-950/60',  border: 'border-amber-700' },
  blackmail:  { icon: '\u2709', color: 'text-rose-300',   bg: 'bg-rose-950/60',   border: 'border-rose-800' },
  seize:      { icon: '\u2691', color: 'text-red-300',    bg: 'bg-red-950/60',    border: 'border-red-800' },
  exchange:   { icon: '\u21c4', color: 'text-orange-300', bg: 'bg-orange-950/60', border: 'border-orange-800' },
  spy:        { icon: '\u25c9', color: 'text-cyan-300',   bg: 'bg-cyan-950/60',   border: 'border-cyan-800' },
};

/** Every event reads from the catalogue, so the feed follows the reader's language. */
function formatEvent(t: Translator, event: RoundEvent): string {
  const { actorName: player, targetPlayerName: target, targetCharacter: character, detail, detail2 } = event;

  switch (event.type) {
    case 'murder':
      return t('event.murder', { player, character: character ?? '' });
    case 'steal':
      return target
        ? t('event.stealResolved', { player, character: character ?? '', amount: detail ?? '', target })
        : t('event.steal', { player, character: character ?? '' });
    case 'swap':
      return t('event.swap', { player, target: target ?? '' });
    case 'destroy':
      return t('event.destroy', { player, district: detail ?? '', target: target ?? '' });
    case 'bewitch':
      return t('event.bewitch', { player, character: character ?? '' });
    case 'confiscate':
      return t('event.confiscate', { player, district: detail ?? '', target: target ?? '' });
    case 'blackmail':
      return t('event.blackmail', { player, amount: detail ?? '', target: target ?? '' });
    case 'seize':
      return t('event.seize', { player, district: detail ?? '', target: target ?? '' });
    case 'exchange':
      return t('event.exchange', { player, district: detail ?? '', district2: detail2 ?? '', target: target ?? '' });
    case 'spy':
      return t('event.spy', { player, target: target ?? '' });
    default:
      return '';
  }
}

export function RoundEvents({
  events, murderedCharacter, robbedCharacter, bewitchedCharacter, myCharacter, cast,
}: RoundEventsProps) {
  const t = useT();
  const myRank = myCharacter?.rank;
  const iMurdered = myRank != null && murderedCharacter === myRank;
  const iRobbed = myRank != null && robbedCharacter === myRank;
  const iBewitched = myRank != null && bewitchedCharacter === myRank;

  if (events.length === 0 && !iMurdered && !iRobbed && !iBewitched) return null;

  return (
    <div className="space-y-2">
      {/* Personal alert: murdered */}
      <AnimatePresence>
        {iMurdered && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="bg-red-900/80 border-2 border-red-500 rounded-xl px-4 py-3 text-center shadow-lg shadow-red-500/20"
          >
            <div className="text-2xl mb-1">{'\u2620'}</div>
            <div className="text-red-200 font-bold text-sm">{t('event.youMurderedTitle')}</div>
            <div className="text-red-400 text-xs mt-1">{t('event.youMurderedBody', { character: myCharacter?.name ?? '' })}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Personal alert: robbed */}
      <AnimatePresence>
        {iRobbed && !iMurdered && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="bg-amber-900/80 border-2 border-amber-500 rounded-xl px-4 py-3 text-center shadow-lg shadow-amber-500/20"
          >
            <div className="text-2xl mb-1">{'\u2666'}</div>
            <div className="text-amber-200 font-bold text-sm">{t('event.youRobbedTitle')}</div>
            <div className="text-amber-400 text-xs mt-1">{t('event.youRobbedBody')}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Personal alert: bewitched */}
      <AnimatePresence>
        {iBewitched && !iMurdered && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="bg-purple-900/80 border-2 border-purple-500 rounded-xl px-4 py-3 text-center shadow-lg shadow-purple-500/20"
          >
            <div className="text-2xl mb-1">⚘</div>
            <div className="text-purple-200 font-bold text-sm">{t('event.youBewitchedTitle')}</div>
            <div className="text-purple-300 text-xs mt-1">
              {t('event.youBewitchedBody', { character: myCharacter?.name ?? '' })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Event feed */}
      <div className="flex flex-wrap gap-2 justify-center">
        <AnimatePresence>
          {events.map((event, i) => {
            const style = EVENT_STYLES[event.type];
            // Highlight events targeting me
            const targetsMe =
              (event.type === 'murder' && iMurdered) ||
              (event.type === 'steal' && iRobbed) ||
              (event.type === 'destroy' && event.targetPlayerName && myCharacter &&
                events.some(e => e.targetPlayerName === event.targetPlayerName));

            return (
              <motion.div
                key={`${event.type}-${event.actorName}-${i}`}
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`
                  inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs
                  ${style.bg} ${style.border}
                  ${targetsMe ? 'ring-1 ring-white/30' : ''}
                `}
              >
                <span className="text-base">{style.icon}</span>
                <span className={style.color}>{formatEvent(t, event)}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
