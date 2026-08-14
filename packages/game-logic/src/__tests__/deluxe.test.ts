import { describe, it, expect } from 'vitest';
import {
  createGame, processAction, getBotAction, getAvailableActions, getPlayerView, calculateScores,
  hasPendingDecision, pendingDecisionPlayerId,
  CHARACTER_SETS, ALL_CHARACTERS, getCharacterByName, buildCast, buildLimitFor,
  type GameState, type GameConfig,
} from '../index.js';

function botConfig(n: number, setId: string, includeRank9 = false): GameConfig {
  return {
    players: Array.from({ length: n }, (_, i) => ({ name: `Bot ${i + 1}`, isBot: true, age: 20 + i })),
    characterSetId: setId,
    includeRank9,
  };
}

/** Drive a game entirely with bots until it ends or gets stuck. */
function playOut(state: GameState, maxIterations = 8000): { state: GameState; stuck: string | null } {
  let safety = 0;
  while (state.phase !== 'gameOver' && safety++ < maxIterations) {
    let botId: string | null = null;
    if (hasPendingDecision(state)) botId = pendingDecisionPlayerId(state);
    else if (state.phase === 'chooseCharacters') botId = state.players[state.choosingPlayerIndex].id;
    else if (state.phase === 'playerTurns' && state.turnState) botId = state.turnState.playerId;

    if (!botId) return { state, stuck: `no actor in phase ${state.phase}` };

    const action = getBotAction(state, botId);
    if (!action) {
      return { state, stuck: `no action for ${botId} in phase ${state.phase} rank ${state.currentCharacterRank}` };
    }

    try {
      state = processAction(state, action);
    } catch (e: any) {
      return { state, stuck: `${action.type} threw: ${e.message}` };
    }
  }
  return { state, stuck: state.phase === 'gameOver' ? null : 'ran out of iterations' };
}

describe('Character roster', () => {
  it('has three characters for every rank 1-9', () => {
    for (let rank = 1; rank <= 9; rank++) {
      expect(ALL_CHARACTERS.filter(c => c.rank === rank)).toHaveLength(3);
    }
    expect(ALL_CHARACTERS).toHaveLength(27);
  });

  it('every preset set names one character per rank 1-8', () => {
    for (const set of CHARACTER_SETS) {
      if (set.isRandom) continue;
      expect(set.characters, set.name).toHaveLength(8);
      const ranks = set.characters.map(n => getCharacterByName(n).rank).sort((a, b) => a - b);
      expect(ranks, set.name).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    }
  });

  it('builds a cast of 8, or 9 with the rank 9 character', () => {
    const pick = <T,>(a: T[]) => a[0];
    for (const set of CHARACTER_SETS) {
      expect(buildCast(set.id, false, pick), set.name).toHaveLength(8);
      expect(buildCast(set.id, true, pick), set.name).toHaveLength(9);
    }
  });
});

describe('Preset sets play through', () => {
  for (const set of CHARACTER_SETS) {
    it(`${set.name} finishes bot games at every table size`, () => {
      for (let players = 2; players <= 7; players++) {
        const { state, stuck } = playOut(createGame(botConfig(players, set.id)));
        expect(stuck, `${set.name} with ${players} players`).toBeNull();
        expect(state.scores).not.toBeNull();
      }
    });

    it(`${set.name} finishes bot games with the rank 9 character`, () => {
      for (let round = 0; round < 5; round++) {
        const { state, stuck } = playOut(createGame(botConfig(5, set.id, true)));
        expect(stuck, `${set.name} run ${round}`).toBeNull();
        expect(state.maxRank).toBe(9);
      }
    });
  }
});

describe('Crown assignment by age', () => {
  it('gives the Crown to the oldest player', () => {
    const state = createGame({
      players: [
        { name: 'Young', isBot: false, age: 21 },
        { name: 'Elder', isBot: false, age: 64 },
        { name: 'Middle', isBot: false, age: 40 },
      ],
    });
    expect(state.players[state.crownPlayerIndex].name).toBe('Elder');
    expect(state.choosingPlayerIndex).toBe(state.crownPlayerIndex);
  });

  it('gives bots an age so the draw stays fair', () => {
    const state = createGame({
      players: [{ name: 'Human', isBot: false, age: 30 }, { name: 'Bot', isBot: true }],
    });
    expect(typeof state.players[1].age).toBe('number');
  });
});

// ── Individual powers ───────────────────────────────────────────

/** Put a game straight into a given player's turn with a chosen character. */
function turnFor(setId: string, characterName: any, numPlayers = 4): GameState {
  let state = createGame(botConfig(numPlayers, setId));
  const char = getCharacterByName(characterName);
  state.phase = 'playerTurns';
  state.availableCharacters = [];
  // Deterministic setup: nothing removed face up unless a test says otherwise.
  state.removedCharactersFaceUp = [];
  state.players.forEach((p, i) => {
    p.characterCard = state.cast[i % state.cast.length];
  });
  state.players[0].characterCard = char;
  // Make sure nobody else holds the same rank.
  const others = state.cast.filter(c => c.rank !== char.rank);
  state.players.forEach((p, i) => { if (i > 0) p.characterCard = others[(i - 1) % others.length]; });
  state.currentCharacterRank = char.rank;
  state.turnState = {
    playerId: state.players[0].id,
    characterRank: char.rank,
    effectiveCharacter: char,
    phase: 'awaitingAction',
    actionTaken: false,
    powerUsed: false,
    incomeCollected: false,
    districtsBuilt: 0,
    maxDistricts: buildLimitFor(char.name),
    drawnCards: [],
    merchantBonusTaken: false,
    specialBuildingsUsed: [],
    goldSpentBuilding: 0,
    beautifiedCount: 0,
    isBewitchedTurn: false,
    isWitchResume: false,
  };
  return state;
}

describe('Deluxe powers', () => {
  it('Navigator gains 4 gold and cannot build', () => {
    let state = turnFor('devious-dignitaries', 'Navigator');
    const me = state.players[0].id;
    const before = state.players[0].gold;
    state = processAction(state, { type: 'TAKE_GOLD', playerId: me });
    state = processAction(state, { type: 'NAVIGATOR_GAIN', playerId: me, choice: 'gold' });
    expect(state.players[0].gold).toBe(before + 2 + 4);
    expect(getAvailableActions(state, me).canBuildDistrict).toBe(false);
  });

  it('Alchemist gets its building gold back at the end of the turn', () => {
    let state = turnFor('cunning-agents', 'Alchemist');
    const me = state.players[0].id;
    state.players[0].gold = 10;
    state.players[0].hand = [{ id: 'x', name: 'Palace', cost: 5, type: 'noble' }];
    state = processAction(state, { type: 'TAKE_GOLD', playerId: me });
    state = processAction(state, { type: 'BUILD_DISTRICT', playerId: me, cardIndex: 0 });
    expect(state.players[0].gold).toBe(7);
    state = processAction(state, { type: 'END_TURN', playerId: me });
    expect(state.players.find(p => p.id === me)!.gold).toBe(12);
  });

  it('Trader builds trade districts outside the building limit', () => {
    let state = turnFor('ambitious-aristocrats', 'Trader');
    const me = state.players[0].id;
    state.players[0].gold = 20;
    state.players[0].hand = [
      { id: 'a', name: 'Tavern', cost: 1, type: 'trade' },
      { id: 'b', name: 'Market', cost: 2, type: 'trade' },
      { id: 'c', name: 'Manor', cost: 3, type: 'noble' },
    ];
    state = processAction(state, { type: 'TAKE_GOLD', playerId: me });
    state = processAction(state, { type: 'BUILD_DISTRICT', playerId: me, cardIndex: 0 });
    state = processAction(state, { type: 'BUILD_DISTRICT', playerId: me, cardIndex: 0 });
    state = processAction(state, { type: 'BUILD_DISTRICT', playerId: me, cardIndex: 0 });
    expect(state.players[0].city.map(d => d.name)).toEqual(['Tavern', 'Market', 'Manor']);
    // The one non-trade district used up the limit.
    expect(state.turnState!.districtsBuilt).toBe(1);
  });

  it('Patrician draws cards instead of gold for noble districts', () => {
    let state = turnFor('vicious-nobles', 'Patrician');
    const me = state.players[0].id;
    state.players[0].city = [
      { id: 'n1', name: 'Manor', cost: 3, type: 'noble' },
      { id: 'n2', name: 'Castle', cost: 4, type: 'noble' },
    ];
    const goldBefore = state.players[0].gold;
    const handBefore = state.players[0].hand.length;
    state = processAction(state, { type: 'TAKE_GOLD', playerId: me });
    state = processAction(state, { type: 'USE_POWER', playerId: me });
    expect(state.players[0].hand.length).toBe(handBefore + 2);
    expect(state.players[0].gold).toBe(goldBefore + 2);
  });

  it('Abbot splits its income and taxes the richest player', () => {
    let state = turnFor('cunning-agents', 'Abbot');
    const me = state.players[0].id;
    state.players[0].gold = 1;
    state.players[1].gold = 12;
    state.players[0].city = [
      { id: 'r1', name: 'Temple', cost: 1, type: 'religious' },
      { id: 'r2', name: 'Church', cost: 2, type: 'religious' },
    ];
    state = processAction(state, { type: 'TAKE_GOLD', playerId: me });   // gold = 3
    state = processAction(state, { type: 'ABBOT_INCOME', playerId: me, goldCount: 1, cardCount: 1 });
    // 3 + 1 income + 1 tribute from the richest player
    expect(state.players[0].gold).toBe(5);
    expect(state.players[1].gold).toBe(11);
  });

  it('Marshal seizes a cheap district and pays the owner', () => {
    let state = turnFor('ambitious-aristocrats', 'Marshal');
    const me = state.players[0].id;
    state.players[0].gold = 5;
    state.players[1].gold = 0;
    state.players[1].city = [{ id: 't', name: 'Tavern', cost: 1, type: 'trade' }];
    state = processAction(state, { type: 'TAKE_GOLD', playerId: me });
    state = processAction(state, {
      type: 'MARSHAL_SEIZE', playerId: me, targetPlayerId: state.players[1].id, districtIndex: 0,
    });
    expect(state.players[0].city.map(d => d.name)).toEqual(['Tavern']);
    expect(state.players[1].city).toHaveLength(0);
    expect(state.players[1].gold).toBe(1);
    expect(state.players[0].gold).toBe(6);
  });

  it('Diplomat swaps districts and pays the difference', () => {
    let state = turnFor('illustrious-emissaries', 'Diplomat');
    const me = state.players[0].id;
    state.players[0].gold = 5;
    state.players[0].city = [{ id: 'a', name: 'Tavern', cost: 1, type: 'trade' }];
    state.players[1].city = [{ id: 'b', name: 'Palace', cost: 5, type: 'noble' }];
    state.players[1].characterCard = state.cast.find(c => c.rank === 6)!;
    state = processAction(state, { type: 'TAKE_GOLD', playerId: me });
    state = processAction(state, {
      type: 'DIPLOMAT_EXCHANGE', playerId: me,
      targetPlayerId: state.players[1].id, theirDistrictIndex: 0, myDistrictIndex: 0,
    });
    expect(state.players[0].city.map(d => d.name)).toEqual(['Palace']);
    expect(state.players[1].city.map(d => d.name)).toEqual(['Tavern']);
    expect(state.players[0].gold).toBe(3);  // 5 + 2 gathered - 4 difference
  });

  it('Artist beautifies at most two districts', () => {
    let state = turnFor('illustrious-emissaries', 'Artist', 5);
    const me = state.players[0].id;
    state.players[0].gold = 5;
    state.players[0].city = [
      { id: 'a', name: 'Tavern', cost: 1, type: 'trade' },
      { id: 'b', name: 'Market', cost: 2, type: 'trade' },
      { id: 'c', name: 'Manor', cost: 3, type: 'noble' },
    ];
    state = processAction(state, { type: 'TAKE_GOLD', playerId: me });
    state = processAction(state, { type: 'ARTIST_BEAUTIFY', playerId: me, districtIndex: 0 });
    state = processAction(state, { type: 'ARTIST_BEAUTIFY', playerId: me, districtIndex: 1 });
    expect(() =>
      processAction(state, { type: 'ARTIST_BEAUTIFY', playerId: me, districtIndex: 2 })
    ).toThrow('at most 2');
    expect(state.players[0].city[0].beautified).toBe(true);

    // Beautified districts are worth an extra point at the end of the game.
    const scores = calculateScores(state, false);
    expect(scores[0].districtPoints).toBe(1 + 2 + 3 + 2);
  });

  it('Tax Collector takes a cut of every district built', () => {
    let state = createGame(botConfig(4, 'vicious-nobles', true));
    state.phase = 'playerTurns';
    const taxman = state.cast.find(c => c.name === 'Tax Collector')!;
    const merchant = state.cast.find(c => c.rank === 6)!;
    state.players[0].characterCard = merchant;
    state.players[1].characterCard = taxman;
    state.players[2].characterCard = state.cast.find(c => c.rank === 3)!;
    state.players[3].characterCard = state.cast.find(c => c.rank === 5)!;
    state.currentCharacterRank = merchant.rank;
    state.turnState = {
      playerId: state.players[0].id, characterRank: merchant.rank, effectiveCharacter: merchant,
      phase: 'awaitingAction', actionTaken: false, powerUsed: false, incomeCollected: false,
      districtsBuilt: 0, maxDistricts: 1, drawnCards: [], merchantBonusTaken: false,
      specialBuildingsUsed: [], goldSpentBuilding: 0, beautifiedCount: 0,
      isBewitchedTurn: false, isWitchResume: false,
    };
    const me = state.players[0].id;
    state.players[0].gold = 10;
    state.players[0].hand = [{ id: 'x', name: 'Tavern', cost: 1, type: 'trade' }];
    state = processAction(state, { type: 'TAKE_GOLD', playerId: me });
    state = processAction(state, { type: 'BUILD_DISTRICT', playerId: me, cardIndex: 0 });
    expect(state.taxPot).toBe(1);
  });

  it('Witch bewitches, the target is stunted, and the Witch resumes', () => {
    let state = createGame(botConfig(4, 'cunning-agents'));
    state.phase = 'playerTurns';
    const witch = state.cast.find(c => c.name === 'Witch')!;
    const rank6 = state.cast.find(c => c.rank === 6)!;
    state.players[0].characterCard = witch;
    state.players[1].characterCard = rank6;
    state.players[2].characterCard = state.cast.find(c => c.rank === 3)!;
    state.players[3].characterCard = state.cast.find(c => c.rank === 5)!;
    state.currentCharacterRank = 0;
    state = processAction(state, { type: 'START_GAME' });
    // Drive the round with bots and confirm the Witch's second turn happens.
    state.currentCharacterRank = 0;
    state.turnState = null;
    state.phase = 'playerTurns';

    // Manually walk into the Witch's turn
    let s = state;
    s.currentCharacterRank = 1;
    s.turnState = {
      playerId: s.players[0].id, characterRank: 1, effectiveCharacter: witch,
      phase: 'awaitingAction', actionTaken: false, powerUsed: false, incomeCollected: false,
      districtsBuilt: 0, maxDistricts: 0, drawnCards: [], merchantBonusTaken: false,
      specialBuildingsUsed: [], goldSpentBuilding: 0, beautifiedCount: 0,
      isBewitchedTurn: false, isWitchResume: false,
    };
    const witchId = s.players[0].id;
    s = processAction(s, { type: 'TAKE_GOLD', playerId: witchId });
    s = processAction(s, { type: 'WITCH_BEWITCH', playerId: witchId, targetRank: 6 });
    expect(s.bewitchedCharacter).toBe(6);

    // Fast-forward through everyone else with the bot driver.
    const { state: done, stuck } = playOut(s);
    expect(stuck).toBeNull();
    expect(done.log.some(l => l.message.includes('resumes their turn as the'))).toBe(true);
  });

  it('the Witch cannot build on her own turn', () => {
    const state = turnFor('cunning-agents', 'Witch');
    expect(state.turnState!.maxDistricts).toBe(0);
    const me = state.players[0].id;
    state.players[0].gold = 20;
    state.players[0].hand = [{ id: 'x', name: 'Tavern', cost: 1, type: 'trade' }];
    const afterGather = processAction(state, { type: 'TAKE_GOLD', playerId: me });
    expect(getAvailableActions(afterGather, me).canBuildDistrict).toBe(false);
    expect(() =>
      processAction(afterGather, { type: 'BUILD_DISTRICT', playerId: me, cardIndex: 0 })
    ).toThrow('cannot build');
  });

  it('characters removed face up cannot be named by any power', () => {
    const state = turnFor('cunning-agents', 'Witch');
    const me = state.players[0].id;
    // Put a rank 6 character face up on the table.
    const rank6 = state.cast.find(c => c.rank === 6)!;
    state.removedCharactersFaceUp = [rank6];
    state.players.forEach(p => { if (p.characterCard?.rank === 6) p.characterCard = null; });

    const gathered = processAction(state, { type: 'TAKE_GOLD', playerId: me });
    expect(() =>
      processAction(gathered, { type: 'WITCH_BEWITCH', playerId: me, targetRank: 6 })
    ).toThrow('removed face up');

    // ...and the same guard covers the other targeting powers.
    const assassinState = turnFor('tenacious-delegates', 'Assassin');
    assassinState.removedCharactersFaceUp = [assassinState.cast.find(c => c.rank === 6)!];
    expect(() =>
      processAction(assassinState, { type: 'ASSASSIN_KILL', playerId: assassinState.players[0].id, targetRank: 6 })
    ).toThrow('removed face up');
  });

  it('says so plainly when nobody was playing the bewitched character', () => {
    let state = createGame(botConfig(4, 'cunning-agents'));
    const witch = state.cast.find(c => c.name === 'Witch')!;
    const rank5 = state.cast.find(c => c.rank === 5)!;
    const rank8 = state.cast.find(c => c.rank === 8)!;

    state.phase = 'playerTurns';
    state.removedCharactersFaceUp = [];
    state.players.forEach(p => { p.characterCard = null; });
    state.players[0].characterCard = witch;
    state.players[1].characterCard = rank5;
    state.players[2].characterCard = rank8;
    // Nobody holds rank 6.

    state.currentCharacterRank = 1;
    state.turnState = {
      playerId: state.players[0].id, characterRank: 1, effectiveCharacter: witch,
      phase: 'awaitingAction', actionTaken: false, powerUsed: false, incomeCollected: false,
      districtsBuilt: 0, maxDistricts: 0, drawnCards: [], merchantBonusTaken: false,
      specialBuildingsUsed: [], goldSpentBuilding: 0, beautifiedCount: 0,
      isBewitchedTurn: false, isWitchResume: false,
    };

    const me = state.players[0].id;
    state = processAction(state, { type: 'TAKE_GOLD', playerId: me });
    state = processAction(state, { type: 'WITCH_BEWITCH', playerId: me, targetRank: 6 });

    const { state: after, stuck } = playOut(state, 300);
    expect(stuck).toBeNull();
    expect(after.log.some(l => /Nobody was playing the .* does not resume their turn/.test(l.message)))
      .toBe(true);
  });

  it('Magistrate confiscates the first district a warranted player pays for', () => {
    let state = createGame(botConfig(4, 'devious-dignitaries'));
    const magistrate = state.cast.find(c => c.name === 'Magistrate')!;
    const rank6 = state.cast.find(c => c.rank === 6)!;
    state.phase = 'playerTurns';
    state.players[0].characterCard = magistrate;
    state.players[1].characterCard = rank6;
    state.players[2].characterCard = state.cast.find(c => c.rank === 3)!;
    state.players[3].characterCard = state.cast.find(c => c.rank === 5)!;

    state.magistratePlayerId = state.players[0].id;
    state.warrants = [{ rank: 6, signed: true }, { rank: 3, signed: false }, { rank: 5, signed: false }];

    state.currentCharacterRank = rank6.rank;
    state.turnState = {
      playerId: state.players[1].id, characterRank: rank6.rank, effectiveCharacter: rank6,
      phase: 'awaitingAction', actionTaken: false, powerUsed: false, incomeCollected: false,
      districtsBuilt: 0, maxDistricts: 1, drawnCards: [], merchantBonusTaken: false,
      specialBuildingsUsed: [], goldSpentBuilding: 0, beautifiedCount: 0,
      isBewitchedTurn: false, isWitchResume: false,
    };
    const builder = state.players[1].id;
    state.players[1].gold = 10;
    state.players[1].hand = [{ id: 'x', name: 'Palace', cost: 5, type: 'noble' }];

    state = processAction(state, { type: 'TAKE_GOLD', playerId: builder });
    state = processAction(state, { type: 'BUILD_DISTRICT', playerId: builder, cardIndex: 0 });

    expect(state.pendingMagistrate).not.toBeNull();
    state = processAction(state, { type: 'MAGISTRATE_CONFISCATE', playerId: state.players[0].id });
    expect(state.players[0].city.map(d => d.name)).toEqual(['Palace']);
    expect(state.players[1].city).toHaveLength(0);
  });

  it('Blackmailer takes everything when the real threat is revealed', () => {
    let state = createGame(botConfig(4, 'devious-dignitaries'));
    const blackmailer = state.cast.find(c => c.name === 'Blackmailer')!;
    const rank6 = state.cast.find(c => c.rank === 6)!;
    state.phase = 'playerTurns';
    state.players[0].characterCard = blackmailer;
    state.players[1].characterCard = rank6;
    state.players[2].characterCard = state.cast.find(c => c.rank === 3)!;
    state.players[3].characterCard = state.cast.find(c => c.rank === 5)!;
    state.blackmailerPlayerId = state.players[0].id;
    state.threats = [{ rank: 6, real: true }, { rank: 5, real: false }];

    state.currentCharacterRank = rank6.rank;
    state.turnState = {
      playerId: state.players[1].id, characterRank: rank6.rank, effectiveCharacter: rank6,
      phase: 'awaitingAction', actionTaken: false, powerUsed: false, incomeCollected: false,
      districtsBuilt: 0, maxDistricts: 1, drawnCards: [], merchantBonusTaken: false,
      specialBuildingsUsed: [], goldSpentBuilding: 0, beautifiedCount: 0,
      isBewitchedTurn: false, isWitchResume: false,
    };
    state.players[1].gold = 8;
    state = processAction(state, { type: 'TAKE_GOLD', playerId: state.players[1].id });

    expect(state.pendingBlackmail?.stage).toBe('bribe');
    state = processAction(state, { type: 'BLACKMAIL_REFUSE', playerId: state.players[1].id });
    expect(state.pendingBlackmail?.stage).toBe('reveal');
    state = processAction(state, { type: 'BLACKMAIL_REVEAL', playerId: state.players[0].id });
    expect(state.players[1].gold).toBe(0);
    expect(state.players[0].gold).toBeGreaterThanOrEqual(10);
  });

  it('Wizard steals a card from a hand and may build it for free of the limit', () => {
    let state = turnFor('devious-dignitaries', 'Wizard');
    const me = state.players[0].id;
    state.players[0].gold = 10;
    state.players[1].hand = [{ id: 'y', name: 'Palace', cost: 5, type: 'noble' }];
    state = processAction(state, { type: 'TAKE_GOLD', playerId: me });
    state = processAction(state, {
      type: 'WIZARD_TAKE', playerId: me, targetPlayerId: state.players[1].id, cardIndex: 0, build: true,
    });
    expect(state.players[0].city.map(d => d.name)).toEqual(['Palace']);
    expect(state.turnState!.districtsBuilt).toBe(0);   // did not consume the limit
  });

  it('Seer takes a card from everyone and gives one back', () => {
    let state = turnFor('tenacious-delegates', 'Seer');
    const me = state.players[0].id;
    const handSizes = state.players.map(p => p.hand.length);
    state = processAction(state, { type: 'TAKE_GOLD', playerId: me });
    state = processAction(state, { type: 'SEER_TAKE', playerId: me });
    // Everyone ends with the hand size they started with.
    expect(state.players.map(p => p.hand.length)).toEqual(handSizes);
  });

  it('Emperor hands the Crown on and takes a resource', () => {
    let state = turnFor('cunning-agents', 'Emperor');
    const me = state.players[0].id;
    state.crownPlayerIndex = 0;
    state.players[1].gold = 5;
    state = processAction(state, { type: 'TAKE_GOLD', playerId: me });
    expect(getAvailableActions(state, me).canEndTurn).toBe(false);   // must pass the Crown
    state = processAction(state, {
      type: 'EMPEROR_CROWN', playerId: me, targetPlayerId: state.players[1].id, take: 'gold',
    });
    expect(state.crownPlayerIndex).toBe(1);
    expect(state.players[1].gold).toBe(4);
    expect(getAvailableActions(state, me).canEndTurn).toBe(true);
  });

  it('Spy takes gold for every matching card and draws replacements', () => {
    let state = turnFor('illustrious-emissaries', 'Spy');
    const me = state.players[0].id;
    state.players[1].gold = 10;
    state.players[1].hand = [
      { id: 'a', name: 'Manor', cost: 3, type: 'noble' },
      { id: 'b', name: 'Castle', cost: 4, type: 'noble' },
      { id: 'c', name: 'Tavern', cost: 1, type: 'trade' },
    ];
    const myHand = state.players[0].hand.length;
    state = processAction(state, {
      type: 'SPY_SPY', playerId: me, targetPlayerId: state.players[1].id, districtType: 'noble',
    });
    expect(state.players[1].gold).toBe(8);
    expect(state.players[0].hand.length).toBe(myHand + 2);
    // The Spy keeps looking at that hand for the rest of the round.
    const view = getPlayerView(state, me);
    expect(view.revealedHands.some(h => h.playerId === state.players[1].id)).toBe(true);
  });

  it('Scholar draws seven and keeps one', () => {
    let state = turnFor('tenacious-delegates', 'Scholar');
    const me = state.players[0].id;
    const before = state.players[0].hand.length;
    state = processAction(state, { type: 'DRAW_CARDS', playerId: me });
    expect(state.turnState!.drawnCards).toHaveLength(7);
    state = processAction(state, { type: 'KEEP_CARD', playerId: me, cardIndex: 0 });
    expect(state.players[0].hand.length).toBe(before + 1);
    expect(state.turnState!.maxDistricts).toBe(2);
  });

  it('Cardinal buys gold from another player with cards', () => {
    let state = turnFor('vicious-nobles', 'Cardinal');
    const me = state.players[0].id;
    state.players[0].gold = 1;
    state.players[0].hand = [
      { id: 'p', name: 'Palace', cost: 5, type: 'noble' },
      { id: 'q', name: 'Tavern', cost: 1, type: 'trade' },
      { id: 'r', name: 'Market', cost: 2, type: 'trade' },
      { id: 's', name: 'Temple', cost: 1, type: 'religious' },
    ];
    state.players[1].gold = 10;
    state = processAction(state, { type: 'TAKE_GOLD', playerId: me });  // gold = 3
    state = processAction(state, {
      type: 'CARDINAL_BUILD', playerId: me, cardIndex: 0, lenderPlayerId: state.players[1].id,
    });
    expect(state.players[0].city.map(d => d.name)).toEqual(['Palace']);
    expect(state.players[0].gold).toBe(0);
    expect(state.players[1].gold).toBe(8);          // lent 2
    expect(state.players[1].hand.length).toBeGreaterThanOrEqual(2);
  });

  /** Set up a rank 8 turn so that ending it calls the rank 9 character next. */
  function queenGame(rank4Seat: number): GameState {
    const state = createGame(botConfig(5, 'ambitious-aristocrats', true));
    const queen = state.cast.find(c => c.name === 'Queen')!;
    const rank4 = state.cast.find(c => c.rank === 4)!;
    const rank8 = state.cast.find(c => c.rank === 8)!;

    state.phase = 'playerTurns';
    state.players.forEach(p => { p.characterCard = null; });
    state.players[0].characterCard = queen;
    state.players[rank4Seat].characterCard = rank4;
    state.players[4].characterCard = rank8;

    state.currentCharacterRank = 8;
    state.turnState = {
      playerId: state.players[4].id, characterRank: 8, effectiveCharacter: rank8,
      phase: 'actionTaken', actionTaken: true, powerUsed: true, incomeCollected: true,
      districtsBuilt: 0, maxDistricts: 1, drawnCards: [], merchantBonusTaken: false,
      specialBuildingsUsed: [], goldSpentBuilding: 0, beautifiedCount: 0,
      isBewitchedTurn: false, isWitchResume: false,
    };
    return state;
  }

  it('Queen collects 3 gold beside the rank 4 character', () => {
    let state = queenGame(1);   // seat 1 is adjacent to seat 0
    const before = state.players[0].gold;
    state = processAction(state, { type: 'END_TURN', playerId: state.players[4].id });
    expect(state.currentCharacterRank).toBe(9);
    expect(state.players[0].gold).toBe(before + 3);
  });

  it('Queen gains nothing when not seated beside the rank 4 character', () => {
    let state = queenGame(2);   // seat 2 is two away from seat 0
    const before = state.players[0].gold;
    state = processAction(state, { type: 'END_TURN', playerId: state.players[4].id });
    expect(state.currentCharacterRank).toBe(9);
    expect(state.players[0].gold).toBe(before);
  });
});
