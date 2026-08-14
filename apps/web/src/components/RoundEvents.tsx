'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { RoundEvent, Character } from '@citadels/game-logic';

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

function formatEvent(event: RoundEvent): string {
  switch (event.type) {
    case 'murder':
      return `${event.actorName} (Assassin) killed the ${event.targetCharacter}!`;
    case 'steal': {
      const victim = event.targetPlayerName ? ` \u2014 stole from ${event.targetPlayerName}` : '';
      const detail = event.detail ? ` (${event.detail})` : '';
      return `${event.actorName} (Thief) targets the ${event.targetCharacter}${victim}${detail}`;
    }
    case 'swap':
      return `${event.actorName} (Magician) swapped hands with ${event.targetPlayerName}`;
    case 'destroy':
      return `${event.actorName} (Warlord) destroyed ${event.detail} in ${event.targetPlayerName}'s city`;
    case 'bewitch':
      return `${event.actorName} (Witch) bewitched the ${event.targetCharacter}`;
    case 'confiscate':
      return `${event.actorName} (Magistrate) confiscated ${event.detail} from ${event.targetPlayerName}`;
    case 'blackmail':
      return `${event.actorName} (Blackmailer) took ${event.detail} from ${event.targetPlayerName}`;
    case 'seize':
      return `${event.actorName} (Marshal) seized ${event.detail} from ${event.targetPlayerName}`;
    case 'exchange':
      return `${event.actorName} (Diplomat) swapped ${event.detail} with ${event.targetPlayerName}`;
    case 'spy':
      return `${event.actorName} (Spy) looked through ${event.targetPlayerName}'s hand`;
    default:
      return '';
  }
}

export function RoundEvents({
  events, murderedCharacter, robbedCharacter, bewitchedCharacter, myCharacter, cast,
}: RoundEventsProps) {
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
            <div className="text-red-200 font-bold text-sm">You have been murdered!</div>
            <div className="text-red-400 text-xs mt-1">Your turn as {myCharacter?.name} is skipped this round.</div>
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
            <div className="text-amber-200 font-bold text-sm">You are being robbed!</div>
            <div className="text-amber-400 text-xs mt-1">The Thief will steal all your gold when your turn starts.</div>
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
            <div className="text-purple-200 font-bold text-sm">You have been bewitched!</div>
            <div className="text-purple-300 text-xs mt-1">
              You may only gather resources. The Witch then plays your {myCharacter?.name}&apos;s turn.
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
                <span className={style.color}>{formatEvent(event)}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
