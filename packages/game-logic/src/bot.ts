import type { GameState, GameAction, Player, Character, DistrictCard } from './types.js';
import { getAvailableActions } from './engine.js';
import { CHARACTERS } from './constants.js';

export function getBotAction(state: GameState, botPlayerId: string): GameAction | null {
  const actions = getAvailableActions(state, botPlayerId);
  const player = state.players.find(p => p.id === botPlayerId);
  if (!player) return null;

  // Character choosing phase
  if (actions.canChooseCharacter && actions.availableCharacters.length > 0) {
    const rank = chooseBotCharacter(state, player, actions.availableCharacters);
    return { type: 'CHOOSE_CHARACTER', playerId: botPlayerId, characterRank: rank };
  }

  // Card choosing phase (drew cards, must pick one)
  if (actions.canKeepCard && actions.drawnCards.length > 0) {
    const bestIndex = chooseBestCard(player, actions.drawnCards);
    return { type: 'KEEP_CARD', playerId: botPlayerId, cardIndex: bestIndex };
  }

  // Player turn phase
  if (state.phase === 'playerTurns' && player.characterCard?.rank === state.currentCharacterRank) {
    return getBotTurnAction(state, player, actions);
  }

  return null;
}

function getBotTurnAction(
  state: GameState,
  player: Player,
  actions: ReturnType<typeof getAvailableActions>
): GameAction | null {
  const playerId = player.id;

  // Use power before action for Assassin/Thief
  if (actions.canAssassinKill) {
    const target = chooseAssassinTarget(state, player);
    return { type: 'ASSASSIN_KILL', playerId, targetRank: target };
  }

  if (actions.canThiefSteal) {
    const target = chooseThiefTarget(state, player);
    return { type: 'THIEF_STEAL', playerId, targetRank: target };
  }

  // Take action if not yet taken
  if (actions.canTakeGold || actions.canDrawCards) {
    if (shouldTakeGold(player)) {
      return { type: 'TAKE_GOLD', playerId };
    }
    if (actions.canDrawCards) {
      return { type: 'DRAW_CARDS', playerId };
    }
    return { type: 'TAKE_GOLD', playerId };
  }

  // Use Magician power after action
  if (actions.canMagicianSwap) {
    const swapAction = chooseMagicianAction(state, player);
    if (swapAction) return swapAction;
  }

  // Collect income
  if (actions.canCollectIncome) {
    return { type: 'USE_POWER', playerId };
  }

  // Build district
  if (actions.canBuildDistrict && actions.buildableCards.length > 0) {
    const best = chooseBestBuild(player, actions.buildableCards);
    if (best !== null) {
      return { type: 'BUILD_DISTRICT', playerId, cardIndex: best };
    }
  }

  // Use Warlord power
  if (actions.canWarlordDestroy) {
    const destroyAction = chooseWarlordTarget(state, player);
    if (destroyAction) return destroyAction;
    return { type: 'WARLORD_PASS', playerId };
  }

  // End turn
  if (actions.canEndTurn) {
    return { type: 'END_TURN', playerId };
  }

  return null;
}

// ── Character selection strategy ────────────────────────────────

function chooseBotCharacter(state: GameState, player: Player, available: Character[]): number {
  // Score each available character
  let bestRank = available[0].rank;
  let bestScore = -Infinity;

  for (const char of available) {
    let score = 0;

    switch (char.name) {
      case 'Assassin':
        // Good when others are close to winning
        score = getMaxOpponentCitySize(state, player) >= 6 ? 8 : 3;
        break;
      case 'Thief':
        // Good when we need gold
        score = player.gold < 3 ? 6 : 3;
        break;
      case 'Magician':
        // Good when hand is bad or empty
        score = player.hand.length <= 1 ? 6 : 2;
        break;
      case 'King':
        // Good for yellow districts and crown control
        score = 4 + countDistrictType(player, 'noble') * 2;
        break;
      case 'Bishop':
        // Good for blue districts and protection
        score = 3 + countDistrictType(player, 'religious') * 2;
        if (getMaxOpponentCitySize(state, player) >= 6) score += 3; // protection is valuable late
        break;
      case 'Merchant':
        // Good for green districts and gold
        score = 5 + countDistrictType(player, 'trade') * 2;
        break;
      case 'Architect':
        // Good when we have gold and cards to build
        score = player.gold >= 4 && player.hand.length >= 2 ? 8 : 2;
        break;
      case 'Warlord':
        // Good for red districts and disrupting leaders
        score = 3 + countDistrictType(player, 'military') * 2;
        if (getMaxOpponentCitySize(state, player) >= 6) score += 4;
        break;
    }

    // Add some randomness
    score += Math.random() * 2;

    if (score > bestScore) {
      bestScore = score;
      bestRank = char.rank;
    }
  }

  return bestRank;
}

// ── Action strategies ───────────────────────────────────────────

function shouldTakeGold(player: Player): boolean {
  // Take gold if we have buildable cards but not enough money
  const cheapestBuildable = player.hand
    .filter(c => !player.city.some(d => d.name === c.name))
    .sort((a, b) => a.cost - b.cost)[0];

  if (cheapestBuildable && player.gold < cheapestBuildable.cost) return true;
  if (player.hand.length >= 5) return true; // plenty of cards
  if (player.gold < 2) return true;
  return false;
}

function chooseBestCard(player: Player, drawnCards: DistrictCard[]): number {
  let bestIndex = 0;
  let bestScore = -Infinity;

  for (let i = 0; i < drawnCards.length; i++) {
    const card = drawnCards[i];
    let score = card.cost; // higher cost = more points

    // Prefer types we don't have
    if (!player.city.some(d => d.type === card.type)) score += 3;
    // Avoid duplicates in hand
    if (player.hand.some(c => c.name === card.name)) score -= 5;
    // Avoid duplicates in city
    if (player.city.some(d => d.name === card.name)) score -= 10;
    // Prefer affordable
    if (card.cost <= player.gold + 2) score += 2;
    // Prefer special districts
    if (card.type === 'special') score += 2;

    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return bestIndex;
}

function chooseBestBuild(
  player: Player,
  buildable: { index: number; card: DistrictCard }[]
): number | null {
  if (buildable.length === 0) return null;

  let best = buildable[0];
  let bestScore = -Infinity;

  for (const entry of buildable) {
    let score = entry.card.cost; // more expensive = more points

    // Strong preference for types we don't have in city
    if (!player.city.some(d => d.type === entry.card.type)) score += 5;
    // Special districts are valuable
    if (entry.card.type === 'special') score += 3;
    // Don't overspend if low on gold
    if (player.gold - entry.card.cost < 1) score -= 2;

    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }

  return best.index;
}

function chooseAssassinTarget(state: GameState, player: Player): number {
  // Murder the player closest to winning
  const leader = getLeadingOpponent(state, player);
  // Try to guess what character the leader would pick
  // Simple heuristic: target Architect (7) if leader has gold, King (4) for crown control
  if (leader && leader.city.length >= 6 && leader.gold >= 4) return 7; // Architect
  if (leader && leader.city.length >= 6) return 5; // Bishop (protection)
  // Random between Merchant/Architect/Warlord
  const targets = [4, 5, 6, 7, 8];
  return targets[Math.floor(Math.random() * targets.length)];
}

function chooseThiefTarget(state: GameState, player: Player): number {
  // Steal from characters likely to have gold
  const murdered = state.murderedCharacter;
  const options = [3, 4, 5, 6, 7, 8].filter(r => r !== murdered);
  // Prefer Merchant (6) or Architect (7) — likely to have gold
  if (options.includes(6)) return 6;
  if (options.includes(7)) return 7;
  return options[Math.floor(Math.random() * options.length)];
}

function chooseMagicianAction(state: GameState, player: Player): GameAction | null {
  // If hand is mostly bad (expensive cards we can't afford, or duplicates), swap with richest player
  const badCards = player.hand.filter(
    c => c.cost > player.gold + 4 || player.city.some(d => d.name === c.name)
  );

  if (badCards.length >= player.hand.length / 2) {
    // Swap with player who has the most cards
    const target = state.players
      .filter(p => p.id !== player.id)
      .sort((a, b) => b.hand.length - a.hand.length)[0];
    if (target && target.hand.length > player.hand.length) {
      return { type: 'MAGICIAN_SWAP_PLAYER', playerId: player.id, targetPlayerId: target.id };
    }
  }

  // Otherwise, discard bad cards
  if (badCards.length > 0) {
    const indices = badCards.map(c => player.hand.indexOf(c)).filter(i => i !== -1);
    if (indices.length > 0) {
      return { type: 'MAGICIAN_SWAP_DECK', playerId: player.id, cardIndices: indices };
    }
  }

  return null;
}

function chooseWarlordTarget(state: GameState, player: Player): GameAction | null {
  // Destroy cheapest district of the leader (if not Bishop)
  const opponents = state.players.filter(
    p => p.id !== player.id && p.characterCard?.name !== 'Bishop' && p.city.length < 8
  );

  let bestTarget: { playerId: string; districtIndex: number; cost: number } | null = null;

  for (const opp of opponents) {
    for (let i = 0; i < opp.city.length; i++) {
      const d = opp.city[i];
      if (d.name === 'Keep') continue;
      const destroyCost = Math.max(0, d.cost - 1);
      let adjustedCost = destroyCost;
      if (opp.city.some(x => x.name === 'Great Wall') && d.name !== 'Great Wall') {
        adjustedCost++;
      }
      if (adjustedCost <= player.gold) {
        // Prefer destroying leaders' districts, especially cheap ones
        const priority = opp.city.length * 10 - adjustedCost;
        if (!bestTarget || priority > (state.players.find(p => p.id === bestTarget!.playerId)?.city.length ?? 0) * 10 - bestTarget.cost) {
          bestTarget = { playerId: opp.id, districtIndex: i, cost: adjustedCost };
        }
      }
    }
  }

  if (bestTarget) {
    return {
      type: 'WARLORD_DESTROY',
      playerId: player.id,
      targetPlayerId: bestTarget.playerId,
      districtIndex: bestTarget.districtIndex,
    };
  }

  return null;
}

// ── Helpers ──────────────────────────────────────────────────────

function countDistrictType(player: Player, type: string): number {
  return player.city.filter(d => d.type === type).length;
}

function getMaxOpponentCitySize(state: GameState, player: Player): number {
  return Math.max(0, ...state.players.filter(p => p.id !== player.id).map(p => p.city.length));
}

function getLeadingOpponent(state: GameState, player: Player): Player | null {
  const opponents = state.players.filter(p => p.id !== player.id);
  if (opponents.length === 0) return null;
  return opponents.sort((a, b) => b.city.length - a.city.length)[0];
}
