import type { CharacterName, DistrictType, LogKey, ErrorCode } from '@citadels/game-logic';

export type Locale = 'en' | 'es';

export const LOCALES: { id: Locale; label: string; flag: string }[] = [
  { id: 'en', label: 'English', flag: '🇬🇧' },
  { id: 'es', label: 'Español', flag: '🇪🇸' },
];

/**
 * Grammatical gender, so Spanish can say "la Bruja" but "el Rey". English
 * ignores it and uses "the" throughout.
 */
export type Gender = 'm' | 'f';

/** How a character reads on screen: its name, the card blurb, and the full rule. */
export interface CharacterText {
  name: string;
  gender?: Gender;
  short: string;
  full: string;
}

export interface DistrictText {
  name: string;
  gender?: Gender;
  description?: string;
}

/**
 * Every string the player can see. Keeping this one shape per language means a
 * missing translation is a type error rather than a surprise in the UI.
 */
export interface Dictionary {
  ui: Record<UiKey, string>;
  log: Record<LogKey, string>;
  err: Record<ErrorCode, string>;
  characters: Record<CharacterName, CharacterText>;
  districts: Record<string, DistrictText>;
  districtTypes: Record<DistrictType, string>;
  sets: Record<string, { name: string; blurb: string }>;
}

/** Keys for interface chrome — buttons, labels, headings, hints. */
export type UiKey =
  // Setup screen
  | 'app.title' | 'app.tagline'
  | 'setup.yourName' | 'setup.namePlaceholder' | 'setup.age' | 'setup.agePlaceholder'
  | 'setup.oldestStarts' | 'setup.language'
  | 'setup.tabSolo' | 'setup.tabHost' | 'setup.tabJoin' | 'setup.tabLoad'
  | 'setup.numberOfBots' | 'setup.totalPlayers' | 'setup.humanPlayers' | 'setup.additionalBots'
  | 'setup.startGame' | 'setup.createRoom' | 'setup.joinGame'
  | 'setup.roomCode' | 'setup.roomCodePlaceholder' | 'setup.needNameAndAge'
  | 'setup.hostPicksSet' | 'setup.noSavedGames' | 'setup.savedGame'
  | 'setup.characters' | 'setup.showCast' | 'setup.randomCast'
  | 'setup.addRank9' | 'setup.queenNeedsFive' | 'setup.randomRank9'
  // Lobby
  | 'lobby.waiting' | 'lobby.shareCode' | 'lobby.clickToCopy' | 'lobby.waitingForPlayer'
  | 'lobby.playersJoined' | 'lobby.oldestWillStart'
  // Board chrome
  | 'board.round' | 'board.deck' | 'board.tax' | 'board.final'
  | 'board.nowPlaying' | 'board.bewitchedPlays' | 'board.gameOver'
  | 'board.chooseYourCharacter' | 'board.choosingCharacters' | 'board.choosing' | 'board.waiting'
  | 'board.yourTurnChooseAction' | 'board.pickCardToKeep' | 'board.bewitchedTurnEnds'
  | 'board.buildUsePowersEnd' | 'board.takeGold' | 'board.drawCards' | 'board.drawSevenCards'
  | 'board.endTurn' | 'board.tapCardToBuild' | 'board.noCards' | 'board.waitingForDecision'
  | 'board.copyRoomCode' | 'board.districts'
  // Character select
  | 'select.title' | 'select.subtitle' | 'select.you' | 'select.removedFaceUp'
  | 'select.warrantOn' | 'select.threatOn' | 'select.warrantMarker' | 'select.threatMarker'
  // Card choice
  | 'choice.title' | 'choice.otherGoesBack' | 'choice.othersGoBack' | 'choice.keep' | 'choice.yourHand'
  // Overlays
  | 'graveyard.title' | 'graveyard.prompt' | 'graveyard.recover' | 'graveyard.decline'
  | 'magistrate.title' | 'magistrate.prompt' | 'magistrate.confiscate' | 'magistrate.stayHidden'
  | 'blackmail.title' | 'blackmail.bribePrompt' | 'blackmail.pay' | 'blackmail.refuse'
  | 'blackmail.revealPrompt' | 'blackmail.realThreat' | 'blackmail.bluff'
  | 'blackmail.reveal' | 'blackmail.leaveFacedown'
  | 'seer.title' | 'seer.prompt' | 'seer.giveTo' | 'seer.pickCard'
  | 'seer.confirm' | 'seer.remaining' | 'seer.yourHand' | 'seer.clear'
  // Game over
  | 'over.title' | 'over.playAgain' | 'over.points' | 'over.colourBonus'
  | 'over.firstBonus' | 'over.otherBonus'
  // Log and recap
  | 'log.roundLog' | 'log.previous'
  | 'recap.close' | 'recap.closeTitle'
  // Powers
  | 'power.kill' | 'power.killTitle'
  | 'power.bewitch' | 'power.bewitchTitle' | 'power.bewitchHint'
  | 'power.warrants' | 'power.warrantsTitle' | 'power.warrantsHint' | 'power.placeWarrants' | 'power.signed'
  | 'power.steal' | 'power.stealTitle'
  | 'power.spy' | 'power.spyTitle' | 'power.spyHint'
  | 'power.threaten' | 'power.threatenTitle' | 'power.threatenHint' | 'power.placeThreats' | 'power.real'
  | 'power.magic' | 'power.magicTitle' | 'power.swapWith' | 'power.orDiscard' | 'power.discardAndDraw'
  | 'power.lookAtHand' | 'power.wizardTitle' | 'power.wizardHint' | 'power.buildIt'
  | 'power.nobodyHasCards' | 'power.emptyHand'
  | 'power.seerTake' | 'power.seerTitle'
  | 'power.giveCrown' | 'power.emperorTitle' | 'power.emperorHint' | 'power.takeGold1' | 'power.takeCard1'
  | 'power.collectIncome' | 'power.drawIncome'
  | 'power.abbotIncome' | 'power.abbotTitle' | 'power.abbotHint' | 'power.abbotTake'
  | 'power.cardinal' | 'power.cardinalTitle' | 'power.cardinalHint' | 'power.cardinalNeed' | 'power.cardinalTake'
  | 'power.navigatorGold' | 'power.navigatorCards'
  | 'power.destroy' | 'power.destroyTitle' | 'power.dontDestroy'
  | 'power.seize' | 'power.seizeTitle' | 'power.seizeHint' | 'power.pay'
  | 'power.exchange' | 'power.exchangeTitle' | 'power.exchangeHint' | 'power.districtToGive'
  | 'power.beautify' | 'power.beautifyTitle' | 'power.beautifyHint' | 'power.beautifiedMark'
  | 'power.collectTax'
  | 'power.laboratory' | 'power.laboratoryTitle'
  | 'power.smithy'
  | 'power.skip' | 'power.cancel' | 'power.bewitchedNote' | 'power.playingAs'
  | 'power.citySuffix'
  // Round events
  | 'event.murder' | 'event.steal' | 'event.stealResolved' | 'event.swap' | 'event.destroy'
  | 'event.bewitch' | 'event.confiscate' | 'event.blackmail' | 'event.seize' | 'event.exchange' | 'event.spy'
  | 'event.youMurderedTitle' | 'event.youMurderedBody'
  | 'event.youRobbedTitle' | 'event.youRobbedBody'
  | 'event.youBewitchedTitle' | 'event.youBewitchedBody'
  // Player seat / misc
  | 'seat.bot' | 'seat.murdered' | 'seat.robbed'
  | 'misc.gold' | 'misc.cards' | 'misc.rank' | 'misc.tapToClose'
  | 'misc.districtSuffix' | 'misc.pointsSuffix' | 'misc.costLabel';
