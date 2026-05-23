import type {
  GameState, GameConfig, GameAction, Player, Character,
  TurnState, PlayerGameView, PlayerPublicInfo, LogEntry, RoundEvent,
} from './types.js';
import {
  CHARACTERS, createDistrictDeck,
  STARTING_GOLD, STARTING_HAND_SIZE,
  FACEUP_REMOVED_BY_PLAYER_COUNT, DISTRICTS_TO_WIN, DISTRICTS_TO_WIN_SHORT,
} from './constants.js';
import {
  collectIncome, applyMerchantBonus, applyArchitectDraw,
  canWarlordDestroy, getWarlordDestroyCost,
  getCardsToDrawCount, getCardsToKeepCount,
} from './characters.js';
import { calculateScores, determineWinner } from './scoring.js';
import { shuffle, generateId, cloneState, addLog } from './utils.js';

function getDistrictsToWin(config?: { shorterGame?: boolean }): number {
  return config?.shorterGame ? DISTRICTS_TO_WIN_SHORT : DISTRICTS_TO_WIN;
}

function getActivePlayer(state: GameState): Player | null {
  return state.players.find(p => p.characterCard?.rank === state.currentCharacterRank) ?? null;
}

function getActivePlayerIndex(state: GameState): number {
  return state.players.findIndex(p => p.characterCard?.rank === state.currentCharacterRank);
}

// ── Create game ─────────────────────────────────────────────────

export function createGame(config: GameConfig): GameState {
  if (config.players.length < 2 || config.players.length > 7) {
    throw new Error('Citadels requires 2-7 players.');
  }

  const districtDeck = shuffle(createDistrictDeck());

  const players: Player[] = config.players.map((p, i) => {
    const hand = districtDeck.splice(0, STARTING_HAND_SIZE);
    return {
      id: generateId(),
      name: p.name,
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

    characterDeck: [...CHARACTERS],
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

    crownPlayerIndex: 0, // first player gets crown
    firstToEightDistricts: null,
    gameEndTriggered: false,

    scores: null,
    log: [],
  };

  addLog(state, `Game started with ${players.length} players.`);
  return startRemoveCharacters(state);
}

// ── Phase: Remove Characters ────────────────────────────────────

function startRemoveCharacters(state: GameState): GameState {
  state.phase = 'removeCharacters';
  state.murderedCharacter = null;
  state.robbedCharacter = null;

  // Return all character cards and reset
  for (const player of state.players) {
    player.characterCard = null;
  }
  state.characterDeck = cloneState(CHARACTERS);

  // Shuffle character deck
  shuffle(state.characterDeck);

  // 1. Remove one card facedown (nobody sees it)
  state.removedCharactersFaceDown = [state.characterDeck.shift()!];
  state.removedCharactersFaceUp = [];

  // 2. Remove faceup cards based on player count
  const numPlayers = state.players.length;

  if (numPlayers >= 4 && numPlayers <= 7) {
    const faceUpCount = FACEUP_REMOVED_BY_PLAYER_COUNT[numPlayers] ?? 0;
    for (let i = 0; i < faceUpCount; i++) {
      const card = state.characterDeck.shift()!;
      // Special rule: if King is drawn faceup, replace with another and shuffle King back
      if (card.name === 'King') {
        state.characterDeck.push(card);
        shuffle(state.characterDeck);
        const replacement = state.characterDeck.shift()!;
        state.removedCharactersFaceUp.push(replacement);
      } else {
        state.removedCharactersFaceUp.push(card);
      }
    }
  }

  // Remaining cards are available for choosing
  state.availableCharacters = [...state.characterDeck];
  state.characterDeck = [];

  // Move to choose characters phase
  state.choosingPlayerIndex = state.crownPlayerIndex;
  state.phase = 'chooseCharacters';

  addLog(state, `Round ${state.round}: Character selection begins.`);
  return state;
}

// ── Phase: Choose Characters ────────────────────────────────────

function handleChooseCharacter(state: GameState, playerId: string, characterRank: number): GameState {
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) throw new Error('Player not found.');

  // Determine choosing order based on crown
  const numPlayers = state.players.length;
  const expectedChooserIndex = state.choosingPlayerIndex;

  if (playerIndex !== expectedChooserIndex) {
    throw new Error('Not your turn to choose a character.');
  }

  // Find the character in available pool
  const charIndex = state.availableCharacters.findIndex(c => c.rank === characterRank);
  if (charIndex === -1) throw new Error('Character not available.');

  const character = state.availableCharacters.splice(charIndex, 1)[0];
  state.players[playerIndex].characterCard = character;

  addLog(state, `${state.players[playerIndex].name} chose a character.`);

  // Special handling for 2-player and 3-player games
  if (numPlayers === 2) {
    return handleTwoPlayerDraft(state);
  }
  if (numPlayers === 3) {
    return handleThreePlayerDraft(state);
  }

  // Advance to next player
  state.choosingPlayerIndex = (state.choosingPlayerIndex + 1) % numPlayers;

  // Check if all players have chosen
  const allChosen = state.players.every(p => p.characterCard !== null);
  if (allChosen) {
    // Last remaining card goes facedown
    if (state.availableCharacters.length > 0) {
      state.removedCharactersFaceDown.push(...state.availableCharacters);
      state.availableCharacters = [];
    }
    return startPlayerTurns(state);
  }

  // 7-player special: last player picks between remaining card and facedown card
  if (numPlayers === 7) {
    const playersWithCards = state.players.filter(p => p.characterCard !== null).length;
    if (playersWithCards === 6 && state.availableCharacters.length === 1) {
      // Last player sees the facedown card too
      state.availableCharacters.push(state.removedCharactersFaceDown[0]);
      state.removedCharactersFaceDown = [];
    }
  }

  return state;
}

// Track how many picks each player has made in 2-player mode
function getPickCount(state: GameState): number {
  return state.players.filter(p => p.characterCard !== null).length;
}

function handleTwoPlayerDraft(state: GameState): GameState {
  // 2-player draft is complex: each player picks 2 characters
  // But our type only supports 1 characterCard per player.
  // For simplicity with the current type system, 2-player uses standard draft
  // (each player gets 1 character). The full 2-player variant is a future enhancement.
  // For now, advance normally.
  state.choosingPlayerIndex = (state.choosingPlayerIndex + 1) % state.players.length;
  const allChosen = state.players.every(p => p.characterCard !== null);
  if (allChosen) {
    if (state.availableCharacters.length > 0) {
      state.removedCharactersFaceDown.push(...state.availableCharacters);
      state.availableCharacters = [];
    }
    return startPlayerTurns(state);
  }
  return state;
}

function handleThreePlayerDraft(state: GameState): GameState {
  // Same simplification as 2-player for now
  state.choosingPlayerIndex = (state.choosingPlayerIndex + 1) % state.players.length;
  const allChosen = state.players.every(p => p.characterCard !== null);
  if (allChosen) {
    if (state.availableCharacters.length > 0) {
      state.removedCharactersFaceDown.push(...state.availableCharacters);
      state.availableCharacters = [];
    }
    return startPlayerTurns(state);
  }
  return state;
}

// ── Phase: Player Turns ─────────────────────────────────────────

function startPlayerTurns(state: GameState): GameState {
  state.phase = 'playerTurns';
  state.currentCharacterRank = 0;
  addLog(state, 'Character selection complete. Calling characters...');
  return advanceToNextCharacter(state);
}

function advanceToNextCharacter(state: GameState): GameState {
  state.currentCharacterRank++;

  // Find if any player has this character
  while (state.currentCharacterRank <= 8) {
    const playerIndex = getActivePlayerIndex(state);

    if (playerIndex !== -1) {
      const player = state.players[playerIndex];

      // Check if this character was murdered
      if (state.murderedCharacter === state.currentCharacterRank) {
        addLog(state, `${player.characterCard!.name} was murdered! ${player.name} skips their turn.`);
        state.currentCharacterRank++;
        continue;
      }

      // Start this player's turn
      addLog(state, `${player.characterCard!.name} (#${state.currentCharacterRank}) is called. ${player.name} reveals.`);

      // King gets crown immediately
      if (player.characterCard!.name === 'King') {
        state.crownPlayerIndex = playerIndex;
        addLog(state, `${player.name} takes the Crown.`);
      }

      // Check if robbed
      if (state.robbedCharacter === state.currentCharacterRank) {
        const thief = state.players.find(p => p.characterCard?.name === 'Thief');
        if (thief) {
          const stolen = player.gold;
          state.players[playerIndex] = { ...player, gold: 0 };
          const thiefIndex = state.players.findIndex(p => p.id === thief.id);
          state.players[thiefIndex] = { ...thief, gold: thief.gold + stolen };
          addLog(state, `${thief.name} (Thief) steals ${stolen} gold from ${player.name}!`);
        }
      }

      state.turnState = {
        characterRank: state.currentCharacterRank,
        phase: 'awaitingAction',
        actionTaken: false,
        powerUsed: false,
        incomeCollected: false,
        districtsBuilt: 0,
        maxDistricts: player.characterCard!.name === 'Architect' ? 3 : 1,
        drawnCards: [],
        merchantBonusTaken: false,
      };

      return state;
    }

    state.currentCharacterRank++;
  }

  // All characters called — end of round
  return endRound(state);
}

// ── Turn actions ────────────────────────────────────────────────

function handleTakeGold(state: GameState, playerId: string): GameState {
  const playerIndex = validateTurnAction(state, playerId);
  const player = state.players[playerIndex];

  state.players[playerIndex] = { ...player, gold: player.gold + 2 };
  state.turnState!.actionTaken = true;
  state.turnState!.phase = 'actionTaken';
  addLog(state, `${player.name} takes 2 gold. (Total: ${player.gold + 2})`);

  // Merchant bonus: +1 gold after action
  state = applyMerchantBonus(state, playerIndex);

  // Architect: draw 2 extra cards after action
  state = applyArchitectDraw(state, playerIndex);

  return state;
}

function handleDrawCards(state: GameState, playerId: string): GameState {
  const playerIndex = validateTurnAction(state, playerId);
  const player = state.players[playerIndex];

  const drawCount = getCardsToDrawCount(player);
  const keepCount = getCardsToKeepCount(player);

  const drawn: typeof state.districtDeck = [];
  for (let i = 0; i < drawCount; i++) {
    if (state.districtDeck.length > 0) {
      drawn.push(state.districtDeck.shift()!);
    }
  }

  if (keepCount === -1 || drawn.length <= 1) {
    // Library: keep all drawn cards, or only 1 drawn
    state.players[playerIndex] = {
      ...player,
      hand: [...player.hand, ...drawn],
    };
    state.turnState!.actionTaken = true;
    state.turnState!.phase = 'actionTaken';
    addLog(state, `${player.name} draws ${drawn.length} cards and keeps ${drawn.length === 1 ? 'it' : 'all'}.`);

    state = applyMerchantBonus(state, playerIndex);
    state = applyArchitectDraw(state, playerIndex);
  } else {
    // Must choose which card to keep
    state.turnState!.drawnCards = drawn;
    state.turnState!.phase = 'choosingCard';
    addLog(state, `${player.name} draws ${drawn.length} cards and must choose one to keep.`);
  }

  return state;
}

function handleKeepCard(state: GameState, playerId: string, cardIndex: number): GameState {
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) throw new Error('Player not found.');
  if (!state.turnState || state.turnState.phase !== 'choosingCard') {
    throw new Error('Not in card choosing phase.');
  }

  const drawn = state.turnState.drawnCards;
  if (cardIndex < 0 || cardIndex >= drawn.length) throw new Error('Invalid card index.');

  const kept = drawn[cardIndex];
  const returned = drawn.filter((_, i) => i !== cardIndex);

  state.players[playerIndex] = {
    ...state.players[playerIndex],
    hand: [...state.players[playerIndex].hand, kept],
  };

  // Return unchosen cards to bottom of deck
  state.districtDeck.push(...returned);

  state.turnState.drawnCards = [];
  state.turnState.actionTaken = true;
  state.turnState.phase = 'actionTaken';

  state = applyMerchantBonus(state, playerIndex);
  state = applyArchitectDraw(state, playerIndex);

  return state;
}

function handleBuildDistrict(state: GameState, playerId: string, cardIndex: number): GameState {
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) throw new Error('Player not found.');
  if (!state.turnState) throw new Error('No active turn.');
  if (!state.turnState.actionTaken) throw new Error('Must take an action first.');
  if (state.turnState.districtsBuilt >= state.turnState.maxDistricts) {
    throw new Error(`Cannot build more than ${state.turnState.maxDistricts} districts this turn.`);
  }

  const player = state.players[playerIndex];
  const card = player.hand[cardIndex];
  if (!card) throw new Error('Invalid card index.');
  if (player.gold < card.cost) throw new Error(`Not enough gold. Need ${card.cost}, have ${player.gold}.`);

  // Cannot build duplicate district
  if (player.city.some(d => d.name === card.name)) {
    throw new Error(`You already have ${card.name} in your city.`);
  }

  // Build it
  const newHand = [...player.hand];
  newHand.splice(cardIndex, 1);

  state.players[playerIndex] = {
    ...player,
    gold: player.gold - card.cost,
    hand: newHand,
    city: [...player.city, { ...card }],
  };

  state.turnState.districtsBuilt++;
  addLog(state, `${player.name} builds ${card.name} (cost ${card.cost}).`);

  // Check game end trigger
  const limit = DISTRICTS_TO_WIN; // TODO: support shorter game
  if (state.players[playerIndex].city.length >= limit && !state.gameEndTriggered) {
    state.gameEndTriggered = true;
    state.firstToEightDistricts = player.id;
    addLog(state, `${player.name} has built ${limit} districts! This is the final round.`);
  }

  return state;
}

// ── Character powers ────────────────────────────────────────────

function handleAssassinKill(state: GameState, playerId: string, targetRank: number): GameState {
  const playerIndex = validatePowerUse(state, playerId, 'Assassin');

  if (targetRank < 2 || targetRank > 8) throw new Error('Invalid target. Must be rank 2-8.');
  if (targetRank === 1) throw new Error('Cannot murder the Assassin.');

  state.murderedCharacter = targetRank;
  state.turnState!.powerUsed = true;

  const targetChar = CHARACTERS.find(c => c.rank === targetRank);
  addLog(state, `${state.players[playerIndex].name} (Assassin) murders the ${targetChar?.name ?? 'unknown'}!`);

  return state;
}

function handleThiefSteal(state: GameState, playerId: string, targetRank: number): GameState {
  const playerIndex = validatePowerUse(state, playerId, 'Thief');

  if (targetRank < 3 || targetRank > 8) throw new Error('Invalid target. Must be rank 3-8.');
  if (targetRank === 1) throw new Error('Cannot steal from the Assassin.');
  if (targetRank === 2) throw new Error('Cannot steal from the Thief.');
  if (state.murderedCharacter === targetRank) throw new Error('Cannot steal from the murdered character.');

  state.robbedCharacter = targetRank;
  state.turnState!.powerUsed = true;

  const targetChar = CHARACTERS.find(c => c.rank === targetRank);
  addLog(state, `${state.players[playerIndex].name} (Thief) targets the ${targetChar?.name ?? 'unknown'} for robbery.`);

  return state;
}

function handleMagicianSwapPlayer(state: GameState, playerId: string, targetPlayerId: string): GameState {
  const playerIndex = validatePowerUse(state, playerId, 'Magician');
  const targetIndex = state.players.findIndex(p => p.id === targetPlayerId);
  if (targetIndex === -1) throw new Error('Target player not found.');
  if (targetIndex === playerIndex) throw new Error('Cannot swap with yourself.');

  const myHand = state.players[playerIndex].hand;
  const theirHand = state.players[targetIndex].hand;

  state.players[playerIndex] = { ...state.players[playerIndex], hand: theirHand };
  state.players[targetIndex] = { ...state.players[targetIndex], hand: myHand };

  state.turnState!.powerUsed = true;
  addLog(state, `${state.players[playerIndex].name} (Magician) swaps hands with ${state.players[targetIndex].name}.`);

  return state;
}

function handleMagicianSwapDeck(state: GameState, playerId: string, cardIndices: number[]): GameState {
  const playerIndex = validatePowerUse(state, playerId, 'Magician');
  const player = state.players[playerIndex];

  // Validate indices
  const sortedIndices = [...new Set(cardIndices)].sort((a, b) => b - a);
  for (const idx of sortedIndices) {
    if (idx < 0 || idx >= player.hand.length) throw new Error('Invalid card index.');
  }

  // Remove cards from hand (in reverse order to maintain indices)
  const newHand = [...player.hand];
  const discarded = [];
  for (const idx of sortedIndices) {
    discarded.push(newHand.splice(idx, 1)[0]);
  }

  // Put discarded at bottom of deck
  state.districtDeck.push(...discarded);

  // Draw same number from top
  const drawn = [];
  for (let i = 0; i < discarded.length; i++) {
    if (state.districtDeck.length > 0) {
      drawn.push(state.districtDeck.shift()!);
    }
  }

  state.players[playerIndex] = { ...player, hand: [...newHand, ...drawn] };
  state.turnState!.powerUsed = true;
  addLog(state, `${player.name} (Magician) discards ${discarded.length} cards and draws ${drawn.length} new ones.`);

  return state;
}

function handleWarlordDestroy(
  state: GameState,
  playerId: string,
  targetPlayerId: string,
  districtIndex: number
): GameState {
  const playerIndex = validatePowerUse(state, playerId, 'Warlord');

  const error = canWarlordDestroy(state, targetPlayerId, districtIndex, false);
  if (error) throw new Error(error);

  const targetPlayerIndex = state.players.findIndex(p => p.id === targetPlayerId);
  const targetPlayer = state.players[targetPlayerIndex];
  const district = targetPlayer.city[districtIndex];
  const cost = getWarlordDestroyCost(state, targetPlayerId, districtIndex);

  // Pay cost
  state.players[playerIndex] = {
    ...state.players[playerIndex],
    gold: state.players[playerIndex].gold - cost,
  };

  // Remove district
  const newCity = [...targetPlayer.city];
  const removed = newCity.splice(districtIndex, 1)[0];
  state.players[targetPlayerIndex] = { ...targetPlayer, city: newCity };

  state.turnState!.powerUsed = true;
  addLog(state, `${state.players[playerIndex].name} (Warlord) destroys ${removed.name} in ${targetPlayer.name}'s city (paid ${cost} gold).`);

  // Graveyard: owner can pay 1 gold to recover destroyed district
  const graveyardOwner = state.players.find(
    p => p.city.some(d => d.name === 'Graveyard') && p.id !== targetPlayerId
  );
  if (graveyardOwner && removed.name !== 'Graveyard') {
    if (graveyardOwner.gold >= 1) {
      const gIdx = state.players.findIndex(p => p.id === graveyardOwner.id);
      state.players[gIdx] = {
        ...graveyardOwner,
        gold: graveyardOwner.gold - 1,
        hand: [...graveyardOwner.hand, removed],
      };
      addLog(state, `${graveyardOwner.name} uses Graveyard to recover ${removed.name} for 1 gold.`);
    }
  }

  return state;
}

function handleCollectIncome(state: GameState, playerId: string): GameState {
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) throw new Error('Player not found.');
  if (!state.turnState) throw new Error('No active turn.');
  if (state.turnState.incomeCollected) throw new Error('Income already collected this turn.');
  state = collectIncome(state, playerIndex);
  state.turnState!.incomeCollected = true;
  return state;
}

// ── End turn ────────────────────────────────────────────────────

function handleEndTurn(state: GameState, playerId: string): GameState {
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) throw new Error('Player not found.');
  if (!state.turnState) throw new Error('No active turn.');
  if (!state.turnState.actionTaken) throw new Error('Must take an action before ending turn.');

  state.turnState.phase = 'turnOver';
  return advanceToNextCharacter(state);
}

// ── End round ───────────────────────────────────────────────────

function endRound(state: GameState): GameState {
  // Check if murdered King — heir gets crown
  if (state.murderedCharacter === 4) {
    const kingPlayer = state.players.find(p => p.characterCard?.name === 'King');
    if (kingPlayer) {
      const kingIdx = state.players.findIndex(p => p.id === kingPlayer.id);
      state.crownPlayerIndex = kingIdx;
      addLog(state, `${kingPlayer.name} (murdered King's heir) takes the Crown.`);
    }
  }

  // Check game end
  if (state.gameEndTriggered) {
    return endGame(state);
  }

  // New round
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

  addLog(state, `Game over! ${winner.playerName} wins with ${winner.totalPoints} points!`);

  return state;
}

// ── Validation helpers ──────────────────────────────────────────

function validateTurnAction(state: GameState, playerId: string): number {
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) throw new Error('Player not found.');
  if (!state.turnState) throw new Error('No active turn.');
  if (state.players[playerIndex].characterCard?.rank !== state.currentCharacterRank) {
    throw new Error('Not your turn.');
  }
  if (state.turnState.actionTaken) throw new Error('Action already taken.');
  return playerIndex;
}

function validatePowerUse(state: GameState, playerId: string, expectedCharacter: string): number {
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) throw new Error('Player not found.');
  if (!state.turnState) throw new Error('No active turn.');
  if (state.players[playerIndex].characterCard?.name !== expectedCharacter) {
    throw new Error(`You are not the ${expectedCharacter}.`);
  }
  if (state.turnState.powerUsed) throw new Error('Power already used this turn.');
  return playerIndex;
}

// ── Process action (main entry point) ───────────────────────────

export function processAction(state: GameState, action: GameAction): GameState {
  state = cloneState(state);

  switch (action.type) {
    case 'START_GAME':
      return state; // game starts in createGame

    case 'CHOOSE_CHARACTER':
      if (state.phase !== 'chooseCharacters') throw new Error('Not in character choosing phase.');
      return handleChooseCharacter(state, action.playerId, action.characterRank);

    case 'TAKE_GOLD':
      if (state.phase !== 'playerTurns') throw new Error('Not in player turns phase.');
      return handleTakeGold(state, action.playerId);

    case 'DRAW_CARDS':
      if (state.phase !== 'playerTurns') throw new Error('Not in player turns phase.');
      return handleDrawCards(state, action.playerId);

    case 'KEEP_CARD':
      if (state.phase !== 'playerTurns') throw new Error('Not in player turns phase.');
      return handleKeepCard(state, action.playerId, action.cardIndex);

    case 'BUILD_DISTRICT':
      if (state.phase !== 'playerTurns') throw new Error('Not in player turns phase.');
      return handleBuildDistrict(state, action.playerId, action.cardIndex);

    case 'USE_POWER':
      if (state.phase !== 'playerTurns') throw new Error('Not in player turns phase.');
      return handleCollectIncome(state, action.playerId);

    case 'END_TURN':
      if (state.phase !== 'playerTurns') throw new Error('Not in player turns phase.');
      return handleEndTurn(state, action.playerId);

    case 'ASSASSIN_KILL':
      if (state.phase !== 'playerTurns') throw new Error('Not in player turns phase.');
      return handleAssassinKill(state, action.playerId, action.targetRank);

    case 'THIEF_STEAL':
      if (state.phase !== 'playerTurns') throw new Error('Not in player turns phase.');
      return handleThiefSteal(state, action.playerId, action.targetRank);

    case 'MAGICIAN_SWAP_PLAYER':
      if (state.phase !== 'playerTurns') throw new Error('Not in player turns phase.');
      return handleMagicianSwapPlayer(state, action.playerId, action.targetPlayerId);

    case 'MAGICIAN_SWAP_DECK':
      if (state.phase !== 'playerTurns') throw new Error('Not in player turns phase.');
      return handleMagicianSwapDeck(state, action.playerId, action.cardIndices);

    case 'WARLORD_DESTROY':
      if (state.phase !== 'playerTurns') throw new Error('Not in player turns phase.');
      return handleWarlordDestroy(state, action.playerId, action.targetPlayerId, action.districtIndex);

    case 'WARLORD_PASS':
      if (state.phase !== 'playerTurns') throw new Error('Not in player turns phase.');
      // Warlord chooses not to destroy — just mark power as used
      state.turnState!.powerUsed = true;
      return state;

    default:
      throw new Error(`Unknown action type: ${(action as any).type}`);
  }
}

// ── Round events builder ────────────────────────────────────────

function buildRoundEvents(state: GameState): RoundEvent[] {
  const events: RoundEvent[] = [];
  const roundPrefix = `Round ${state.round}`;

  // Scan log entries from this round for targeting events
  for (const entry of state.log) {
    const msg = entry.message;

    // Assassin murder
    const murderMatch = msg.match(/^(.+?) \(Assassin\) murders the (.+?)!/);
    if (murderMatch) {
      events.push({
        type: 'murder',
        actorName: murderMatch[1],
        actorCharacter: 'Assassin',
        targetCharacter: murderMatch[2],
      });
    }

    // Thief steal target
    const stealMatch = msg.match(/^(.+?) \(Thief\) targets the (.+?) for robbery/);
    if (stealMatch) {
      events.push({
        type: 'steal',
        actorName: stealMatch[1],
        actorCharacter: 'Thief',
        targetCharacter: stealMatch[2],
      });
    }

    // Thief actual steal
    const stolenMatch = msg.match(/^(.+?) \(Thief\) steals (\d+) gold from (.+?)!/);
    if (stolenMatch) {
      // Update existing steal event with victim name
      const existing = events.find(e => e.type === 'steal' && e.actorName === stolenMatch[1]);
      if (existing) {
        existing.targetPlayerName = stolenMatch[3];
        existing.detail = `${stolenMatch[2]} gold stolen`;
      }
    }

    // Magician swap
    const swapMatch = msg.match(/^(.+?) \(Magician\) swaps hands with (.+?)\./);
    if (swapMatch) {
      events.push({
        type: 'swap',
        actorName: swapMatch[1],
        actorCharacter: 'Magician',
        targetPlayerName: swapMatch[2],
      });
    }

    // Warlord destroy
    const destroyMatch = msg.match(/^(.+?) \(Warlord\) destroys (.+?) in (.+?)'s city/);
    if (destroyMatch) {
      events.push({
        type: 'destroy',
        actorName: destroyMatch[1],
        actorCharacter: 'Warlord',
        targetPlayerName: destroyMatch[3],
        detail: destroyMatch[2],
      });
    }
  }

  return events;
}

// ── Player view ─────────────────────────────────────────────────

export function getPlayerView(state: GameState, playerId: string): PlayerGameView {
  const myIndex = state.players.findIndex(p => p.id === playerId);
  const me = state.players[myIndex];
  const activePlayerIndex = getActivePlayerIndex(state);

  const players: PlayerPublicInfo[] = state.players.map((p, i) => ({
    id: p.id,
    name: p.name,
    gold: p.gold,
    city: p.city,
    handSize: p.hand.length,
    isBot: p.isBot,
    // Only show revealed character during playerTurns phase for characters already called
    revealedCharacter:
      state.phase === 'playerTurns' && p.characterCard && p.characterCard.rank <= state.currentCharacterRank
        ? p.characterCard
        : state.phase === 'gameOver'
          ? p.characterCard
          : null,
  }));

  return {
    id: state.id,
    phase: state.phase,
    round: state.round,
    myIndex,
    players,
    myHand: me?.hand ?? [],
    myCharacter: me?.characterCard ?? null,

    availableCharacters:
      state.phase === 'chooseCharacters' && state.choosingPlayerIndex === myIndex
        ? state.availableCharacters
        : [],
    isMyTurnToChoose: state.phase === 'chooseCharacters' && state.choosingPlayerIndex === myIndex,
    removedCharactersFaceUp: state.removedCharactersFaceUp,
    removedCharactersFaceDownCount: state.removedCharactersFaceDown.length,

    currentCharacterRank: state.currentCharacterRank,
    turnState: activePlayerIndex === myIndex ? state.turnState : (state.turnState ? {
      ...state.turnState,
      drawnCards: [], // hide drawn cards from other players
    } : null),
    isMyTurn: state.phase === 'playerTurns' && activePlayerIndex === myIndex,

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
  drawnCards: import('./types.js').DistrictCard[];
  canBuildDistrict: boolean;
  buildableCards: { index: number; card: import('./types.js').DistrictCard }[];
  canUsePower: boolean;
  powerType: string | null;
  canCollectIncome: boolean;
  canEndTurn: boolean;
  canAssassinKill: boolean;
  canThiefSteal: boolean;
  canMagicianSwap: boolean;
  canWarlordDestroy: boolean;
}

export function getAvailableActions(state: GameState, playerId: string): AvailableActions {
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  const player = state.players[playerIndex];
  const turn = state.turnState;

  const empty: AvailableActions = {
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
  };

  if (!player) return empty;

  // Character choosing phase
  if (state.phase === 'chooseCharacters' && state.choosingPlayerIndex === playerIndex) {
    return {
      ...empty,
      canChooseCharacter: true,
      availableCharacters: state.availableCharacters,
    };
  }

  // Not in player turns or not this player's turn
  if (state.phase !== 'playerTurns' || !turn) return empty;
  if (player.characterCard?.rank !== state.currentCharacterRank) return empty;

  const isAwaitingAction = !turn.actionTaken;
  const isChoosingCard = turn.phase === 'choosingCard';
  const hasActed = turn.actionTaken;
  const canBuild = hasActed && turn.districtsBuilt < turn.maxDistricts;

  // Find buildable cards
  const buildableCards = canBuild
    ? player.hand
        .map((card, index) => ({ index, card }))
        .filter(({ card }) => card.cost <= player.gold && !player.city.some(d => d.name === card.name))
    : [];

  // Character power availability
  const charName = player.characterCard?.name;
  const canUsePower = !turn.powerUsed;

  return {
    ...empty,
    canTakeGold: isAwaitingAction,
    canDrawCards: isAwaitingAction && state.districtDeck.length > 0,
    canKeepCard: isChoosingCard,
    drawnCards: isChoosingCard ? turn.drawnCards : [],
    canBuildDistrict: buildableCards.length > 0,
    buildableCards,
    canUsePower: canUsePower && !['Assassin', 'Thief'].includes(charName ?? ''),
    powerType: charName ?? null,
    canCollectIncome: hasActed && !turn.incomeCollected && ['King', 'Bishop', 'Merchant', 'Warlord'].includes(charName ?? ''),
    canEndTurn: hasActed && !isChoosingCard,
    canAssassinKill: canUsePower && charName === 'Assassin',
    canThiefSteal: canUsePower && charName === 'Thief',
    canMagicianSwap: canUsePower && charName === 'Magician',
    canWarlordDestroy: canUsePower && charName === 'Warlord' && hasActed,
  };
}
