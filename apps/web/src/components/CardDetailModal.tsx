'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { DistrictCard, Character, BuiltDistrict } from '@citadels/game-logic';
import { getDistrictImagePath, getCharacterImagePath, DISTRICT_TYPE_ICON, CHARACTER_ICON, rankTheme } from '@/lib/cardImages';
import { useState } from 'react';
import { useT } from '@/hooks/useI18n';

const TYPE_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  noble: { bg: 'from-yellow-900 to-yellow-950', border: 'border-yellow-500', text: 'text-yellow-300', glow: 'shadow-yellow-500/30' },
  religious: { bg: 'from-blue-900 to-blue-950', border: 'border-blue-500', text: 'text-blue-300', glow: 'shadow-blue-500/30' },
  trade: { bg: 'from-green-900 to-green-950', border: 'border-green-500', text: 'text-green-300', glow: 'shadow-green-500/30' },
  military: { bg: 'from-red-900 to-red-950', border: 'border-red-500', text: 'text-red-300', glow: 'shadow-red-500/30' },
  special: { bg: 'from-purple-900 to-purple-950', border: 'border-purple-500', text: 'text-purple-300', glow: 'shadow-purple-500/30' },
};

// ── District Detail Modal ───────────────────────────────────────

interface DistrictDetailProps {
  card: DistrictCard | BuiltDistrict;
  onClose: () => void;
}

export function DistrictDetailModal({ card, onClose }: DistrictDetailProps) {
  const t = useT();
  const colors = TYPE_COLORS[card.type] || TYPE_COLORS.special;
  const [imgError, setImgError] = useState(false);
  const typeLabel = t.districtType(card.type);
  const description = t.districtDescription(card.name);

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
            {DISTRICT_TYPE_ICON[card.type]} {typeLabel}
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          <h2 className="text-xl font-bold mb-1">{t.district(card.name)}</h2>
          <div className={`text-xs font-medium mb-3 ${colors.text}`}>
            {t('misc.districtSuffix', { type: typeLabel, cost: card.cost })}
          </div>

          {description ? (
            <p className="text-sm text-slate-300 leading-relaxed">{description}</p>
          ) : (
            <p className="text-sm text-slate-400 italic">
              {t('misc.pointsSuffix', { type: typeLabel.toLowerCase(), cost: card.cost })}
            </p>
          )}
        </div>

        {/* Close hint */}
        <div className="text-center pb-3 text-xs text-slate-500">{t('misc.tapToClose')}</div>
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
  const t = useT();
  const colors = rankTheme(character.rank);
  const [imgError, setImgError] = useState(false);
  const fullDescription = t.characterFull(character.name) || t.characterShort(character.name);

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
          <h2 className="text-xl font-bold mb-1">{t.character(character.name)}</h2>
          <div className={`text-xs font-medium mb-3 ${colors.text}`}>
            {t('misc.rank', { rank: character.rank })} &middot; {CHARACTER_ICON[character.name]}
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">{fullDescription}</p>
        </div>

        <div className="text-center pb-3 text-xs text-slate-500">{t('misc.tapToClose')}</div>
      </motion.div>
    </motion.div>
  );
}
