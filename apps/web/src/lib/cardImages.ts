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
  noble: '\u265A',      // chess king ♚
  religious: '\u2720',   // maltese cross ✠
  trade: '\u2696',       // scales ⚖
  military: '\u2694',    // crossed swords ⚔
  special: '\u2726',     // star ✦
};

export const CHARACTER_ICON: Record<string, string> = {
  Assassin: '\u2620',    // skull ☠
  Thief: '\u2666',       // diamond ♦
  Magician: '\u2728',    // sparkles ✨
  King: '\u265A',        // chess king ♚
  Bishop: '\u2657',      // chess bishop ♗
  Merchant: '\u2696',    // scales ⚖
  Architect: '\u25B2',   // triangle ▲
  Warlord: '\u2694',     // crossed swords ⚔
};
