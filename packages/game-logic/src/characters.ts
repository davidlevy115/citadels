import type { GameState, Player, Character, CharacterName, DistrictType } from './types.js';
import { CHARACTER_INCOME_TYPE, CHARACTER_INCOME_AS_CARDS } from './constants.js';
import { addLog } from './utils.js';
import { fail, type ErrorCode } from './errors.js';
import type { LogParams } from './log.js';

/** Why an action is not allowed, or null when it is. */
export type Refusal = { code: ErrorCode; params?: LogParams } | null;

function refuse(code: ErrorCode, params?: LogParams): Refusal {
  return { code, params };
}

/** The character whose powers are in effect for the active turn. */
export function effectiveCharacter(state: GameState): Character | null {
  return state.turnState?.effectiveCharacter ?? null;
}

export function effectiveName(state: GameState): CharacterName | null {
  return state.turnState?.effectiveCharacter.name ?? null;
}

/** How many districts of the character's income colour a player has. */
export function countIncomeDistricts(player: Player, incomeType: DistrictType): number {
  let count = 0;
  for (const district of player.city) {
    if (district.type === incomeType) count++;
    // School of Magic counts as any type for income
    else if (district.name === 'School of Magic') count++;
  }
  return count;
}

export function getCharacterIncomeCount(player: Player, character: Character | null): number {
  if (!character) return 0;
  const incomeType = CHARACTER_INCOME_TYPE[character.name];
  if (!incomeType) return 0;
  return countIncomeDistricts(player, incomeType);
}

export function incomeIsCards(character: Character | null): boolean {
  return !!character && CHARACTER_INCOME_AS_CARDS.includes(character.name);
}

/**
 * Take the character's district income. Most characters take gold; the
 * Patrician and Cardinal take cards instead.
 */
export function collectIncome(state: GameState, playerIndex: number, character: Character | null): GameState {
  const player = state.players[playerIndex];
  const count = getCharacterIncomeCount(player, character);
  if (count <= 0) return state;

  if (incomeIsCards(character)) {
    const drawn = drawCards(state, count);
    state.players[playerIndex] = { ...player, hand: [...player.hand, ...drawn] };
    addLog(state, 'income.cards', { player: player.name, count: drawn.length });
  } else {
    state.players[playerIndex] = { ...player, gold: player.gold + count };
    addLog(state, 'income.gold', { player: player.name, amount: count });
  }
  return state;
}

/** Draw up to `count` cards off the top of the district deck. */
export function drawCards(state: GameState, count: number): GameState['districtDeck'] {
  const drawn: GameState['districtDeck'] = [];
  for (let i = 0; i < count; i++) {
    if (state.districtDeck.length > 0) drawn.push(state.districtDeck.shift()!);
  }
  return drawn;
}

/** Merchant's guaranteed extra gold, applied once after the gather action. */
export function applyMerchantBonus(state: GameState, playerIndex: number): GameState {
  const player = state.players[playerIndex];
  if (effectiveName(state) === 'Merchant' && state.turnState && !state.turnState.merchantBonusTaken) {
    state.players[playerIndex] = { ...player, gold: player.gold + 1 };
    state.turnState.merchantBonusTaken = true;
    addLog(state, 'merchant.bonus', { player: player.name });
  }
  return state;
}

/** Architect's two extra cards, applied once after the gather action. */
export function applyArchitectDraw(state: GameState, playerIndex: number): GameState {
  if (effectiveName(state) !== 'Architect') return state;
  const player = state.players[playerIndex];
  const drawn = drawCards(state, 2);
  if (drawn.length > 0) {
    state.players[playerIndex] = { ...player, hand: [...player.hand, ...drawn] };
    addLog(state, 'architect.draw', { player: player.name, count: drawn.length });
  }
  return state;
}

/**
 * The Abbot is owed 1 gold by the richest player whenever they are not the
 * richest themselves. Checked when the Abbot claims their income.
 */
export function applyAbbotTribute(state: GameState, playerIndex: number): GameState {
  const abbot = state.players[playerIndex];
  const maxGold = Math.max(...state.players.map(p => p.gold));
  if (abbot.gold >= maxGold) return state;

  const richest = state.players.filter(p => p.gold === maxGold && p.id !== abbot.id);
  if (richest.length === 0) return state;

  const donor = richest[0];
  const donorIndex = state.players.findIndex(p => p.id === donor.id);
  state.players[donorIndex] = { ...donor, gold: donor.gold - 1 };
  state.players[playerIndex] = { ...state.players[playerIndex], gold: state.players[playerIndex].gold + 1 };
  addLog(state, 'abbot.tribute', { donor: donor.name, player: abbot.name });
  return state;
}

/** The Queen collects 3 gold when seated beside whoever revealed the rank 4 character. */
export function applyQueenBonus(state: GameState, playerIndex: number): GameState {
  const rank4Index = state.players.findIndex(p => p.characterCard?.rank === 4);
  if (rank4Index === -1) return state;

  const n = state.players.length;
  const isAdjacent =
    (playerIndex + 1) % n === rank4Index || (playerIndex - 1 + n) % n === rank4Index;
  if (!isAdjacent) return state;

  const player = state.players[playerIndex];
  state.players[playerIndex] = { ...player, gold: player.gold + 3 };
  addLog(state, 'queen.bonus', { player: player.name });
  return state;
}

/** Effective cost of a built district — beautified districts are worth 1 more. */
export function districtValue(d: { cost: number; beautified?: boolean }): number {
  return d.cost + (d.beautified ? 1 : 0);
}

/** Bishop protection applies to the Bishop only, not the other rank 5 characters. */
function isProtectedFromRank8(state: GameState, player: Player): boolean {
  if (player.characterCard?.name !== 'Bishop') return false;
  // A bewitched Bishop loses the protection; the Witch gains it instead.
  if (state.bewitchedCharacter === 5) return false;
  return true;
}

export function canWarlordDestroy(
  state: GameState,
  targetPlayerId: string,
  districtIndex: number,
  shorterGame: boolean
): Refusal {
  const targetPlayer = state.players.find(p => p.id === targetPlayerId);
  if (!targetPlayer) return refuse('err.targetPlayerNotFound');

  const limit = shorterGame ? 7 : 8;
  if (targetPlayer.city.length >= limit) return refuse('err.cannotDestroyCompleted');
  if (isProtectedFromRank8(state, targetPlayer)) return refuse('err.bishopProtected');

  const district = targetPlayer.city[districtIndex];
  if (!district) return refuse('err.districtNotFound');
  if (district.name === 'Keep') return refuse('err.keepCannotDestroy');

  const destroyer = state.players.find(p => p.id === state.turnState?.playerId);
  if (!destroyer) return refuse('err.noRank8');

  const destroyCost = getWarlordDestroyCost(state, targetPlayerId, districtIndex);
  if (destroyer.gold < destroyCost) {
    return refuse('err.notEnoughGoldCost', { cost: destroyCost, gold: destroyer.gold });
  }

  return null; // can destroy
}

export function getWarlordDestroyCost(state: GameState, targetPlayerId: string, districtIndex: number): number {
  const targetPlayer = state.players.find(p => p.id === targetPlayerId)!;
  const district = targetPlayer.city[districtIndex];
  let cost = districtValue(district) - 1;
  if (targetPlayer.city.some(d => d.name === 'Great Wall') && district.name !== 'Great Wall') {
    cost += 1;
  }
  return Math.max(0, cost);
}

/** Diplomat and Marshal share the Bishop restriction and the completed-city rule. */
export function canTakeDistrictFrom(state: GameState, targetPlayerId: string, districtIndex: number): Refusal {
  const target = state.players.find(p => p.id === targetPlayerId);
  if (!target) return refuse('err.targetPlayerNotFound');
  if (target.city.length >= 8) return refuse('err.cannotTouchCompleted');
  if (isProtectedFromRank8(state, target)) return refuse('err.bishopProtected');
  const district = target.city[districtIndex];
  if (!district) return refuse('err.districtNotFound');
  if (district.name === 'Keep') return refuse('err.keepCannotTake');
  return null;
}

export function getCardsToDrawCount(state: GameState, player: Player): number {
  if (effectiveName(state) === 'Scholar') return 7;
  if (player.city.some(d => d.name === 'Observatory')) return 3;
  return 2;
}

export function getCardsToKeepCount(state: GameState, player: Player): number {
  if (effectiveName(state) === 'Scholar') return 1;
  if (player.city.some(d => d.name === 'Library')) return -1; // keep all
  return 1;
}

/** Building limit granted by the character in effect. */
export function buildLimitFor(name: CharacterName | null): number {
  switch (name) {
    case 'Architect': return 3;
    case 'Seer': return 2;
    case 'Scholar': return 2;
    case 'Navigator': return 0;
    // The Witch cannot build on her own turn — only on the one she takes over.
    case 'Witch': return 0;
    default: return 1;
  }
}
