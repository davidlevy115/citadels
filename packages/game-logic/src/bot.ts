import type { GameState, GameAction, Player, Character, DistrictCard, DistrictType } from './types.js';
import { getAvailableActions } from './engine.js';
import { CHARACTER_INCOME_TYPE } from './constants.js';
import { getCharacterIncomeCount, districtValue } from './characters.js';

export function getBotAction(state: GameState, botPlayerId: string): GameAction | null {
  const actions = getAvailableActions(state, botPlayerId);
  const player = state.players.find(p => p.id === botPlayerId);
  if (!player) return null;

  // ── Pending decisions ──
  if (actions.canGraveyardDecide && state.pendingGraveyard) {
    const card = state.pendingGraveyard.card;
    const worthIt =
      player.gold >= 1 &&
      !player.city.some(d => d.name === card.name) &&
      (card.cost >= 2 || player.hand.length <= 1);
    return { type: worthIt ? 'GRAVEYARD_RECOVER' : 'GRAVEYARD_PASS', playerId: botPlayerId };
  }

  if (actions.canMagistrateDecide && state.pendingMagistrate) {
    // Always worth taking a free district.
    return { type: 'MAGISTRATE_CONFISCATE', playerId: botPlayerId };
  }

  if (actions.canSeerGive && state.pendingSeer) {
    // Hand back the cheapest cards and keep the best of what was taken.
    const ranked = player.hand
      .map((card, cardIndex) => ({ card, cardIndex }))
      .sort((a, b) => a.card.cost - b.card.cost);
    const assignments = state.pendingSeer.recipientIds.map((toPlayerId, i) => ({
      toPlayerId,
      cardIndex: ranked[i].cardIndex,
    }));
    return { type: 'SEER_GIVE', playerId: botPlayerId, assignments };
  }

  if (actions.canBlackmailDecide && state.pendingBlackmail) {
    const pending = state.pendingBlackmail;
    if (pending.stage === 'bribe') {
      // Pay when the bribe is cheap relative to what is at risk.
      const pay = pending.bribeAmount <= 2 || player.gold >= 6;
      return { type: pay ? 'BLACKMAIL_PAY' : 'BLACKMAIL_REFUSE', playerId: botPlayerId };
    }
    // The Blackmailer knows which marker is real.
    const targetRank = state.players.find(p => p.id === state.turnState?.playerId)?.characterCard?.rank;
    const real = state.threats.some(t => t.rank === targetRank && t.real);
    return { type: real ? 'BLACKMAIL_REVEAL' : 'BLACKMAIL_SKIP', playerId: botPlayerId };
  }

  // ── Character draft ──
  if (actions.canChooseCharacter && actions.availableCharacters.length > 0) {
    const rank = chooseBotCharacter(state, player, actions.availableCharacters);
    return { type: 'CHOOSE_CHARACTER', playerId: botPlayerId, characterRank: rank };
  }

  // ── Card choosing ──
  if (actions.canKeepCard && actions.drawnCards.length > 0) {
    const bestIndex = chooseBestCard(player, actions.drawnCards);
    return { type: 'KEEP_CARD', playerId: botPlayerId, cardIndex: bestIndex };
  }

  if (state.phase === 'playerTurns' && state.turnState?.playerId === botPlayerId) {
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
  const opponents = state.players.filter(p => p.id !== playerId);

  // ── Powers that must fire before the gather action ──
  if (actions.canAssassinKill) {
    const target = chooseKillTarget(state, player);
    return target != null
      ? { type: 'ASSASSIN_KILL', playerId, targetRank: target }
      : { type: 'SKIP_POWER', playerId };
  }
  if (actions.canThiefSteal) {
    const target = chooseThiefTarget(state, player);
    return target != null
      ? { type: 'THIEF_STEAL', playerId, targetRank: target }
      : { type: 'SKIP_POWER', playerId };
  }
  if (actions.canMagistrateWarrants) {
    const ranks = pickRanks(state, player, 3);
    if (ranks.length === 3) {
      return { type: 'MAGISTRATE_WARRANTS', playerId, signedRank: ranks[0], otherRanks: ranks.slice(1) };
    }
  }
  if (actions.canBlackmailAssign) {
    const ranks = pickRanks(state, player, 2, 3);
    if (ranks.length === 2) {
      return { type: 'BLACKMAIL_ASSIGN', playerId, realRank: ranks[0], bluffRank: ranks[1] };
    }
  }
  if (actions.canSpy) {
    const target = opponents.sort((a, b) => b.hand.length - a.hand.length)[0];
    if (target) {
      return { type: 'SPY_SPY', playerId, targetPlayerId: target.id, districtType: guessRichestType(target) };
    }
  }

  // ── Gather resources ──
  if (actions.canTakeGold || actions.canDrawCards) {
    if (shouldTakeGold(state, player)) return { type: 'TAKE_GOLD', playerId };
    if (actions.canDrawCards) return { type: 'DRAW_CARDS', playerId };
    return { type: 'TAKE_GOLD', playerId };
  }

  // ── Mandatory powers ──
  if (actions.canWitchBewitch) {
    const target = chooseBewitchTarget(state, player);
    // With nobody left to bewitch the Witch simply ends her turn.
    return target != null
      ? { type: 'WITCH_BEWITCH', playerId, targetRank: target }
      : { type: 'END_TURN', playerId };
  }
  if (actions.canEmperorCrown) {
    // Crown the player furthest from winning, and take whatever they have.
    const target = [...opponents].sort((a, b) => a.city.length - b.city.length)[0];
    if (target) {
      return {
        type: 'EMPEROR_CROWN', playerId, targetPlayerId: target.id,
        take: target.gold > 0 ? 'gold' : 'card',
      };
    }
  }

  // ── Income and extra resources ──
  if (actions.canNavigatorGain) {
    return { type: 'NAVIGATOR_GAIN', playerId, choice: player.hand.length <= 2 ? 'cards' : 'gold' };
  }
  if (actions.canAbbotIncome) {
    const total = getCharacterIncomeCount(player, state.turnState!.effectiveCharacter);
    const cards = player.hand.length <= 1 ? Math.min(1, total) : 0;
    return { type: 'ABBOT_INCOME', playerId, goldCount: total - cards, cardCount: cards };
  }
  if (actions.canCollectIncome) {
    return { type: 'USE_POWER', playerId };
  }
  if (actions.canTaxCollectorCollect) {
    return { type: 'TAX_COLLECTOR_COLLECT', playerId };
  }

  // ── Hand-manipulation powers ──
  if (actions.canMagicianSwap) {
    const swapAction = chooseMagicianAction(state, player);
    if (swapAction) return swapAction;
    return { type: 'SKIP_POWER', playerId };
  }
  if (actions.canWizardTake) {
    const target = opponents.filter(p => p.hand.length > 0).sort((a, b) => b.hand.length - a.hand.length)[0];
    if (target) {
      const best = bestCardIndex(target.hand, player);
      const card = target.hand[best];
      const build = card.cost <= player.gold && !player.city.some(d => d.name === card.name);
      return { type: 'WIZARD_TAKE', playerId, targetPlayerId: target.id, cardIndex: best, build };
    }
    return { type: 'SKIP_POWER', playerId };
  }
  if (actions.canSeerTake) {
    return { type: 'SEER_TAKE', playerId };
  }

  // ── Build ──
  if (actions.canBuildDistrict && actions.buildableCards.length > 0) {
    const best = chooseBestBuild(player, actions.buildableCards);
    if (best !== null) return { type: 'BUILD_DISTRICT', playerId, cardIndex: best };
  }
  if (actions.canCardinalBuild) {
    const cardinalBuild = chooseCardinalBuild(state, player);
    if (cardinalBuild) return cardinalBuild;
  }

  // ── Artist ──
  if (actions.canArtistBeautify) {
    const idx = player.city.findIndex(d => !d.beautified);
    if (idx !== -1 && player.gold >= 2) {
      return { type: 'ARTIST_BEAUTIFY', playerId, districtIndex: idx };
    }
  }

  // ── Aggressive rank 8 powers ──
  if (actions.canWarlordDestroy) {
    const destroyAction = chooseWarlordTarget(state, player);
    if (destroyAction) return destroyAction;
    return { type: 'WARLORD_PASS', playerId };
  }
  if (actions.canMarshalSeize) {
    const seize = chooseMarshalTarget(state, player);
    if (seize) return seize;
    return { type: 'SKIP_POWER', playerId };
  }
  if (actions.canDiplomatExchange) {
    const exchange = chooseDiplomatExchange(state, player);
    if (exchange) return exchange;
    return { type: 'SKIP_POWER', playerId };
  }

  if (actions.canEndTurn) {
    return { type: 'END_TURN', playerId };
  }

  // Nothing sensible left but the turn is still blocked by a mandatory power.
  if (actions.canSkipPower) return { type: 'SKIP_POWER', playerId };

  return null;
}

// ── Character selection strategy ────────────────────────────────

function chooseBotCharacter(state: GameState, player: Player, available: Character[]): number {
  let bestRank = available[0].rank;
  let bestScore = -Infinity;
  const threat = getMaxOpponentCitySize(state, player);

  for (const char of available) {
    let score = scoreCharacter(state, player, char, threat);
    score += Math.random() * 2;
    if (score > bestScore) {
      bestScore = score;
      bestRank = char.rank;
    }
  }

  return bestRank;
}

function scoreCharacter(state: GameState, player: Player, char: Character, threat: number): number {
  const incomeType = CHARACTER_INCOME_TYPE[char.name];
  const incomeValue = incomeType ? countDistrictType(player, incomeType) * 2 : 0;

  switch (char.name) {
    // Rank 1
    case 'Assassin': return (threat >= 6 ? 8 : 3);
    case 'Witch': return (threat >= 6 ? 7 : 4);
    case 'Magistrate': return (threat >= 5 ? 6 : 3);
    // Rank 2
    case 'Thief': return player.gold < 3 ? 6 : 3;
    case 'Spy': return player.gold < 3 ? 5 : 3;
    case 'Blackmailer': return 4;
    // Rank 3
    case 'Magician': return player.hand.length <= 1 ? 6 : 2;
    case 'Wizard': return player.hand.length <= 2 ? 7 : 4;
    case 'Seer': return player.hand.length <= 2 ? 6 : 4;
    // Rank 4
    case 'King': return 4 + incomeValue;
    case 'Emperor': return 4 + incomeValue;
    case 'Patrician': return 3 + incomeValue;
    // Rank 5
    case 'Bishop': return 3 + incomeValue + (threat >= 6 ? 3 : 0);
    case 'Abbot': return 3 + incomeValue;
    case 'Cardinal': return 3 + incomeValue;
    // Rank 6
    case 'Merchant': return 5 + incomeValue;
    case 'Alchemist': return player.hand.length >= 2 ? 8 : 4;
    case 'Trader': return 4 + incomeValue + countDistrictType(player, 'trade');
    // Rank 7
    case 'Architect': return player.gold >= 4 && player.hand.length >= 2 ? 8 : 3;
    case 'Navigator': return player.hand.length <= 1 || player.gold <= 1 ? 6 : 2;
    case 'Scholar': return player.hand.length <= 2 ? 7 : 4;
    // Rank 8
    case 'Warlord': return 3 + incomeValue + (threat >= 6 ? 4 : 0);
    case 'Diplomat': return 3 + incomeValue + (threat >= 6 ? 3 : 0);
    case 'Marshal': return 3 + incomeValue + (threat >= 5 ? 4 : 0);
    // Rank 9
    case 'Queen': return 4;
    case 'Artist': return player.city.length >= 3 && player.gold >= 3 ? 5 : 2;
    case 'Tax Collector': return 3 + Math.min(6, state.taxPot);
    default: return 3;
  }
}

// ── Action strategies ───────────────────────────────────────────

function shouldTakeGold(state: GameState, player: Player): boolean {
  const name = state.turnState?.effectiveCharacter.name;
  // The Alchemist gets its money back, so cards are what it lacks.
  if (name === 'Alchemist' && player.hand.length <= 2) return false;

  const cheapestBuildable = player.hand
    .filter(c => !player.city.some(d => d.name === c.name))
    .sort((a, b) => a.cost - b.cost)[0];

  if (cheapestBuildable && player.gold < cheapestBuildable.cost) return true;
  if (player.hand.length >= 5) return true;
  if (player.gold < 2) return true;
  return false;
}

function chooseBestCard(player: Player, drawnCards: DistrictCard[]): number {
  return bestCardIndex(drawnCards, player);
}

function bestCardIndex(cards: DistrictCard[], player: Player): number {
  let bestIndex = 0;
  let bestScore = -Infinity;

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    let score = card.cost;
    if (!player.city.some(d => d.type === card.type)) score += 3;
    if (player.hand.some(c => c.name === card.name)) score -= 5;
    if (player.city.some(d => d.name === card.name)) score -= 10;
    if (card.cost <= player.gold + 2) score += 2;
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
    let score = entry.card.cost;
    if (!player.city.some(d => d.type === entry.card.type)) score += 5;
    if (entry.card.type === 'special') score += 3;
    if (player.gold - entry.card.cost < 1) score -= 2;

    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }

  return best.index;
}

/**
 * Ranks that are worth naming: in the cast, not our own, not already out of
 * action, and not lying face up on the table as a removed character (the engine
 * rejects those outright, and naming one would waste the power anyway).
 */
function targetableRanks(state: GameState, player: Player, minRank: number): number[] {
  const myRank = player.characterCard?.rank ?? 0;
  const removedFaceUp = state.removedCharactersFaceUp.map(c => c.rank);
  return state.cast
    .map(c => c.rank)
    .filter(r =>
      r >= minRank &&
      r !== myRank &&
      r !== state.murderedCharacter &&
      r !== state.bewitchedCharacter &&
      !removedFaceUp.includes(r)
    );
}

/** Pick `count` distinct ranks to target, most appealing first. */
function pickRanks(state: GameState, player: Player, count: number, minRank = 2): number[] {
  return targetableRanks(state, player, minRank)
    .sort((a, b) => rankAppeal(b) - rankAppeal(a))
    .slice(0, count);
}

function rankAppeal(rank: number): number {
  // Rank 6/7 tend to be the richest and busiest builders.
  return { 6: 5, 7: 5, 4: 4, 8: 3, 5: 3, 3: 2, 2: 1, 9: 1 }[rank] ?? 1;
}

/** First rank from `preference` that can actually be targeted. */
function preferredTarget(state: GameState, player: Player, minRank: number, preference: number[]): number | null {
  const options = targetableRanks(state, player, minRank);
  if (options.length === 0) return null;
  for (const rank of preference) {
    if (options.includes(rank)) return rank;
  }
  return options[Math.floor(Math.random() * options.length)];
}

function chooseKillTarget(state: GameState, player: Player): number | null {
  const leader = getLeadingOpponent(state, player);
  if (leader && leader.city.length >= 6 && leader.gold >= 4) {
    const architect = preferredTarget(state, player, 2, [7]);
    if (architect === 7) return 7;
  }
  if (leader && leader.city.length >= 6) {
    const bishop = preferredTarget(state, player, 2, [5]);
    if (bishop === 5) return 5;
  }
  return preferredTarget(state, player, 2, shuffleRanks([4, 5, 6, 7, 8]));
}

function chooseBewitchTarget(state: GameState, player: Player): number | null {
  // Prefer a powerful character we would enjoy playing ourselves.
  return preferredTarget(state, player, 2, [7, 6, 8, 4, 5, 3, 2, 9]);
}

function chooseThiefTarget(state: GameState, player: Player): number | null {
  return preferredTarget(state, player, 3, [6, 7]);
}

function shuffleRanks(ranks: number[]): number[] {
  return [...ranks].sort(() => Math.random() - 0.5);
}

function guessRichestType(target: Player): DistrictType {
  // Guess the colour the target is most likely to be collecting.
  const counts: Record<string, number> = {};
  for (const d of target.city) counts[d.type] = (counts[d.type] ?? 0) + 1;
  const types: DistrictType[] = ['trade', 'noble', 'religious', 'military', 'special'];
  return types.sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0))[0];
}

function chooseMagicianAction(state: GameState, player: Player): GameAction | null {
  const badCards = player.hand.filter(
    c => c.cost > player.gold + 4 || player.city.some(d => d.name === c.name)
  );

  if (badCards.length >= player.hand.length / 2) {
    const target = state.players
      .filter(p => p.id !== player.id)
      .sort((a, b) => b.hand.length - a.hand.length)[0];
    if (target && target.hand.length > player.hand.length) {
      return { type: 'MAGICIAN_SWAP_PLAYER', playerId: player.id, targetPlayerId: target.id };
    }
  }

  if (badCards.length > 0) {
    const indices = badCards.map(c => player.hand.indexOf(c)).filter(i => i !== -1);
    if (indices.length > 0) {
      return { type: 'MAGICIAN_SWAP_DECK', playerId: player.id, cardIndices: indices };
    }
  }

  return null;
}

function chooseCardinalBuild(state: GameState, player: Player): GameAction | null {
  const lender = state.players
    .filter(p => p.id !== player.id)
    .sort((a, b) => b.gold - a.gold)[0];
  if (!lender) return null;

  for (let i = 0; i < player.hand.length; i++) {
    const card = player.hand[i];
    if (player.city.some(d => d.name === card.name)) continue;
    const shortfall = card.cost - player.gold;
    if (shortfall <= 0) continue;
    if (shortfall > lender.gold) continue;
    if (player.hand.length - 1 < shortfall) continue;
    // Only worth it when the district is clearly better than the cards traded away.
    if (card.cost < shortfall * 2) continue;
    return { type: 'CARDINAL_BUILD', playerId: player.id, cardIndex: i, lenderPlayerId: lender.id };
  }
  return null;
}

function chooseWarlordTarget(state: GameState, player: Player): GameAction | null {
  const opponents = state.players.filter(
    p => p.id !== player.id && p.characterCard?.name !== 'Bishop' && p.city.length < 8
  );

  let bestTarget: { playerId: string; districtIndex: number; priority: number } | null = null;

  for (const opp of opponents) {
    for (let i = 0; i < opp.city.length; i++) {
      const d = opp.city[i];
      if (d.name === 'Keep') continue;
      let cost = Math.max(0, districtValue(d) - 1);
      if (opp.city.some(x => x.name === 'Great Wall') && d.name !== 'Great Wall') cost++;
      if (cost > player.gold) continue;

      const priority = opp.city.length * 10 - cost;
      if (!bestTarget || priority > bestTarget.priority) {
        bestTarget = { playerId: opp.id, districtIndex: i, priority };
      }
    }
  }

  if (!bestTarget) return null;
  return {
    type: 'WARLORD_DESTROY',
    playerId: player.id,
    targetPlayerId: bestTarget.playerId,
    districtIndex: bestTarget.districtIndex,
  };
}

function chooseMarshalTarget(state: GameState, player: Player): GameAction | null {
  const opponents = state.players.filter(
    p => p.id !== player.id && p.characterCard?.name !== 'Bishop' && p.city.length < 8
  );

  let best: { playerId: string; districtIndex: number; value: number } | null = null;
  for (const opp of opponents) {
    for (let i = 0; i < opp.city.length; i++) {
      const d = opp.city[i];
      if (d.name === 'Keep') continue;
      const price = districtValue(d);
      if (price > 3 || price > player.gold) continue;
      if (player.city.some(x => x.name === d.name)) continue;
      const value = price * 10 + opp.city.length;
      if (!best || value > best.value) best = { playerId: opp.id, districtIndex: i, value };
    }
  }

  if (!best) return null;
  return { type: 'MARSHAL_SEIZE', playerId: player.id, targetPlayerId: best.playerId, districtIndex: best.districtIndex };
}

function chooseDiplomatExchange(state: GameState, player: Player): GameAction | null {
  const opponents = state.players.filter(
    p => p.id !== player.id && p.characterCard?.name !== 'Bishop' && p.city.length < 8
  );
  if (player.city.length === 0) return null;

  // Give away our cheapest district for their most valuable affordable one.
  let myIndex = -1;
  for (let i = 0; i < player.city.length; i++) {
    if (player.city[i].name === 'Keep') continue;
    if (myIndex === -1 || districtValue(player.city[i]) < districtValue(player.city[myIndex])) myIndex = i;
  }
  if (myIndex === -1) return null;
  const myValue = districtValue(player.city[myIndex]);

  let best: { playerId: string; districtIndex: number; gain: number } | null = null;
  for (const opp of opponents) {
    const oppHasGreatWall = opp.city.some(x => x.name === 'Great Wall');
    for (let i = 0; i < opp.city.length; i++) {
      const d = opp.city[i];
      if (d.name === 'Keep') continue;
      if (player.city.some((x, xi) => xi !== myIndex && x.name === d.name)) continue;
      if (opp.city.some((x, xi) => xi !== i && x.name === player.city[myIndex].name)) continue;
      // The engine charges the Great Wall surcharge on the district being taken.
      const theirValue = districtValue(d) + (oppHasGreatWall && d.name !== 'Great Wall' ? 1 : 0);
      const difference = Math.max(0, theirValue - myValue);
      if (difference > player.gold) continue;
      const gain = districtValue(d) - myValue - difference * 0.5;
      if (gain <= 0) continue;
      if (!best || gain > best.gain) best = { playerId: opp.id, districtIndex: i, gain };
    }
  }

  if (!best) return null;
  return {
    type: 'DIPLOMAT_EXCHANGE',
    playerId: player.id,
    targetPlayerId: best.playerId,
    theirDistrictIndex: best.districtIndex,
    myDistrictIndex: myIndex,
  };
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
