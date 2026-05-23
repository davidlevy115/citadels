'use client';

import { motion } from 'framer-motion';
import type { PlayerPublicInfo } from '@citadels/game-logic';

interface PlayerInfoProps {
  player: PlayerPublicInfo;
  isMe: boolean;
  hasCrown: boolean;
  isActive: boolean;
  onCharacterClick?: () => void;
}

export function PlayerInfo({ player, isMe, hasCrown, isActive, onCharacterClick }: PlayerInfoProps) {
  return (
    <motion.div
      animate={isActive ? { scale: [1, 1.02, 1] } : {}}
      transition={{ repeat: isActive ? Infinity : 0, duration: 2 }}
      className={`
        rounded-lg p-3 border transition-colors
        ${isActive ? 'border-yellow-400 bg-slate-700/80' : 'border-slate-600 bg-slate-800/60'}
        ${isMe ? 'ring-1 ring-cyan-500/50' : ''}
      `}
    >
      <div className="flex items-center gap-2 mb-1">
        {hasCrown && <span className="text-yellow-400 text-lg" title="Has the Crown">&#9813;</span>}
        <span className={`font-semibold text-sm ${isMe ? 'text-cyan-300' : ''}`}>
          {player.name} {isMe && '(You)'} {player.isBot && <span className="text-xs text-slate-400">[Bot]</span>}
        </span>
      </div>

      <div className="flex items-center gap-3 text-xs text-slate-300">
        <span title="Gold">&#9733; {player.gold}</span>
        <span title="Cards in hand">&#9830; {player.handSize}</span>
        <span title="Districts built">&#9962; {player.city.length}</span>
      </div>

      {player.revealedCharacter && (
        <button
          onClick={onCharacterClick}
          className="mt-1 text-xs text-amber-300 hover:text-amber-200 underline decoration-dotted underline-offset-2 transition-colors"
        >
          {player.revealedCharacter.name} (#{player.revealedCharacter.rank})
        </button>
      )}
    </motion.div>
  );
}
