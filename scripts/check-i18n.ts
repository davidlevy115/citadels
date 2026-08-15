/**
 * Two checks the type system cannot make:
 *
 *  1. Every log entry a real game produces renders with no {placeholder} left
 *     over. This exercises the actual engine call sites, so it catches a
 *     template asking for something the engine never passes.
 *
 *  2. Both languages use the same placeholders for a given key. This catches a
 *     translation that invents a parameter, without needing a hand-maintained
 *     list of every parameter name in the game — earlier versions of this
 *     script had one, and it produced false failures every time a new
 *     parameter was introduced.
 *
 * Run with: pnpm check:i18n
 */
import {
  createGame, processAction, getBotAction,
  hasPendingDecision, pendingDecisionPlayerId,
  CHARACTER_SETS, ALL_CHARACTERS, createDistrictDeck,
  type GameState, type LogEntry,
} from '@citadels/game-logic';
import { createTranslator } from '../apps/web/src/lib/i18n/index.js';
import { en } from '../apps/web/src/lib/i18n/en.js';
import { es } from '../apps/web/src/lib/i18n/es.js';

const LOCALES = ['en', 'es'] as const;
const DICTS = { en, es };
const problems: string[] = [];

/**
 * Article-aware variants all come from one parameter: {districtEl} and
 * {districtA} are both fed by `district`, so they count as the same input.
 */
function baseParam(name: string): string {
  return name.replace(/^(character2?|district2?)(El|A|De)$/, '$1');
}

function placeholders(template: string): Set<string> {
  return new Set(
    [...template.matchAll(/\{(\w+)\}/g)].map(m => baseParam(m[1]))
  );
}

// ── 1. Real games, both languages ───────────────────────────────

const seenKeys = new Set<string>();

for (const set of CHARACTER_SETS) {
  for (const includeRank9 of [false, true]) {
    let state: GameState = createGame({
      players: Array.from({ length: 5 }, (_, i) => ({ name: `P${i + 1}`, isBot: true, age: 20 + i })),
      characterSetId: set.id,
      includeRank9,
    });

    let safety = 0;
    while (state.phase !== 'gameOver' && safety++ < 6000) {
      let actorId: string | null = null;
      if (hasPendingDecision(state)) actorId = pendingDecisionPlayerId(state);
      else if (state.phase === 'chooseCharacters') actorId = state.players[state.choosingPlayerIndex].id;
      else if (state.turnState) actorId = state.turnState.playerId;
      if (!actorId) break;

      const action = getBotAction(state, actorId);
      if (!action) break;
      state = processAction(state, action);
    }

    for (const entry of state.log as LogEntry[]) {
      seenKeys.add(entry.key);
      for (const locale of LOCALES) {
        const rendered = createTranslator(locale).log(entry);
        const leftover = rendered.match(/\{(\w+)\}/g);
        if (leftover) {
          problems.push(`${locale}/log/${entry.key}: engine never passes ${leftover.join(', ')} → "${rendered}"`);
        }
        if (!rendered.trim()) problems.push(`${locale}/log/${entry.key}: rendered empty`);
      }
    }
  }
}

// ── 2. Languages agree on their placeholders ────────────────────

for (const section of ['ui', 'log', 'err'] as const) {
  for (const key of Object.keys(en[section])) {
    const enParams = placeholders((en[section] as Record<string, string>)[key]);
    const esParams = placeholders((es[section] as Record<string, string>)[key]);

    for (const p of esParams) {
      if (!enParams.has(p)) problems.push(`${section}/${key}: es uses {${p}}, en does not`);
    }
    for (const p of enParams) {
      if (!esParams.has(p)) problems.push(`${section}/${key}: en uses {${p}}, es does not`);
    }
  }
}

// ── 3. Nothing is left unnamed ──────────────────────────────────

for (const locale of LOCALES) {
  const t = createTranslator(locale);
  const dict = DICTS[locale];

  for (const c of ALL_CHARACTERS) {
    if (!t.character(c.name)) problems.push(`${locale}: character ${c.name} has no name`);
    if (!t.characterShort(c.name)) problems.push(`${locale}: character ${c.name} has no blurb`);
    if (!t.characterFull(c.name)) problems.push(`${locale}: character ${c.name} has no full text`);
  }

  for (const name of new Set(createDistrictDeck().map(d => d.name))) {
    if (!dict.districts[name]) problems.push(`${locale}: district ${name} missing from the catalogue`);
  }

  for (const set of CHARACTER_SETS) {
    if (!t.set(set.id).name) problems.push(`${locale}: set ${set.id} has no name`);
    if (!t.set(set.id).blurb) problems.push(`${locale}: set ${set.id} has no blurb`);
  }

  for (const [section, entries] of Object.entries({ ui: dict.ui, log: dict.log, err: dict.err })) {
    for (const [key, text] of Object.entries(entries as Record<string, string>)) {
      if (!text.trim()) problems.push(`${locale}/${section}/${key}: empty`);
    }
  }
}

// ── Report ──────────────────────────────────────────────────────

const unexercised = Object.keys(en.log).filter(k => !seenKeys.has(k));
console.log(`log keys exercised by real games: ${seenKeys.size}/${Object.keys(en.log).length}`);
if (unexercised.length) console.log(`  cross-checked only: ${unexercised.join(', ')}`);

if (problems.length) {
  console.log(`\nPROBLEMS (${problems.length}):`);
  for (const p of problems.slice(0, 40)) console.log('  ' + p);
  process.exit(1);
}
console.log('i18n OK — placeholders resolve, both languages agree, nothing unnamed');
