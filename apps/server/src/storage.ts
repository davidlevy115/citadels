import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import type { GameState } from '@citadels/game-logic';

const SAVE_DIR = join(import.meta.dirname, '../../saves');

function ensureSaveDir(): void {
  if (!existsSync(SAVE_DIR)) {
    mkdirSync(SAVE_DIR, { recursive: true });
  }
}

export function saveGame(gameId: string, state: GameState): void {
  ensureSaveDir();
  const path = join(SAVE_DIR, `${gameId}.json`);
  writeFileSync(path, JSON.stringify(state, null, 2), 'utf-8');
}

/**
 * Saves written before the deluxe character sets landed have no `cast` and an
 * older turn shape, so they cannot be resumed by the current engine.
 */
function isCompatible(state: any): state is GameState {
  return !!state
    && Array.isArray(state.cast) && state.cast.length > 0
    && typeof state.maxRank === 'number'
    && (state.turnState === null || typeof state.turnState?.playerId === 'string');
}

export function loadGame(gameId: string): GameState | null {
  const path = join(SAVE_DIR, `${gameId}.json`);
  if (!existsSync(path)) return null;
  try {
    const state = JSON.parse(readFileSync(path, 'utf-8'));
    if (!isCompatible(state)) {
      console.warn(`Save ${gameId} was written by an older version and cannot be loaded.`);
      return null;
    }
    return state;
  } catch (e) {
    console.error(`Could not read save ${gameId}:`, e);
    return null;
  }
}

export function listSavedGames(): string[] {
  ensureSaveDir();
  return readdirSync(SAVE_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''))
    .filter(id => loadGame(id) !== null);
}

export function deleteSavedGame(gameId: string): void {
  const path = join(SAVE_DIR, `${gameId}.json`);
  if (existsSync(path)) unlinkSync(path);
}
