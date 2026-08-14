function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-');
}

export function getDistrictImagePath(name: string): string {
  return `/images/cards/districts/${slugify(name)}.jpg`;
}

export function getCharacterImagePath(name: string): string {
  return `/images/cards/characters/${slugify(name)}.jpg`;
}

// Themed icons for district types (used as fallback/overlay)
export const DISTRICT_TYPE_ICON: Record<string, string> = {
  noble: '♚',      // chess king
  religious: '✠',   // maltese cross
  trade: '⚖',       // scales
  military: '⚔',    // crossed swords
  special: '✦',     // star
};

/**
 * Fallback glyph per character. Only the eight classic characters ship with
 * artwork, so the deluxe cast leans on these.
 */
export const CHARACTER_ICON: Record<string, string> = {
  // Rank 1
  Assassin: '☠',        // skull
  Witch: '⚘',           // flower
  Magistrate: '§',      // section sign
  // Rank 2
  Thief: '♦',           // diamond
  Spy: '◉',             // fisheye
  Blackmailer: '✉',     // envelope
  // Rank 3
  Magician: '✨',        // sparkles
  Wizard: '⚛',          // atom
  Seer: '◎',            // bullseye
  // Rank 4
  King: '♚',            // chess king
  Emperor: '♕',         // white queen
  Patrician: '♝',       // chess bishop
  // Rank 5
  Bishop: '♗',          // chess bishop (white)
  Abbot: '✝',           // latin cross
  Cardinal: '✠',        // maltese cross
  // Rank 6
  Merchant: '⚖',        // scales
  Alchemist: '⚗',       // alembic
  Trader: '⚓',          // anchor
  // Rank 7
  Architect: '▲',       // triangle
  Navigator: '⎈',       // helm
  Scholar: '✍',         // writing hand
  // Rank 8
  Warlord: '⚔',         // crossed swords
  Diplomat: '⇄',        // swap arrows
  Marshal: '⚑',         // flag
  // Rank 9
  Queen: '♛',           // chess queen
  Artist: '✿',          // blossom
  'Tax Collector': '●', // coin
};

/** Card colour scheme per character, keyed by rank so every variant matches. */
export const RANK_THEME: Record<number, { border: string; bg: string; text: string; glow: string }> = {
  1: { border: 'border-gray-400', bg: 'from-gray-800 to-gray-950', text: 'text-gray-300', glow: 'shadow-gray-500/30' },
  2: { border: 'border-amber-500', bg: 'from-stone-700 to-stone-950', text: 'text-amber-300', glow: 'shadow-amber-500/30' },
  3: { border: 'border-indigo-400', bg: 'from-indigo-800 to-indigo-950', text: 'text-indigo-300', glow: 'shadow-indigo-500/30' },
  4: { border: 'border-yellow-400', bg: 'from-yellow-700 to-yellow-950', text: 'text-yellow-300', glow: 'shadow-yellow-500/30' },
  5: { border: 'border-blue-400', bg: 'from-blue-700 to-blue-950', text: 'text-blue-300', glow: 'shadow-blue-500/30' },
  6: { border: 'border-green-400', bg: 'from-green-700 to-green-950', text: 'text-green-300', glow: 'shadow-green-500/30' },
  7: { border: 'border-amber-400', bg: 'from-amber-700 to-amber-950', text: 'text-amber-300', glow: 'shadow-amber-500/30' },
  8: { border: 'border-red-400', bg: 'from-red-700 to-red-950', text: 'text-red-300', glow: 'shadow-red-500/30' },
  9: { border: 'border-pink-400', bg: 'from-pink-800 to-pink-950', text: 'text-pink-300', glow: 'shadow-pink-500/30' },
};

export function rankTheme(rank: number) {
  return RANK_THEME[rank] ?? RANK_THEME[1];
}
