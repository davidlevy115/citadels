'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import type { DistrictCard, Character } from '@citadels/game-logic';
import { getDistrictImagePath, getCharacterImagePath, DISTRICT_TYPE_ICON, CHARACTER_ICON } from '@/lib/cardImages';

const TYPE_BORDER: Record<string, string> = {
  noble: 'border-yellow-500',
  religious: 'border-blue-500',
  trade: 'border-green-500',
  military: 'border-red-500',
  special: 'border-purple-500',
};

const TYPE_BG: Record<string, string> = {
  noble: 'from-yellow-700 to-yellow-900',
  religious: 'from-blue-700 to-blue-900',
  trade: 'from-green-700 to-green-900',
  military: 'from-red-700 to-red-900',
  special: 'from-purple-700 to-purple-900',
};

const TYPE_TEXT: Record<string, string> = {
  noble: 'text-yellow-300',
  religious: 'text-blue-300',
  trade: 'text-green-300',
  military: 'text-red-300',
  special: 'text-purple-300',
};

const TYPE_LABELS: Record<string, string> = {
  noble: 'Noble',
  religious: 'Religious',
  trade: 'Trade',
  military: 'Military',
  special: 'Special',
};

// ── District Card ───────────────────────────────────────────────

interface DistrictCardProps {
  card: DistrictCard;
  onClick?: () => void;
  onDetail?: () => void;
  selected?: boolean;
  disabled?: boolean;
  small?: boolean;
}

export function DistrictCardView({ card, onClick, onDetail, selected, disabled, small }: DistrictCardProps) {
  const [imgError, setImgError] = useState(false);
  const border = TYPE_BORDER[card.type] || TYPE_BORDER.special;
  const bg = TYPE_BG[card.type] || TYPE_BG.special;
  const textColor = TYPE_TEXT[card.type] || TYPE_TEXT.special;
  const icon = DISTRICT_TYPE_ICON[card.type] || '\u2726';

  const handleClick = (e: React.MouseEvent) => {
    if (disabled && onDetail) {
      // disabled cards (in city) can still be inspected
      e.stopPropagation();
      onDetail();
      return;
    }
    if (onClick) onClick();
    else if (onDetail) onDetail();
  };

  if (small) {
    return (
      <motion.div
        whileHover={{ y: -4, scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleClick}
        className={`
          relative rounded-lg border-2 overflow-hidden cursor-pointer select-none
          ${border}
          ${selected ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-900' : ''}
          w-[72px] h-[100px]
        `}
      >
        {/* Background image or fallback */}
        {!imgError ? (
          <img
            src={getDistrictImagePath(card.name)}
            alt={card.name}
            className="absolute inset-0 w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-b ${bg} flex items-center justify-center`}>
            <span className="text-2xl opacity-30">{icon}</span>
          </div>
        )}

        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

        {/* Cost */}
        <div className="absolute top-1 left-1 w-5 h-5 bg-yellow-400 text-black font-bold rounded-full flex items-center justify-center text-[10px] shadow">
          {card.cost}
        </div>

        {/* Type icon */}
        <div className={`absolute top-1 right-1 text-xs ${textColor}`}>{icon}</div>

        {/* Name */}
        <div className="absolute bottom-0 inset-x-0 px-1 pb-1.5">
          <div className="text-[9px] font-semibold text-white leading-tight text-center drop-shadow">
            {card.name}
          </div>
        </div>
      </motion.div>
    );
  }

  // Full-size card
  return (
    <motion.div
      whileHover={!disabled ? { y: -10, scale: 1.05 } : { scale: 1.02 }}
      whileTap={{ scale: 0.95 }}
      onClick={handleClick}
      className={`
        relative rounded-xl border-2 overflow-hidden cursor-pointer select-none
        transition-shadow
        ${border}
        ${selected ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900' : ''}
        ${disabled ? 'opacity-60' : 'hover:shadow-xl hover:shadow-black/40'}
        w-[120px] h-[170px]
      `}
    >
      {/* Background image or fallback */}
      {!imgError ? (
        <img
          src={getDistrictImagePath(card.name)}
          alt={card.name}
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className={`absolute inset-0 bg-gradient-to-b ${bg} flex items-center justify-center`}>
          <span className="text-4xl opacity-25">{icon}</span>
        </div>
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-black/10" />

      {/* Cost badge */}
      <div className="absolute top-2 left-2 w-7 h-7 bg-yellow-400 text-black font-bold rounded-full flex items-center justify-center text-sm shadow-lg">
        {card.cost}
      </div>

      {/* Type badge */}
      <div className={`absolute top-2 right-2 px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-black/50 backdrop-blur-sm ${textColor}`}>
        {icon} {TYPE_LABELS[card.type]}
      </div>

      {/* Bottom content */}
      <div className="absolute bottom-0 inset-x-0 p-2.5">
        <div className="text-xs font-bold text-white drop-shadow mb-0.5">{card.name}</div>
        {card.description && (
          <div className="text-[8px] text-slate-300 leading-tight line-clamp-3 drop-shadow">
            {card.description}
          </div>
        )}
        {!card.description && (
          <div className={`text-[8px] ${textColor} opacity-70`}>
            {TYPE_LABELS[card.type]} &middot; {card.cost} pts
          </div>
        )}
      </div>

      {/* Detail indicator */}
      {onDetail && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 opacity-0 hover:opacity-100 transition-opacity">
          <div className="text-[8px] bg-white/20 backdrop-blur rounded px-1.5 py-0.5 text-white">
            Click for details
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ── Character Card ──────────────────────────────────────────────

const CHAR_BORDER: Record<string, string> = {
  Assassin: 'border-gray-400',
  Thief: 'border-amber-500',
  Magician: 'border-indigo-400',
  King: 'border-yellow-400',
  Bishop: 'border-blue-400',
  Merchant: 'border-green-400',
  Architect: 'border-amber-400',
  Warlord: 'border-red-400',
};

const CHAR_BG: Record<string, string> = {
  Assassin: 'from-gray-800 to-gray-950',
  Thief: 'from-gray-700 to-gray-900',
  Magician: 'from-indigo-700 to-indigo-950',
  King: 'from-yellow-700 to-yellow-900',
  Bishop: 'from-blue-700 to-blue-900',
  Merchant: 'from-green-700 to-green-900',
  Architect: 'from-amber-700 to-amber-900',
  Warlord: 'from-red-700 to-red-900',
};

interface CharacterCardProps {
  character: Character;
  onClick?: () => void;
  onDetail?: () => void;
  selected?: boolean;
  disabled?: boolean;
  small?: boolean;
}

export function CharacterCardView({ character, onClick, onDetail, selected, disabled, small }: CharacterCardProps) {
  const [imgError, setImgError] = useState(false);
  const border = CHAR_BORDER[character.name] || 'border-slate-500';
  const bg = CHAR_BG[character.name] || 'from-slate-700 to-slate-900';
  const icon = CHARACTER_ICON[character.name] || '\u2726';

  const handleClick = () => {
    if (disabled && onDetail) {
      onDetail();
      return;
    }
    if (onClick) onClick();
    else if (onDetail) onDetail();
  };

  if (small) {
    return (
      <motion.div
        whileHover={{ y: -4, scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleClick}
        className={`
          relative rounded-lg border-2 overflow-hidden cursor-pointer select-none
          ${border}
          ${selected ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-900' : ''}
          ${disabled ? 'opacity-50' : ''}
          w-[72px] h-[100px]
        `}
      >
        {!imgError ? (
          <img
            src={getCharacterImagePath(character.name)}
            alt={character.name}
            className="absolute inset-0 w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-b ${bg} flex items-center justify-center`}>
            <span className="text-2xl opacity-30">{icon}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
        <div className="absolute top-1 left-1 w-5 h-5 bg-white/20 text-white font-bold rounded-full flex items-center justify-center text-[10px]">
          {character.rank}
        </div>
        <div className="absolute bottom-0 inset-x-0 px-1 pb-1.5">
          <div className="text-[9px] font-bold text-white text-center drop-shadow">{character.name}</div>
        </div>
      </motion.div>
    );
  }

  // Full-size character card
  return (
    <motion.div
      whileHover={!disabled ? { y: -10, scale: 1.05 } : { scale: 1.02 }}
      whileTap={!disabled ? { scale: 0.95 } : undefined}
      onClick={handleClick}
      className={`
        relative rounded-xl border-2 overflow-hidden cursor-pointer select-none
        ${border}
        ${selected ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900' : ''}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-xl hover:shadow-black/40'}
        w-[120px] h-[170px]
      `}
    >
      {!imgError ? (
        <img
          src={getCharacterImagePath(character.name)}
          alt={character.name}
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className={`absolute inset-0 bg-gradient-to-b ${bg} flex items-center justify-center`}>
          <span className="text-4xl opacity-25">{icon}</span>
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-black/10" />

      {/* Rank badge */}
      <div className="absolute top-2 left-2 w-7 h-7 bg-white/20 backdrop-blur-sm text-white font-bold rounded-full flex items-center justify-center text-sm border border-white/30">
        {character.rank}
      </div>

      {/* Bottom content */}
      <div className="absolute bottom-0 inset-x-0 p-2.5">
        <div className="text-sm font-bold text-white drop-shadow mb-0.5">{character.name}</div>
        <div className="text-[8px] text-slate-300 leading-tight line-clamp-3 drop-shadow">
          {character.description}
        </div>
      </div>
    </motion.div>
  );
}
