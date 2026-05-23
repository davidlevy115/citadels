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

export function loadGame(gameId: string): GameState | null {
  const path = join(SAVE_DIR, `${gameId}.json`);
  if (!existsSync(path)) return null;
  const data = readFileSync(path, 'utf-8');
  return JSON.parse(data) as GameState;
}

export function listSavedGames(): string[] {
  ensureSaveDir();
  return readdirSync(SAVE_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));
}

export function deleteSavedGame(gameId: string): void {
  const path = join(SAVE_DIR, `${gameId}.json`);
  if (existsSync(path)) unlinkSync(path);
}
