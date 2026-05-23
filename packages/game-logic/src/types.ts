// ── District types ──────────────────────────────────────────────

export type DistrictType = 'noble' | 'religious' | 'trade' | 'military' | 'special';

export interface DistrictCard {
  id: string;
  name: string;
  cost: number;
  type: DistrictType;
  description?: string;
}

// ── Character types ─────────────────────────────────────────────

export type CharacterName =
  | 'Assassin'
  | 'Thief'
  | 'Magician'
  | 'King'
  | 'Bishop'
  | 'Merchant'
  | 'Architect'
  | 'Warlord';

export interface Character {
  rank: number;
  name: CharacterName;
  description: string;
}

// ── Player ──────────────────────────────────────────────────────

export interface Player {
  id: string;
  name: string;
  gold: number;
  hand: DistrictCard[];
  city: BuiltDistrict[];
  characterCard: Character | null;
  isBot: boolean;
  botDifficulty?: 'easy' | 'medium' | 'hard';
}

export interface BuiltDistrict extends DistrictCard {
  beautified?: boolean; // for Artist bonus character
}

// ── Game phases ─────────────────────────────────────────────────

export type GamePhase =
  | 'setup'
  | 'removeCharacters'
  | 'chooseCharacters'
  | 'playerTurns'
  | 'gameOver';

export type TurnPhase =
  | 'awaitingAction'      // must take gold or draw cards
  | 'choosingCard'        // drew 2 cards, must pick 1
  | 'actionTaken'         // took action, may build/use power/end turn
  | 'usingPower'          // in the middle of using a character power
  | 'turnOver';           // turn is done

// ── Game actions ────────────────────────────────────────────────

export type GameAction =
  | { type: 'START_GAME' }
  | { type: 'CHOOSE_CHARACTER'; playerId: string; characterRank: number }
  | { type: 'TAKE_GOLD'; playerId: string }
  | { type: 'DRAW_CARDS'; playerId: string }
  | { type: 'KEEP_CARD'; playerId: string; cardIndex: number }
  | { type: 'BUILD_DISTRICT'; playerId: string; cardIndex: number }
  | { type: 'USE_POWER'; playerId: string }
  | { type: 'END_TURN'; playerId: string }
  // Character-specific power targets
  | { type: 'ASSASSIN_KILL'; playerId: string; targetRank: number }
  | { type: 'THIEF_STEAL'; playerId: string; targetRank: number }
  | { type: 'MAGICIAN_SWAP_PLAYER'; playerId: string; targetPlayerId: string }
  | { type: 'MAGICIAN_SWAP_DECK'; playerId: string; cardIndices: number[] }
  | { type: 'WARLORD_DESTROY'; playerId: string; targetPlayerId: string; districtIndex: number }
  | { type: 'WARLORD_PASS'; playerId: string };

// ── Turn state ──────────────────────────────────────────────────

export interface TurnState {
  characterRank: number;
  phase: TurnPhase;
  actionTaken: boolean;
  powerUsed: boolean;         // unique character power (kill, steal, swap, destroy)
  incomeCollected: boolean;   // district-type income (separate from power)
  districtsBuilt: number;
  maxDistricts: number;
  drawnCards: DistrictCard[];  // cards drawn for choosing
  merchantBonusTaken: boolean;
}

// ── Game state ──────────────────────────────────────────────────

export interface GameState {
  id: string;
  players: Player[];
  phase: GamePhase;
  round: number;

  // Decks
  characterDeck: Character[];
  districtDeck: DistrictCard[];
  districtDiscard: DistrictCard[];

  // Round state
  removedCharactersFaceDown: Character[];
  removedCharactersFaceUp: Character[];
  availableCharacters: Character[];
  choosingPlayerIndex: number;

  // Turn state
  currentCharacterRank: number;
  turnState: TurnState | null;
  murderedCharacter: number | null;  // rank of murdered character
  robbedCharacter: number | null;    // rank of robbed character

  // Crown
  crownPlayerIndex: number;

  // Game end
  firstToEightDistricts: string | null;  // player id
  gameEndTriggered: boolean;

  // Scoring (populated at game end)
  scores: PlayerScore[] | null;

  // Log for UI
  log: LogEntry[];
}

export interface PlayerScore {
  playerId: string;
  playerName: string;
  districtPoints: number;
  colorBonusPoints: number;
  firstToEightPoints: number;
  otherEightPoints: number;
  totalPoints: number;
}

export interface LogEntry {
  message: string;
  timestamp: number;
}

// ── Config ──────────────────────────────────────────────────────

export interface GameConfig {
  players: { name: string; isBot: boolean; botDifficulty?: 'easy' | 'medium' | 'hard' }[];
  shorterGame?: boolean; // 7 districts instead of 8
}

// ── Player view (what a specific player can see) ────────────────

export interface PlayerGameView {
  id: string;
  phase: GamePhase;
  round: number;
  myIndex: number;
  players: PlayerPublicInfo[];
  myHand: DistrictCard[];
  myCharacter: Character | null;

  // Character drafting
  availableCharacters: Character[];
  isMyTurnToChoose: boolean;
  removedCharactersFaceUp: Character[];
  removedCharactersFaceDownCount: number;  // how many cards removed secretly

  // Turn state
  currentCharacterRank: number;
  turnState: TurnState | null;
  isMyTurn: boolean;

  // Game state
  crownPlayerIndex: number;
  gameEndTriggered: boolean;
  firstToEightDistricts: string | null;
  scores: PlayerScore[] | null;
  log: LogEntry[];
  districtDeckCount: number;

  // Round events (targeting)
  murderedCharacter: number | null;   // rank killed by Assassin
  robbedCharacter: number | null;     // rank targeted by Thief
  roundEvents: RoundEvent[];          // major events this round
}

export interface RoundEvent {
  type: 'murder' | 'steal' | 'swap' | 'destroy' | 'bewitch';
  actorName: string;
  actorCharacter: string;
  targetCharacter?: string;       // character name targeted (Assassin/Thief)
  targetPlayerName?: string;      // player name targeted (Magician/Warlord)
  detail?: string;                // e.g. district name destroyed
}

export interface PlayerPublicInfo {
  id: string;
  name: string;
  gold: number;
  city: BuiltDistrict[];
  handSize: number;
  isBot: boolean;
  revealedCharacter: Character | null; // only shown after reveal
}
