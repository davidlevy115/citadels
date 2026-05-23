import type { GameState } from './types.js';

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

export function addLog(state: GameState, message: string): void {
  state.log.push({ message, timestamp: Date.now() });
  if (state.log.length > 200) state.log.shift();
}
