#!/bin/bash
cd "$(dirname "$0")"
echo ""
echo "  ♛  CITADELS  ♛"
echo "  Building & starting..."
echo ""
pnpm --filter @citadels/game-logic build && pnpm --parallel --filter @citadels/server --filter @citadels/web dev
