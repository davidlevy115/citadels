import type { GameState, Player } from './types.js';
import { CHARACTER_INCOME_TYPE } from './constants.js';
import { addLog } from './utils.js';

export function getCharacterIncomeGold(state: GameState, player: Player): number {
  const character = player.characterCard;
  if (!character) return 0;
  const incomeType = CHARACTER_INCOME_TYPE[character.name];
  if (!incomeType) return 0;

  let count = 0;
  for (const district of player.city) {
    if (district.type === incomeType) {
      count++;
    }
    // School of Magic counts as any type for income
    if (district.name === 'School of Magic') {
      count++;
    }
  }
  return count;
}

export function collectIncome(state: GameState, playerIndex: number): GameState {
  const player = state.players[playerIndex];
  const income = getCharacterIncomeGold(state, player);
  if (income > 0) {
    state.players[playerIndex] = {
      ...player,
      gold: player.gold + income,
    };
    addLog(state, `${player.name} collects ${income} gold income from districts.`);
  }
  return state;
}

export function applyMerchantBonus(state: GameState, playerIndex: number): GameState {
  const player = state.players[playerIndex];
  if (player.characterCard?.name === 'Merchant' && state.turnState && !state.turnState.merchantBonusTaken) {
    state.players[playerIndex] = { ...player, gold: player.gold + 1 };
    state.turnState.merchantBonusTaken = true;
    addLog(state, `${player.name} receives 1 bonus gold as Merchant.`);
  }
  return state;
}

export function applyArchitectDraw(state: GameState, playerIndex: number): GameState {
  const player = state.players[playerIndex];
  if (player.characterCard?.name === 'Architect') {
    const drawn: string[] = [];
    for (let i = 0; i < 2; i++) {
      if (state.districtDeck.length > 0) {
        const card = state.districtDeck.shift()!;
        state.players[playerIndex].hand.push(card);
        drawn.push(card.name);
      }
    }
    if (drawn.length > 0) {
      addLog(state, `${player.name} draws ${drawn.length} extra cards as Architect.`);
    }
  }
  return state;
}

export function canWarlordDestroy(
  state: GameState,
  targetPlayerId: string,
  districtIndex: number,
  shorterGame: boolean
): string | null {
  const targetPlayer = state.players.find(p => p.id === targetPlayerId);
  if (!targetPlayer) return 'Target player not found.';

  // Cannot destroy in completed city
  const limit = shorterGame ? 7 : 8;
  if (targetPlayer.city.length >= limit) return 'Cannot destroy districts in a completed city.';

  // Cannot destroy Bishop's districts
  if (targetPlayer.characterCard?.name === 'Bishop') return "Cannot destroy the Bishop's districts.";

  const district = targetPlayer.city[districtIndex];
  if (!district) return 'District not found.';

  // Cannot destroy Keep
  if (district.name === 'Keep') return 'The Keep cannot be destroyed.';

  // Check cost
  const warlord = state.players.find(p => p.characterCard?.name === 'Warlord');
  if (!warlord) return 'No Warlord found.';

  let destroyCost = district.cost - 1;
  // Great Wall makes it cost +1 for other districts
  if (targetPlayer.city.some(d => d.name === 'Great Wall') && district.name !== 'Great Wall') {
    destroyCost += 1;
  }

  if (warlord.gold < destroyCost) return `Not enough gold. Need ${destroyCost}, have ${warlord.gold}.`;

  return null; // can destroy
}

export function getWarlordDestroyCost(state: GameState, targetPlayerId: string, districtIndex: number): number {
  const targetPlayer = state.players.find(p => p.id === targetPlayerId)!;
  const district = targetPlayer.city[districtIndex];
  let cost = district.cost - 1;
  if (targetPlayer.city.some(d => d.name === 'Great Wall') && district.name !== 'Great Wall') {
    cost += 1;
  }
  return Math.max(0, cost);
}

export function getCardsToDrawCount(player: Player): number {
  if (player.city.some(d => d.name === 'Observatory')) return 3;
  return 2;
}

export function getCardsToKeepCount(player: Player): number {
  if (player.city.some(d => d.name === 'Library')) return -1; // keep all
  return 1;
}
