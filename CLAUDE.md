# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies (delete node_modules first if packages seem broken)
pnpm install

# Dev mode — builds game-logic, then starts server (port 3001) + web dev server (port 3000) in parallel
pnpm play
# or equivalently:
./play.sh

# Build everything for production
pnpm build

# Build individual packages
pnpm --filter @citadels/game-logic build   # compile TypeScript → dist/
pnpm --filter @citadels/server build       # compile TypeScript → dist/
pnpm --filter @citadels/web build          # Next.js static export → apps/web/out/

# Run tests (game-logic only)
pnpm test

# Check that every string renders in every language with no unresolved {placeholders}
pnpm check:i18n
pnpm --filter @citadels/game-logic test

# Run a single test file
node node_modules/.pnpm/node_modules/.bin/vitest run packages/game-logic/src/__tests__/engine.test.ts

# Compile TypeScript manually (tsc binary location in pnpm store)
node node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/lib/_tsc.js -p packages/game-logic/tsconfig.json
node node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/lib/_tsc.js -p apps/server/tsconfig.json

# Build web app
node_modules/.pnpm/node_modules/.bin/next build apps/web
```

## Architecture

**Monorepo** (pnpm workspaces): `packages/game-logic`, `apps/server`, `apps/web`.

### Game Logic (`packages/game-logic/src/`)

Pure TypeScript state machine — zero UI/network dependencies, fully testable.

- **`types.ts`** — All interfaces: `GameState`, `GameAction` (discriminated union), `TurnState`, `PlayerGameView`, `PlayerPublicInfo`, etc.
- **`engine.ts`** — Core: `createGame()`, `processAction(state, action) → newState`, `getPlayerView(state, playerId)`, `getAvailableActions()`. The game is a series of state transitions triggered by actions.
- **`constants.ts`** — The full 27-character deluxe roster (`ALL_CHARACTERS`, three per rank 1–9), the classic eight (`CHARACTERS`), the preset casts (`CHARACTER_SETS`) and `buildCast()`, plus the district card pool.
- **`characters.ts`** — Character power helpers: income collection, Architect draw, Warlord/Diplomat/Marshal targeting rules, Observatory/Library draw logic, `buildLimitFor()`.
- **`bot.ts`** — AI: `getBotAction(state, playerId) → GameAction`. Runs server-side, same API as human players.
- **`scoring.ts`** — End-game point calculation.

**Key pattern**: `getPlayerView` strips private information before sending to each client — players only see their own hand and character choice. `TurnState` is attached to `GameState` and drives what actions are valid each phase.

**Character sets**: a game is played with a *cast* of one character per rank, chosen at setup (`GameConfig.characterSetId`, optionally `includeRank9`). `GameState.cast` and `GameState.maxRank` are the source of truth — never assume the classic eight or `maxRank === 8`.

**`TurnState.playerId` / `effectiveCharacter`**: the active player is `turnState.playerId`, *not* whoever holds `currentCharacterRank`. The Witch bewitches a character, that player takes a stunted turn (`isBewitchedTurn`), and then the Witch replays it herself (`isWitchResume`) with `effectiveCharacter` set to the bewitched card. All power logic keys off `effectiveCharacter`, never `player.characterCard`.

**Pending decisions** block every other action: `pendingGraveyard`, `pendingMagistrate` (warrant confiscation) and `pendingBlackmail` (bribe, then reveal). Use `hasPendingDecision()` / `pendingDecisionPlayerId()` to find who must answer — bot drivers and the server loop both rely on these.

**Special buildings** (Laboratory, Smithy, Graveyard, Observatory, Library) are handled in engine.ts with `specialBuildingsUsed: string[]` on `TurnState` to prevent double-use per turn.

**Structured logs**: `state.log` holds `{ key, params }`, never a finished sentence — see `log.ts` for the `LogKey` union and the parameter naming contract. Rule violations throw `GameError` carrying an `ErrorCode` (`errors.ts`) rather than an English message. This is what lets the same game be read in any language, and it also means round events and turn boundaries match on keys instead of pattern-matching prose. **Never add a bare string to the log or an `Error` with prose** — add a key.

**Targeting**: characters discarded face up are public and cannot be held by anyone, so `validateTargetRank()` rejects them for every naming power (Assassin, Witch, Magistrate, Thief, Blackmailer). Naming one used to silently waste the whole power — most painfully the Witch's, which loses her second turn. Bots filter the same way via `targetableRanks()` in `bot.ts`; the UI filters via `targetableRanks()` in `PowerActions.tsx`.

**Deliberate simplifications**: the Seer's give-back cards are chosen automatically (cheapest first); Magistrate/Blackmailer markers are placed by naming ranks rather than dragging tokens.

### Server (`apps/server/src/`)

Express + Socket.io. Single process serves both the static frontend and the game API.

- **`rooms.ts`** — All Socket.io event handlers: `createGame`, `joinRoom`, `createMultiplayerRoom`, `gameAction`, `loadGame`, `listSaves`, `rejoinRoom`. The `rooms` Map is the in-memory game state store. After every player action, `advanceRoom()` advances bot moves and broadcasts updated views to all players.
  - **Turn narration**: every action goes through `applyAction()`, which attributes the log lines it produced to the turn that was active, splitting at the `TURN_BOUNDARY` line when one action ends a turn and starts the next.
  - **Recap gating**: `advanceRoom()` replaces the old run-all-bots-at-once loop. Bots stop the moment a turn completes; that turn is emitted as a single `turnSummary` and the room *waits* for a `turnSummaryAck` from every human (or `SUMMARY_ACK_TIMEOUT_MS`) before continuing. This is what keeps recaps describing the turn that just happened instead of arriving in a burst once the round is over — do not reintroduce batching.
- **`storage.ts`** — JSON file persistence for single-player saves in `apps/saves/` (gitignored). `loadGame()` rejects saves written before the deluxe cast existed (no `cast` / old `turnState`), and `listSavedGames()` hides them.
- **`index.ts`** — HTTP server, Socket.io CORS setup, static file serving. Tries multiple paths for `apps/web/out/`.

**Multiplayer flow**: Room is created with a pending config → players join by room code → once all humans joined, `tryStartGame()` creates the `GameState` and maps socket IDs to player IDs.

**Reconnect**: `rejoinRoom` event updates a player's socket ID without removing their game state. Disconnect handler no longer removes players from rooms (they can reconnect, especially on mobile).

### Web (`apps/web/src/`)

Next.js 15 static export (`output: 'export'`). Builds to `apps/web/out/` which the server serves.

- **`hooks/useSocket.ts`** — Main hook. Manages Socket.io connection, all server event listeners, and emits player actions. Handles `visibilitychange` for mobile background reconnection.
- **`hooks/useGameState.ts`** — Zustand store. Holds `roomId`, `playerId`, `gameView` (`PlayerGameView`), `lobbyState`, errors.
- **`components/GameBoard.tsx`** — Top-level game UI. Orchestrates all other components.
- **`components/PowerActions.tsx`** — Power and special-building buttons for all 27 characters, driven by `turnState.effectiveCharacter`.
- **`components/CharacterSelect.tsx`** — Character draft overlay, shown when `isMyTurnToChoose`. Includes colored district dots per player and warrant/threat markers.
- **`components/CharacterSetPicker.tsx`** — Preset cast chooser on the setup screen, with the rank 9 toggle.
- **`components/TurnSummaryPopup.tsx`** — Recap of the turn that just finished. Closes after 10s or on the × button; either way it acks the server, which is what lets the game continue.
- **`components/GameLog.tsx`** — Shows only the most recent round that has entries, newest line first.
- **Dead code**: `PlayerInfo.tsx` and `City.tsx` are not imported anywhere and are not translated.
- **`lib/i18n/`** — The translation catalogues. `types.ts` defines `Dictionary`, whose `Record<LogKey|ErrorCode|UiKey, …>` shape makes a missing translation a **compile error**. `index.ts` holds the formatter, which supplies article-aware variants of character and district parameters (`{character}` / `{characterEl}` / `{characterA}` / `{characterDe}`) so Spanish can say "la Bruja" but "al Rey"; each language's template picks the form it needs. Add a language by writing one more file of the same shape.
- **`hooks/useI18n.ts`** — `useT()` returns the translator; language is a client preference chosen on the setup screen and kept in `localStorage`. Because logs are structured, two players in one game can read it in different languages.
- **`lib/socket.ts`** — Singleton Socket.io client. Connects to `NEXT_PUBLIC_SERVER_URL` env var or same origin (production) / port 3001 (dev).

### TypeScript Setup

All three packages extend `tsconfig.base.json` (root). The base uses `module: ESNext, moduleResolution: bundler` which works for Next.js and tsx (dev server). The game-logic `dist/` must be compiled before building the web app in production; in dev, `next.config.ts` uses `transpilePackages: ['@citadels/game-logic']` so Next.js transpiles the TS source directly.

**Known issue**: TypeScript 5.9.3 in the pnpm store is missing `lib.es2016.array.include.d.ts`. This file was manually created at `node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/lib/lib.es2016.array.include.d.ts`. It persists across `pnpm install` but NOT across `rm -rf node_modules && pnpm install` — in that case, recreate it (it defines `Array.prototype.includes`).

## Deployment

Single service on Render (see `render.yaml`): one Node.js process serves both the built frontend and the Socket.io API on port 10000. Build command compiles all three packages; start command is `node apps/server/dist/index.js`.
