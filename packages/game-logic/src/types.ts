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
  // rank 1
  | 'Assassin' | 'Witch' | 'Magistrate'
  // rank 2
  | 'Thief' | 'Spy' | 'Blackmailer'
  // rank 3
  | 'Magician' | 'Wizard' | 'Seer'
  // rank 4
  | 'King' | 'Emperor' | 'Patrician'
  // rank 5
  | 'Bishop' | 'Abbot' | 'Cardinal'
  // rank 6
  | 'Merchant' | 'Alchemist' | 'Trader'
  // rank 7
  | 'Architect' | 'Navigator' | 'Scholar'
  // rank 8
  | 'Warlord' | 'Diplomat' | 'Marshal'
  // rank 9 (optional)
  | 'Queen' | 'Artist' | 'Tax Collector';

export interface Character {
  rank: number;
  name: CharacterName;
  description: string;
}

/** A named cast of characters — one per rank — that a game can be played with. */
export interface CharacterSet {
  id: string;
  name: string;
  blurb: string;
  characters: CharacterName[];   // ranks 1-8, in order
  rank9?: CharacterName;         // optional ninth character
  isRandom?: boolean;            // cast is drawn at random when the game starts
}

// ── Player ──────────────────────────────────────────────────────

export interface Player {
  id: string;
  name: string;
  age?: number;          // declared at setup — the oldest player starts with the Crown
  gold: number;
  hand: DistrictCard[];
  city: BuiltDistrict[];
  characterCard: Character | null;
  isBot: boolean;
  botDifficulty?: 'easy' | 'medium' | 'hard';
}

export interface BuiltDistrict extends DistrictCard {
  beautified?: boolean; // Artist — permanently worth (and costing) 1 more
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
  | { type: 'WARLORD_PASS'; playerId: string }
  | { type: 'LABORATORY_DISCARD'; playerId: string; cardIndex: number }
  | { type: 'SMITHY_DRAW'; playerId: string }
  | { type: 'GRAVEYARD_RECOVER'; playerId: string }
  | { type: 'GRAVEYARD_PASS'; playerId: string }
  // ── Deluxe characters ──
  | { type: 'WITCH_BEWITCH'; playerId: string; targetRank: number }
  | { type: 'MAGISTRATE_WARRANTS'; playerId: string; signedRank: number; otherRanks: number[] }
  | { type: 'MAGISTRATE_CONFISCATE'; playerId: string }
  | { type: 'MAGISTRATE_PASS'; playerId: string }
  | { type: 'SPY_SPY'; playerId: string; targetPlayerId: string; districtType: DistrictType }
  | { type: 'BLACKMAIL_ASSIGN'; playerId: string; realRank: number; bluffRank: number }
  | { type: 'BLACKMAIL_PAY'; playerId: string }
  | { type: 'BLACKMAIL_REFUSE'; playerId: string }
  | { type: 'BLACKMAIL_REVEAL'; playerId: string }
  | { type: 'BLACKMAIL_SKIP'; playerId: string }
  | { type: 'WIZARD_TAKE'; playerId: string; targetPlayerId: string; cardIndex: number; build: boolean }
  | { type: 'SEER_TAKE'; playerId: string }
  | { type: 'EMPEROR_CROWN'; playerId: string; targetPlayerId: string; take: 'gold' | 'card' }
  | { type: 'ABBOT_INCOME'; playerId: string; goldCount: number; cardCount: number }
  | { type: 'CARDINAL_BUILD'; playerId: string; cardIndex: number; lenderPlayerId: string }
  | { type: 'NAVIGATOR_GAIN'; playerId: string; choice: 'gold' | 'cards' }
  | { type: 'DIPLOMAT_EXCHANGE'; playerId: string; targetPlayerId: string; theirDistrictIndex: number; myDistrictIndex: number }
  | { type: 'MARSHAL_SEIZE'; playerId: string; targetPlayerId: string; districtIndex: number }
  | { type: 'ARTIST_BEAUTIFY'; playerId: string; districtIndex: number }
  | { type: 'TAX_COLLECTOR_COLLECT'; playerId: string }
  /** Decline an optional power so the turn can move on. */
  | { type: 'SKIP_POWER'; playerId: string };

// ── Turn state ──────────────────────────────────────────────────

export interface TurnState {
  playerId: string;           // whose turn this is (may differ from the rank's owner — see Witch)
  characterRank: number;
  /** The character whose powers apply. Normally the player's own card; the Witch
   *  resumes her turn playing the bewitched character instead. */
  effectiveCharacter: Character;
  phase: TurnPhase;
  actionTaken: boolean;
  powerUsed: boolean;         // unique character power (kill, steal, swap, destroy)
  incomeCollected: boolean;   // district-type income (separate from power)
  districtsBuilt: number;
  maxDistricts: number;
  drawnCards: DistrictCard[];  // cards drawn for choosing
  merchantBonusTaken: boolean;
  specialBuildingsUsed: string[];  // names of special buildings used this turn
  goldSpentBuilding: number;   // Alchemist refund
  beautifiedCount: number;     // Artist — at most 2 per turn
  /** True on the bewitched player's stunted turn: gather resources, then stop. */
  isBewitchedTurn: boolean;
  /** True while the Witch is playing the bewitched character's turn. */
  isWitchResume: boolean;
}

// ── Game state ──────────────────────────────────────────────────

export interface GameState {
  id: string;
  players: Player[];
  phase: GamePhase;
  round: number;

  /** The cast of characters in play this game (one per rank). */
  cast: Character[];
  characterSetId: string;
  maxRank: number;             // 8, or 9 when a rank 9 character is in the cast

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

  // ── Deluxe character round state ──
  /** Rank bewitched by the Witch this round, and the Witch's own player id. */
  bewitchedCharacter: number | null;
  witchPlayerId: string | null;
  /** Set once the bewitched player has taken their stunted turn — the Witch may now resume. */
  witchResumePending: boolean;
  /** Magistrate warrants: signed one confiscates, the others are bluffs. */
  warrants: { rank: number; signed: boolean }[];
  magistratePlayerId: string | null;
  /** Ranks already checked against a warrant (each warrant fires at most once). */
  warrantsResolved: number[];
  /** Blackmailer threats: the real one can take all the target's gold. */
  threats: { rank: number; real: boolean }[];
  blackmailerPlayerId: string | null;
  threatsResolved: number[];
  /** Gold sitting on the Tax Collector's token. */
  taxPot: number;
  /** Hands a player has earned the right to look at this round (Spy). */
  revealedHands: { viewerId: string; targetId: string }[];

  // Pending decisions — these block every other action until answered
  /** Graveyard: a destroyed district awaiting the owner's recover/pass decision */
  pendingGraveyard: { playerId: string; card: DistrictCard } | null;
  /** Magistrate: a district just paid for by a warranted player */
  pendingMagistrate: { playerId: string; targetPlayerId: string; card: DistrictCard } | null;
  /** Blackmailer: a threatened player choosing to bribe or refuse */
  pendingBlackmail: {
    playerId: string;          // the threatened player, deciding
    blackmailerId: string;
    stage: 'bribe' | 'reveal'; // 'reveal' = target refused, blackmailer decides
    bribeAmount: number;
  } | null;

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
  players: { name: string; isBot: boolean; age?: number; botDifficulty?: 'easy' | 'medium' | 'hard' }[];
  shorterGame?: boolean;       // 7 districts instead of 8
  characterSetId?: string;     // defaults to 'classic'
  includeRank9?: boolean;      // add the set's rank 9 character
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

  /** The cast in play this game, and the set it came from. */
  cast: Character[];
  characterSetId: string;
  maxRank: number;

  // Character drafting
  availableCharacters: Character[];
  isMyTurnToChoose: boolean;
  removedCharactersFaceUp: Character[];
  removedCharactersFaceDownCount: number;  // how many cards removed secretly

  // Turn state
  currentCharacterRank: number;
  turnState: TurnState | null;
  isMyTurn: boolean;
  pendingGraveyard: { playerId: string; card: DistrictCard } | null;
  pendingMagistrate: { playerId: string; targetPlayerId: string; targetPlayerName: string; card: DistrictCard } | null;
  pendingBlackmail: { playerId: string; blackmailerId: string; blackmailerName: string; stage: 'bribe' | 'reveal'; bribeAmount: number } | null;

  /** Hands revealed to me by my own power (Wizard / Spy). */
  revealedHands: { playerId: string; playerName: string; cards: DistrictCard[] }[];
  /** Warrants / threats I placed this round (only visible to their owner). */
  myWarrants: { rank: number; signed: boolean }[];
  myThreats: { rank: number; real: boolean }[];
  /** Ranks known to be under a warrant / threat (markers are public, their meaning is not). */
  warrantedRanks: number[];
  threatenedRanks: number[];
  bewitchedCharacter: number | null;
  taxPot: number;

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
  type: 'murder' | 'steal' | 'swap' | 'destroy' | 'bewitch' | 'confiscate' | 'blackmail' | 'seize' | 'exchange' | 'spy';
  actorName: string;
  actorCharacter: string;
  targetCharacter?: string;       // character name targeted (Assassin/Thief/Witch)
  targetPlayerName?: string;      // player name targeted (Magician/Warlord)
  detail?: string;                // e.g. district name destroyed
}

/** What a player did on one turn — shown as a transient popup. */
export interface BotTurnSummary {
  playerName: string;
  characterName: string;
  characterRank: number;
  /** The round the turn belonged to. */
  round: number;
  actions: string[];
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
