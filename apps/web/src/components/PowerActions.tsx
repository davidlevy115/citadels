'use client';

import { useState, type ReactNode } from 'react';
import type { PlayerGameView, Character, DistrictType } from '@citadels/game-logic';
import { districtValue } from '@citadels/game-logic';

interface PowerActionsProps {
  view: PlayerGameView;
  onAction: (action: any) => void;
}

// ── Shared pieces ───────────────────────────────────────────────

const BTN = 'px-3 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
const CHIP = 'px-2 py-1 rounded text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

/** A button that swaps itself for an inline panel when opened. */
function PowerPanel({ label, tone, title, children, hint }: {
  label: string;
  tone: string;
  title: string;
  hint?: string;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={`${BTN} ${tone}`}>
        {label}
      </button>
    );
  }

  return (
    <div className="space-y-2 bg-slate-800 rounded p-3 border border-slate-600 max-w-full">
      <p className="text-xs text-slate-300 font-medium">{title}</p>
      {hint && <p className="text-[10px] text-slate-500 leading-snug">{hint}</p>}
      {children(() => setOpen(false))}
      <button onClick={() => setOpen(false)} className={`${CHIP} bg-slate-600 hover:bg-slate-500`}>
        Cancel
      </button>
    </div>
  );
}

/**
 * Ranks that can legally be named this round: in the cast, not your own, and
 * not sitting face up on the table as a removed character.
 */
function targetableRanks(view: PlayerGameView, minRank: number, exclude: (number | null | undefined)[] = []) {
  const removed = view.removedCharactersFaceUp.map(c => c.rank);
  return view.cast.filter(c =>
    c.rank >= minRank &&
    c.rank !== view.turnState?.characterRank &&
    !removed.includes(c.rank) &&
    !exclude.includes(c.rank)
  );
}

/** Rank buttons for every character in the cast that can legally be targeted. */
function RankTargets({ view, minRank, exclude, onPick, tone }: {
  view: PlayerGameView;
  minRank: number;
  exclude?: number[];
  onPick: (rank: number) => void;
  tone: string;
}) {
  const targets = targetableRanks(view, minRank, exclude ?? []);

  return (
    <div className="flex flex-wrap gap-1">
      {targets.map(c => (
        <button key={c.rank} onClick={() => onPick(c.rank)} className={`${CHIP} bg-gray-700 ${tone}`}>
          <span className="text-slate-400 mr-1">{c.rank}</span>{c.name}
        </button>
      ))}
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────

export function PowerActions({ view, onAction }: PowerActionsProps) {
  const turn = view.turnState;
  if (!turn || !view.isMyTurn) return null;

  // The Witch plays the bewitched character's turn, so powers follow the
  // effective character rather than the card the player drafted.
  const char: Character = turn.effectiveCharacter;
  const me = view.players[view.myIndex];
  const myCity = me?.city ?? [];
  const myGold = me?.gold ?? 0;
  const specialUsed = turn.specialBuildingsUsed ?? [];
  const powerFree = !turn.powerUsed;
  const acted = turn.actionTaken;

  if (turn.isBewitchedTurn) {
    return (
      <div className="text-[11px] text-purple-300 text-center">
        Bewitched — gather resources, then your turn ends.
      </div>
    );
  }

  const mustUsePower = (char.name === 'Witch' || char.name === 'Emperor') && powerFree;

  return (
    <div className="flex flex-wrap gap-2 justify-center max-w-full">
      {turn.isWitchResume && (
        <div className="w-full text-center text-[11px] text-purple-300">
          Playing the bewitched {char.name}&apos;s turn.
        </div>
      )}

      {/* ── Rank 1 ── */}
      {char.name === 'Assassin' && powerFree && (
        <PowerPanel label="Kill…" tone="bg-gray-700 hover:bg-gray-600" title="Kill a character">
          {close => (
            <RankTargets view={view} minRank={2} tone="hover:bg-red-700"
              onPick={r => { onAction({ type: 'ASSASSIN_KILL', targetRank: r }); close(); }} />
          )}
        </PowerPanel>
      )}

      {char.name === 'Witch' && powerFree && acted && (
        <PowerPanel label="Bewitch…" tone="bg-purple-800 hover:bg-purple-700"
          title="Bewitch a character"
          hint="Your turn pauses. When they are called they may only gather resources — then you play their turn.">
          {close => (
            <RankTargets view={view} minRank={2} tone="hover:bg-purple-700"
              onPick={r => { onAction({ type: 'WITCH_BEWITCH', targetRank: r }); close(); }} />
          )}
        </PowerPanel>
      )}

      {char.name === 'Magistrate' && powerFree && (
        <MagistrateAction view={view} onAction={onAction} />
      )}

      {/* ── Rank 2 ── */}
      {char.name === 'Thief' && powerFree && (
        <PowerPanel label="Steal from…" tone="bg-gray-700 hover:bg-gray-600" title="Rob a character">
          {close => (
            <RankTargets view={view} minRank={3}
              exclude={[view.murderedCharacter, view.bewitchedCharacter].filter((r): r is number => r != null)}
              tone="hover:bg-amber-700"
              onPick={r => { onAction({ type: 'THIEF_STEAL', targetRank: r }); close(); }} />
          )}
        </PowerPanel>
      )}

      {char.name === 'Spy' && powerFree && (
        <SpyAction view={view} onAction={onAction} />
      )}

      {char.name === 'Blackmailer' && powerFree && (
        <BlackmailerAction view={view} onAction={onAction} />
      )}

      {/* ── Rank 3 ── */}
      {char.name === 'Magician' && powerFree && (
        <MagicianAction view={view} onAction={onAction} />
      )}

      {char.name === 'Wizard' && powerFree && (
        <WizardAction view={view} onAction={onAction} />
      )}

      {char.name === 'Seer' && powerFree && (
        <button onClick={() => onAction({ type: 'SEER_TAKE' })}
          className={`${BTN} bg-indigo-700 hover:bg-indigo-600`}
          title="Take a random card from every player, then hand one back to each">
          Take a card from everyone
        </button>
      )}

      {/* ── Rank 4 ── */}
      {char.name === 'Emperor' && powerFree && (
        <EmperorAction view={view} onAction={onAction} />
      )}

      {/* ── Income ── */}
      {char.name === 'Abbot' && !turn.incomeCollected && acted && (
        <AbbotAction view={view} onAction={onAction} />
      )}

      {char.name !== 'Abbot' && !turn.incomeCollected && acted && hasIncome(char.name) && (
        <button onClick={() => onAction({ type: 'USE_POWER' })}
          className={`${BTN} bg-amber-600 hover:bg-amber-500`}>
          {char.name === 'Patrician' || char.name === 'Cardinal' ? 'Draw District Income' : 'Collect Income'}
        </button>
      )}

      {/* ── Rank 5 ── */}
      {char.name === 'Cardinal' && acted && turn.districtsBuilt < turn.maxDistricts && (
        <CardinalAction view={view} onAction={onAction} />
      )}

      {/* ── Rank 7 ── */}
      {char.name === 'Navigator' && powerFree && acted && (
        <div className="flex gap-2">
          <button onClick={() => onAction({ type: 'NAVIGATOR_GAIN', choice: 'gold' })}
            className={`${BTN} bg-yellow-700 hover:bg-yellow-600 text-yellow-100`}>
            Take 4 Gold
          </button>
          <button onClick={() => onAction({ type: 'NAVIGATOR_GAIN', choice: 'cards' })}
            className={`${BTN} bg-emerald-800 hover:bg-emerald-700 text-emerald-100`}>
            Draw 4 Cards
          </button>
        </div>
      )}

      {/* ── Rank 8 ── */}
      {char.name === 'Warlord' && powerFree && acted && (
        <WarlordAction view={view} onAction={onAction} />
      )}

      {char.name === 'Diplomat' && powerFree && acted && (
        <DiplomatAction view={view} onAction={onAction} />
      )}

      {char.name === 'Marshal' && powerFree && acted && (
        <MarshalAction view={view} onAction={onAction} />
      )}

      {/* ── Rank 9 ── */}
      {char.name === 'Artist' && turn.beautifiedCount < 2 && myGold >= 1 && myCity.some(d => !d.beautified) && (
        <ArtistAction view={view} onAction={onAction} />
      )}

      {char.name === 'Tax Collector' && powerFree && view.taxPot > 0 && (
        <button onClick={() => onAction({ type: 'TAX_COLLECTOR_COLLECT' })}
          className={`${BTN} bg-yellow-700 hover:bg-yellow-600 text-yellow-100`}>
          Collect {view.taxPot} gold in tax
        </button>
      )}

      {/* ── Special buildings ── */}
      {myCity.some(d => d.name === 'Laboratory') && !specialUsed.includes('Laboratory') && view.myHand.length > 0 && (
        <PowerPanel label="Laboratory (discard for 2g)" tone="bg-teal-700 hover:bg-teal-600"
          title="Discard a card to gain 2 gold">
          {close => (
            <div className="flex flex-wrap gap-1">
              {view.myHand.map((card, i) => (
                <button key={i} className={`${CHIP} bg-teal-700 hover:bg-teal-600`}
                  onClick={() => { onAction({ type: 'LABORATORY_DISCARD', cardIndex: i }); close(); }}>
                  {card.name} ({card.cost}g)
                </button>
              ))}
            </div>
          )}
        </PowerPanel>
      )}

      {myCity.some(d => d.name === 'Smithy') && !specialUsed.includes('Smithy') && myGold >= 2 && (
        <button onClick={() => onAction({ type: 'SMITHY_DRAW' })}
          className={`${BTN} bg-orange-700 hover:bg-orange-600`}
          title="Pay 2 gold to draw 3 district cards">
          Smithy (pay 2g, draw 3)
        </button>
      )}

      {/* ── Decline an optional power ── */}
      {powerFree && !mustUsePower && acted && isOptionalPower(char.name) && (
        <button onClick={() => onAction({ type: 'SKIP_POWER' })}
          className={`${BTN} bg-slate-700/80 hover:bg-slate-600/80 text-slate-300 text-xs`}>
          Skip {char.name} power
        </button>
      )}
    </div>
  );
}

function hasIncome(name: string): boolean {
  return ['King', 'Emperor', 'Patrician', 'Bishop', 'Cardinal', 'Merchant', 'Trader', 'Warlord', 'Diplomat', 'Marshal']
    .includes(name);
}

/** Characters whose power is a choice the player may decline. */
function isOptionalPower(name: string): boolean {
  return ['Assassin', 'Magistrate', 'Thief', 'Spy', 'Blackmailer', 'Magician', 'Wizard', 'Seer',
    'Navigator', 'Warlord', 'Diplomat', 'Marshal', 'Tax Collector'].includes(name);
}

// ── Individual powers ───────────────────────────────────────────

function MagistrateAction({ view, onAction }: PowerActionsProps) {
  const [picked, setPicked] = useState<number[]>([]);
  const targets = targetableRanks(view, 2);

  return (
    <PowerPanel label="Issue warrants…" tone="bg-gray-700 hover:bg-gray-600"
      title="Assign three warrants"
      hint="Pick three characters. The first one you pick gets the signed warrant — only that one lets you confiscate.">
      {close => (
        <>
          <div className="flex flex-wrap gap-1">
            {targets.map(c => {
              const idx = picked.indexOf(c.rank);
              return (
                <button key={c.rank}
                  onClick={() => setPicked(p => p.includes(c.rank) ? p.filter(r => r !== c.rank) : [...p, c.rank].slice(0, 3))}
                  className={`${CHIP} ${
                    idx === 0 ? 'bg-red-700' : idx > 0 ? 'bg-slate-500' : 'bg-gray-700 hover:bg-gray-600'
                  }`}>
                  <span className="text-slate-300 mr-1">{c.rank}</span>{c.name}
                  {idx === 0 && <span className="ml-1 text-[9px]">SIGNED</span>}
                </button>
              );
            })}
          </div>
          <button disabled={picked.length !== 3}
            onClick={() => { onAction({ type: 'MAGISTRATE_WARRANTS', signedRank: picked[0], otherRanks: picked.slice(1) }); close(); }}
            className={`${CHIP} bg-amber-600 hover:bg-amber-500`}>
            Place warrants ({picked.length}/3)
          </button>
        </>
      )}
    </PowerPanel>
  );
}

function BlackmailerAction({ view, onAction }: PowerActionsProps) {
  const [picked, setPicked] = useState<number[]>([]);
  const targets = targetableRanks(view, 3, [view.murderedCharacter, view.bewitchedCharacter]);

  return (
    <PowerPanel label="Threaten…" tone="bg-gray-700 hover:bg-gray-600"
      title="Threaten two characters"
      hint="The first one you pick gets the real threat; the second is a bluff. Both must bribe you or gamble.">
      {close => (
        <>
          <div className="flex flex-wrap gap-1">
            {targets.map(c => {
              const idx = picked.indexOf(c.rank);
              return (
                <button key={c.rank}
                  onClick={() => setPicked(p => p.includes(c.rank) ? p.filter(r => r !== c.rank) : [...p, c.rank].slice(0, 2))}
                  className={`${CHIP} ${
                    idx === 0 ? 'bg-red-700' : idx > 0 ? 'bg-slate-500' : 'bg-gray-700 hover:bg-gray-600'
                  }`}>
                  <span className="text-slate-300 mr-1">{c.rank}</span>{c.name}
                  {idx === 0 && <span className="ml-1 text-[9px]">REAL</span>}
                </button>
              );
            })}
          </div>
          <button disabled={picked.length !== 2}
            onClick={() => { onAction({ type: 'BLACKMAIL_ASSIGN', realRank: picked[0], bluffRank: picked[1] }); close(); }}
            className={`${CHIP} bg-amber-600 hover:bg-amber-500`}>
            Place threats ({picked.length}/2)
          </button>
        </>
      )}
    </PowerPanel>
  );
}

const DISTRICT_TYPES: { type: DistrictType; label: string; tone: string }[] = [
  { type: 'noble', label: 'Noble', tone: 'bg-yellow-700 hover:bg-yellow-600' },
  { type: 'religious', label: 'Religious', tone: 'bg-blue-700 hover:bg-blue-600' },
  { type: 'trade', label: 'Trade', tone: 'bg-green-700 hover:bg-green-600' },
  { type: 'military', label: 'Military', tone: 'bg-red-700 hover:bg-red-600' },
  { type: 'special', label: 'Special', tone: 'bg-purple-700 hover:bg-purple-600' },
];

function SpyAction({ view, onAction }: PowerActionsProps) {
  const [target, setTarget] = useState<string | null>(null);
  const opponents = view.players.filter((_, i) => i !== view.myIndex);

  return (
    <PowerPanel label="Spy…" tone="bg-gray-700 hover:bg-gray-600"
      title="Name a district type and look at a hand"
      hint="Take 1 gold from them and draw 1 card for every card of that type in their hand.">
      {close => (
        <>
          <div className="flex flex-wrap gap-1">
            {opponents.map(p => (
              <button key={p.id} onClick={() => setTarget(p.id)}
                className={`${CHIP} ${target === p.id ? 'bg-cyan-700' : 'bg-slate-600 hover:bg-slate-500'}`}>
                {p.name} ({p.handSize}c, {p.gold}g)
              </button>
            ))}
          </div>
          {target && (
            <div className="flex flex-wrap gap-1">
              {DISTRICT_TYPES.map(t => (
                <button key={t.type} className={`${CHIP} ${t.tone}`}
                  onClick={() => { onAction({ type: 'SPY_SPY', targetPlayerId: target, districtType: t.type }); close(); }}>
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </PowerPanel>
  );
}

function MagicianAction({ view, onAction }: PowerActionsProps) {
  const [selectedCards, setSelectedCards] = useState<number[]>([]);

  return (
    <PowerPanel label="Use Magic…" tone="bg-indigo-700 hover:bg-indigo-600" title="Magician power">
      {close => (
        <>
          <div className="flex flex-wrap gap-1">
            {view.players.filter((_, i) => i !== view.myIndex).map(p => (
              <button key={p.id} className={`${CHIP} bg-indigo-700 hover:bg-indigo-600`}
                onClick={() => { onAction({ type: 'MAGICIAN_SWAP_PLAYER', targetPlayerId: p.id }); close(); }}>
                Swap with {p.name} ({p.handSize} cards)
              </button>
            ))}
          </div>
          {view.myHand.length > 0 && (
            <div>
              <p className="text-[10px] text-slate-500 mb-1">Or discard cards to draw replacements:</p>
              <div className="flex flex-wrap gap-1 mb-2">
                {view.myHand.map((card, i) => (
                  <button key={i}
                    onClick={() => setSelectedCards(p => p.includes(i) ? p.filter(x => x !== i) : [...p, i])}
                    className={`${CHIP} ${selectedCards.includes(i) ? 'bg-red-600' : 'bg-slate-600 hover:bg-slate-500'}`}>
                    {card.name}
                  </button>
                ))}
              </div>
              {selectedCards.length > 0 && (
                <button className={`${CHIP} bg-indigo-600 hover:bg-indigo-500`}
                  onClick={() => { onAction({ type: 'MAGICIAN_SWAP_DECK', cardIndices: selectedCards }); close(); }}>
                  Discard {selectedCards.length} &amp; Draw
                </button>
              )}
            </div>
          )}
        </>
      )}
    </PowerPanel>
  );
}

function WizardAction({ view, onAction }: PowerActionsProps) {
  const myGold = view.players[view.myIndex]?.gold ?? 0;
  const myCity = view.players[view.myIndex]?.city ?? [];

  return (
    <PowerPanel label="Look at a hand…" tone="bg-indigo-700 hover:bg-indigo-600"
      title="Take one card from another player"
      hint="Keep it, or build it straight away without using up your building limit.">
      {close => (
        <div className="space-y-2 max-h-56 overflow-y-auto">
          {view.revealedHands.length === 0 && (
            <p className="text-[10px] text-slate-500">Nobody has any cards to take.</p>
          )}
          {view.revealedHands.map(hand => (
            <div key={hand.playerId}>
              <p className="text-[10px] text-slate-400 mb-1">{hand.playerName}&apos;s hand:</p>
              <div className="flex flex-wrap gap-1">
                {hand.cards.map((card, i) => {
                  const canBuild = card.cost <= myGold;
                  return (
                    <div key={i} className="flex flex-col gap-0.5">
                      <button className={`${CHIP} bg-slate-600 hover:bg-slate-500`}
                        onClick={() => { onAction({ type: 'WIZARD_TAKE', targetPlayerId: hand.playerId, cardIndex: i, build: false }); close(); }}>
                        {card.name} ({card.cost}g)
                      </button>
                      <button disabled={!canBuild}
                        className={`${CHIP} bg-cyan-700 hover:bg-cyan-600 text-[10px]`}
                        onClick={() => { onAction({ type: 'WIZARD_TAKE', targetPlayerId: hand.playerId, cardIndex: i, build: true }); close(); }}>
                        Build it
                      </button>
                    </div>
                  );
                })}
                {hand.cards.length === 0 && <span className="text-[10px] text-slate-600 italic">empty</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </PowerPanel>
  );
}

function EmperorAction({ view, onAction }: PowerActionsProps) {
  const [target, setTarget] = useState<string | null>(null);
  const opponents = view.players.filter((_, i) => i !== view.myIndex);
  const chosen = opponents.find(p => p.id === target);

  return (
    <PowerPanel label="Give the Crown…" tone="bg-yellow-700 hover:bg-yellow-600"
      title="Crown another player and take a resource"
      hint="You must do this before ending your turn.">
      {close => (
        <>
          <div className="flex flex-wrap gap-1">
            {opponents.map(p => (
              <button key={p.id} onClick={() => setTarget(p.id)}
                className={`${CHIP} ${target === p.id ? 'bg-yellow-600' : 'bg-slate-600 hover:bg-slate-500'}`}>
                {p.name} ({p.gold}g, {p.handSize}c)
              </button>
            ))}
          </div>
          {chosen && (
            <div className="flex gap-1">
              <button disabled={chosen.gold < 1} className={`${CHIP} bg-yellow-700 hover:bg-yellow-600`}
                onClick={() => { onAction({ type: 'EMPEROR_CROWN', targetPlayerId: chosen.id, take: 'gold' }); close(); }}>
                Take 1 gold
              </button>
              <button disabled={chosen.handSize < 1} className={`${CHIP} bg-emerald-700 hover:bg-emerald-600`}
                onClick={() => { onAction({ type: 'EMPEROR_CROWN', targetPlayerId: chosen.id, take: 'card' }); close(); }}>
                Take 1 card
              </button>
            </div>
          )}
        </>
      )}
    </PowerPanel>
  );
}

function AbbotAction({ view, onAction }: PowerActionsProps) {
  const me = view.players[view.myIndex];
  const total = (me?.city ?? []).filter(d => d.type === 'religious' || d.name === 'School of Magic').length;
  const [gold, setGold] = useState(total);

  return (
    <PowerPanel label={`Take income (${total})`} tone="bg-amber-600 hover:bg-amber-500"
      title="Split your income between gold and cards"
      hint="The richest player also owes you 1 gold if it is not you.">
      {close => (
        <>
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: total + 1 }, (_, g) => (
              <button key={g} onClick={() => setGold(g)}
                className={`${CHIP} ${gold === g ? 'bg-amber-600' : 'bg-slate-600 hover:bg-slate-500'}`}>
                {g}g + {total - g}c
              </button>
            ))}
          </div>
          <button className={`${CHIP} bg-amber-600 hover:bg-amber-500`}
            onClick={() => { onAction({ type: 'ABBOT_INCOME', goldCount: gold, cardCount: total - gold }); close(); }}>
            Take {gold} gold and {total - gold} cards
          </button>
        </>
      )}
    </PowerPanel>
  );
}

function CardinalAction({ view, onAction }: PowerActionsProps) {
  const me = view.players[view.myIndex];
  const myGold = me?.gold ?? 0;
  const [cardIndex, setCardIndex] = useState<number | null>(null);

  // Only cards we cannot afford outright, and only if we have spare cards to trade.
  const options = view.myHand
    .map((card, index) => ({ card, index, shortfall: card.cost - myGold }))
    .filter(o => o.shortfall > 0 && !me?.city.some(d => d.name === o.card.name))
    .filter(o => view.myHand.length - 1 >= o.shortfall);

  if (options.length === 0) return null;
  const chosen = options.find(o => o.index === cardIndex);

  return (
    <PowerPanel label="Buy gold with cards…" tone="bg-blue-800 hover:bg-blue-700"
      title="Take the gold you are missing from another player"
      hint="You give them one card from your hand for each gold you take, then build.">
      {close => (
        <>
          <div className="flex flex-wrap gap-1">
            {options.map(o => (
              <button key={o.index} onClick={() => setCardIndex(o.index)}
                className={`${CHIP} ${cardIndex === o.index ? 'bg-blue-700' : 'bg-slate-600 hover:bg-slate-500'}`}>
                {o.card.name} ({o.card.cost}g) — need {o.shortfall}
              </button>
            ))}
          </div>
          {chosen && (
            <div className="flex flex-wrap gap-1">
              {view.players.filter((_, i) => i !== view.myIndex).map(p => (
                <button key={p.id} disabled={p.gold < chosen.shortfall}
                  className={`${CHIP} bg-blue-700 hover:bg-blue-600`}
                  onClick={() => { onAction({ type: 'CARDINAL_BUILD', cardIndex: chosen.index, lenderPlayerId: p.id }); close(); }}>
                  Take {chosen.shortfall}g from {p.name} ({p.gold}g)
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </PowerPanel>
  );
}

function WarlordAction({ view, onAction }: PowerActionsProps) {
  const myGold = view.players[view.myIndex]?.gold ?? 0;
  const targets = view.players.filter(p =>
    p.revealedCharacter?.name !== 'Bishop' && p.city.length < 8 && p.city.length > 0
  );

  return (
    <PowerPanel label="Destroy District…" tone="bg-red-700 hover:bg-red-600" title="Destroy a district">
      {close => (
        <div className="space-y-1.5 max-h-56 overflow-y-auto">
          {targets.map(p => {
            const greatWall = p.city.some(d => d.name === 'Great Wall');
            return (
              <div key={p.id}>
                <p className="text-[10px] text-slate-400">{p.name}&apos;s city:</p>
                <div className="flex flex-wrap gap-1">
                  {p.city.map((d, i) => {
                    const cost = Math.max(0, districtValue(d) - 1 + (greatWall && d.name !== 'Great Wall' ? 1 : 0));
                    const blocked = d.name === 'Keep' || cost > myGold;
                    return (
                      <button key={i} disabled={blocked} className={`${CHIP} bg-red-700 hover:bg-red-600`}
                        onClick={() => { onAction({ type: 'WARLORD_DESTROY', targetPlayerId: p.id, districtIndex: i }); close(); }}>
                        {d.name} ({cost}g)
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <button className={`${CHIP} bg-slate-600 hover:bg-slate-500`}
            onClick={() => { onAction({ type: 'WARLORD_PASS' }); close(); }}>
            Don&apos;t Destroy
          </button>
        </div>
      )}
    </PowerPanel>
  );
}

function MarshalAction({ view, onAction }: PowerActionsProps) {
  const myGold = view.players[view.myIndex]?.gold ?? 0;
  const myCity = view.players[view.myIndex]?.city ?? [];
  const targets = view.players.filter((p, i) =>
    i !== view.myIndex && p.revealedCharacter?.name !== 'Bishop' && p.city.length < 8 && p.city.length > 0
  );

  return (
    <PowerPanel label="Seize District…" tone="bg-red-700 hover:bg-red-600"
      title="Seize a district costing 3 or less"
      hint="You pay its owner the full building cost.">
      {close => (
        <div className="space-y-1.5 max-h-56 overflow-y-auto">
          {targets.map(p => (
            <div key={p.id}>
              <p className="text-[10px] text-slate-400">{p.name}&apos;s city:</p>
              <div className="flex flex-wrap gap-1">
                {p.city.map((d, i) => {
                  const price = districtValue(d);
                  const blocked = d.name === 'Keep' || price > 3 || price > myGold ||
                    myCity.some(x => x.name === d.name);
                  return (
                    <button key={i} disabled={blocked} className={`${CHIP} bg-red-700 hover:bg-red-600`}
                      onClick={() => { onAction({ type: 'MARSHAL_SEIZE', targetPlayerId: p.id, districtIndex: i }); close(); }}>
                      {d.name} (pay {price}g)
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </PowerPanel>
  );
}

function DiplomatAction({ view, onAction }: PowerActionsProps) {
  const me = view.players[view.myIndex];
  const myCity = me?.city ?? [];
  const myGold = me?.gold ?? 0;
  const [myIndex, setMyIndex] = useState<number | null>(null);

  const targets = view.players.filter((p, i) =>
    i !== view.myIndex && p.revealedCharacter?.name !== 'Bishop' && p.city.length < 8 && p.city.length > 0
  );

  return (
    <PowerPanel label="Exchange District…" tone="bg-red-700 hover:bg-red-600"
      title="Swap one of your districts for one of theirs"
      hint="If theirs is worth more you pay the difference.">
      {close => (
        <>
          <p className="text-[10px] text-slate-500">Your district to give:</p>
          <div className="flex flex-wrap gap-1">
            {myCity.map((d, i) => (
              <button key={i} disabled={d.name === 'Keep'} onClick={() => setMyIndex(i)}
                className={`${CHIP} ${myIndex === i ? 'bg-cyan-700' : 'bg-slate-600 hover:bg-slate-500'}`}>
                {d.name} ({districtValue(d)})
              </button>
            ))}
          </div>

          {myIndex !== null && (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {targets.map(p => {
                const greatWall = p.city.some(d => d.name === 'Great Wall');
                return (
                  <div key={p.id}>
                    <p className="text-[10px] text-slate-400">{p.name}&apos;s city:</p>
                    <div className="flex flex-wrap gap-1">
                      {p.city.map((d, i) => {
                        const theirValue = districtValue(d) + (greatWall && d.name !== 'Great Wall' ? 1 : 0);
                        const difference = Math.max(0, theirValue - districtValue(myCity[myIndex]));
                        const blocked = d.name === 'Keep' || difference > myGold ||
                          myCity.some((x, xi) => xi !== myIndex && x.name === d.name);
                        return (
                          <button key={i} disabled={blocked} className={`${CHIP} bg-red-700 hover:bg-red-600`}
                            onClick={() => {
                              onAction({ type: 'DIPLOMAT_EXCHANGE', targetPlayerId: p.id, theirDistrictIndex: i, myDistrictIndex: myIndex });
                              close();
                            }}>
                            {d.name}{difference > 0 ? ` (+${difference}g)` : ''}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </PowerPanel>
  );
}

function ArtistAction({ view, onAction }: PowerActionsProps) {
  const myCity = view.players[view.myIndex]?.city ?? [];
  const left = 2 - (view.turnState?.beautifiedCount ?? 0);

  return (
    <PowerPanel label={`Beautify… (${left} left)`} tone="bg-pink-700 hover:bg-pink-600"
      title="Beautify a district for 1 gold"
      hint="It is permanently worth 1 more — and costs 1 more to destroy or take.">
      {close => (
        <div className="flex flex-wrap gap-1">
          {myCity.map((d, i) => (
            <button key={i} disabled={!!d.beautified} className={`${CHIP} bg-pink-700 hover:bg-pink-600`}
              onClick={() => { onAction({ type: 'ARTIST_BEAUTIFY', districtIndex: i }); close(); }}>
              {d.name} {d.beautified ? '✦' : `(${d.cost})`}
            </button>
          ))}
        </div>
      )}
    </PowerPanel>
  );
}
