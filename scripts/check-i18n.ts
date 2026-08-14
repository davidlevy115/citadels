/**
 * Renders every log key, error code and interface string in every language and
 * fails if any {placeholder} is left unresolved — the one class of translation
 * bug the type system cannot catch.
 *
 * Run with: pnpm check:i18n
 */
import {
  createGame, processAction, getBotAction, getPlayerView,
  hasPendingDecision, pendingDecisionPlayerId,
  CHARACTER_SETS, ALL_CHARACTERS, createDistrictDeck,
  type GameState, type LogEntry,
} from '@citadels/game-logic';
import { createTranslator } from '../apps/web/src/lib/i18n/index.js';
import { en } from '../apps/web/src/lib/i18n/en.js';
import { es } from '../apps/web/src/lib/i18n/es.js';

const LOCALES = ['en', 'es'] as const;
const problems: string[] = [];

/** Any {placeholder} left behind means a template and its params disagree. */
function check(label: string, rendered: string) {
  const leftover = rendered.match(/\{(\w+)\}/g);
  if (leftover) problems.push(`${label}: unresolved ${leftover.join(', ')} → "${rendered}"`);
  if (!rendered.trim()) problems.push(`${label}: rendered empty`);
}

// 1. Every log entry a real game produces, in both languages.
const seenKeys = new Set<string>();
for (const set of CHARACTER_SETS) {
  for (const r9 of [false, true]) {
    let state: GameState = createGame({
      players: Array.from({ length: 5 }, (_, i) => ({ name: `P${i + 1}`, isBot: true, age: 20 + i })),
      characterSetId: set.id,
      includeRank9: r9,
    });
    let safety = 0;
    while (state.phase !== 'gameOver' && safety++ < 6000) {
      let id: string | null = null;
      if (hasPendingDecision(state)) id = pendingDecisionPlayerId(state);
      else if (state.phase === 'chooseCharacters') id = state.players[state.choosingPlayerIndex].id;
      else if (state.turnState) id = state.turnState.playerId;
      if (!id) break;
      const action = getBotAction(state, id);
      if (!action) break;
      state = processAction(state, action);
    }
    for (const entry of state.log as LogEntry[]) {
      seenKeys.add(entry.key);
      for (const locale of LOCALES) {
        check(`${locale}/log/${entry.key}`, createTranslator(locale).log(entry));
      }
    }
  }
}

// 2. Every log key in the catalogue, even ones this run did not produce.
for (const locale of LOCALES) {
  const t = createTranslator(locale);
  for (const key of Object.keys(en.log)) {
    if (seenKeys.has(key)) continue;
    // Feed a generous set of params so any placeholder can resolve.
    const rendered = t.log({
      key: key as any,
      params: {
        player: 'Alice', player2: 'Bob', target: 'Bob', donor: 'Bob', lender: 'Bob',
        character: 'Witch', character2: 'King', district: 'Tavern', district2: 'Castle',
        districtType: 'trade', characters: ['Witch', 'King'],
        count: 2, amount: 3, total: 4, cost: 5, gold: 6, cards: 7, round: 1, rank: 4,
        limit: 8, pot: 2, points: 25, matches: 1, discarded: 2, drawn: 2, price: 3,
        paid: 1, ranks: '2, 5', id: 'ABCDEF',
      },
      timestamp: 0,
    });
    check(`${locale}/log-unseen/${key}`, rendered);
  }

  // 3. Every error code.
  for (const code of Object.keys(en.err)) {
    const rendered = t.error({
      code: code as any,
      params: {
        player: 'Alice', character: 'Witch', district: 'Tavern', amount: 3, cost: 5,
        gold: 2, max: 3, min: 2, total: 4, detail: 'boom',
      },
    });
    check(`${locale}/err/${code}`, rendered);
  }

  // 4. Every UI string (params supplied generously).
  for (const key of Object.keys(en.ui)) {
    const rendered = t(key as any, {
      count: 3, joined: 1, total: 4, round: 2, amount: 5, points: 10, rank: 4,
      player: 'Alice', target: 'Bob', character: 'Witch', district: 'Tavern',
      district2: 'Castle', type: 'Trade', ranks: '2, 5',
      cost: 3, gold: 2, cards: 1, shortfall: 2, price: 3, kind: 'a bluff', id: 'ABCDEF',
    });
    check(`${locale}/ui/${key}`, rendered);
  }

  // 5. Every character and district has a name and text.
  for (const c of ALL_CHARACTERS) {
    if (!t.character(c.name)) problems.push(`${locale}: character ${c.name} has no name`);
    if (!t.characterShort(c.name)) problems.push(`${locale}: character ${c.name} has no blurb`);
    if (!t.characterFull(c.name)) problems.push(`${locale}: character ${c.name} has no full text`);
  }
  for (const d of new Set(createDistrictDeck().map(d => d.name))) {
    if (!t.district(d)) problems.push(`${locale}: district ${d} has no name`);
    if (t.district(d) === d && locale === 'es' && !['Templo'].includes(d)) {
      // Not an error by itself, but worth surfacing if a Spanish name is missing.
      if (!es.districts[d]) problems.push(`${locale}: district ${d} missing from catalogue`);
    }
  }
}

const unexercised = Object.keys(en.log).filter(k => !seenKeys.has(k));
console.log(`log keys exercised by real games: ${seenKeys.size}/${Object.keys(en.log).length}`);
if (unexercised.length) console.log(`  only checked synthetically: ${unexercised.join(', ')}`);
if (problems.length) {
  console.log(`\nPROBLEMS (${problems.length}):`);
  for (const p of problems.slice(0, 40)) console.log('  ' + p);
  process.exit(1);
}
console.log('i18n OK — no unresolved placeholders in either language');
