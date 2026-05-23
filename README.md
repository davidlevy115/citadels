# Citadels Digital

A digital implementation of Bruno Faidutti's **Citadels** board game, built for web browsers on any device.

## Why This Tech Stack

Citadels is a card game driven by **hidden information**, **turn-based multiplayer**, and **rich UI interactions** (drafting, building, using powers). A game engine is overkill — the mechanics are state transitions, not physics. What matters is:

1. **Beautiful card UI with smooth animations** — React + Framer Motion handle this natively.
2. **Real-time multiplayer with private state** — Socket.io rooms let us send each player only what they should see.
3. **Cross-platform from a single codebase** — A responsive web app works on every phone, tablet, and desktop. PWA adds install-to-homescreen.
4. **Shared type safety** — TypeScript end-to-end means the game rules, server, and client all speak the same language. Bugs surface at compile time.
5. **Easy to maintain** — One language (TypeScript), one paradigm (React components), massive community and ecosystem.

### Stack

| Layer | Technology | Role |
|-------|-----------|------|
| Game Logic | TypeScript (pure functions) | Rules engine, state machine — no UI dependencies, fully testable |
| Frontend | Next.js 15 + React 19 | Component-based UI, SSR for fast load, file-based routing |
| Styling | Tailwind CSS 4 | Utility-first CSS, responsive design out of the box |
| Animations | Framer Motion | Card flips, dealing, drag-and-drop, transitions |
| Real-time | Socket.io | WebSocket rooms, reconnection, private messaging per player |
| State (client) | Zustand | Lightweight reactive store for game state |
| Persistence | File-based JSON (server) | Save/load single-player games |
| Deploy | Vercel (web) + Railway/Fly.io (server) | Free tiers, easy CI/CD |

### Alternatives Considered

- **Phaser + Colyseus**: Better for sprite-heavy 2D games. Overkill for cards. Mixing canvas + HTML for menus is clunky.
- **Godot 4**: True game engine, exports everywhere. But GDScript is niche, web export is 20MB+, and multiplayer requires more manual wiring.
- **Unity**: Heavy runtime, C# only, not free for all use cases. Wrong tool for a card game.

## Architecture

```
citadels/
├── packages/
│   └── game-logic/          # Pure TypeScript game rules
│       └── src/
│           ├── types.ts      # All game types and interfaces
│           ├── constants.ts  # Character/district card data
│           ├── engine.ts     # State machine (createGame, processAction)
│           ├── characters.ts # Character power implementations
│           ├── scoring.ts    # End-game scoring
│           ├── bot.ts        # Bot AI for single-player
│           └── utils.ts      # Shuffle, RNG helpers
├── apps/
│   ├── server/               # Multiplayer game server
│   │   └── src/
│   │       ├── index.ts      # Entry point, Socket.io setup
│   │       ├── rooms.ts      # Room/lobby management
│   │       └── storage.ts    # Save/load game persistence
│   └── web/                  # Next.js frontend
│       └── src/
│           ├── app/          # Pages (lobby, game)
│           ├── components/   # UI components (Card, Hand, City, etc.)
│           ├── hooks/        # useSocket, useGameState
│           └── lib/          # Socket client setup
```

### Key Design Decisions

**Pure game-logic package**: The rules engine is a pure state machine with zero dependencies on UI or networking. `processAction(state, action) → newState`. This means:
- Unit-testable without any UI
- Server runs it authoritatively (no cheating)
- Client can run it for optimistic updates
- Bot AI operates on the same API as human players
- Save/load is just `JSON.stringify(state)`

**Server-authoritative multiplayer**: The server holds the true game state. Clients send actions, the server validates and broadcasts results. Each player only receives their own private information (hand, character choice) plus public state.

**Bot players**: Bots use the same `processAction` API as humans. They run server-side with configurable strategy. Games can be all-bots, all-humans, or mixed.

**Save/load**: Game state is a single serializable object. Single-player games are saved to the server as JSON files, keyed by a game ID stored in the player's browser.

## Game Modes

- **Single Player**: Play against 1-7 bots. Games auto-save and can be resumed later.
- **Multiplayer**: Create a room, share the code. 2-8 human players.
- **Mixed**: Fill empty seats with bots in any multiplayer room.

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+

### Install and Run

```bash
# Install dependencies
pnpm install

# Build the shared game-logic package
pnpm --filter @citadels/game-logic build

# Start the game server (default: port 3001)
pnpm --filter @citadels/server dev

# Start the web app (default: port 3000)
pnpm --filter @citadels/web dev
```

Open http://localhost:3000 in your browser.

### Run Tests

```bash
# Run game logic tests (rules verification)
pnpm --filter @citadels/game-logic test

# Run all tests
pnpm test
```

## Game Rules Summary

Citadels is a 2-8 player city-building card game. Each round:

1. **Draft characters secretly** — choose from Assassin, Thief, Magician, King, Bishop, Merchant, Architect, or Warlord.
2. **Take turns in rank order** — collect gold or draw cards, build districts in your city, use your character's unique power.
3. **Race to 8 districts** — the first player to build 8 districts triggers the final round.
4. **Score** — total district costs + bonus for all 5 colors (3 pts) + bonus for first to 8 (4 pts) or also reaching 8 (2 pts).

The full rules are in `4a-citadels-rulebook.pdf`.
