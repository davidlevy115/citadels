'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { DistrictCard, Character, BuiltDistrict } from '@citadels/game-logic';
import { getDistrictImagePath, getCharacterImagePath, DISTRICT_TYPE_ICON, CHARACTER_ICON } from '@/lib/cardImages';
import { useState } from 'react';

const TYPE_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  noble: { bg: 'from-yellow-900 to-yellow-950', border: 'border-yellow-500', text: 'text-yellow-300', glow: 'shadow-yellow-500/30' },
  religious: { bg: 'from-blue-900 to-blue-950', border: 'border-blue-500', text: 'text-blue-300', glow: 'shadow-blue-500/30' },
  trade: { bg: 'from-green-900 to-green-950', border: 'border-green-500', text: 'text-green-300', glow: 'shadow-green-500/30' },
  military: { bg: 'from-red-900 to-red-950', border: 'border-red-500', text: 'text-red-300', glow: 'shadow-red-500/30' },
  special: { bg: 'from-purple-900 to-purple-950', border: 'border-purple-500', text: 'text-purple-300', glow: 'shadow-purple-500/30' },
};

const CHAR_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  Assassin: { bg: 'from-gray-900 to-black', border: 'border-gray-400', text: 'text-gray-300', glow: 'shadow-gray-500/30' },
  Thief: { bg: 'from-gray-800 to-gray-950', border: 'border-amber-500', text: 'text-amber-300', glow: 'shadow-amber-500/30' },
  Magician: { bg: 'from-indigo-900 to-indigo-950', border: 'border-indigo-400', text: 'text-indigo-300', glow: 'shadow-indigo-500/30' },
  King: { bg: 'from-yellow-800 to-yellow-950', border: 'border-yellow-400', text: 'text-yellow-300', glow: 'shadow-yellow-500/30' },
  Bishop: { bg: 'from-blue-800 to-blue-950', border: 'border-blue-400', text: 'text-blue-300', glow: 'shadow-blue-500/30' },
  Merchant: { bg: 'from-green-800 to-green-950', border: 'border-green-400', text: 'text-green-300', glow: 'shadow-green-500/30' },
  Architect: { bg: 'from-amber-800 to-amber-950', border: 'border-amber-400', text: 'text-amber-300', glow: 'shadow-amber-500/30' },
  Warlord: { bg: 'from-red-800 to-red-950', border: 'border-red-400', text: 'text-red-300', glow: 'shadow-red-500/30' },
};

const TYPE_LABELS: Record<string, string> = {
  noble: 'Noble',
  religious: 'Religious',
  trade: 'Trade',
  military: 'Military',
  special: 'Special',
};

// Full descriptions for all characters
const CHARACTER_DETAILS: Record<string, string> = {
  Assassin: 'Announce the title of another character that you wish to murder. The player who has the murdered character must say nothing, and skips their entire turn.',
  Thief: 'Announce the title of a character from whom you wish to steal. When that character is called, you take all their gold. You may not steal from the Assassin or the murdered character.',
  Magician: 'You have two options: Exchange your entire hand of cards with another player, OR discard any number of cards and draw replacements from the deck.',
  King: 'You receive the Crown and will choose first next round. Gain 1 gold for each noble (yellow) district in your city. If murdered, you still receive the Crown after all turns.',
  Bishop: 'Your districts cannot be destroyed by the Warlord. Gain 1 gold for each religious (blue) district in your city.',
  Merchant: 'After taking your action, receive 1 additional gold. Gain 1 gold for each trade (green) district in your city.',
  Architect: 'After taking your action, draw 2 additional cards. You may build up to 3 districts this turn.',
  Warlord: 'You may destroy one district by paying one less than its cost in gold. Gain 1 gold for each military (red) district in your city.',
};

// ── District Detail Modal ───────────────────────────────────────

interface DistrictDetailProps {
  card: DistrictCard | BuiltDistrict;
  onClose: () => void;
}

export function DistrictDetailModal({ card, onClose }: DistrictDetailProps) {
  const colors = TYPE_COLORS[card.type] || TYPE_COLORS.special;
  const [imgError, setImgError] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.8, opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className={`relative w-72 max-h-[85dvh] overflow-y-auto rounded-2xl border-2 bg-gradient-to-b shadow-2xl ${colors.border} ${colors.bg} ${colors.glow}`}
      >
        {/* Card image */}
        <div className="relative h-48 sm:h-64 overflow-hidden">
          {!imgError ? (
            <img
              src={getDistrictImagePath(card.name)}
              alt={card.name}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className={`w-full h-full flex items-center justify-center bg-gradient-to-b ${colors.bg}`}>
              <span className="text-6xl opacity-40">{DISTRICT_TYPE_ICON[card.type] || '\u2726'}</span>
            </div>
          )}
          {/* Gradient overlay at bottom */}
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/80 to-transparent" />

          {/* Cost badge */}
          <div className="absolute top-3 left-3 w-10 h-10 bg-yellow-400 text-black font-bold rounded-full flex items-center justify-center text-lg shadow-lg">
            {card.cost}
          </div>

          {/* Type badge */}
          <div className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-medium bg-black/50 ${colors.text}`}>
            {DISTRICT_TYPE_ICON[card.type]} {TYPE_LABELS[card.type]}
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          <h2 className="text-xl font-bold mb-1">{card.name}</h2>
          <div className={`text-xs font-medium mb-3 ${colors.text}`}>
            {TYPE_LABELS[card.type]} District &middot; Cost {card.cost}
          </div>

          {card.description ? (
            <p className="text-sm text-slate-300 leading-relaxed">{card.description}</p>
          ) : (
            <p className="text-sm text-slate-400 italic">
              A {TYPE_LABELS[card.type].toLowerCase()} district worth {card.cost} point{card.cost !== 1 ? 's' : ''} at end of game.
              {card.name === 'Dragon Gate' || card.name === 'University'
                ? ' Worth 8 points instead of 6.'
                : ''}
            </p>
          )}
        </div>

        {/* Close hint */}
        <div className="text-center pb-3 text-xs text-slate-500">Tap anywhere to close</div>
      </motion.div>
    </motion.div>
  );
}

// ── Character Detail Modal ──────────────────────────────────────

interface CharacterDetailProps {
  character: Character;
  onClose: () => void;
}

export function CharacterDetailModal({ character, onClose }: CharacterDetailProps) {
  const colors = CHAR_COLORS[character.name] || CHAR_COLORS.Assassin;
  const [imgError, setImgError] = useState(false);
  const fullDescription = CHARACTER_DETAILS[character.name] || character.description;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.8, opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className={`relative w-72 max-h-[85dvh] overflow-y-auto rounded-2xl border-2 bg-gradient-to-b shadow-2xl ${colors.border} ${colors.bg} ${colors.glow}`}
      >
        {/* Character image */}
        <div className="relative h-48 sm:h-72 overflow-hidden">
          {!imgError ? (
            <img
              src={getCharacterImagePath(character.name)}
              alt={character.name}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className={`w-full h-full flex items-center justify-center bg-gradient-to-b ${colors.bg}`}>
              <span className="text-6xl opacity-40">{CHARACTER_ICON[character.name] || '\u2726'}</span>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/90 to-transparent" />

          {/* Rank badge */}
          <div className="absolute top-3 left-3 w-10 h-10 bg-white/20 backdrop-blur text-white font-bold rounded-full flex items-center justify-center text-lg border border-white/30">
            {character.rank}
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          <h2 className="text-xl font-bold mb-1">{character.name}</h2>
          <div className={`text-xs font-medium mb-3 ${colors.text}`}>
            Rank {character.rank} &middot; {CHARACTER_ICON[character.name]}
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">{fullDescription}</p>
        </div>

        <div className="text-center pb-3 text-xs text-slate-500">Tap anywhere to close</div>
      </motion.div>
    </motion.div>
  );
}
