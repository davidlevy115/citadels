import { describe, it, expect, beforeEach } from 'vitest';
import {
  createGame, processAction, getPlayerView, getAvailableActions,
  getBotAction, calculateScores, CHARACTERS,
  type GameState, type GameConfig, type GameAction,
} from '../index.js';

function makeConfig(numPlayers: number): GameConfig {
  return {
    players: Array.from({ length: numPlayers }, (_, i) => ({
      name: `Player ${i + 1}`,
      isBot: false,
    })),
  };
}

function makeBotsConfig(numBots: number): GameConfig {
  return {
    players: [
      { name: 'Human', isBot: false },
      ...Array.from({ length: numBots }, (_, i) => ({
        name: `Bot ${i + 1}`,
        isBot: true,
      })),
    ],
  };
}

describe('Game creation', () => {
  it('creates a game with correct number of players', () => {
    const state = createGame(makeConfig(4));
    expect(state.players).toHaveLength(4);
  });

  it('gives each player 4 cards and 2 gold', () => {
    const state = createGame(makeConfig(4));
    for (const p of state.players) {
      expect(p.hand).toHaveLength(4);
      expect(p.gold).toBe(2);
    }
  });

  it('starts in chooseCharacters phase', () => {
    const state = createGame(makeConfig(4));
    expect(state.phase).toBe('chooseCharacters');
  });

  it('rejects less than 2 players', () => {
    expect(() => createGame(makeConfig(1))).toThrow();
  });

  it('rejects more than 7 players', () => {
    expect(() => createGame(makeConfig(8))).toThrow();
  });

  it('removes correct faceup cards for 4 players (2 faceup)', () => {
    const state = createGame(makeConfig(4));
    expect(state.removedCharactersFaceUp).toHaveLength(2);
    expect(state.removedCharactersFaceDown).toHaveLength(1);
    // 8 chars - 1 facedown - 2 faceup = 5 available
    expect(state.availableCharacters).toHaveLength(5);
  });

  it('removes correct faceup cards for 5 players (1 faceup)', () => {
    const state = createGame(makeConfig(5));
    expect(state.removedCharactersFaceUp).toHaveLength(1);
    expect(state.availableCharacters).toHaveLength(6);
  });

  it('removes 0 faceup cards for 6 players', () => {
    const state = createGame(makeConfig(6));
    expect(state.removedCharactersFaceUp).toHaveLength(0);
    expect(state.availableCharacters).toHaveLength(7);
  });

  it('first player gets the crown', () => {
    const state = createGame(makeConfig(4));
    expect(state.crownPlayerIndex).toBe(0);
  });
});

describe('Character selection', () => {
  it('allows crown holder to choose first', () => {
    const state = createGame(makeConfig(4));
    const actions = getAvailableActions(state, state.players[0].id);
    expect(actions.canChooseCharacter).toBe(true);
    expect(actions.availableCharacters.length).toBeGreaterThan(0);
  });

  it('prevents non-crown player from choosing first', () => {
    const state = createGame(makeConfig(4));
    const actions = getAvailableActions(state, state.players[1].id);
    expect(actions.canChooseCharacter).toBe(false);
  });

  it('advances to next player after choosing', () => {
    let state = createGame(makeConfig(4));
    const firstCharRank = state.availableCharacters[0].rank;

    state = processAction(state, {
      type: 'CHOOSE_CHARACTER',
      playerId: state.players[0].id,
      characterRank: firstCharRank,
    });

    expect(state.choosingPlayerIndex).toBe(1);
    expect(state.players[0].characterCard?.rank).toBe(firstCharRank);
  });

  it('transitions to playerTurns after all choose', () => {
    let state = createGame(makeConfig(4));

    // All 4 players choose characters
    for (let i = 0; i < 4; i++) {
      const playerIdx = (state.crownPlayerIndex + i) % 4;
      const charRank = state.availableCharacters[0].rank;
      state = processAction(state, {
        type: 'CHOOSE_CHARACTER',
        playerId: state.players[playerIdx].id,
        characterRank: charRank,
      });
    }

    expect(state.phase).toBe('playerTurns');
  });
});

describe('Player turns', () => {
  function setupTurnPhase(): GameState {
    let state = createGame(makeConfig(4));
    // All players choose characters
    for (let i = 0; i < 4; i++) {
      const playerIdx = (state.crownPlayerIndex + i) % 4;
      const charRank = state.availableCharacters[0].rank;
      state = processAction(state, {
        type: 'CHOOSE_CHARACTER',
        playerId: state.players[playerIdx].id,
        characterRank: charRank,
      });
    }
    return state;
  }

  it('calls characters in rank order', () => {
    const state = setupTurnPhase();
    // currentCharacterRank should be the lowest rank among players
    const minRank = Math.min(...state.players.map(p => p.characterCard!.rank));
    expect(state.currentCharacterRank).toBe(minRank);
  });

  it('allows taking gold', () => {
    const state = setupTurnPhase();
    const activePlayer = state.players.find(p => p.characterCard?.rank === state.currentCharacterRank)!;
    const goldBefore = activePlayer.gold;

    const newState = processAction(state, {
      type: 'TAKE_GOLD',
      playerId: activePlayer.id,
    });

    const updatedPlayer = newState.players.find(p => p.id === activePlayer.id)!;
    expect(updatedPlayer.gold).toBeGreaterThanOrEqual(goldBefore + 2);
  });

  it('allows drawing cards', () => {
    const state = setupTurnPhase();
    const activePlayer = state.players.find(p => p.characterCard?.rank === state.currentCharacterRank)!;

    const newState = processAction(state, {
      type: 'DRAW_CARDS',
      playerId: activePlayer.id,
    });

    // Should be in choosingCard phase (unless Library is in play)
    expect(newState.turnState?.phase).toBe('choosingCard');
    expect(newState.turnState?.drawnCards).toHaveLength(2);
  });

  it('allows keeping a drawn card', () => {
    let state = setupTurnPhase();
    const activePlayer = state.players.find(p => p.characterCard?.rank === state.currentCharacterRank)!;
    const handSizeBefore = activePlayer.hand.length;

    state = processAction(state, { type: 'DRAW_CARDS', playerId: activePlayer.id });
    state = processAction(state, { type: 'KEEP_CARD', playerId: activePlayer.id, cardIndex: 0 });

    const updatedPlayer = state.players.find(p => p.id === activePlayer.id)!;
    expect(updatedPlayer.hand.length).toBe(handSizeBefore + 1);
    expect(state.turnState?.actionTaken).toBe(true);
  });

  it('prevents taking action twice', () => {
    let state = setupTurnPhase();
    const activePlayer = state.players.find(p => p.characterCard?.rank === state.currentCharacterRank)!;

    state = processAction(state, { type: 'TAKE_GOLD', playerId: activePlayer.id });

    expect(() => {
      processAction(state, { type: 'TAKE_GOLD', playerId: activePlayer.id });
    }).toThrow('Action already taken');
  });

  it('prevents building before taking action', () => {
    const state = setupTurnPhase();
    const activePlayer = state.players.find(p => p.characterCard?.rank === state.currentCharacterRank)!;

    expect(() => {
      processAction(state, { type: 'BUILD_DISTRICT', playerId: activePlayer.id, cardIndex: 0 });
    }).toThrow('Must take an action first');
  });

  it('allows building after taking action', () => {
    let state = setupTurnPhase();
    const activePlayer = state.players.find(p => p.characterCard?.rank === state.currentCharacterRank)!;

    // Give player enough gold
    const playerIdx = state.players.findIndex(p => p.id === activePlayer.id);
    state.players[playerIdx] = { ...activePlayer, gold: 20 };

    state = processAction(state, { type: 'TAKE_GOLD', playerId: activePlayer.id });

    // Try to build if player has cards
    const updatedPlayer = state.players.find(p => p.id === activePlayer.id)!;
    if (updatedPlayer.hand.length > 0) {
      const card = updatedPlayer.hand[0];
      const newState = processAction(state, {
        type: 'BUILD_DISTRICT',
        playerId: activePlayer.id,
        cardIndex: 0,
      });

      const finalPlayer = newState.players.find(p => p.id === activePlayer.id)!;
      expect(finalPlayer.city).toHaveLength(1);
      expect(finalPlayer.city[0].name).toBe(card.name);
      expect(finalPlayer.gold).toBe(updatedPlayer.gold - card.cost);
    }
  });

  it('prevents building duplicate districts', () => {
    let state = setupTurnPhase();
    const activePlayer = state.players.find(p => p.characterCard?.rank === state.currentCharacterRank)!;
    const playerIdx = state.players.findIndex(p => p.id === activePlayer.id);

    // Give player gold and a duplicate card in hand and city
    const card = activePlayer.hand[0];
    state.players[playerIdx] = {
      ...activePlayer,
      gold: 20,
      city: [{ ...card }], // already built
    };

    state = processAction(state, { type: 'TAKE_GOLD', playerId: activePlayer.id });

    expect(() => {
      processAction(state, { type: 'BUILD_DISTRICT', playerId: activePlayer.id, cardIndex: 0 });
    }).toThrow('already have');
  });

  it('ends turn and advances to next character', () => {
    let state = setupTurnPhase();
    const activePlayer = state.players.find(p => p.characterCard?.rank === state.currentCharacterRank)!;
    const currentRank = state.currentCharacterRank;

    state = processAction(state, { type: 'TAKE_GOLD', playerId: activePlayer.id });
    state = processAction(state, { type: 'END_TURN', playerId: activePlayer.id });

    expect(state.currentCharacterRank).toBeGreaterThan(currentRank);
  });
});

describe('Character powers', () => {
  // Setup game in playerTurns phase with the specified character on player 0 active
  function setupWithCharacters(assignments: Record<number, number>): GameState {
    let state = createGame(makeConfig(4));

    state.phase = 'playerTurns';
    state.availableCharacters = [];

    for (const [playerIdx, rank] of Object.entries(assignments)) {
      const char = CHARACTERS.find((c: any) => c.rank === rank);
      state.players[parseInt(playerIdx)].characterCard = { ...char! };
    }

    // Set current turn to player 0's character rank
    const player0Rank = assignments[0];
    state.currentCharacterRank = player0Rank;

    state.turnState = {
      characterRank: player0Rank,
      phase: 'awaitingAction',
      actionTaken: false,
      powerUsed: false,
      incomeCollected: false,
      districtsBuilt: 0,
      maxDistricts: player0Rank === 7 ? 3 : 1,
      drawnCards: [],
      merchantBonusTaken: false,
    };

    return state;
  }

  describe('Assassin', () => {
    it('murders a character', () => {
      // Player 0 = Assassin(1), Player 1 = King(4)
      let state = setupWithCharacters({ 0: 1, 1: 4, 2: 5, 3: 6 });

      state = processAction(state, {
        type: 'ASSASSIN_KILL',
        playerId: state.players[0].id,
        targetRank: 4,
      });

      expect(state.murderedCharacter).toBe(4);
      expect(state.turnState?.powerUsed).toBe(true);
    });

    it('cannot murder the Assassin (rank 1)', () => {
      let state = setupWithCharacters({ 0: 1, 1: 4, 2: 5, 3: 6 });

      expect(() => {
        processAction(state, {
          type: 'ASSASSIN_KILL',
          playerId: state.players[0].id,
          targetRank: 1,
        });
      }).toThrow();
    });
  });

  describe('Thief', () => {
    it('steals gold when target is called', () => {
      // Player 0 = Thief(2), Player 1 = King(4)
      let state = setupWithCharacters({ 0: 2, 1: 4, 2: 5, 3: 6 });
      state.players[1] = { ...state.players[1], gold: 10 };

      state = processAction(state, {
        type: 'THIEF_STEAL',
        playerId: state.players[0].id,
        targetRank: 4,
      });

      expect(state.robbedCharacter).toBe(4);

      // Take action and end Thief's turn
      state = processAction(state, { type: 'TAKE_GOLD', playerId: state.players[0].id });
      state = processAction(state, { type: 'END_TURN', playerId: state.players[0].id });

      // Now King should be called — Thief steals gold
      // Find King player after theft
      const kingPlayer = state.players.find(p => p.characterCard?.rank === 4)!;
      const thiefPlayer = state.players.find(p => p.characterCard?.rank === 2)!;
      expect(kingPlayer.gold).toBe(0);
      expect(thiefPlayer.gold).toBeGreaterThanOrEqual(10); // stole 10
    });

    it('cannot steal from rank 1 or 2', () => {
      let state = setupWithCharacters({ 0: 2, 1: 4, 2: 5, 3: 6 });

      expect(() => {
        processAction(state, { type: 'THIEF_STEAL', playerId: state.players[0].id, targetRank: 1 });
      }).toThrow();

      expect(() => {
        processAction(state, { type: 'THIEF_STEAL', playerId: state.players[0].id, targetRank: 2 });
      }).toThrow();
    });

    it('cannot steal from murdered character', () => {
      let state = setupWithCharacters({ 0: 2, 1: 4, 2: 5, 3: 6 });
      state.murderedCharacter = 4;

      expect(() => {
        processAction(state, { type: 'THIEF_STEAL', playerId: state.players[0].id, targetRank: 4 });
      }).toThrow();
    });
  });

  describe('Magician', () => {
    it('swaps hands with another player', () => {
      let state = setupWithCharacters({ 0: 3, 1: 4, 2: 5, 3: 6 });
      const myHand = [...state.players[0].hand];
      const theirHand = [...state.players[1].hand];

      state = processAction(state, {
        type: 'MAGICIAN_SWAP_PLAYER',
        playerId: state.players[0].id,
        targetPlayerId: state.players[1].id,
      });

      expect(state.players[0].hand.map(c => c.id)).toEqual(theirHand.map(c => c.id));
      expect(state.players[1].hand.map(c => c.id)).toEqual(myHand.map(c => c.id));
    });

    it('discards and draws from deck', () => {
      let state = setupWithCharacters({ 0: 3, 1: 4, 2: 5, 3: 6 });
      const handSizeBefore = state.players[0].hand.length;

      state = processAction(state, {
        type: 'MAGICIAN_SWAP_DECK',
        playerId: state.players[0].id,
        cardIndices: [0, 1],
      });

      // Same hand size (discarded 2, drew 2)
      expect(state.players[0].hand.length).toBe(handSizeBefore);
      expect(state.turnState?.powerUsed).toBe(true);
    });
  });

  describe('King', () => {
    it('gives crown when called', () => {
      let state = setupWithCharacters({ 0: 1, 1: 4, 2: 5, 3: 6 });
      state.crownPlayerIndex = 2; // someone else has crown

      // Play through Assassin's turn
      state = processAction(state, { type: 'TAKE_GOLD', playerId: state.players[0].id });
      state = processAction(state, { type: 'END_TURN', playerId: state.players[0].id });

      // King should now be called and crown transferred
      expect(state.crownPlayerIndex).toBe(1); // Player 1 (King)
    });

    it('collects income from noble districts', () => {
      let state = setupWithCharacters({ 0: 4, 1: 5, 2: 6, 3: 8 });
      // Give King 2 noble districts
      state.players[0] = {
        ...state.players[0],
        city: [
          { id: 'test1', name: 'Manor', cost: 3, type: 'noble' },
          { id: 'test2', name: 'Castle', cost: 4, type: 'noble' },
        ],
      };

      state = processAction(state, { type: 'TAKE_GOLD', playerId: state.players[0].id });
      const goldAfterAction = state.players[0].gold;

      state = processAction(state, { type: 'USE_POWER', playerId: state.players[0].id });
      expect(state.players[0].gold).toBe(goldAfterAction + 2); // 2 noble districts
    });
  });

  describe('Merchant', () => {
    it('gets +1 gold after taking action', () => {
      let state = setupWithCharacters({ 0: 6, 1: 7, 2: 8, 3: 1 });
      const goldBefore = state.players[0].gold;

      state = processAction(state, { type: 'TAKE_GOLD', playerId: state.players[0].id });

      // +2 from action, +1 from Merchant bonus
      expect(state.players[0].gold).toBe(goldBefore + 3);
    });
  });

  describe('Architect', () => {
    it('draws 2 extra cards after action', () => {
      let state = setupWithCharacters({ 0: 7, 1: 8, 2: 1, 3: 2 });
      const handSizeBefore = state.players[0].hand.length;

      state = processAction(state, { type: 'TAKE_GOLD', playerId: state.players[0].id });

      // Architect draws 2 extra cards automatically
      expect(state.players[0].hand.length).toBe(handSizeBefore + 2);
    });

    it('can build up to 3 districts', () => {
      let state = setupWithCharacters({ 0: 7, 1: 8, 2: 1, 3: 2 });
      expect(state.turnState?.maxDistricts).toBe(3);
    });
  });

  describe('Warlord', () => {
    it('destroys a district', () => {
      let state = setupWithCharacters({ 0: 8, 1: 4, 2: 5, 3: 6 });
      state.players[0] = { ...state.players[0], gold: 20 };
      state.players[1] = {
        ...state.players[1],
        city: [{ id: 'test1', name: 'Tavern', cost: 1, type: 'trade' }],
      };

      state = processAction(state, { type: 'TAKE_GOLD', playerId: state.players[0].id });
      state = processAction(state, {
        type: 'WARLORD_DESTROY',
        playerId: state.players[0].id,
        targetPlayerId: state.players[1].id,
        districtIndex: 0,
      });

      expect(state.players[1].city).toHaveLength(0);
      // Cost 1 district costs 0 to destroy
      expect(state.players[0].gold).toBe(22); // 20 + 2 gold action - 0 destroy cost
    });

    it('cannot destroy the Keep', () => {
      let state = setupWithCharacters({ 0: 8, 1: 4, 2: 5, 3: 6 });
      state.players[0] = { ...state.players[0], gold: 20 };
      state.players[1] = {
        ...state.players[1],
        city: [{ id: 'test1', name: 'Keep', cost: 3, type: 'special' }],
      };

      state = processAction(state, { type: 'TAKE_GOLD', playerId: state.players[0].id });

      expect(() => {
        processAction(state, {
          type: 'WARLORD_DESTROY',
          playerId: state.players[0].id,
          targetPlayerId: state.players[1].id,
          districtIndex: 0,
        });
      }).toThrow('Keep');
    });

    it('cannot destroy Bishop districts', () => {
      let state = setupWithCharacters({ 0: 8, 1: 5, 2: 4, 3: 6 });
      state.players[0] = { ...state.players[0], gold: 20 };
      state.players[1] = {
        ...state.players[1],
        city: [{ id: 'test1', name: 'Tavern', cost: 1, type: 'trade' }],
      };

      state = processAction(state, { type: 'TAKE_GOLD', playerId: state.players[0].id });

      expect(() => {
        processAction(state, {
          type: 'WARLORD_DESTROY',
          playerId: state.players[0].id,
          targetPlayerId: state.players[1].id,
          districtIndex: 0,
        });
      }).toThrow('Bishop');
    });

    it('cannot destroy districts in completed city (8 districts)', () => {
      let state = setupWithCharacters({ 0: 8, 1: 4, 2: 5, 3: 6 });
      state.players[0] = { ...state.players[0], gold: 20 };
      state.players[1] = {
        ...state.players[1],
        city: Array.from({ length: 8 }, (_, i) => ({
          id: `test${i}`, name: `District${i}`, cost: 1, type: 'trade' as const,
        })),
      };

      state = processAction(state, { type: 'TAKE_GOLD', playerId: state.players[0].id });

      expect(() => {
        processAction(state, {
          type: 'WARLORD_DESTROY',
          playerId: state.players[0].id,
          targetPlayerId: state.players[1].id,
          districtIndex: 0,
        });
      }).toThrow('completed city');
    });

    it('can destroy after building and collecting income', () => {
      let state = setupWithCharacters({ 0: 8, 1: 4, 2: 5, 3: 6 });
      state.players[0] = {
        ...state.players[0],
        gold: 20,
        hand: [{ id: 'h1', name: 'Watchtower', cost: 1, type: 'military' }],
        city: [
          { id: 'c1', name: 'Battlefield', cost: 3, type: 'military' },
        ],
      };
      state.players[1] = {
        ...state.players[1],
        city: [{ id: 't1', name: 'Tavern', cost: 1, type: 'trade' }],
      };

      // Take action
      state = processAction(state, { type: 'TAKE_GOLD', playerId: state.players[0].id });
      // Collect income (1 military district = 1 gold)
      state = processAction(state, { type: 'USE_POWER', playerId: state.players[0].id });
      expect(state.turnState?.incomeCollected).toBe(true);
      expect(state.turnState?.powerUsed).toBe(false); // power NOT used

      // Build a district
      state = processAction(state, { type: 'BUILD_DISTRICT', playerId: state.players[0].id, cardIndex: 0 });

      // Destroy should still be available
      state = processAction(state, {
        type: 'WARLORD_DESTROY',
        playerId: state.players[0].id,
        targetPlayerId: state.players[1].id,
        districtIndex: 0,
      });

      expect(state.turnState?.powerUsed).toBe(true);
      expect(state.players[1].city).toHaveLength(0);
    });
  });
});

describe('Scoring', () => {
  it('scores district costs correctly', () => {


    const state: any = {
      players: [
        { id: 'p1', name: 'Player 1', gold: 0, hand: [], city: [
          { id: 'd1', name: 'Manor', cost: 3, type: 'noble' },
          { id: 'd2', name: 'Temple', cost: 1, type: 'religious' },
        ]},
      ],
      firstToEightDistricts: null,
    };

    const scores = calculateScores(state, false);
    expect(scores[0].districtPoints).toBe(4);
  });

  it('awards 3 points for all 5 colors', () => {


    const state: any = {
      players: [
        { id: 'p1', name: 'Player 1', gold: 0, hand: [], city: [
          { id: 'd1', name: 'Manor', cost: 3, type: 'noble' },
          { id: 'd2', name: 'Temple', cost: 1, type: 'religious' },
          { id: 'd3', name: 'Tavern', cost: 1, type: 'trade' },
          { id: 'd4', name: 'Watchtower', cost: 1, type: 'military' },
          { id: 'd5', name: 'Keep', cost: 3, type: 'special' },
        ]},
      ],
      firstToEightDistricts: null,
    };

    const scores = calculateScores(state, false);
    expect(scores[0].colorBonusPoints).toBe(3);
  });

  it('awards 4 points for first to 8 districts', () => {


    const state: any = {
      players: [
        { id: 'p1', name: 'Player 1', gold: 0, hand: [], city: Array.from({ length: 8 }, (_, i) => ({
          id: `d${i}`, name: `D${i}`, cost: 1, type: 'trade',
        }))},
      ],
      firstToEightDistricts: 'p1',
    };

    const scores = calculateScores(state, false);
    expect(scores[0].firstToEightPoints).toBe(4);
  });

  it('awards 2 points for others who reach 8', () => {


    const state: any = {
      players: [
        { id: 'p1', name: 'Player 1', gold: 0, hand: [], city: Array.from({ length: 8 }, (_, i) => ({
          id: `d1${i}`, name: `A${i}`, cost: 1, type: 'trade',
        }))},
        { id: 'p2', name: 'Player 2', gold: 0, hand: [], city: Array.from({ length: 8 }, (_, i) => ({
          id: `d2${i}`, name: `B${i}`, cost: 2, type: 'noble',
        }))},
      ],
      firstToEightDistricts: 'p1',
    };

    const scores = calculateScores(state, false);
    expect(scores[0].firstToEightPoints).toBe(4);
    expect(scores[1].otherEightPoints).toBe(2);
  });

  it('Dragon Gate and University score 8 points', () => {


    const state: any = {
      players: [
        { id: 'p1', name: 'Player 1', gold: 0, hand: [], city: [
          { id: 'd1', name: 'Dragon Gate', cost: 6, type: 'special' },
          { id: 'd2', name: 'University', cost: 6, type: 'special' },
        ]},
      ],
      firstToEightDistricts: null,
    };

    const scores = calculateScores(state, false);
    expect(scores[0].districtPoints).toBe(16); // 8 + 8
  });

  it('Haunted City fills missing color for bonus', () => {


    const state: any = {
      players: [
        { id: 'p1', name: 'Player 1', gold: 0, hand: [], city: [
          { id: 'd1', name: 'Manor', cost: 3, type: 'noble' },
          { id: 'd2', name: 'Temple', cost: 1, type: 'religious' },
          { id: 'd3', name: 'Tavern', cost: 1, type: 'trade' },
          { id: 'd4', name: 'Watchtower', cost: 1, type: 'military' },
          { id: 'd5', name: 'Haunted City', cost: 2, type: 'special' },
        ]},
      ],
      firstToEightDistricts: null,
    };

    const scores = calculateScores(state, false);
    expect(scores[0].colorBonusPoints).toBe(3); // Haunted City counts as missing special
  });
});

describe('Game end', () => {
  it('triggers game end when player builds 8th district', () => {
    let state = createGame(makeConfig(4));

    // Manually set up: give player 7 districts and enough gold
    state.phase = 'playerTurns';

    state.players[0].characterCard = { ...CHARACTERS[3] }; // King (rank 4)
    state.players[1].characterCard = { ...CHARACTERS[4] }; // Bishop
    state.players[2].characterCard = { ...CHARACTERS[5] }; // Merchant
    state.players[3].characterCard = { ...CHARACTERS[6] }; // Architect

    state.currentCharacterRank = 4;
    state.players[0] = {
      ...state.players[0],
      gold: 20,
      city: Array.from({ length: 7 }, (_, i) => ({
        id: `city${i}`, name: `District${i}`, cost: 1, type: 'trade' as const,
      })),
    };

    // Need a card that isn't a duplicate
    state.players[0].hand = [{ id: 'new', name: 'UniqueDistrict', cost: 1, type: 'noble' }];

    state.turnState = {
      characterRank: 4,
      phase: 'awaitingAction',
      actionTaken: false,
      powerUsed: false,
      incomeCollected: false,
      districtsBuilt: 0,
      maxDistricts: 1,
      drawnCards: [],
      merchantBonusTaken: false,
    };

    state = processAction(state, { type: 'TAKE_GOLD', playerId: state.players[0].id });
    state = processAction(state, { type: 'BUILD_DISTRICT', playerId: state.players[0].id, cardIndex: 0 });

    expect(state.gameEndTriggered).toBe(true);
    expect(state.firstToEightDistricts).toBe(state.players[0].id);
  });
});

describe('Player view', () => {
  it('hides other players hands and characters', () => {
    let state = createGame(makeConfig(4));

    // Choose characters
    for (let i = 0; i < 4; i++) {
      const playerIdx = (state.crownPlayerIndex + i) % 4;
      const charRank = state.availableCharacters[0].rank;
      state = processAction(state, {
        type: 'CHOOSE_CHARACTER',
        playerId: state.players[playerIdx].id,
        characterRank: charRank,
      });
    }

    const view = getPlayerView(state, state.players[0].id);

    // I should see my character
    expect(view.myCharacter).not.toBeNull();

    // Other players' unrevealed characters should be null
    for (let i = 1; i < view.players.length; i++) {
      const p = view.players[i];
      if (p.revealedCharacter?.rank && p.revealedCharacter.rank > state.currentCharacterRank) {
        expect(p.revealedCharacter).toBeNull();
      }
    }

    // I should see my hand
    expect(view.myHand.length).toBeGreaterThan(0);

    // Other players should only show hand size
    for (const p of view.players) {
      expect(typeof p.handSize).toBe('number');
    }
  });
});

describe('Full game simulation with bots', () => {
  it('plays a complete game without errors', () => {

    let state = createGame({
      players: [
        { name: 'Bot A', isBot: true },
        { name: 'Bot B', isBot: true },
        { name: 'Bot C', isBot: true },
        { name: 'Bot D', isBot: true },
      ],
    });

    let safety = 0;
    const maxIterations = 5000;

    let lastPhase = '';
    let stuckCount = 0;

    while (state.phase !== 'gameOver' && safety++ < maxIterations) {
      // Find which bot needs to act
      let botId: string | null = null;

      if (state.phase === 'chooseCharacters') {
        botId = state.players[state.choosingPlayerIndex].id;
      } else if (state.phase === 'playerTurns') {
        const active = state.players.find(p => p.characterCard?.rank === state.currentCharacterRank);
        if (active) botId = active.id;
      }

      if (!botId) {
        // Could be removeCharacters or other transitional phase — should not happen
        // since createGame and endRound auto-advance through removeCharacters
        break;
      }

      const action = getBotAction(state, botId);
      if (!action) {
        break;
      }

      try {
        state = processAction(state, action);
      } catch (e) {
        break;
      }

      // Detect stuck loops
      const stateKey = `${state.phase}-${state.round}-${state.currentCharacterRank}-${state.turnState?.phase}`;
      if (stateKey === lastPhase) {
        stuckCount++;
        if (stuckCount > 50) break;
      } else {
        stuckCount = 0;
        lastPhase = stateKey;
      }
    }

    expect(state.phase).toBe('gameOver');
    expect(state.scores).not.toBeNull();
    expect(state.scores!.length).toBe(4);

    // Winner should have the highest score
    const winner = state.scores!.sort((a: any, b: any) => b.totalPoints - a.totalPoints)[0];
    expect(winner.totalPoints).toBeGreaterThan(0);
  });
});
