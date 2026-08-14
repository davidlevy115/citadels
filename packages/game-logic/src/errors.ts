import type { LogParams } from './log.js';

/**
 * Rule violations carry a code and parameters instead of a sentence, so the
 * client can show them in the player's own language. Same parameter naming
 * contract as log entries: `character` / `district` / `districtType` values are
 * canonical English names that the renderer translates.
 */
export type ErrorCode =
  // Lookup and phase
  | 'err.playerNotFound'
  | 'err.targetPlayerNotFound'
  | 'err.districtNotFound'
  | 'err.invalidCardIndex'
  | 'err.characterNotAvailable'
  | 'err.noActiveTurn'
  | 'err.notYourTurn'
  | 'err.notYourTurnToChoose'
  | 'err.notInTurnPhase'
  | 'err.notInCharacterPhase'
  | 'err.notInCardChoosingPhase'
  | 'err.playerCountRange'
  // Turn flow
  | 'err.actionAlreadyTaken'
  | 'err.mustActFirst'
  | 'err.mustActBeforeEnding'
  | 'err.powerAlreadyUsed'
  | 'err.incomeAlreadyCollected'
  | 'err.alreadyBuiltThisTurn'
  | 'err.buildLimit'
  | 'err.cannotBuildThisTurn'
  | 'err.duplicateDistrict'
  | 'err.notEnoughGoldCost'
  // Bewitchment
  | 'err.bewitchedCannotBuild'
  | 'err.bewitchedCannotUsePower'
  | 'err.bewitchedCannotUseDistrict'
  // Targeting
  | 'err.invalidTargetRank'
  | 'err.removedFaceUp'
  | 'err.chooseAnotherPlayer'
  | 'err.chooseOwnDistrict'
  | 'err.cannotSpySelf'
  | 'err.cannotSwapSelf'
  | 'err.stealFromKilled'
  | 'err.stealFromBewitched'
  | 'err.threatenKilled'
  | 'err.threatenBewitched'
  | 'err.warrantsDistinct'
  | 'err.threatsDistinct'
  // Character requirements
  | 'err.notThatCharacter'
  | 'err.mustUsePower'
  | 'err.witchMustBewitch'
  | 'err.witchMustGather'
  | 'err.emperorMustCrown'
  | 'err.crownSomeoneElse'
  | 'err.abbotSplit'
  // Rank 8 and district taking
  | 'err.cannotDestroyCompleted'
  | 'err.cannotTouchCompleted'
  | 'err.bishopProtected'
  | 'err.keepCannotDestroy'
  | 'err.keepCannotTake'
  | 'err.keepCannotExchange'
  | 'err.noRank8'
  | 'err.marshalCostLimit'
  | 'err.notEnoughGoldAmount'
  | 'err.targetAlreadyHas'
  | 'err.youAlreadyHave'
  // Cardinal
  | 'err.canAffordAlready'
  | 'err.lenderLacksGold'
  | 'err.needSpareCards'
  // Artist
  | 'err.alreadyBeautified'
  | 'err.beautifyLimit'
  | 'err.needGoldBeautify'
  // Districts
  | 'err.buildingNotOwned'
  | 'err.buildingAlreadyUsed'
  | 'err.needGoldGraveyard'
  | 'err.needGoldSmithy'
  | 'err.noCardsToDiscard'
  | 'err.notEnoughGoldForDistrict'
  // Pending decisions
  | 'err.noGraveyardPending'
  | 'err.notYourGraveyardDecision'
  | 'err.noWarrantPending'
  | 'err.notYourWarrantDecision'
  | 'err.noBribePending'
  | 'err.noRevealPending'
  | 'err.notYourDecision'
  | 'err.waitingGraveyard'
  | 'err.waitingWarrant'
  | 'err.waitingBlackmail'
  | 'err.waitingSeer'
  | 'err.noSeerPending'
  | 'err.seerGiveOnePerPlayer'
  | 'err.seerNotOwed'
  | 'err.seerCardTwice'
  // Lobby / connection level, raised by the server rather than the rules
  | 'err.needTwoPlayers'
  | 'err.roomNotFound'
  | 'err.roomFull'
  | 'err.gameNotStarted'
  | 'err.notInRoom'
  | 'err.saveNotFound'
  | 'err.noHumanInSave'
  | 'err.unknown';

/** A rule violation the player should be told about, in their own language. */
export class GameError extends Error {
  readonly code: ErrorCode;
  readonly params?: LogParams;

  constructor(code: ErrorCode, params?: LogParams) {
    // The message keeps a readable form for logs and stack traces; the client
    // renders from `code` instead.
    super(params ? `${code} ${JSON.stringify(params)}` : code);
    this.name = 'GameError';
    this.code = code;
    this.params = params;
  }
}

export function isGameError(e: unknown): e is GameError {
  return e instanceof GameError || (typeof e === 'object' && e !== null && 'code' in e && 'name' in e && (e as any).name === 'GameError');
}

/** Shorthand for throwing. */
export function fail(code: ErrorCode, params?: LogParams): never {
  throw new GameError(code, params);
}
