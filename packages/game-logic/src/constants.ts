import type { Character, CharacterName, CharacterSet, DistrictCard, DistrictType } from './types.js';

// ── Characters ──────────────────────────────────────────────────
// The full Citadels (2016 / Deluxe) roster: three characters per rank 1-8,
// plus three optional rank 9 characters.

export const ALL_CHARACTERS: Character[] = [
  // ── Rank 1 ──
  { rank: 1, name: 'Assassin', description: 'Kill a character. That player skips their entire turn.' },
  { rank: 1, name: 'Witch', description: 'Gather resources, then bewitch a character. Their turn ends at once and you play it as if it were yours.' },
  { rank: 1, name: 'Magistrate', description: 'Assign 3 warrants to characters. Confiscate the first district the signed target pays to build.' },
  // ── Rank 2 ──
  { rank: 2, name: 'Thief', description: 'Rob a character. When they are called, take all their gold.' },
  { rank: 2, name: 'Spy', description: 'Name a district type and look at a player’s hand. Take 1 gold per match and draw as many cards.' },
  { rank: 2, name: 'Blackmailer', description: 'Threaten 2 characters. They bribe you with half their gold, or risk losing all of it.' },
  // ── Rank 3 ──
  { rank: 3, name: 'Magician', description: 'Exchange your hand with another player, or discard cards and draw replacements.' },
  { rank: 3, name: 'Wizard', description: 'Look at a player’s hand and take a card. Keep it or build it for free of your building limit.' },
  { rank: 3, name: 'Seer', description: 'Take a random card from every player, then give one back to each. Building limit 2.' },
  // ── Rank 4 ──
  { rank: 4, name: 'King', description: 'Take the Crown. Gain 1 gold per noble (yellow) district.' },
  { rank: 4, name: 'Emperor', description: 'Gain 1 gold per noble district. Give the Crown to another player and take 1 gold or 1 card from them.' },
  { rank: 4, name: 'Patrician', description: 'Take the Crown. Gain 1 card per noble (yellow) district.' },
  // ── Rank 5 ──
  { rank: 5, name: 'Bishop', description: 'Protected from the rank 8 character. Gain 1 gold per religious (blue) district.' },
  { rank: 5, name: 'Abbot', description: 'Gain 1 gold or card per religious district. The richest player must give you 1 gold.' },
  { rank: 5, name: 'Cardinal', description: 'Gain 1 card per religious district. Buy gold from a player with cards to finish a build.' },
  // ── Rank 6 ──
  { rank: 6, name: 'Merchant', description: 'Gain 1 extra gold. Gain 1 gold per trade (green) district.' },
  { rank: 6, name: 'Alchemist', description: 'At the end of your turn you get back every gold you paid to build districts.' },
  { rank: 6, name: 'Trader', description: 'Gain 1 gold per trade district. Trade districts do not count toward your building limit.' },
  // ── Rank 7 ──
  { rank: 7, name: 'Architect', description: 'Gain 2 extra cards. Building limit 3.' },
  { rank: 7, name: 'Navigator', description: 'Gain 4 gold or 4 cards. You cannot build any district this turn.' },
  { rank: 7, name: 'Scholar', description: 'Draw 7 cards and keep 1; shuffle the rest back. Building limit 2.' },
  // ── Rank 8 ──
  { rank: 8, name: 'Warlord', description: 'Destroy a district by paying 1 less than its cost. Gain 1 gold per military (red) district.' },
  { rank: 8, name: 'Diplomat', description: 'Swap one of your districts for one in another city, paying the difference. Gain 1 gold per military district.' },
  { rank: 8, name: 'Marshal', description: 'Seize a district costing 3 or less, paying its owner. Gain 1 gold per military district.' },
  // ── Rank 9 (optional) ──
  { rank: 9, name: 'Queen', description: 'Gain 3 gold if you sit next to the player who revealed the rank 4 character. Needs 5+ players.' },
  { rank: 9, name: 'Artist', description: 'Beautify up to 2 of your districts for 1 gold each, permanently raising their value by 1.' },
  { rank: 9, name: 'Tax Collector', description: 'Every district built anywhere costs its builder 1 gold in tax. Collect the pot on your turn.' },
];

/** The eight classic characters — the default cast. */
export const CHARACTERS: Character[] = ALL_CHARACTERS.filter(c =>
  ['Assassin', 'Thief', 'Magician', 'King', 'Bishop', 'Merchant', 'Architect', 'Warlord'].includes(c.name)
);

export function getCharacterByName(name: CharacterName): Character {
  const c = ALL_CHARACTERS.find(ch => ch.name === name);
  if (!c) throw new Error(`Unknown character: ${name}`);
  return c;
}

/** Which district colour a character draws income from (null = no income power). */
export const CHARACTER_INCOME_TYPE: Record<CharacterName, DistrictType | null> = {
  Assassin: null,
  Witch: null,
  Magistrate: null,
  Thief: null,
  Spy: null,
  Blackmailer: null,
  Magician: null,
  Wizard: null,
  Seer: null,
  King: 'noble',
  Emperor: 'noble',
  Patrician: 'noble',
  Bishop: 'religious',
  Abbot: 'religious',
  Cardinal: 'religious',
  Merchant: 'trade',
  Alchemist: null,
  Trader: 'trade',
  Architect: null,
  Navigator: null,
  Scholar: null,
  Warlord: 'military',
  Diplomat: 'military',
  Marshal: 'military',
  Queen: null,
  Artist: null,
  'Tax Collector': null,
};

/** Characters whose income arrives as cards rather than gold. */
export const CHARACTER_INCOME_AS_CARDS: CharacterName[] = ['Patrician', 'Cardinal'];

/** Characters that take the Crown when called (rank 4 variants). */
export const CROWN_TAKING_CHARACTERS: CharacterName[] = ['King', 'Emperor', 'Patrician'];

// ── Preset character sets ───────────────────────────────────────
// The rulebook's suggested casts, one character per rank.

export const CHARACTER_SETS: CharacterSet[] = [
  {
    id: 'classic',
    name: 'Classic',
    blurb: 'The eight original characters. The best place to start.',
    characters: ['Assassin', 'Thief', 'Magician', 'King', 'Bishop', 'Merchant', 'Architect', 'Warlord'],
    rank9: 'Queen',
  },
  {
    id: 'ambitious-aristocrats',
    name: 'Ambitious Aristocrats',
    blurb: 'Warrants, wizardry and seizures — a game of pressure on the leader.',
    characters: ['Magistrate', 'Thief', 'Wizard', 'Patrician', 'Bishop', 'Trader', 'Architect', 'Marshal'],
    rank9: 'Queen',
  },
  {
    id: 'cunning-agents',
    name: 'Cunning Agents',
    blurb: 'Bewitching, blackmail and free building. Gold gets slippery.',
    characters: ['Witch', 'Blackmailer', 'Magician', 'Emperor', 'Abbot', 'Alchemist', 'Architect', 'Warlord'],
    rank9: 'Tax Collector',
  },
  {
    id: 'illustrious-emissaries',
    name: 'Illustrious Emissaries',
    blurb: 'Information warfare — spying, scrying and district swaps.',
    characters: ['Witch', 'Spy', 'Seer', 'Emperor', 'Bishop', 'Merchant', 'Scholar', 'Diplomat'],
    rank9: 'Artist',
  },
  {
    id: 'devious-dignitaries',
    name: 'Devious Dignitaries',
    blurb: 'Heavy interference. Nothing you build is safe.',
    characters: ['Magistrate', 'Blackmailer', 'Wizard', 'King', 'Abbot', 'Alchemist', 'Navigator', 'Marshal'],
    rank9: 'Queen',
  },
  {
    id: 'tenacious-delegates',
    name: 'Tenacious Delegates',
    blurb: 'Card-hungry and fast. Hands change owners constantly.',
    characters: ['Assassin', 'Spy', 'Seer', 'King', 'Cardinal', 'Trader', 'Scholar', 'Diplomat'],
    rank9: 'Artist',
  },
  {
    id: 'vicious-nobles',
    name: 'Vicious Nobles',
    blurb: 'The classics with sharper teeth. Build big, pay tax.',
    characters: ['Assassin', 'Thief', 'Magician', 'Patrician', 'Cardinal', 'Merchant', 'Navigator', 'Warlord'],
    rank9: 'Tax Collector',
  },
  {
    id: 'random',
    name: 'Random Mix',
    blurb: 'One random character per rank. Nobody knows what is coming.',
    characters: [],   // filled in at game creation
    rank9: 'Artist',
    isRandom: true,
  },
];

export function getCharacterSet(id: string): CharacterSet {
  return CHARACTER_SETS.find(s => s.id === id) ?? CHARACTER_SETS[0];
}

/**
 * Build the cast of characters for a game: one per rank 1-8, plus the
 * set's rank 9 character when requested.
 */
export function buildCast(setId: string, includeRank9: boolean, rng: <T>(arr: T[]) => T): Character[] {
  const set = getCharacterSet(setId);
  const cast: Character[] = [];

  if (set.isRandom) {
    for (let rank = 1; rank <= 8; rank++) {
      cast.push(rng(ALL_CHARACTERS.filter(c => c.rank === rank)));
    }
  } else {
    for (const name of set.characters) {
      cast.push(getCharacterByName(name));
    }
  }

  if (includeRank9) {
    if (set.isRandom) {
      cast.push(rng(ALL_CHARACTERS.filter(c => c.rank === 9)));
    } else if (set.rank9) {
      cast.push(getCharacterByName(set.rank9));
    }
  }

  return cast.sort((a, b) => a.rank - b.rank);
}

// ── District cards ──────────────────────────────────────────────

interface DistrictDef {
  name: string;
  cost: number;
  type: DistrictType;
  count: number;
  description?: string;
}

const DISTRICT_DEFS: DistrictDef[] = [
  // Noble (Yellow)
  { name: 'Manor', cost: 3, type: 'noble', count: 5 },
  { name: 'Castle', cost: 4, type: 'noble', count: 4 },
  { name: 'Palace', cost: 5, type: 'noble', count: 3 },

  // Religious (Blue)
  { name: 'Temple', cost: 1, type: 'religious', count: 3 },
  { name: 'Church', cost: 2, type: 'religious', count: 3 },
  { name: 'Monastery', cost: 3, type: 'religious', count: 3 },
  { name: 'Cathedral', cost: 5, type: 'religious', count: 2 },

  // Trade (Green)
  { name: 'Tavern', cost: 1, type: 'trade', count: 5 },
  { name: 'Market', cost: 2, type: 'trade', count: 4 },
  { name: 'Trading Post', cost: 2, type: 'trade', count: 3 },
  { name: 'Docks', cost: 3, type: 'trade', count: 3 },
  { name: 'Harbor', cost: 4, type: 'trade', count: 3 },
  { name: 'Town Hall', cost: 5, type: 'trade', count: 2 },

  // Military (Red)
  { name: 'Watchtower', cost: 1, type: 'military', count: 3 },
  { name: 'Prison', cost: 2, type: 'military', count: 3 },
  { name: 'Battlefield', cost: 3, type: 'military', count: 3 },
  { name: 'Fortress', cost: 5, type: 'military', count: 2 },

  // Special (Purple) — base game only
  { name: 'Haunted City', cost: 2, type: 'special', count: 1, description: 'For end-game scoring, the Haunted City counts as any district type of your choice.' },
  { name: 'Keep', cost: 3, type: 'special', count: 2, description: 'The Keep cannot be destroyed by the Warlord.' },
  { name: 'Laboratory', cost: 5, type: 'special', count: 1, description: 'Once per turn, discard a card from your hand and receive 2 gold.' },
  { name: 'Smithy', cost: 5, type: 'special', count: 1, description: 'Once per turn, pay 2 gold and draw 3 cards.' },
  { name: 'Graveyard', cost: 5, type: 'special', count: 1, description: 'When the Warlord destroys a district, you may pay 1 gold to take it into your hand.' },
  { name: 'Observatory', cost: 5, type: 'special', count: 1, description: 'When you choose to draw cards, draw 3 and keep 1.' },
  { name: 'Library', cost: 6, type: 'special', count: 1, description: 'When you choose to draw cards, keep both cards.' },
  { name: 'School of Magic', cost: 6, type: 'special', count: 1, description: 'For income purposes, the School of Magic counts as the district type of your choice.' },
  { name: 'Dragon Gate', cost: 6, type: 'special', count: 1, description: 'Worth 8 points at end of game (instead of 6).' },
  { name: 'University', cost: 6, type: 'special', count: 1, description: 'Worth 8 points at end of game (instead of 6).' },
  { name: 'Great Wall', cost: 6, type: 'special', count: 1, description: 'The Warlord must pay 1 extra gold to destroy any of your other districts.' },
];

export function createDistrictDeck(): DistrictCard[] {
  const deck: DistrictCard[] = [];
  let idCounter = 0;
  for (const def of DISTRICT_DEFS) {
    for (let i = 0; i < def.count; i++) {
      deck.push({
        id: `district-${idCounter++}`,
        name: def.name,
        cost: def.cost,
        type: def.type,
        description: def.description,
      });
    }
  }
  return deck;
}

export const DISTRICTS_TO_WIN = 8;
export const DISTRICTS_TO_WIN_SHORT = 7;
export const STARTING_GOLD = 2;
export const STARTING_HAND_SIZE = 4;
export const GOLD_PER_ACTION = 2;
export const CARDS_DRAWN_PER_ACTION = 2;
export const CARDS_KEPT_PER_ACTION = 1;

// Number of faceup removed characters by player count (4-7 players, 8 basic characters)
export const FACEUP_REMOVED_BY_PLAYER_COUNT: Record<number, number> = {
  2: 0, // special rules
  3: 0, // special rules
  4: 2,
  5: 1,
  6: 0,
  7: 0,
};

// Same table when a rank 9 character joins the cast (9 characters in the deck)
export const FACEUP_REMOVED_BY_PLAYER_COUNT_9: Record<number, number> = {
  2: 0,
  3: 0,
  4: 3,
  5: 2,
  6: 1,
  7: 0,
};
