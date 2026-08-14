/**
 * Log entries are stored as a key plus parameters rather than a finished
 * sentence, so the same game can be read in any language and so code that
 * reacts to events (round events, turn boundaries) can match on the key instead
 * of pattern-matching English prose.
 */

export type LogParamValue = string | number | string[];
export type LogParams = Record<string, LogParamValue>;

/**
 * Parameter naming is a contract with the translators:
 *   player, player2, target, donor, lender  — player names, never translated
 *   character, character2                   — character names, translated
 *   district, district2                     — district names, translated
 *   districtType                            — district colour, translated
 *   characters                              — list of character names, translated
 * everything else is a plain number or string.
 */
export type LogKey =
  // Game and round framing
  | 'game.started'
  | 'game.cast'
  | 'game.crownOldest'
  | 'game.over'
  | 'round.selectionBegins'
  | 'round.selectionComplete'
  | 'player.choseCharacter'
  // Turn framing
  | 'turn.called'
  | 'turn.killed'
  | 'turn.takesCrown'
  | 'turn.bewitchedNotice'
  | 'heir.takesCrown'
  // Gathering and building
  | 'action.takeGold'
  | 'action.drawKeptOne'
  | 'action.drawKeptAll'
  | 'action.drawChoose'
  | 'build.district'
  | 'build.finalRound'
  | 'income.gold'
  | 'income.cards'
  | 'tax.paid'
  // Rank 1
  | 'assassin.kills'
  | 'witch.bewitches'
  | 'witch.resumes'
  | 'witch.noResume'
  | 'magistrate.warrants'
  | 'magistrate.mayReveal'
  | 'magistrate.confiscates'
  // Rank 2
  | 'thief.targets'
  | 'thief.steals'
  | 'spy.inspects'
  | 'blackmailer.threatens'
  | 'blackmail.mustDecide'
  | 'blackmail.bribes'
  | 'blackmail.refuses'
  | 'blackmail.revealsReal'
  | 'blackmail.revealsBluff'
  | 'blackmail.skips'
  // Rank 3
  | 'magician.swaps'
  | 'magician.discards'
  | 'wizard.takesAndBuilds'
  | 'wizard.takesCard'
  | 'seer.takes'
  | 'seer.gives'
  // Rank 4
  | 'emperor.crownsGold'
  | 'emperor.crownsCard'
  | 'emperor.crownsNothing'
  // Rank 5
  | 'abbot.income'
  | 'abbot.tribute'
  | 'cardinal.builds'
  // Rank 6
  | 'merchant.bonus'
  | 'alchemist.refund'
  // Rank 7
  | 'architect.draw'
  | 'navigator.gold'
  | 'navigator.cards'
  // Rank 8
  | 'warlord.destroys'
  | 'diplomat.exchanges'
  | 'diplomat.exchangesPaid'
  | 'marshal.seizes'
  // Rank 9
  | 'queen.bonus'
  | 'artist.beautifies'
  | 'taxCollector.collects'
  // Districts
  | 'graveyard.mayRecover'
  | 'graveyard.recovers'
  | 'laboratory.use'
  | 'smithy.use';

export interface LogEntry {
  key: LogKey;
  params?: LogParams;
  timestamp: number;
}

/** Entries that mark the beginning of a new turn. */
export const TURN_START_KEYS: LogKey[] = ['turn.called', 'witch.resumes'];

/**
 * Entries that describe the round rather than any one player's turn, and so do
 * not belong in a per-turn recap.
 */
export const ROUND_FRAMING_KEYS: LogKey[] = [
  'game.started',
  'game.cast',
  'game.crownOldest',
  'game.over',
  'round.selectionBegins',
  'round.selectionComplete',
  'player.choseCharacter',
  'turn.killed',
  'heir.takesCrown',
  'witch.noResume',
];
