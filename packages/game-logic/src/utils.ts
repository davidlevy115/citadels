import type { GameState } from './types.js';
import type { LogKey, LogParams } from './log.js';

// Fisher-Yates shuffle (in-place, returns same array)
export function shuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

export function cloneState<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/** Keep the whole game's history — the UI slices it per round and the
 *  server slices it per turn, so trimming here would lose information. */
const MAX_LOG_ENTRIES = 2000;

/**
 * Record an event as a key plus parameters. Nothing here is a finished
 * sentence: the client turns these into text in the reader's own language.
 */
export function addLog(state: GameState, key: LogKey, params?: LogParams): void {
  state.log.push({ key, ...(params ? { params } : {}), timestamp: Date.now() });
  if (state.log.length > MAX_LOG_ENTRIES) state.log.shift();
}
