'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { DistrictCard, Character, BuiltDistrict } from '@citadels/game-logic';
import { getDistrictImagePath, getCharacterImagePath, DISTRICT_TYPE_ICON, CHARACTER_ICON, rankTheme } from '@/lib/cardImages';
import { useState } from 'react';

const TYPE_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  noble: { bg: 'from-yellow-900 to-yellow-950', border: 'border-yellow-500', text: 'text-yellow-300', glow: 'shadow-yellow-500/30' },
  religious: { bg: 'from-blue-900 to-blue-950', border: 'border-blue-500', text: 'text-blue-300', glow: 'shadow-blue-500/30' },
  trade: { bg: 'from-green-900 to-green-950', border: 'border-green-500', text: 'text-green-300', glow: 'shadow-green-500/30' },
  military: { bg: 'from-red-900 to-red-950', border: 'border-red-500', text: 'text-red-300', glow: 'shadow-red-500/30' },
  special: { bg: 'from-purple-900 to-purple-950', border: 'border-purple-500', text: 'text-purple-300', glow: 'shadow-purple-500/30' },
};

const TYPE_LABELS: Record<string, string> = {
  noble: 'Noble',
  religious: 'Religious',
  trade: 'Trade',
  military: 'Military',
  special: 'Special',
};

/** Full rulebook text for every character in the deluxe roster. */
const CHARACTER_DETAILS: Record<string, string> = {
  // Rank 1
  Assassin: 'Call the name of another character whom you wish to kill. When the killed character is called to take their turn, they must remain silent and skip their entire turn.',
  Witch: 'First you must gather resources, then bewitch another character — your turn goes on hold. When the bewitched character is called they only gather resources and stop. You then resume your turn playing that character\'s abilities, using your own hand, gold and city.',
  Magistrate: 'Assign three warrant markers facedown to three different characters. Only one is signed. If the signed target pays to build a district, you may reveal the warrant, refund them, and build it in your city for free.',
  // Rank 2
  Thief: 'Call the name of another character whom you wish to rob. When that character is revealed you immediately take all of their gold. You cannot rob the rank 1 character, the killed character, or the bewitched character.',
  Spy: 'Choose another player and name a district type, then look at their hand. For each card of that type, take 1 gold from them and draw 1 card from the deck.',
  Blackmailer: 'Assign two threat markers facedown to two different characters — one real, one a bluff. A threatened player must bribe you with half their gold or refuse; if you then reveal the real marker, you take all of their gold.',
  // Rank 3
  Magician: 'Either exchange your entire hand of cards with another player, or discard any number of cards facedown to the bottom of the deck and draw the same number of replacements.',
  Wizard: 'Look at another player\'s hand and take one card. Either keep it or pay to build it immediately — building it this way does not count toward your building limit. This turn you may also build districts identical to ones already in your city.',
  Seer: 'Take a card at random from every other player\'s hand, then give one card from your hand back to each of them. Your building limit this turn is 2.',
  // Rank 4
  King: 'Gain 1 gold for each noble (yellow) district in your city. You must take the Crown, so you call the characters for the rest of this round and choose first next round. If you are killed you still inherit the Crown once revealed.',
  Emperor: 'Gain 1 gold for each noble (yellow) district in your city. You must take the Crown from whoever has it and give it to a different player — not yourself — then take either 1 gold or 1 random card from them.',
  Patrician: 'Gain 1 card for each noble (yellow) district in your city. You must take the Crown, so you call the characters for the rest of this round and choose first next round.',
  // Rank 5
  Bishop: 'Gain 1 gold for each religious (blue) district in your city. During this round the rank 8 character cannot destroy, seize or exchange your districts.',
  Abbot: 'Gain 1 gold or 1 card for each religious (blue) district in your city, in any combination you declare. If you are not the richest player, the richest player must give you 1 gold.',
  Cardinal: 'Gain 1 card for each religious (blue) district in your city. If you cannot afford a district, take the missing gold from another player, giving them 1 card from your hand for each gold taken.',
  // Rank 6
  Merchant: 'Gain 1 gold for each trade (green) district in your city, plus 1 extra gold regardless of which resource you gathered.',
  Alchemist: 'At the end of your turn you receive back all the gold you paid to build districts this turn — but not gold paid for anything else. You still need the gold up front.',
  Trader: 'Gain 1 gold for each trade (green) district in your city. Trade districts do not count toward your building limit, so you may build any number of them.',
  // Rank 7
  Architect: 'Gain 2 extra cards regardless of which resource you gathered. Your building limit this turn is 3.',
  Navigator: 'Gain either 4 gold or 4 cards, regardless of which resource you gathered. You cannot build any districts this turn.',
  Scholar: 'Draw 7 cards from the deck, keep 1, and shuffle the other 6 back in. Your building limit this turn is 2.',
  // Rank 8
  Warlord: 'Gain 1 gold for each military (red) district in your city. You may destroy one district by paying 1 fewer gold than its building cost. You cannot touch a completed city.',
  Diplomat: 'Gain 1 gold for each military (red) district in your city. You may exchange one district in another player\'s city for one in yours, paying the difference if theirs is worth more.',
  Marshal: 'Gain 1 gold for each military (red) district in your city. You may seize one district costing 3 or less from another player\'s city by paying its owner its building cost.',
  // Rank 9
  Queen: 'Gain 3 gold if you are sitting next to the player who revealed the rank 4 character. Cannot be used with fewer than 5 players.',
  Artist: 'Beautify up to 2 of your districts for 1 gold each. A beautified district is permanently worth 1 more point, and costs 1 more to destroy, seize or exchange.',
  'Tax Collector': 'While the Tax Collector is in the game, every player pays 1 gold in tax for each district they build. On your turn you may take the whole tax pot into your stash.',
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
  const colors = rankTheme(character.rank);
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
