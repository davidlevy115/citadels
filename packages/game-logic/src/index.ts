export type {
  GameState,
  GameConfig,
  GameAction,
  GamePhase,
  TurnPhase,
  Player,
  Character,
  CharacterName,
  CharacterSet,
  DistrictCard,
  BuiltDistrict,
  DistrictType,
  TurnState,
  PlayerGameView,
  PlayerPublicInfo,
  PlayerScore,
  LogEntry,
  RoundEvent,
  BotTurnSummary,
} from './types.js';

export type { LogKey, LogParams, LogParamValue } from './log.js';
export { TURN_START_KEYS, ROUND_FRAMING_KEYS } from './log.js';
export type { ErrorCode } from './errors.js';
export { GameError, isGameError } from './errors.js';

export {
  createGame, processAction, getPlayerView, getAvailableActions,
  hasPendingDecision, pendingDecisionPlayerId, currentRoundEntries,
} from './engine.js';
export type { AvailableActions } from './engine.js';
export { calculateScores, determineWinner } from './scoring.js';
export { getBotAction } from './bot.js';
export {
  CHARACTERS,
  ALL_CHARACTERS,
  CHARACTER_SETS,
  getCharacterSet,
  getCharacterByName,
  buildCast,
  createDistrictDeck,
  DISTRICTS_TO_WIN,
  DISTRICTS_TO_WIN_SHORT,
  CHARACTER_INCOME_TYPE,
  CROWN_TAKING_CHARACTERS,
} from './constants.js';
export { districtValue, buildLimitFor } from './characters.js';
export { shuffle, generateId } from './utils.js';
