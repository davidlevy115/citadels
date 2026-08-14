import type {
  GameState, GameConfig, GameAction, Player, Character, DistrictCard, DistrictType,
  TurnState, PlayerGameView, PlayerPublicInfo, RoundEvent, LogEntry,
} from './types.js';
import {
  createDistrictDeck, buildCast, CROWN_TAKING_CHARACTERS,
  STARTING_GOLD, STARTING_HAND_SIZE,
  FACEUP_REMOVED_BY_PLAYER_COUNT, FACEUP_REMOVED_BY_PLAYER_COUNT_9,
  DISTRICTS_TO_WIN, DISTRICTS_TO_WIN_SHORT,
} from './constants.js';
import {
  collectIncome, applyMerchantBonus, applyArchitectDraw, applyAbbotTribute, applyQueenBonus,
  canWarlordDestroy, getWarlordDestroyCost, canTakeDistrictFrom,
  getCardsToDrawCount, getCardsToKeepCount, buildLimitFor, drawCards,
  getCharacterIncomeCount, districtValue, effectiveName,
} from './characters.js';
import { calculateScores, determineWinner } from './scoring.js';
import { shuffle, generateId, cloneState, addLog } from './utils.js';
import { fail } from './errors.js';

function getDistrictsToWin(config?: { shorterGame?: boolean }): number {
  return config?.shorterGame ? DISTRICTS_TO_WIN_SHORT : DISTRICTS_TO_WIN;
}

/** The player taking the current turn. With the Witch this is not the rank's owner. */
function getActivePlayerIndex(state: GameState): number {
  if (state.turnState) {
    return state.players.findIndex(p => p.id === state.turnState!.playerId);
  }
  return state.players.findIndex(p => p.characterCard?.rank === state.currentCharacterRank);
}

function getActivePlayer(state: GameState): Player | null {
  const i = getActivePlayerIndex(state);
  return i === -1 ? null : state.players[i];
}

function castHas(state: GameState, name: string): boolean {
  return state.cast.some(c => c.name === name);
}

// ── Create game ─────────────────────────────────────────────────

export function createGame(config: GameConfig): GameState {
  if (config.players.length < 2 || config.players.length > 7) {
    fail('err.playerCountRange');
  }

  const districtDeck = shuffle(createDistrictDeck());
  const pickRandom = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
  const cast = buildCast(config.characterSetId ?? 'classic', !!config.includeRank9, pickRandom);
  const maxRank = Math.max(...cast.map(c => c.rank));

  const players: Player[] = config.players.map(p => {
    const hand = districtDeck.splice(0, STARTING_HAND_SIZE);
    return {
      id: generateId(),
      name: p.name,
      // Bots that were not given an age get a plausible one so the "oldest starts"
      // rule still produces a fair draw.
      age: p.age ?? (p.isBot ? 20 + Math.floor(Math.random() * 46) : undefined),
      gold: STARTING_GOLD,
      hand,
      city: [],
      characterCard: null,
      isBot: p.isBot,
      botDifficulty: p.botDifficulty,
    };
  });

  const state: GameState = {
    id: generateId(),
    players,
    phase: 'removeCharacters',
    round: 1,

    cast,
    characterSetId: config.characterSetId ?? 'classic',
    maxRank,

    characterDeck: [],
    districtDeck,
    districtDiscard: [],

    removedCharactersFaceDown: [],
    removedCharactersFaceUp: [],
    availableCharacters: [],
    choosingPlayerIndex: 0,

    currentCharacterRank: 0,
    turnState: null,
    murderedCharacter: null,
    robbedCharacter: null,

    bewitchedCharacter: null,
    witchPlayerId: null,
    witchResumePending: false,
    warrants: [],
    magistratePlayerId: null,
    warrantsResolved: [],
    threats: [],
    blackmailerPlayerId: null,
    threatsResolved: [],
    taxPot: 0,
    revealedHands: [],

    pendingGraveyard: null,
    pendingMagistrate: null,
    pendingBlackmail: null,

    crownPlayerIndex: 0,
    firstToEightDistricts: null,
    gameEndTriggered: false,

    scores: null,
    log: [],
  };

  // The oldest player takes the Crown.
  state.crownPlayerIndex = oldestPlayerIndex(players);

  addLog(state, 'game.started', { count: players.length });
  addLog(state, 'game.cast', { characters: cast.map(c => c.name) });
  addLog(state, 'game.crownOldest', { player: players[state.crownPlayerIndex].name });
  return startRemoveCharacters(state);
}

function oldestPlayerIndex(players: Player[]): number {
  let best = 0;
  for (let i = 1; i < players.length; i++) {
    if ((players[i].age ?? -1) > (players[best].age ?? -1)) best = i;
  }
  return best;
}

// ── Phase: Remove Characters ────────────────────────────────────

function startRemoveCharacters(state: GameState): GameState {
  state.phase = 'removeCharacters';
  state.murderedCharacter = null;
  state.robbedCharacter = null;
  state.bewitchedCharacter = null;
  state.witchPlayerId = null;
  state.witchResumePending = false;
  state.warrants = [];
  state.magistratePlayerId = null;
  state.warrantsResolved = [];
  state.threats = [];
  state.blackmailerPlayerId = null;
  state.threatsResolved = [];
  state.revealedHands = [];

  for (const player of state.players) {
    player.characterCard = null;
  }
  state.characterDeck = cloneState(state.cast);
  shuffle(state.characterDeck);

  // 1. Remove one card facedown (nobody sees it)
  state.removedCharactersFaceDown = [state.characterDeck.shift()!];
  state.removedCharactersFaceUp = [];

  // 2. Remove faceup cards based on player count
  const numPlayers = state.players.length;
  const table = state.maxRank >= 9 ? FACEUP_REMOVED_BY_PLAYER_COUNT_9 : FACEUP_REMOVED_BY_PLAYER_COUNT;

  if (numPlayers >= 4 && numPlayers <= 7) {
    const faceUpCount = table[numPlayers] ?? 0;
    for (let i = 0; i < faceUpCount; i++) {
      // The rank 4 character may never be among the faceup discards. The deck
      // is already shuffled, so taking the first card that is not rank 4 is
      // still a uniform draw — and, unlike reshuffling and drawing again,
      // it cannot hand back the rank 4 card a second time.
      const index = state.characterDeck.findIndex(c => c.rank !== 4);
      if (index === -1) break;
      state.removedCharactersFaceUp.push(state.characterDeck.splice(index, 1)[0]);
    }
  }

  state.availableCharacters = [...state.characterDeck];
  state.characterDeck = [];

  state.choosingPlayerIndex = state.crownPlayerIndex;
  state.phase = 'chooseCharacters';

  addLog(state, 'round.selectionBegins', { round: state.round });
  return state;
}

// ── Phase: Choose Characters ────────────────────────────────────

function handleChooseCharacter(state: GameState, playerId: string, characterRank: number): GameState {
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) fail('err.playerNotFound');

  const numPlayers = state.players.length;
  if (playerIndex !== state.choosingPlayerIndex) {
    fail('err.notYourTurnToChoose');
  }

  const charIndex = state.availableCharacters.findIndex(c => c.rank === characterRank);
  if (charIndex === -1) fail('err.characterNotAvailable');

  const character = state.availableCharacters.splice(charIndex, 1)[0];
  state.players[playerIndex].characterCard = character;

  addLog(state, 'player.choseCharacter', { player: state.players[playerIndex].name });

  state.choosingPlayerIndex = (state.choosingPlayerIndex + 1) % numPlayers;

  const allChosen = state.players.every(p => p.characterCard !== null);
  if (allChosen) {
    if (state.availableCharacters.length > 0) {
      state.removedCharactersFaceDown.push(...state.availableCharacters);
      state.availableCharacters = [];
    }
    return startPlayerTurns(state);
  }

  // 7-player special: last player also sees the facedown card
  if (numPlayers === 7) {
    const playersWithCards = state.players.filter(p => p.characterCard !== null).length;
    if (playersWithCards === 6 && state.availableCharacters.length === 1) {
      state.availableCharacters.push(state.removedCharactersFaceDown[0]);
      state.removedCharactersFaceDown = [];
    }
  }

  return state;
}

// ── Phase: Player Turns ─────────────────────────────────────────

function startPlayerTurns(state: GameState): GameState {
  state.phase = 'playerTurns';
  state.currentCharacterRank = 0;
  addLog(state, 'round.selectionComplete');
  return advanceToNextCharacter(state);
}

function advanceToNextCharacter(state: GameState): GameState {
  // The Witch steps back in before the next rank is called.
  if (state.witchResumePending) {
    state.witchResumePending = false;
    return startWitchResume(state);
  }

  state.currentCharacterRank++;

  while (state.currentCharacterRank <= state.maxRank) {
    const playerIndex = state.players.findIndex(
      p => p.characterCard?.rank === state.currentCharacterRank
    );

    if (playerIndex !== -1) {
      const player = state.players[playerIndex];

      if (state.murderedCharacter === state.currentCharacterRank) {
        addLog(state, 'turn.killed', { character: player.characterCard!.name, player: player.name });
        state.currentCharacterRank++;
        continue;
      }

      return startTurnFor(state, playerIndex);
    }

    state.currentCharacterRank++;
  }

  return endRound(state);
}

function startTurnFor(state: GameState, playerIndex: number): GameState {
  const player = state.players[playerIndex];
  const character = player.characterCard!;
  const isBewitched = state.bewitchedCharacter === character.rank;

  addLog(state, 'turn.called', { character: character.name, rank: character.rank, player: player.name });

  // Rank 4 characters that simply take the Crown do so on reveal.
  if (CROWN_TAKING_CHARACTERS.includes(character.name) && character.name !== 'Emperor') {
    state.crownPlayerIndex = playerIndex;
    addLog(state, 'turn.takesCrown', { player: player.name });
  }

  // Thief collects when the robbed character reveals.
  if (state.robbedCharacter === character.rank) {
    const thief = state.players.find(p => p.characterCard?.name === 'Thief');
    if (thief) {
      const stolen = player.gold;
      state.players[playerIndex] = { ...player, gold: 0 };
      const thiefIndex = state.players.findIndex(p => p.id === thief.id);
      state.players[thiefIndex] = { ...thief, gold: thief.gold + stolen };
      addLog(state, 'thief.steals', { player: thief.name, amount: stolen, target: player.name });
    }
  }

  state.turnState = {
    playerId: player.id,
    characterRank: character.rank,
    effectiveCharacter: character,
    phase: 'awaitingAction',
    actionTaken: false,
    powerUsed: false,
    incomeCollected: false,
    districtsBuilt: 0,
    maxDistricts: isBewitched ? 0 : buildLimitFor(character.name),
    drawnCards: [],
    merchantBonusTaken: false,
    specialBuildingsUsed: [],
    goldSpentBuilding: 0,
    beautifiedCount: 0,
    isBewitchedTurn: isBewitched,
    isWitchResume: false,
  };

  if (isBewitched) {
    addLog(state, 'turn.bewitchedNotice', { player: player.name });
  }

  // The Queen's bonus is automatic on reveal.
  if (character.name === 'Queen' && !isBewitched) {
    state = applyQueenBonus(state, playerIndex);
  }

  return state;
}

function startWitchResume(state: GameState): GameState {
  const witchIndex = state.players.findIndex(p => p.id === state.witchPlayerId);
  const bewitchedChar = state.cast.find(c => c.rank === state.bewitchedCharacter);
  if (witchIndex === -1 || !bewitchedChar) {
    // Nothing to resume — carry on with the round.
    return advanceToNextCharacter(state);
  }

  const witch = state.players[witchIndex];
  addLog(state, 'witch.resumes', { player: witch.name, character: bewitchedChar.name });

  state.turnState = {
    playerId: witch.id,
    characterRank: bewitchedChar.rank,
    effectiveCharacter: bewitchedChar,
    phase: 'actionTaken',
    actionTaken: true,     // resources were gathered on the Witch's own turn
    powerUsed: false,
    incomeCollected: false,
    districtsBuilt: 0,
    maxDistricts: buildLimitFor(bewitchedChar.name),
    drawnCards: [],
    merchantBonusTaken: false,
    specialBuildingsUsed: [],
    goldSpentBuilding: 0,
    beautifiedCount: 0,
    isBewitchedTurn: false,
    isWitchResume: true,
  };

  // Abilities that hand out extra resources fire now.
  state = applyMerchantBonus(state, witchIndex);
  state = applyArchitectDraw(state, witchIndex);

  return state;
}

// ── Turn actions ────────────────────────────────────────────────

function handleTakeGold(state: GameState, playerId: string): GameState {
  const playerIndex = validateTurnAction(state, playerId);
  const player = state.players[playerIndex];

  state.players[playerIndex] = { ...player, gold: player.gold + 2 };
  state.turnState!.actionTaken = true;
  state.turnState!.phase = 'actionTaken';
  addLog(state, 'action.takeGold', { player: player.name, total: player.gold + 2 });

  return afterGather(state, playerIndex);
}

function handleDrawCards(state: GameState, playerId: string): GameState {
  const playerIndex = validateTurnAction(state, playerId);
  const player = state.players[playerIndex];

  const drawCount = getCardsToDrawCount(state, player);
  const keepCount = getCardsToKeepCount(state, player);
  const drawn = drawCards(state, drawCount);

  if (keepCount === -1 || drawn.length <= 1) {
    state.players[playerIndex] = { ...player, hand: [...player.hand, ...drawn] };
    state.turnState!.actionTaken = true;
    state.turnState!.phase = 'actionTaken';
    addLog(state, drawn.length === 1 ? 'action.drawKeptOne' : 'action.drawKeptAll', { player: player.name, count: drawn.length });
    return afterGather(state, playerIndex);
  }

  state.turnState!.drawnCards = drawn;
  state.turnState!.phase = 'choosingCard';
  addLog(state, 'action.drawChoose', { player: player.name, count: drawn.length });
  return state;
}

function handleKeepCard(state: GameState, playerId: string, cardIndex: number): GameState {
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) fail('err.playerNotFound');
  if (!state.turnState || state.turnState.phase !== 'choosingCard') {
    fail('err.notInCardChoosingPhase');
  }

  const drawn = state.turnState.drawnCards;
  if (cardIndex < 0 || cardIndex >= drawn.length) fail('err.invalidCardIndex');

  const kept = drawn[cardIndex];
  const returned = drawn.filter((_, i) => i !== cardIndex);

  state.players[playerIndex] = {
    ...state.players[playerIndex],
    hand: [...state.players[playerIndex].hand, kept],
  };

  // The Scholar shuffles the rest back in; everyone else puts them on the bottom.
  if (effectiveName(state) === 'Scholar') {
    state.districtDeck.push(...returned);
    shuffle(state.districtDeck);
  } else {
    state.districtDeck.push(...returned);
  }

  state.turnState.drawnCards = [];
  state.turnState.actionTaken = true;
  state.turnState.phase = 'actionTaken';

  return afterGather(state, playerIndex);
}

/** Everything that fires once the gather action is complete. */
function afterGather(state: GameState, playerIndex: number): GameState {
  if (state.turnState?.isBewitchedTurn) {
    // A bewitched player gathers and stops.
    return endTurnInternal(state);
  }

  state = applyMerchantBonus(state, playerIndex);
  state = applyArchitectDraw(state, playerIndex);
  state = maybeStartBlackmailResolution(state, playerIndex);
  return state;
}

function handleBuildDistrict(state: GameState, playerId: string, cardIndex: number): GameState {
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) fail('err.playerNotFound');
  const turn = state.turnState;
  if (!turn) fail('err.noActiveTurn');
  if (turn.playerId !== playerId) fail('err.notYourTurn');
  if (!turn.actionTaken) fail('err.mustActFirst');
  if (turn.isBewitchedTurn) fail('err.bewitchedCannotBuild');

  const player = state.players[playerIndex];
  const card = player.hand[cardIndex];
  if (!card) fail('err.invalidCardIndex');

  const isTraderFreebie = effectiveName(state) === 'Trader' && card.type === 'trade';
  if (!isTraderFreebie && turn.districtsBuilt >= turn.maxDistricts) {
    if (turn.maxDistricts === 0) fail('err.cannotBuildThisTurn');
    fail('err.buildLimit', { max: turn.maxDistricts });
  }
  if (player.gold < card.cost) fail('err.notEnoughGoldCost', { cost: card.cost, gold: player.gold });
  if (!canBuildDuplicate(state, player) && player.city.some(d => d.name === card.name)) {
    fail('err.duplicateDistrict', { district: card.name });
  }

  const newHand = [...player.hand];
  newHand.splice(cardIndex, 1);

  state.players[playerIndex] = {
    ...player,
    gold: player.gold - card.cost,
    hand: newHand,
    city: [...player.city, { ...card }],
  };

  if (!isTraderFreebie) turn.districtsBuilt++;
  turn.goldSpentBuilding += card.cost;
  addLog(state, 'build.district', { player: player.name, district: card.name, cost: card.cost });

  state = applyTax(state, playerIndex);
  state = checkGameEndTrigger(state, playerIndex);
  state = maybeTriggerWarrant(state, playerIndex, card);

  return state;
}

/** The Wizard may build copies of what they already own for one turn. */
function canBuildDuplicate(state: GameState, player: Player): boolean {
  if (effectiveName(state) === 'Wizard') return true;
  return player.city.some(d => d.name === 'Quarry');
}

/** Every district built costs its builder 1 gold in tax when the Tax Collector is in the cast. */
function applyTax(state: GameState, playerIndex: number): GameState {
  if (!castHas(state, 'Tax Collector')) return state;
  const player = state.players[playerIndex];
  if (player.characterCard?.name === 'Tax Collector') return state;
  if (player.gold <= 0) return state;

  state.players[playerIndex] = { ...player, gold: player.gold - 1 };
  state.taxPot += 1;
  addLog(state, 'tax.paid', { player: player.name, pot: state.taxPot });
  return state;
}

function checkGameEndTrigger(state: GameState, playerIndex: number): GameState {
  const limit = getDistrictsToWin();
  const player = state.players[playerIndex];
  if (player.city.length >= limit && !state.gameEndTriggered) {
    state.gameEndTriggered = true;
    state.firstToEightDistricts = player.id;
    addLog(state, 'build.finalRound', { player: player.name, limit });
  }
  return state;
}

// ── Character powers ────────────────────────────────────────────

function handleAssassinKill(state: GameState, playerId: string, targetRank: number): GameState {
  const playerIndex = validatePowerUse(state, playerId, 'Assassin');
  validateTargetRank(state, targetRank, 2);

  state.murderedCharacter = targetRank;
  state.turnState!.powerUsed = true;

  const targetChar = state.cast.find(c => c.rank === targetRank);
  addLog(state, 'assassin.kills', { player: state.players[playerIndex].name, character: targetChar?.name ?? '' });
  return state;
}

function handleWitchBewitch(state: GameState, playerId: string, targetRank: number): GameState {
  const playerIndex = validatePowerUse(state, playerId, 'Witch');
  if (!state.turnState!.actionTaken) fail('err.witchMustGather');
  validateTargetRank(state, targetRank, 2);

  state.bewitchedCharacter = targetRank;
  state.witchPlayerId = playerId;
  state.turnState!.powerUsed = true;

  const targetChar = state.cast.find(c => c.rank === targetRank);
  addLog(state, 'witch.bewitches', { player: state.players[playerIndex].name, character: targetChar?.name ?? '' });

  // The Witch's turn goes on hold immediately.
  return endTurnInternal(state);
}

function handleMagistrateWarrants(
  state: GameState, playerId: string, signedRank: number, otherRanks: number[]
): GameState {
  const playerIndex = validatePowerUse(state, playerId, 'Magistrate');
  const ranks = [signedRank, ...otherRanks];
  const unique = new Set(ranks);
  if (unique.size !== ranks.length) fail('err.warrantsDistinct');
  for (const r of ranks) validateTargetRank(state, r, 2);

  state.warrants = ranks.map(r => ({ rank: r, signed: r === signedRank }));
  state.magistratePlayerId = playerId;
  state.turnState!.powerUsed = true;
  addLog(state, 'magistrate.warrants', { player: state.players[playerIndex].name, ranks: ranks.slice().sort((a, b) => a - b).join(', ') });
  return state;
}

/** After a warranted player pays for their first district, the Magistrate may confiscate it. */
function maybeTriggerWarrant(state: GameState, builderIndex: number, card: DistrictCard): GameState {
  if (!state.magistratePlayerId || state.warrants.length === 0) return state;
  const builder = state.players[builderIndex];
  const rank = builder.characterCard?.rank;
  if (rank == null) return state;

  const warrant = state.warrants.find(w => w.rank === rank && w.signed);
  if (!warrant) return state;
  if (state.warrantsResolved.includes(rank)) return state;

  const magistrate = state.players.find(p => p.id === state.magistratePlayerId);
  if (!magistrate || magistrate.id === builder.id) return state;
  if (magistrate.city.some(d => d.name === card.name)) return state;  // cannot own a duplicate

  state.warrantsResolved.push(rank);
  state.pendingMagistrate = {
    playerId: magistrate.id,
    targetPlayerId: builder.id,
    card,
  };
  addLog(state, 'magistrate.mayReveal', { player: magistrate.name, target: builder.name, district: card.name });
  return state;
}

function handleMagistrateConfiscate(state: GameState, playerId: string): GameState {
  const pending = state.pendingMagistrate;
  if (!pending) fail('err.noWarrantPending');
  if (pending.playerId !== playerId) fail('err.notYourWarrantDecision');

  const magistrateIndex = state.players.findIndex(p => p.id === playerId);
  const targetIndex = state.players.findIndex(p => p.id === pending.targetPlayerId);
  const target = state.players[targetIndex];

  const cityIndex = target.city.map(d => d.name).lastIndexOf(pending.card.name);
  if (cityIndex === -1) {
    state.pendingMagistrate = null;
    return state;
  }

  const newCity = [...target.city];
  const [confiscated] = newCity.splice(cityIndex, 1);

  // The target gets their gold back; the district is built for free in the Magistrate's city.
  state.players[targetIndex] = { ...target, city: newCity, gold: target.gold + confiscated.cost };
  state.players[magistrateIndex] = {
    ...state.players[magistrateIndex],
    city: [...state.players[magistrateIndex].city, confiscated],
  };

  addLog(state, 'magistrate.confiscates', { player: state.players[magistrateIndex].name, district: confiscated.name, target: target.name });
  state.pendingMagistrate = null;
  return checkGameEndTrigger(state, magistrateIndex);
}

function handleMagistratePass(state: GameState, playerId: string): GameState {
  if (!state.pendingMagistrate) fail('err.noWarrantPending');
  if (state.pendingMagistrate.playerId !== playerId) fail('err.notYourWarrantDecision');
  state.pendingMagistrate = null;
  return state;
}

function handleThiefSteal(state: GameState, playerId: string, targetRank: number): GameState {
  const playerIndex = validatePowerUse(state, playerId, 'Thief');

  validateTargetRank(state, targetRank, 3);
  if (state.murderedCharacter === targetRank) fail('err.stealFromKilled');
  if (state.bewitchedCharacter === targetRank) fail('err.stealFromBewitched');

  state.robbedCharacter = targetRank;
  state.turnState!.powerUsed = true;

  const targetChar = state.cast.find(c => c.rank === targetRank);
  addLog(state, 'thief.targets', { player: state.players[playerIndex].name, character: targetChar?.name ?? '' });
  return state;
}

function handleSpy(state: GameState, playerId: string, targetPlayerId: string, districtType: DistrictType): GameState {
  const playerIndex = validatePowerUse(state, playerId, 'Spy');
  const targetIndex = state.players.findIndex(p => p.id === targetPlayerId);
  if (targetIndex === -1) fail('err.targetPlayerNotFound');
  if (targetPlayerId === playerId) fail('err.cannotSpySelf');

  const target = state.players[targetIndex];
  const matches = target.hand.filter(c => c.type === districtType).length;
  const goldTaken = Math.min(matches, target.gold);

  state.players[targetIndex] = { ...target, gold: target.gold - goldTaken };
  const drawn = drawCards(state, matches);
  state.players[playerIndex] = {
    ...state.players[playerIndex],
    gold: state.players[playerIndex].gold + goldTaken,
    hand: [...state.players[playerIndex].hand, ...drawn],
  };

  state.revealedHands.push({ viewerId: playerId, targetId: targetPlayerId });
  state.turnState!.powerUsed = true;
  addLog(state, 'spy.inspects', {
    player: state.players[playerIndex].name,
    target: target.name,
    districtType,
    matches,
    gold: goldTaken,
    cards: drawn.length,
  });
  return state;
}

function handleBlackmailAssign(state: GameState, playerId: string, realRank: number, bluffRank: number): GameState {
  const playerIndex = validatePowerUse(state, playerId, 'Blackmailer');
  if (realRank === bluffRank) fail('err.threatsDistinct');
  for (const r of [realRank, bluffRank]) {
    validateTargetRank(state, r, 3);
    if (state.murderedCharacter === r) fail('err.threatenKilled');
    if (state.bewitchedCharacter === r) fail('err.threatenBewitched');
  }

  state.threats = [{ rank: realRank, real: true }, { rank: bluffRank, real: false }];
  state.blackmailerPlayerId = playerId;
  state.turnState!.powerUsed = true;
  addLog(state, 'blackmailer.threatens', { player: state.players[playerIndex].name, ranks: [realRank, bluffRank].sort((a, b) => a - b).join(', ') });
  return state;
}

/** A threatened player must settle up right after gathering resources. */
function maybeStartBlackmailResolution(state: GameState, playerIndex: number): GameState {
  if (state.threats.length === 0 || !state.blackmailerPlayerId) return state;
  const turn = state.turnState;
  if (!turn || turn.isWitchResume) return state;

  const player = state.players[playerIndex];
  const rank = player.characterCard?.rank;
  if (rank == null) return state;
  if (!state.threats.some(t => t.rank === rank)) return state;
  if (state.threatsResolved.includes(rank)) return state;
  if (state.blackmailerPlayerId === player.id) return state;

  state.threatsResolved.push(rank);
  state.pendingBlackmail = {
    playerId: player.id,
    blackmailerId: state.blackmailerPlayerId,
    stage: 'bribe',
    bribeAmount: Math.floor(player.gold / 2),
  };
  addLog(state, 'blackmail.mustDecide', { player: player.name });
  return state;
}

function handleBlackmailPay(state: GameState, playerId: string): GameState {
  const pending = state.pendingBlackmail;
  if (!pending || pending.stage !== 'bribe') fail('err.noBribePending');
  if (pending.playerId !== playerId) fail('err.notYourDecision');

  const payerIndex = state.players.findIndex(p => p.id === playerId);
  const blackmailerIndex = state.players.findIndex(p => p.id === pending.blackmailerId);
  const amount = Math.min(pending.bribeAmount, state.players[payerIndex].gold);

  state.players[payerIndex] = { ...state.players[payerIndex], gold: state.players[payerIndex].gold - amount };
  state.players[blackmailerIndex] = { ...state.players[blackmailerIndex], gold: state.players[blackmailerIndex].gold + amount };

  // Bribing removes the marker without ever revealing it.
  state.threats = state.threats.filter(t => t.rank !== state.players[payerIndex].characterCard?.rank);
  addLog(state, 'blackmail.bribes', { player: state.players[payerIndex].name, target: state.players[blackmailerIndex].name, amount });
  state.pendingBlackmail = null;
  return state;
}

function handleBlackmailRefuse(state: GameState, playerId: string): GameState {
  const pending = state.pendingBlackmail;
  if (!pending || pending.stage !== 'bribe') fail('err.noBribePending');
  if (pending.playerId !== playerId) fail('err.notYourDecision');

  addLog(state, 'blackmail.refuses', { player: state.players.find(p => p.id === playerId)?.name ?? '' });
  state.pendingBlackmail = {
    ...pending,
    playerId: pending.blackmailerId,   // the Blackmailer now decides
    stage: 'reveal',
  };
  return state;
}

function handleBlackmailReveal(state: GameState, playerId: string): GameState {
  const pending = state.pendingBlackmail;
  if (!pending || pending.stage !== 'reveal') fail('err.noRevealPending');
  if (pending.playerId !== playerId) fail('err.notYourDecision');

  const blackmailerIndex = state.players.findIndex(p => p.id === pending.blackmailerId);
  const targetIndex = state.players.findIndex(p => p.id === state.turnState?.playerId);
  const target = state.players[targetIndex];
  const rank = target?.characterCard?.rank;
  const threat = state.threats.find(t => t.rank === rank);

  if (threat?.real) {
    const taken = target.gold;
    state.players[targetIndex] = { ...target, gold: 0 };
    state.players[blackmailerIndex] = {
      ...state.players[blackmailerIndex],
      gold: state.players[blackmailerIndex].gold + taken,
    };
    addLog(state, 'blackmail.revealsReal', { player: state.players[blackmailerIndex].name, amount: taken, target: target.name });
  } else {
    addLog(state, 'blackmail.revealsBluff', { player: state.players[blackmailerIndex].name, target: target?.name ?? '' });
  }

  state.threats = state.threats.filter(t => t.rank !== rank);
  state.pendingBlackmail = null;
  return state;
}

function handleBlackmailSkip(state: GameState, playerId: string): GameState {
  const pending = state.pendingBlackmail;
  if (!pending || pending.stage !== 'reveal') fail('err.noRevealPending');
  if (pending.playerId !== playerId) fail('err.notYourDecision');
  addLog(state, 'blackmail.skips', { player: state.players.find(p => p.id === playerId)?.name ?? '' });
  state.pendingBlackmail = null;
  return state;
}

function handleMagicianSwapPlayer(state: GameState, playerId: string, targetPlayerId: string): GameState {
  const playerIndex = validatePowerUse(state, playerId, 'Magician');
  const targetIndex = state.players.findIndex(p => p.id === targetPlayerId);
  if (targetIndex === -1) fail('err.targetPlayerNotFound');
  if (targetIndex === playerIndex) fail('err.cannotSwapSelf');

  const myHand = state.players[playerIndex].hand;
  const theirHand = state.players[targetIndex].hand;

  state.players[playerIndex] = { ...state.players[playerIndex], hand: theirHand };
  state.players[targetIndex] = { ...state.players[targetIndex], hand: myHand };

  state.turnState!.powerUsed = true;
  addLog(state, 'magician.swaps', { player: state.players[playerIndex].name, target: state.players[targetIndex].name });
  return state;
}

function handleMagicianSwapDeck(state: GameState, playerId: string, cardIndices: number[]): GameState {
  const playerIndex = validatePowerUse(state, playerId, 'Magician');
  const player = state.players[playerIndex];

  const sortedIndices = [...new Set(cardIndices)].sort((a, b) => b - a);
  for (const idx of sortedIndices) {
    if (idx < 0 || idx >= player.hand.length) fail('err.invalidCardIndex');
  }

  const newHand = [...player.hand];
  const discarded = [];
  for (const idx of sortedIndices) {
    discarded.push(newHand.splice(idx, 1)[0]);
  }

  state.districtDeck.push(...discarded);
  const drawn = drawCards(state, discarded.length);

  state.players[playerIndex] = { ...player, hand: [...newHand, ...drawn] };
  state.turnState!.powerUsed = true;
  addLog(state, 'magician.discards', { player: player.name, discarded: discarded.length, drawn: drawn.length });
  return state;
}

function handleWizardTake(
  state: GameState, playerId: string, targetPlayerId: string, cardIndex: number, build: boolean
): GameState {
  const playerIndex = validatePowerUse(state, playerId, 'Wizard');
  const targetIndex = state.players.findIndex(p => p.id === targetPlayerId);
  if (targetIndex === -1) fail('err.targetPlayerNotFound');
  if (targetPlayerId === playerId) fail('err.chooseAnotherPlayer');

  const target = state.players[targetIndex];
  const card = target.hand[cardIndex];
  if (!card) fail('err.invalidCardIndex');

  const newTargetHand = [...target.hand];
  newTargetHand.splice(cardIndex, 1);
  state.players[targetIndex] = { ...target, hand: newTargetHand };

  const wizard = state.players[playerIndex];
  if (build) {
    if (wizard.gold < card.cost) fail('err.notEnoughGoldForDistrict', { district: card.name });
    state.players[playerIndex] = {
      ...wizard,
      gold: wizard.gold - card.cost,
      city: [...wizard.city, { ...card }],
    };
    state.turnState!.goldSpentBuilding += card.cost;
    addLog(state, 'wizard.takesAndBuilds', { player: wizard.name, district: card.name, target: target.name });
    state = applyTax(state, playerIndex);
    state = checkGameEndTrigger(state, playerIndex);
  } else {
    state.players[playerIndex] = { ...wizard, hand: [...wizard.hand, card] };
    addLog(state, 'wizard.takesCard', { player: wizard.name, target: target.name });
  }

  state.turnState!.powerUsed = true;
  return state;
}

function handleSeerTake(state: GameState, playerId: string): GameState {
  const playerIndex = validatePowerUse(state, playerId, 'Seer');
  const seer = state.players[playerIndex];

  const donors: number[] = [];
  const taken: DistrictCard[] = [];
  for (let i = 0; i < state.players.length; i++) {
    if (i === playerIndex) continue;
    const p = state.players[i];
    if (p.hand.length === 0) continue;
    const pick = Math.floor(Math.random() * p.hand.length);
    const newHand = [...p.hand];
    const [card] = newHand.splice(pick, 1);
    state.players[i] = { ...p, hand: newHand };
    taken.push(card);
    donors.push(i);
  }

  let hand = [...seer.hand, ...taken];

  // Give one card back to each donor. The Seer keeps their best cards, so the
  // cheapest ones go back out.
  const givenBack: string[] = [];
  for (const donorIndex of donors) {
    if (hand.length === 0) break;
    let worst = 0;
    for (let i = 1; i < hand.length; i++) {
      if (hand[i].cost < hand[worst].cost) worst = i;
    }
    const [card] = hand.splice(worst, 1);
    state.players[donorIndex] = {
      ...state.players[donorIndex],
      hand: [...state.players[donorIndex].hand, card],
    };
    givenBack.push(state.players[donorIndex].name);
  }

  state.players[playerIndex] = { ...state.players[playerIndex], hand };
  state.turnState!.powerUsed = true;
  addLog(state, 'seer.takes', { player: seer.name, count: donors.length });
  return state;
}

function handleEmperorCrown(
  state: GameState, playerId: string, targetPlayerId: string, take: 'gold' | 'card'
): GameState {
  const playerIndex = validatePowerUse(state, playerId, 'Emperor');
  const targetIndex = state.players.findIndex(p => p.id === targetPlayerId);
  if (targetIndex === -1) fail('err.targetPlayerNotFound');
  if (targetPlayerId === playerId) fail('err.crownSomeoneElse');

  state.crownPlayerIndex = targetIndex;
  const target = state.players[targetIndex];
  const emperor = state.players[playerIndex];

  if (take === 'gold' && target.gold > 0) {
    state.players[targetIndex] = { ...target, gold: target.gold - 1 };
    state.players[playerIndex] = { ...emperor, gold: emperor.gold + 1 };
    addLog(state, 'emperor.crownsGold', { player: emperor.name, target: target.name });
  } else if (take === 'card' && target.hand.length > 0) {
    const pick = Math.floor(Math.random() * target.hand.length);
    const newHand = [...target.hand];
    const [card] = newHand.splice(pick, 1);
    state.players[targetIndex] = { ...target, hand: newHand };
    state.players[playerIndex] = { ...emperor, hand: [...emperor.hand, card] };
    addLog(state, 'emperor.crownsCard', { player: emperor.name, target: target.name });
  } else {
    addLog(state, 'emperor.crownsNothing', { player: emperor.name, target: target.name });
  }

  state.turnState!.powerUsed = true;
  return state;
}

function handleAbbotIncome(state: GameState, playerId: string, goldCount: number, cardCount: number): GameState {
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) fail('err.playerNotFound');
  if (!state.turnState || state.turnState.playerId !== playerId) fail('err.notYourTurn');
  if (effectiveName(state) !== 'Abbot') fail('err.notThatCharacter', { character: 'Abbot' });
  if (state.turnState.incomeCollected) fail('err.incomeAlreadyCollected');

  const total = getCharacterIncomeCount(state.players[playerIndex], state.turnState.effectiveCharacter);
  if (goldCount < 0 || cardCount < 0 || goldCount + cardCount !== total) {
    fail('err.abbotSplit', { total });
  }

  const player = state.players[playerIndex];
  const drawn = drawCards(state, cardCount);
  state.players[playerIndex] = {
    ...player,
    gold: player.gold + goldCount,
    hand: [...player.hand, ...drawn],
  };
  if (total > 0) {
    addLog(state, 'abbot.income', { player: player.name, gold: goldCount, cards: drawn.length });
  }

  state.turnState.incomeCollected = true;
  return applyAbbotTribute(state, playerIndex);
}

function handleCardinalBuild(
  state: GameState, playerId: string, cardIndex: number, lenderPlayerId: string
): GameState {
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) fail('err.playerNotFound');
  const turn = state.turnState;
  if (!turn || turn.playerId !== playerId) fail('err.notYourTurn');
  if (effectiveName(state) !== 'Cardinal') fail('err.notThatCharacter', { character: 'Cardinal' });
  if (!turn.actionTaken) fail('err.mustActFirst');
  if (turn.districtsBuilt >= turn.maxDistricts) fail('err.alreadyBuiltThisTurn');

  const cardinal = state.players[playerIndex];
  const card = cardinal.hand[cardIndex];
  if (!card) fail('err.invalidCardIndex');
  if (cardinal.city.some(d => d.name === card.name)) fail('err.duplicateDistrict', { district: card.name });

  const shortfall = card.cost - cardinal.gold;
  if (shortfall <= 0) fail('err.canAffordAlready');

  const lenderIndex = state.players.findIndex(p => p.id === lenderPlayerId);
  if (lenderIndex === -1 || lenderPlayerId === playerId) fail('err.chooseAnotherPlayer');
  const lender = state.players[lenderIndex];
  if (lender.gold < shortfall) fail('err.lenderLacksGold', { player: lender.name, amount: shortfall });

  // One card from the Cardinal's hand for every gold taken (the card being built excluded).
  const payable = cardinal.hand.filter((_, i) => i !== cardIndex);
  if (payable.length < shortfall) fail('err.needSpareCards', { amount: shortfall });

  const newHand = [...cardinal.hand];
  newHand.splice(cardIndex, 1);
  const givenCards = newHand.splice(0, shortfall);

  state.players[lenderIndex] = {
    ...lender,
    gold: lender.gold - shortfall,
    hand: [...lender.hand, ...givenCards],
  };
  state.players[playerIndex] = {
    ...cardinal,
    gold: 0,
    hand: newHand,
    city: [...cardinal.city, { ...card }],
  };

  turn.districtsBuilt++;
  turn.goldSpentBuilding += card.cost;
  addLog(state, 'cardinal.builds', { player: cardinal.name, amount: shortfall, lender: lender.name, district: card.name });

  state = applyTax(state, playerIndex);
  state = checkGameEndTrigger(state, playerIndex);
  return maybeTriggerWarrant(state, playerIndex, card);
}

function handleNavigatorGain(state: GameState, playerId: string, choice: 'gold' | 'cards'): GameState {
  const playerIndex = validatePowerUse(state, playerId, 'Navigator');
  const player = state.players[playerIndex];

  if (choice === 'gold') {
    state.players[playerIndex] = { ...player, gold: player.gold + 4 };
    addLog(state, 'navigator.gold', { player: player.name });
  } else {
    const drawn = drawCards(state, 4);
    state.players[playerIndex] = { ...player, hand: [...player.hand, ...drawn] };
    addLog(state, 'navigator.cards', { player: player.name, count: drawn.length });
  }

  state.turnState!.powerUsed = true;
  return state;
}

function handleWarlordDestroy(
  state: GameState, playerId: string, targetPlayerId: string, districtIndex: number
): GameState {
  const playerIndex = validatePowerUse(state, playerId, 'Warlord');

  const refusal = canWarlordDestroy(state, targetPlayerId, districtIndex, false);
  if (refusal) fail(refusal.code, refusal.params);

  const targetPlayerIndex = state.players.findIndex(p => p.id === targetPlayerId);
  const targetPlayer = state.players[targetPlayerIndex];
  const cost = getWarlordDestroyCost(state, targetPlayerId, districtIndex);

  state.players[playerIndex] = {
    ...state.players[playerIndex],
    gold: state.players[playerIndex].gold - cost,
  };

  const newCity = [...targetPlayer.city];
  const removed = newCity.splice(districtIndex, 1)[0];
  state.players[targetPlayerIndex] = { ...targetPlayer, city: newCity };

  state.turnState!.powerUsed = true;
  addLog(state, 'warlord.destroys', { player: state.players[playerIndex].name, district: removed.name, target: targetPlayer.name, cost });

  const graveyardOwner = state.players.find(
    p => p.city.some(d => d.name === 'Graveyard') && p.id !== playerId
  );
  if (graveyardOwner && removed.name !== 'Graveyard' && graveyardOwner.gold >= 1) {
    state.pendingGraveyard = { playerId: graveyardOwner.id, card: removed };
    addLog(state, 'graveyard.mayRecover', { player: graveyardOwner.name, district: removed.name });
  } else {
    state.districtDiscard.push(removed);
  }

  return state;
}

function handleDiplomatExchange(
  state: GameState, playerId: string, targetPlayerId: string,
  theirDistrictIndex: number, myDistrictIndex: number
): GameState {
  const playerIndex = validatePowerUse(state, playerId, 'Diplomat');
  const refusal = canTakeDistrictFrom(state, targetPlayerId, theirDistrictIndex);
  if (refusal) fail(refusal.code, refusal.params);
  if (targetPlayerId === playerId) fail('err.chooseAnotherPlayer');

  const targetIndex = state.players.findIndex(p => p.id === targetPlayerId);
  const diplomat = state.players[playerIndex];
  const target = state.players[targetIndex];

  const theirs = target.city[theirDistrictIndex];
  const mine = diplomat.city[myDistrictIndex];
  if (!mine) fail('err.chooseOwnDistrict');
  if (mine.name === 'Keep') fail('err.keepCannotExchange');
  if (diplomat.city.some((d, i) => i !== myDistrictIndex && d.name === theirs.name)) {
    fail('err.duplicateDistrict', { district: theirs.name });
  }
  if (target.city.some((d, i) => i !== theirDistrictIndex && d.name === mine.name)) {
    fail('err.targetAlreadyHas', { player: target.name, district: mine.name });
  }

  // Pay the difference when taking the more valuable district. The Great Wall
  // never protects the district the Diplomat is giving away.
  const theirValue = districtValue(theirs) + (target.city.some(d => d.name === 'Great Wall') && theirs.name !== 'Great Wall' ? 1 : 0);
  const myValue = districtValue(mine);
  const difference = Math.max(0, theirValue - myValue);
  if (diplomat.gold < difference) fail('err.notEnoughGoldAmount', { amount: difference });

  const myCity = [...diplomat.city];
  myCity.splice(myDistrictIndex, 1);
  const theirCity = [...target.city];
  theirCity.splice(theirDistrictIndex, 1);

  state.players[playerIndex] = {
    ...diplomat,
    gold: diplomat.gold - difference,
    city: [...myCity, theirs],
  };
  state.players[targetIndex] = {
    ...target,
    gold: target.gold + difference,
    city: [...theirCity, mine],
  };

  state.turnState!.powerUsed = true;
  addLog(state, difference > 0 ? 'diplomat.exchangesPaid' : 'diplomat.exchanges', {
    player: diplomat.name, district: mine.name, target: target.name, district2: theirs.name, paid: difference,
  });
  return state;
}

function handleMarshalSeize(
  state: GameState, playerId: string, targetPlayerId: string, districtIndex: number
): GameState {
  const playerIndex = validatePowerUse(state, playerId, 'Marshal');
  const refusal = canTakeDistrictFrom(state, targetPlayerId, districtIndex);
  if (refusal) fail(refusal.code, refusal.params);
  if (targetPlayerId === playerId) fail('err.chooseAnotherPlayer');

  const targetIndex = state.players.findIndex(p => p.id === targetPlayerId);
  const marshal = state.players[playerIndex];
  const target = state.players[targetIndex];
  const district = target.city[districtIndex];

  const price = districtValue(district);
  if (price > 3) fail('err.marshalCostLimit');
  if (marshal.gold < price) fail('err.notEnoughGoldAmount', { amount: price });
  if (marshal.city.some(d => d.name === district.name)) fail('err.youAlreadyHave', { district: district.name });

  const theirCity = [...target.city];
  theirCity.splice(districtIndex, 1);

  state.players[targetIndex] = { ...target, city: theirCity, gold: target.gold + price };
  state.players[playerIndex] = {
    ...marshal,
    gold: marshal.gold - price,
    city: [...marshal.city, district],
  };

  state.turnState!.powerUsed = true;
  addLog(state, 'marshal.seizes', { player: marshal.name, district: district.name, target: target.name, price });
  return checkGameEndTrigger(state, playerIndex);
}

function handleArtistBeautify(state: GameState, playerId: string, districtIndex: number): GameState {
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) fail('err.playerNotFound');
  const turn = state.turnState;
  if (!turn || turn.playerId !== playerId) fail('err.notYourTurn');
  if (effectiveName(state) !== 'Artist') fail('err.notThatCharacter', { character: 'Artist' });
  if (turn.beautifiedCount >= 2) fail('err.beautifyLimit');

  const player = state.players[playerIndex];
  const district = player.city[districtIndex];
  if (!district) fail('err.districtNotFound');
  if (district.beautified) fail('err.alreadyBeautified');
  if (player.gold < 1) fail('err.needGoldBeautify');

  const newCity = [...player.city];
  newCity[districtIndex] = { ...district, beautified: true };
  state.players[playerIndex] = { ...player, gold: player.gold - 1, city: newCity };
  turn.beautifiedCount++;
  addLog(state, 'artist.beautifies', { player: player.name, district: district.name });
  return state;
}

function handleTaxCollectorCollect(state: GameState, playerId: string): GameState {
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) fail('err.playerNotFound');
  if (!state.turnState || state.turnState.playerId !== playerId) fail('err.notYourTurn');
  if (effectiveName(state) !== 'Tax Collector') fail('err.notThatCharacter', { character: 'Tax Collector' });
  if (state.turnState.powerUsed) fail('err.incomeAlreadyCollected');

  const player = state.players[playerIndex];
  state.players[playerIndex] = { ...player, gold: player.gold + state.taxPot };
  addLog(state, 'taxCollector.collects', { player: player.name, amount: state.taxPot });
  state.taxPot = 0;
  state.turnState.powerUsed = true;
  return state;
}

function handleGraveyardRecover(state: GameState, playerId: string): GameState {
  if (!state.pendingGraveyard) fail('err.noGraveyardPending');
  if (state.pendingGraveyard.playerId !== playerId) fail('err.notYourGraveyardDecision');

  const playerIndex = state.players.findIndex(p => p.id === playerId);
  const player = state.players[playerIndex];
  if (player.gold < 1) fail('err.needGoldGraveyard');

  state.players[playerIndex] = {
    ...player,
    gold: player.gold - 1,
    hand: [...player.hand, state.pendingGraveyard.card],
  };
  addLog(state, 'graveyard.recovers', { player: player.name, district: state.pendingGraveyard.card.name });
  state.pendingGraveyard = null;
  return state;
}

function handleGraveyardPass(state: GameState, playerId: string): GameState {
  if (!state.pendingGraveyard) fail('err.noGraveyardPending');
  if (state.pendingGraveyard.playerId !== playerId) fail('err.notYourGraveyardDecision');

  state.districtDiscard.push(state.pendingGraveyard.card);
  state.pendingGraveyard = null;
  return state;
}

function handleLaboratoryDiscard(state: GameState, playerId: string, cardIndex: number): GameState {
  const playerIndex = validateSpecialBuilding(state, playerId, 'Laboratory');
  const player = state.players[playerIndex];
  if (player.hand.length === 0) fail('err.noCardsToDiscard');
  if (cardIndex < 0 || cardIndex >= player.hand.length) fail('err.invalidCardIndex');

  const discarded = player.hand[cardIndex];
  const newHand = [...player.hand];
  newHand.splice(cardIndex, 1);
  state.districtDiscard.push(discarded);

  state.players[playerIndex] = { ...player, gold: player.gold + 2, hand: newHand };
  state.turnState!.specialBuildingsUsed.push('Laboratory');
  addLog(state, 'laboratory.use', { player: player.name, district: discarded.name });
  return state;
}

function handleSmithyDraw(state: GameState, playerId: string): GameState {
  const playerIndex = validateSpecialBuilding(state, playerId, 'Smithy');
  const player = state.players[playerIndex];
  if (player.gold < 2) fail('err.needGoldSmithy');

  const drawn = drawCards(state, 3);
  state.players[playerIndex] = { ...player, gold: player.gold - 2, hand: [...player.hand, ...drawn] };
  state.turnState!.specialBuildingsUsed.push('Smithy');
  addLog(state, 'smithy.use', { player: player.name, count: drawn.length });
  return state;
}

function validateSpecialBuilding(state: GameState, playerId: string, building: string): number {
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) fail('err.playerNotFound');
  if (!state.turnState) fail('err.noActiveTurn');
  if (state.turnState.playerId !== playerId) fail('err.notYourTurn');
  if (state.turnState.isBewitchedTurn) fail('err.bewitchedCannotUseDistrict');
  if (state.turnState.specialBuildingsUsed.includes(building)) fail('err.buildingAlreadyUsed', { district: building });
  if (!state.players[playerIndex].city.some(d => d.name === building)) {
    fail('err.buildingNotOwned', { district: building });
  }
  return playerIndex;
}

function handleCollectIncome(state: GameState, playerId: string): GameState {
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) fail('err.playerNotFound');
  if (!state.turnState) fail('err.noActiveTurn');
  if (state.turnState.playerId !== playerId) fail('err.notYourTurn');
  if (state.turnState.isBewitchedTurn) fail('err.bewitchedCannotUsePower');
  if (state.turnState.incomeCollected) fail('err.incomeAlreadyCollected');
  state = collectIncome(state, playerIndex, state.turnState.effectiveCharacter);
  state.turnState!.incomeCollected = true;
  return state;
}

function handleSkipPower(state: GameState, playerId: string): GameState {
  const turn = state.turnState;
  if (!turn) fail('err.noActiveTurn');
  if (turn.playerId !== playerId) fail('err.notYourTurn');
  const name = turn.effectiveCharacter.name;
  if (name === 'Witch' || name === 'Emperor') fail('err.mustUsePower', { character: name });
  turn.powerUsed = true;
  return state;
}

// ── End turn ────────────────────────────────────────────────────

function handleEndTurn(state: GameState, playerId: string): GameState {
  const turn = state.turnState;
  if (!turn) fail('err.noActiveTurn');
  if (turn.playerId !== playerId) fail('err.notYourTurn');
  if (!turn.actionTaken) fail('err.mustActBeforeEnding');
  // The Witch must bewitch — unless there is nobody left she is allowed to name.
  if (turn.effectiveCharacter.name === 'Witch' && !turn.powerUsed && targetableRanks(state, 2).length > 0) {
    fail('err.witchMustBewitch');
  }
  if (turn.effectiveCharacter.name === 'Emperor' && !turn.powerUsed) {
    fail('err.emperorMustCrown');
  }
  return endTurnInternal(state);
}

function endTurnInternal(state: GameState): GameState {
  const turn = state.turnState!;
  const playerIndex = state.players.findIndex(p => p.id === turn.playerId);

  // The Alchemist gets back everything they spent building.
  if (turn.effectiveCharacter.name === 'Alchemist' && turn.goldSpentBuilding > 0 && playerIndex !== -1) {
    const player = state.players[playerIndex];
    state.players[playerIndex] = { ...player, gold: player.gold + turn.goldSpentBuilding };
    addLog(state, 'alchemist.refund', { player: player.name, amount: turn.goldSpentBuilding });
  }

  const wasBewitchedTurn = turn.isBewitchedTurn;
  turn.phase = 'turnOver';

  if (wasBewitchedTurn && state.witchPlayerId) {
    state.witchResumePending = true;
  }

  return advanceToNextCharacter(state);
}

// ── End round ───────────────────────────────────────────────────

function endRound(state: GameState): GameState {
  // The Witch only gets her second turn if somebody actually drafted the
  // character she named. Say so plainly — otherwise the turn just vanishes.
  if (state.bewitchedCharacter != null && state.witchPlayerId) {
    const held = state.players.some(p => p.characterCard?.rank === state.bewitchedCharacter);
    if (!held) {
      const witch = state.players.find(p => p.id === state.witchPlayerId);
      const character = state.cast.find(c => c.rank === state.bewitchedCharacter);
      addLog(state, 'witch.noResume', { character: character?.name ?? '', player: witch?.name ?? '' });
    }
  }

  // A killed King or Patrician still inherits the Crown once revealed.
  if (state.murderedCharacter === 4) {
    const rank4 = state.players.find(p => p.characterCard?.rank === 4);
    if (rank4 && rank4.characterCard!.name !== 'Emperor') {
      state.crownPlayerIndex = state.players.findIndex(p => p.id === rank4.id);
      addLog(state, 'heir.takesCrown', { player: rank4.name, character: rank4.characterCard!.name });
    }
  }

  if (state.gameEndTriggered) {
    return endGame(state);
  }

  state.round++;
  state.turnState = null;
  return startRemoveCharacters(state);
}

// ── Game end ────────────────────────────────────────────────────

function endGame(state: GameState): GameState {
  state.phase = 'gameOver';
  state.turnState = null;

  state.scores = calculateScores(state, false);
  const winner = determineWinner(state.scores!, state.players);

  addLog(state, 'game.over', { player: winner.playerName, points: winner.totalPoints });
  return state;
}

// ── Validation helpers ──────────────────────────────────────────

function validateTurnAction(state: GameState, playerId: string): number {
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) fail('err.playerNotFound');
  if (!state.turnState) fail('err.noActiveTurn');
  if (state.turnState.playerId !== playerId) fail('err.notYourTurn');
  if (state.turnState.actionTaken) fail('err.actionAlreadyTaken');
  return playerIndex;
}

/**
 * Characters discarded face up are public knowledge and cannot be held by
 * anyone, so naming one only wastes the power. Rejecting it leaks nothing that
 * is not already on the table.
 */
/** Ranks that may still be named this round. */
function targetableRanks(state: GameState, minRank: number): number[] {
  const removed = state.removedCharactersFaceUp.map(c => c.rank);
  return state.cast
    .map(c => c.rank)
    .filter(r => r >= minRank && r !== state.turnState?.characterRank && !removed.includes(r));
}

function validateTargetRank(state: GameState, rank: number, minRank: number): void {
  if (rank < minRank || rank > state.maxRank) {
    fail('err.invalidTargetRank', { min: minRank, max: state.maxRank });
  }
  const removed = state.removedCharactersFaceUp.find(c => c.rank === rank);
  if (removed) {
    fail('err.removedFaceUp', { character: removed.name });
  }
}

function validatePowerUse(state: GameState, playerId: string, expectedCharacter: string): number {
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) fail('err.playerNotFound');
  const turn = state.turnState;
  if (!turn) fail('err.noActiveTurn');
  if (turn.playerId !== playerId) fail('err.notYourTurn');
  if (turn.isBewitchedTurn) fail('err.bewitchedCannotUsePower');
  if (turn.effectiveCharacter.name !== expectedCharacter) {
    fail('err.notThatCharacter', { character: expectedCharacter });
  }
  if (turn.powerUsed) fail('err.powerAlreadyUsed');
  return playerIndex;
}

// ── Process action (main entry point) ───────────────────────────

const PENDING_ACTIONS = new Set([
  'GRAVEYARD_RECOVER', 'GRAVEYARD_PASS',
  'MAGISTRATE_CONFISCATE', 'MAGISTRATE_PASS',
  'BLACKMAIL_PAY', 'BLACKMAIL_REFUSE', 'BLACKMAIL_REVEAL', 'BLACKMAIL_SKIP',
]);

export function hasPendingDecision(state: GameState): boolean {
  return !!(state.pendingGraveyard || state.pendingMagistrate || state.pendingBlackmail);
}

/** Who must answer the outstanding decision, if any. */
export function pendingDecisionPlayerId(state: GameState): string | null {
  if (state.pendingGraveyard) return state.pendingGraveyard.playerId;
  if (state.pendingMagistrate) return state.pendingMagistrate.playerId;
  if (state.pendingBlackmail) return state.pendingBlackmail.playerId;
  return null;
}

export function processAction(state: GameState, action: GameAction): GameState {
  state = cloneState(state);

  if (hasPendingDecision(state) && !PENDING_ACTIONS.has(action.type)) {
    fail(state.pendingGraveyard ? 'err.waitingGraveyard'
      : state.pendingMagistrate ? 'err.waitingWarrant'
      : 'err.waitingBlackmail');
  }

  const requireTurnPhase = () => {
    if (state.phase !== 'playerTurns') fail('err.notInTurnPhase');
  };

  switch (action.type) {
    case 'START_GAME':
      return state;

    case 'CHOOSE_CHARACTER':
      if (state.phase !== 'chooseCharacters') fail('err.notInCharacterPhase');
      return handleChooseCharacter(state, action.playerId, action.characterRank);

    case 'TAKE_GOLD':
      requireTurnPhase();
      return handleTakeGold(state, action.playerId);

    case 'DRAW_CARDS':
      requireTurnPhase();
      return handleDrawCards(state, action.playerId);

    case 'KEEP_CARD':
      requireTurnPhase();
      return handleKeepCard(state, action.playerId, action.cardIndex);

    case 'BUILD_DISTRICT':
      requireTurnPhase();
      return handleBuildDistrict(state, action.playerId, action.cardIndex);

    case 'USE_POWER':
      requireTurnPhase();
      return handleCollectIncome(state, action.playerId);

    case 'SKIP_POWER':
      requireTurnPhase();
      return handleSkipPower(state, action.playerId);

    case 'END_TURN':
      requireTurnPhase();
      return handleEndTurn(state, action.playerId);

    case 'ASSASSIN_KILL':
      requireTurnPhase();
      return handleAssassinKill(state, action.playerId, action.targetRank);

    case 'WITCH_BEWITCH':
      requireTurnPhase();
      return handleWitchBewitch(state, action.playerId, action.targetRank);

    case 'MAGISTRATE_WARRANTS':
      requireTurnPhase();
      return handleMagistrateWarrants(state, action.playerId, action.signedRank, action.otherRanks);

    case 'MAGISTRATE_CONFISCATE':
      return handleMagistrateConfiscate(state, action.playerId);

    case 'MAGISTRATE_PASS':
      return handleMagistratePass(state, action.playerId);

    case 'THIEF_STEAL':
      requireTurnPhase();
      return handleThiefSteal(state, action.playerId, action.targetRank);

    case 'SPY_SPY':
      requireTurnPhase();
      return handleSpy(state, action.playerId, action.targetPlayerId, action.districtType);

    case 'BLACKMAIL_ASSIGN':
      requireTurnPhase();
      return handleBlackmailAssign(state, action.playerId, action.realRank, action.bluffRank);

    case 'BLACKMAIL_PAY':
      return handleBlackmailPay(state, action.playerId);

    case 'BLACKMAIL_REFUSE':
      return handleBlackmailRefuse(state, action.playerId);

    case 'BLACKMAIL_REVEAL':
      return handleBlackmailReveal(state, action.playerId);

    case 'BLACKMAIL_SKIP':
      return handleBlackmailSkip(state, action.playerId);

    case 'MAGICIAN_SWAP_PLAYER':
      requireTurnPhase();
      return handleMagicianSwapPlayer(state, action.playerId, action.targetPlayerId);

    case 'MAGICIAN_SWAP_DECK':
      requireTurnPhase();
      return handleMagicianSwapDeck(state, action.playerId, action.cardIndices);

    case 'WIZARD_TAKE':
      requireTurnPhase();
      return handleWizardTake(state, action.playerId, action.targetPlayerId, action.cardIndex, action.build);

    case 'SEER_TAKE':
      requireTurnPhase();
      return handleSeerTake(state, action.playerId);

    case 'EMPEROR_CROWN':
      requireTurnPhase();
      return handleEmperorCrown(state, action.playerId, action.targetPlayerId, action.take);

    case 'ABBOT_INCOME':
      requireTurnPhase();
      return handleAbbotIncome(state, action.playerId, action.goldCount, action.cardCount);

    case 'CARDINAL_BUILD':
      requireTurnPhase();
      return handleCardinalBuild(state, action.playerId, action.cardIndex, action.lenderPlayerId);

    case 'NAVIGATOR_GAIN':
      requireTurnPhase();
      return handleNavigatorGain(state, action.playerId, action.choice);

    case 'WARLORD_DESTROY':
      requireTurnPhase();
      return handleWarlordDestroy(state, action.playerId, action.targetPlayerId, action.districtIndex);

    case 'WARLORD_PASS':
      requireTurnPhase();
      if (!state.turnState) fail('err.noActiveTurn');
      state.turnState.powerUsed = true;
      return state;

    case 'DIPLOMAT_EXCHANGE':
      requireTurnPhase();
      return handleDiplomatExchange(state, action.playerId, action.targetPlayerId, action.theirDistrictIndex, action.myDistrictIndex);

    case 'MARSHAL_SEIZE':
      requireTurnPhase();
      return handleMarshalSeize(state, action.playerId, action.targetPlayerId, action.districtIndex);

    case 'ARTIST_BEAUTIFY':
      requireTurnPhase();
      return handleArtistBeautify(state, action.playerId, action.districtIndex);

    case 'TAX_COLLECTOR_COLLECT':
      requireTurnPhase();
      return handleTaxCollectorCollect(state, action.playerId);

    case 'LABORATORY_DISCARD':
      requireTurnPhase();
      return handleLaboratoryDiscard(state, action.playerId, action.cardIndex);

    case 'SMITHY_DRAW':
      requireTurnPhase();
      return handleSmithyDraw(state, action.playerId);

    case 'GRAVEYARD_RECOVER':
      return handleGraveyardRecover(state, action.playerId);

    case 'GRAVEYARD_PASS':
      return handleGraveyardPass(state, action.playerId);

    default:
      throw new Error(`Unknown action type: ${(action as any).type}`);
  }
}

// ── Round events builder ────────────────────────────────────────

/**
 * The headline events of the round, read straight off the log keys. This used
 * to pattern-match English sentences, which broke the moment the log stopped
 * being English.
 */
function buildRoundEvents(state: GameState): RoundEvent[] {
  const events: RoundEvent[] = [];
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const num = (v: unknown) => (typeof v === 'number' ? v : 0);

  for (const entry of currentRoundEntries(state)) {
    const p = entry.params ?? {};

    switch (entry.key) {
      case 'assassin.kills':
        events.push({ type: 'murder', actorName: str(p.player), actorCharacter: 'Assassin', targetCharacter: str(p.character) });
        break;
      case 'witch.bewitches':
        events.push({ type: 'bewitch', actorName: str(p.player), actorCharacter: 'Witch', targetCharacter: str(p.character) });
        break;
      case 'thief.targets':
        events.push({ type: 'steal', actorName: str(p.player), actorCharacter: 'Thief', targetCharacter: str(p.character) });
        break;
      case 'thief.steals': {
        // Fill in the victim on the existing "targets" event once it resolves.
        const existing = events.find(e => e.type === 'steal' && e.actorName === str(p.player));
        if (existing) {
          existing.targetPlayerName = str(p.target);
          existing.detail = String(num(p.amount));
        }
        break;
      }
      case 'magician.swaps':
        events.push({ type: 'swap', actorName: str(p.player), actorCharacter: 'Magician', targetPlayerName: str(p.target) });
        break;
      case 'warlord.destroys':
        events.push({ type: 'destroy', actorName: str(p.player), actorCharacter: 'Warlord', targetPlayerName: str(p.target), detail: str(p.district) });
        break;
      case 'magistrate.confiscates':
        events.push({ type: 'confiscate', actorName: str(p.player), actorCharacter: 'Magistrate', targetPlayerName: str(p.target), detail: str(p.district) });
        break;
      case 'marshal.seizes':
        events.push({ type: 'seize', actorName: str(p.player), actorCharacter: 'Marshal', targetPlayerName: str(p.target), detail: str(p.district) });
        break;
      case 'diplomat.exchanges':
      case 'diplomat.exchangesPaid':
        events.push({ type: 'exchange', actorName: str(p.player), actorCharacter: 'Diplomat', targetPlayerName: str(p.target), detail: str(p.district), detail2: str(p.district2) });
        break;
      case 'spy.inspects':
        events.push({ type: 'spy', actorName: str(p.player), actorCharacter: 'Spy', targetPlayerName: str(p.target) });
        break;
      case 'blackmail.revealsReal':
        events.push({ type: 'blackmail', actorName: str(p.player), actorCharacter: 'Blackmailer', targetPlayerName: str(p.target), detail: String(num(p.amount)) });
        break;
    }
  }

  return events;
}

/** Log entries belonging to the round currently in progress. */
export function currentRoundEntries(state: GameState): LogEntry[] {
  const startIndex = state.log.findIndex(
    e => e.key === 'round.selectionBegins' && e.params?.round === state.round
  );
  return startIndex === -1 ? state.log : state.log.slice(startIndex);
}

// ── Player view ─────────────────────────────────────────────────

export function getPlayerView(state: GameState, playerId: string): PlayerGameView {
  const myIndex = state.players.findIndex(p => p.id === playerId);
  const me = state.players[myIndex];
  const activePlayerIndex = getActivePlayerIndex(state);
  const turn = state.turnState;
  const iAmActive = activePlayerIndex === myIndex && myIndex !== -1;

  const players: PlayerPublicInfo[] = state.players.map(p => ({
    id: p.id,
    name: p.name,
    gold: p.gold,
    city: p.city,
    handSize: p.hand.length,
    isBot: p.isBot,
    revealedCharacter:
      state.phase === 'playerTurns' && p.characterCard && p.characterCard.rank <= state.currentCharacterRank
        ? p.characterCard
        : state.phase === 'gameOver'
          ? p.characterCard
          : null,
  }));

  // Hands I am entitled to look at: the Wizard sees everything while choosing,
  // the Spy keeps whatever they already inspected this round.
  const revealedHands: PlayerGameView['revealedHands'] = [];
  const effName = turn?.effectiveCharacter.name;
  if (iAmActive && turn && effName === 'Wizard' && !turn.powerUsed) {
    for (const p of state.players) {
      if (p.id !== playerId) revealedHands.push({ playerId: p.id, playerName: p.name, cards: p.hand });
    }
  }
  for (const r of state.revealedHands) {
    if (r.viewerId !== playerId) continue;
    if (revealedHands.some(x => x.playerId === r.targetId)) continue;
    const target = state.players.find(p => p.id === r.targetId);
    if (target) revealedHands.push({ playerId: target.id, playerName: target.name, cards: target.hand });
  }

  const magistrateTarget = state.pendingMagistrate
    ? state.players.find(p => p.id === state.pendingMagistrate!.targetPlayerId)
    : null;
  const blackmailer = state.pendingBlackmail
    ? state.players.find(p => p.id === state.pendingBlackmail!.blackmailerId)
    : null;

  return {
    id: state.id,
    phase: state.phase,
    round: state.round,
    myIndex,
    players,
    myHand: me?.hand ?? [],
    myCharacter: me?.characterCard ?? null,

    cast: state.cast,
    characterSetId: state.characterSetId,
    maxRank: state.maxRank,

    availableCharacters:
      state.phase === 'chooseCharacters' && state.choosingPlayerIndex === myIndex
        ? state.availableCharacters
        : [],
    isMyTurnToChoose: state.phase === 'chooseCharacters' && state.choosingPlayerIndex === myIndex,
    removedCharactersFaceUp: state.removedCharactersFaceUp,
    removedCharactersFaceDownCount: state.removedCharactersFaceDown.length,

    currentCharacterRank: state.currentCharacterRank,
    turnState: iAmActive ? turn : (turn ? { ...turn, drawnCards: [] } : null),
    isMyTurn: state.phase === 'playerTurns' && iAmActive,
    pendingGraveyard: state.pendingGraveyard ?? null,
    pendingMagistrate: state.pendingMagistrate
      ? { ...state.pendingMagistrate, targetPlayerName: magistrateTarget?.name ?? '' }
      : null,
    pendingBlackmail: state.pendingBlackmail
      ? { ...state.pendingBlackmail, blackmailerName: blackmailer?.name ?? '' }
      : null,

    revealedHands,
    myWarrants: state.magistratePlayerId === playerId ? state.warrants : [],
    myThreats: state.blackmailerPlayerId === playerId ? state.threats : [],
    warrantedRanks: state.warrants.map(w => w.rank),
    threatenedRanks: state.threats.map(t => t.rank),
    bewitchedCharacter: state.bewitchedCharacter,
    taxPot: state.taxPot,

    crownPlayerIndex: state.crownPlayerIndex,
    gameEndTriggered: state.gameEndTriggered,
    firstToEightDistricts: state.firstToEightDistricts,
    scores: state.scores,
    log: state.log,
    districtDeckCount: state.districtDeck.length,

    murderedCharacter: state.murderedCharacter,
    robbedCharacter: state.robbedCharacter,
    roundEvents: buildRoundEvents(state),
  };
}

// ── Available actions ───────────────────────────────────────────

export interface AvailableActions {
  canChooseCharacter: boolean;
  availableCharacters: Character[];
  canTakeGold: boolean;
  canDrawCards: boolean;
  canKeepCard: boolean;
  drawnCards: DistrictCard[];
  canBuildDistrict: boolean;
  buildableCards: { index: number; card: DistrictCard }[];
  canUsePower: boolean;
  powerType: string | null;
  canCollectIncome: boolean;
  canEndTurn: boolean;
  canAssassinKill: boolean;
  canThiefSteal: boolean;
  canMagicianSwap: boolean;
  canWarlordDestroy: boolean;
  canGraveyardDecide: boolean;
  // Deluxe characters
  canWitchBewitch: boolean;
  canMagistrateWarrants: boolean;
  canMagistrateDecide: boolean;
  canSpy: boolean;
  canBlackmailAssign: boolean;
  canBlackmailDecide: boolean;
  canWizardTake: boolean;
  canSeerTake: boolean;
  canEmperorCrown: boolean;
  canAbbotIncome: boolean;
  canCardinalBuild: boolean;
  canNavigatorGain: boolean;
  canDiplomatExchange: boolean;
  canMarshalSeize: boolean;
  canArtistBeautify: boolean;
  canTaxCollectorCollect: boolean;
  canSkipPower: boolean;
}

const EMPTY_ACTIONS: AvailableActions = {
  canChooseCharacter: false,
  availableCharacters: [],
  canTakeGold: false,
  canDrawCards: false,
  canKeepCard: false,
  drawnCards: [],
  canBuildDistrict: false,
  buildableCards: [],
  canUsePower: false,
  powerType: null,
  canCollectIncome: false,
  canEndTurn: false,
  canAssassinKill: false,
  canThiefSteal: false,
  canMagicianSwap: false,
  canWarlordDestroy: false,
  canGraveyardDecide: false,
  canWitchBewitch: false,
  canMagistrateWarrants: false,
  canMagistrateDecide: false,
  canSpy: false,
  canBlackmailAssign: false,
  canBlackmailDecide: false,
  canWizardTake: false,
  canSeerTake: false,
  canEmperorCrown: false,
  canAbbotIncome: false,
  canCardinalBuild: false,
  canNavigatorGain: false,
  canDiplomatExchange: false,
  canMarshalSeize: false,
  canArtistBeautify: false,
  canTaxCollectorCollect: false,
  canSkipPower: false,
};

export function getAvailableActions(state: GameState, playerId: string): AvailableActions {
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  const player = state.players[playerIndex];
  const turn = state.turnState;

  if (!player) return EMPTY_ACTIONS;

  // Outstanding decisions block everything else.
  if (hasPendingDecision(state)) {
    return {
      ...EMPTY_ACTIONS,
      canGraveyardDecide: state.pendingGraveyard?.playerId === playerId,
      canMagistrateDecide: state.pendingMagistrate?.playerId === playerId,
      canBlackmailDecide: state.pendingBlackmail?.playerId === playerId,
    };
  }

  if (state.phase === 'chooseCharacters' && state.choosingPlayerIndex === playerIndex) {
    return {
      ...EMPTY_ACTIONS,
      canChooseCharacter: true,
      availableCharacters: state.availableCharacters,
    };
  }

  if (state.phase !== 'playerTurns' || !turn) return EMPTY_ACTIONS;
  if (turn.playerId !== playerId) return EMPTY_ACTIONS;

  const name = turn.effectiveCharacter.name;
  const isAwaitingAction = !turn.actionTaken;
  const isChoosingCard = turn.phase === 'choosingCard';
  const hasActed = turn.actionTaken;

  // A bewitched player may only gather resources.
  if (turn.isBewitchedTurn) {
    return {
      ...EMPTY_ACTIONS,
      canTakeGold: isAwaitingAction,
      canDrawCards: isAwaitingAction && state.districtDeck.length > 0,
      canKeepCard: isChoosingCard,
      drawnCards: isChoosingCard ? turn.drawnCards : [],
      canEndTurn: hasActed && !isChoosingCard,
      powerType: name,
    };
  }

  const isTrader = name === 'Trader';
  const canBuild = hasActed && (turn.districtsBuilt < turn.maxDistricts || isTrader);
  const allowDuplicates = name === 'Wizard' || player.city.some(d => d.name === 'Quarry');

  const buildableCards = canBuild
    ? player.hand
        .map((card, index) => ({ index, card }))
        .filter(({ card }) =>
          card.cost <= player.gold &&
          (allowDuplicates || !player.city.some(d => d.name === card.name)) &&
          (turn.districtsBuilt < turn.maxDistricts || (isTrader && card.type === 'trade'))
        )
    : [];

  const powerUnused = !turn.powerUsed;
  const witchHasTargets = name === 'Witch' && targetableRanks(state, 2).length > 0;
  const mustUsePower = powerUnused && (witchHasTargets || name === 'Emperor');

  const incomeCount = getCharacterIncomeCount(player, turn.effectiveCharacter);
  const hasIncomePower = incomeCount > 0 || ['King', 'Emperor', 'Bishop', 'Merchant', 'Warlord', 'Diplomat', 'Marshal', 'Trader', 'Patrician', 'Cardinal'].includes(name);

  return {
    ...EMPTY_ACTIONS,
    canTakeGold: isAwaitingAction,
    canDrawCards: isAwaitingAction && state.districtDeck.length > 0,
    canKeepCard: isChoosingCard,
    drawnCards: isChoosingCard ? turn.drawnCards : [],
    canBuildDistrict: buildableCards.length > 0,
    buildableCards,
    canUsePower: powerUnused,
    powerType: name,
    canCollectIncome: hasActed && !turn.incomeCollected && hasIncomePower && name !== 'Abbot',
    canEndTurn: hasActed && !isChoosingCard && !mustUsePower,

    canAssassinKill: powerUnused && name === 'Assassin',
    canWitchBewitch: powerUnused && witchHasTargets && hasActed,
    canMagistrateWarrants: powerUnused && name === 'Magistrate',
    canThiefSteal: powerUnused && name === 'Thief',
    canSpy: powerUnused && name === 'Spy',
    canBlackmailAssign: powerUnused && name === 'Blackmailer',
    canMagicianSwap: powerUnused && name === 'Magician',
    canWizardTake: powerUnused && name === 'Wizard',
    canSeerTake: powerUnused && name === 'Seer',
    canEmperorCrown: powerUnused && name === 'Emperor',
    canAbbotIncome: !turn.incomeCollected && name === 'Abbot' && hasActed,
    canCardinalBuild: name === 'Cardinal' && hasActed && turn.districtsBuilt < turn.maxDistricts,
    canNavigatorGain: powerUnused && name === 'Navigator' && hasActed,
    canWarlordDestroy: powerUnused && name === 'Warlord' && hasActed,
    canDiplomatExchange: powerUnused && name === 'Diplomat' && hasActed && player.city.length > 0,
    canMarshalSeize: powerUnused && name === 'Marshal' && hasActed,
    canArtistBeautify: name === 'Artist' && turn.beautifiedCount < 2 && player.gold >= 1 &&
      player.city.some(d => !d.beautified),
    canTaxCollectorCollect: powerUnused && name === 'Tax Collector' && state.taxPot > 0,
    canSkipPower: powerUnused && !mustUsePower,
  };
}
