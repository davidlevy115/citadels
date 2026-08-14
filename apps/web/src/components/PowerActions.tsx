'use client';

import { useState, type ReactNode } from 'react';
import type { PlayerGameView, Character, DistrictType } from '@citadels/game-logic';
import { districtValue } from '@citadels/game-logic';
import { useT } from '@/hooks/useI18n';

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
  const t = useT();
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
        {t('power.cancel')}
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
  const t = useT();
  const targets = targetableRanks(view, minRank, exclude ?? []);

  return (
    <div className="flex flex-wrap gap-1">
      {targets.map(c => (
        <button key={c.rank} onClick={() => onPick(c.rank)} className={`${CHIP} bg-gray-700 ${tone}`}>
          <span className="text-slate-400 mr-1">{c.rank}</span>{t.character(c.name)}
        </button>
      ))}
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────

export function PowerActions({ view, onAction }: PowerActionsProps) {
  const t = useT();
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
        {t('power.bewitchedNote')}
      </div>
    );
  }

  const mustUsePower = (char.name === 'Witch' || char.name === 'Emperor') && powerFree;

  return (
    <div className="flex flex-wrap gap-2 justify-center max-w-full">
      {turn.isWitchResume && (
        <div className="w-full text-center text-[11px] text-purple-300">
          {t('power.playingAs', { character: char.name })}
        </div>
      )}

      {/* ── Rank 1 ── */}
      {char.name === 'Assassin' && powerFree && (
        <PowerPanel label={t('power.kill')} tone="bg-gray-700 hover:bg-gray-600" title={t('power.killTitle')}>
          {close => (
            <RankTargets view={view} minRank={2} tone="hover:bg-red-700"
              onPick={r => { onAction({ type: 'ASSASSIN_KILL', targetRank: r }); close(); }} />
          )}
        </PowerPanel>
      )}

      {char.name === 'Witch' && powerFree && acted && (
        <PowerPanel label={t('power.bewitch')} tone="bg-purple-800 hover:bg-purple-700"
          title={t('power.bewitchTitle')} hint={t('power.bewitchHint')}>
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
        <PowerPanel label={t('power.steal')} tone="bg-gray-700 hover:bg-gray-600" title={t('power.stealTitle')}>
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
          title={t('power.seerTitle')}>
          {t('power.seerTake')}
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
          {char.name === 'Patrician' || char.name === 'Cardinal' ? t('power.drawIncome') : t('power.collectIncome')}
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
            {t('power.navigatorGold')}
          </button>
          <button onClick={() => onAction({ type: 'NAVIGATOR_GAIN', choice: 'cards' })}
            className={`${BTN} bg-emerald-800 hover:bg-emerald-700 text-emerald-100`}>
            {t('power.navigatorCards')}
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
          {t('power.collectTax', { amount: view.taxPot })}
        </button>
      )}

      {/* ── Special buildings ── */}
      {myCity.some(d => d.name === 'Laboratory') && !specialUsed.includes('Laboratory') && view.myHand.length > 0 && (
        <PowerPanel label={t('power.laboratory')} tone="bg-teal-700 hover:bg-teal-600"
          title={t('power.laboratoryTitle')}>
          {close => (
            <div className="flex flex-wrap gap-1">
              {view.myHand.map((card, i) => (
                <button key={i} className={`${CHIP} bg-teal-700 hover:bg-teal-600`}
                  onClick={() => { onAction({ type: 'LABORATORY_DISCARD', cardIndex: i }); close(); }}>
                  {t.district(card.name)} ({card.cost})
                </button>
              ))}
            </div>
          )}
        </PowerPanel>
      )}

      {myCity.some(d => d.name === 'Smithy') && !specialUsed.includes('Smithy') && myGold >= 2 && (
        <button onClick={() => onAction({ type: 'SMITHY_DRAW' })}
          className={`${BTN} bg-orange-700 hover:bg-orange-600`}
          title={t('power.smithy')}>
          {t('power.smithy')}
        </button>
      )}

      {/* ── Decline an optional power ── */}
      {powerFree && !mustUsePower && acted && isOptionalPower(char.name) && (
        <button onClick={() => onAction({ type: 'SKIP_POWER' })}
          className={`${BTN} bg-slate-700/80 hover:bg-slate-600/80 text-slate-300 text-xs`}>
          {t('power.skip', { character: t.character(char.name) })}
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
  const t = useT();
  const [picked, setPicked] = useState<number[]>([]);
  const targets = targetableRanks(view, 2);

  return (
    <PowerPanel label={t('power.warrants')} tone="bg-gray-700 hover:bg-gray-600"
      title={t('power.warrantsTitle')} hint={t('power.warrantsHint')}>
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
                  <span className="text-slate-300 mr-1">{c.rank}</span>{t.character(c.name)}
                  {idx === 0 && <span className="ml-1 text-[9px]">{t('power.signed')}</span>}
                </button>
              );
            })}
          </div>
          <button disabled={picked.length !== 3}
            onClick={() => { onAction({ type: 'MAGISTRATE_WARRANTS', signedRank: picked[0], otherRanks: picked.slice(1) }); close(); }}
            className={`${CHIP} bg-amber-600 hover:bg-amber-500`}>
            {t('power.placeWarrants', { count: picked.length })}
          </button>
        </>
      )}
    </PowerPanel>
  );
}

function BlackmailerAction({ view, onAction }: PowerActionsProps) {
  const t = useT();
  const [picked, setPicked] = useState<number[]>([]);
  const targets = targetableRanks(view, 3, [view.murderedCharacter, view.bewitchedCharacter]);

  return (
    <PowerPanel label={t('power.threaten')} tone="bg-gray-700 hover:bg-gray-600"
      title={t('power.threatenTitle')} hint={t('power.threatenHint')}>
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
                  <span className="text-slate-300 mr-1">{c.rank}</span>{t.character(c.name)}
                  {idx === 0 && <span className="ml-1 text-[9px]">{t('power.real')}</span>}
                </button>
              );
            })}
          </div>
          <button disabled={picked.length !== 2}
            onClick={() => { onAction({ type: 'BLACKMAIL_ASSIGN', realRank: picked[0], bluffRank: picked[1] }); close(); }}
            className={`${CHIP} bg-amber-600 hover:bg-amber-500`}>
            {t('power.placeThreats', { count: picked.length })}
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
  const t = useT();
  const [target, setTarget] = useState<string | null>(null);
  const opponents = view.players.filter((_, i) => i !== view.myIndex);

  return (
    <PowerPanel label={t('power.spy')} tone="bg-gray-700 hover:bg-gray-600"
      title={t('power.spyTitle')} hint={t('power.spyHint')}>
      {close => (
        <>
          <div className="flex flex-wrap gap-1">
            {opponents.map(p => (
              <button key={p.id} onClick={() => setTarget(p.id)}
                className={`${CHIP} ${target === p.id ? 'bg-cyan-700' : 'bg-slate-600 hover:bg-slate-500'}`}>
                {p.name} ({p.handSize} / {p.gold})
              </button>
            ))}
          </div>
          {target && (
            <div className="flex flex-wrap gap-1">
              {DISTRICT_TYPES.map(dt => (
                <button key={dt.type} className={`${CHIP} ${dt.tone}`}
                  onClick={() => { onAction({ type: 'SPY_SPY', targetPlayerId: target, districtType: dt.type }); close(); }}>
                  {t.districtType(dt.type)}
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
  const t = useT();
  const [selectedCards, setSelectedCards] = useState<number[]>([]);

  return (
    <PowerPanel label={t('power.magic')} tone="bg-indigo-700 hover:bg-indigo-600" title={t('power.magicTitle')}>
      {close => (
        <>
          <div className="flex flex-wrap gap-1">
            {view.players.filter((_, i) => i !== view.myIndex).map(p => (
              <button key={p.id} className={`${CHIP} bg-indigo-700 hover:bg-indigo-600`}
                onClick={() => { onAction({ type: 'MAGICIAN_SWAP_PLAYER', targetPlayerId: p.id }); close(); }}>
                {t('power.swapWith', { player: p.name, count: p.handSize })}
              </button>
            ))}
          </div>
          {view.myHand.length > 0 && (
            <div>
              <p className="text-[10px] text-slate-500 mb-1">{t('power.orDiscard')}</p>
              <div className="flex flex-wrap gap-1 mb-2">
                {view.myHand.map((card, i) => (
                  <button key={i}
                    onClick={() => setSelectedCards(p => p.includes(i) ? p.filter(x => x !== i) : [...p, i])}
                    className={`${CHIP} ${selectedCards.includes(i) ? 'bg-red-600' : 'bg-slate-600 hover:bg-slate-500'}`}>
                    {t.district(card.name)}
                  </button>
                ))}
              </div>
              {selectedCards.length > 0 && (
                <button className={`${CHIP} bg-indigo-600 hover:bg-indigo-500`}
                  onClick={() => { onAction({ type: 'MAGICIAN_SWAP_DECK', cardIndices: selectedCards }); close(); }}>
                  {t('power.discardAndDraw', { count: selectedCards.length })}
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
  const t = useT();
  const myGold = view.players[view.myIndex]?.gold ?? 0;
  const myCity = view.players[view.myIndex]?.city ?? [];

  return (
    <PowerPanel label={t('power.lookAtHand')} tone="bg-indigo-700 hover:bg-indigo-600"
      title={t('power.wizardTitle')} hint={t('power.wizardHint')}>
      {close => (
        <div className="space-y-2 max-h-56 overflow-y-auto">
          {view.revealedHands.length === 0 && (
            <p className="text-[10px] text-slate-500">{t('power.nobodyHasCards')}</p>
          )}
          {view.revealedHands.map(hand => (
            <div key={hand.playerId}>
              <p className="text-[10px] text-slate-400 mb-1">{t('power.citySuffix', { player: hand.playerName })}</p>
              <div className="flex flex-wrap gap-1">
                {hand.cards.map((card, i) => {
                  const canBuild = card.cost <= myGold;
                  return (
                    <div key={i} className="flex flex-col gap-0.5">
                      <button className={`${CHIP} bg-slate-600 hover:bg-slate-500`}
                        onClick={() => { onAction({ type: 'WIZARD_TAKE', targetPlayerId: hand.playerId, cardIndex: i, build: false }); close(); }}>
                        {t.district(card.name)} ({card.cost})
                      </button>
                      <button disabled={!canBuild}
                        className={`${CHIP} bg-cyan-700 hover:bg-cyan-600 text-[10px]`}
                        onClick={() => { onAction({ type: 'WIZARD_TAKE', targetPlayerId: hand.playerId, cardIndex: i, build: true }); close(); }}>
                        {t('power.buildIt')}
                      </button>
                    </div>
                  );
                })}
                {hand.cards.length === 0 && <span className="text-[10px] text-slate-600 italic">{t('power.emptyHand')}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </PowerPanel>
  );
}

function EmperorAction({ view, onAction }: PowerActionsProps) {
  const t = useT();
  const [target, setTarget] = useState<string | null>(null);
  const opponents = view.players.filter((_, i) => i !== view.myIndex);
  const chosen = opponents.find(p => p.id === target);

  return (
    <PowerPanel label={t('power.giveCrown')} tone="bg-yellow-700 hover:bg-yellow-600"
      title={t('power.emperorTitle')} hint={t('power.emperorHint')}>
      {close => (
        <>
          <div className="flex flex-wrap gap-1">
            {opponents.map(p => (
              <button key={p.id} onClick={() => setTarget(p.id)}
                className={`${CHIP} ${target === p.id ? 'bg-yellow-600' : 'bg-slate-600 hover:bg-slate-500'}`}>
                {p.name} ({p.gold} / {p.handSize})
              </button>
            ))}
          </div>
          {chosen && (
            <div className="flex gap-1">
              <button disabled={chosen.gold < 1} className={`${CHIP} bg-yellow-700 hover:bg-yellow-600`}
                onClick={() => { onAction({ type: 'EMPEROR_CROWN', targetPlayerId: chosen.id, take: 'gold' }); close(); }}>
                {t('power.takeGold1')}
              </button>
              <button disabled={chosen.handSize < 1} className={`${CHIP} bg-emerald-700 hover:bg-emerald-600`}
                onClick={() => { onAction({ type: 'EMPEROR_CROWN', targetPlayerId: chosen.id, take: 'card' }); close(); }}>
                {t('power.takeCard1')}
              </button>
            </div>
          )}
        </>
      )}
    </PowerPanel>
  );
}

function AbbotAction({ view, onAction }: PowerActionsProps) {
  const t = useT();
  const me = view.players[view.myIndex];
  const total = (me?.city ?? []).filter(d => d.type === 'religious' || d.name === 'School of Magic').length;
  const [gold, setGold] = useState(total);

  return (
    <PowerPanel label={t('power.abbotIncome', { count: total })} tone="bg-amber-600 hover:bg-amber-500"
      title={t('power.abbotTitle')} hint={t('power.abbotHint')}>
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
            {t('power.abbotTake', { gold, cards: total - gold })}
          </button>
        </>
      )}
    </PowerPanel>
  );
}

function CardinalAction({ view, onAction }: PowerActionsProps) {
  const t = useT();
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
    <PowerPanel label={t('power.cardinal')} tone="bg-blue-800 hover:bg-blue-700"
      title={t('power.cardinalTitle')} hint={t('power.cardinalHint')}>
      {close => (
        <>
          <div className="flex flex-wrap gap-1">
            {options.map(o => (
              <button key={o.index} onClick={() => setCardIndex(o.index)}
                className={`${CHIP} ${cardIndex === o.index ? 'bg-blue-700' : 'bg-slate-600 hover:bg-slate-500'}`}>
                {t('power.cardinalNeed', { district: o.card.name, cost: o.card.cost, shortfall: o.shortfall })}
              </button>
            ))}
          </div>
          {chosen && (
            <div className="flex flex-wrap gap-1">
              {view.players.filter((_, i) => i !== view.myIndex).map(p => (
                <button key={p.id} disabled={p.gold < chosen.shortfall}
                  className={`${CHIP} bg-blue-700 hover:bg-blue-600`}
                  onClick={() => { onAction({ type: 'CARDINAL_BUILD', cardIndex: chosen.index, lenderPlayerId: p.id }); close(); }}>
                  {t('power.cardinalTake', { amount: chosen.shortfall, player: p.name, gold: p.gold })}
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
  const t = useT();
  const myGold = view.players[view.myIndex]?.gold ?? 0;
  const targets = view.players.filter(p =>
    p.revealedCharacter?.name !== 'Bishop' && p.city.length < 8 && p.city.length > 0
  );

  return (
    <PowerPanel label={t('power.destroy')} tone="bg-red-700 hover:bg-red-600" title={t('power.destroyTitle')}>
      {close => (
        <div className="space-y-1.5 max-h-56 overflow-y-auto">
          {targets.map(p => {
            const greatWall = p.city.some(d => d.name === 'Great Wall');
            return (
              <div key={p.id}>
                <p className="text-[10px] text-slate-400">{t('power.citySuffix', { player: p.name })}</p>
                <div className="flex flex-wrap gap-1">
                  {p.city.map((d, i) => {
                    const cost = Math.max(0, districtValue(d) - 1 + (greatWall && d.name !== 'Great Wall' ? 1 : 0));
                    const blocked = d.name === 'Keep' || cost > myGold;
                    return (
                      <button key={i} disabled={blocked} className={`${CHIP} bg-red-700 hover:bg-red-600`}
                        onClick={() => { onAction({ type: 'WARLORD_DESTROY', targetPlayerId: p.id, districtIndex: i }); close(); }}>
                        {t.district(d.name)} ({cost})
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <button className={`${CHIP} bg-slate-600 hover:bg-slate-500`}
            onClick={() => { onAction({ type: 'WARLORD_PASS' }); close(); }}>
            {t('power.dontDestroy')}
          </button>
        </div>
      )}
    </PowerPanel>
  );
}

function MarshalAction({ view, onAction }: PowerActionsProps) {
  const t = useT();
  const myGold = view.players[view.myIndex]?.gold ?? 0;
  const myCity = view.players[view.myIndex]?.city ?? [];
  const targets = view.players.filter((p, i) =>
    i !== view.myIndex && p.revealedCharacter?.name !== 'Bishop' && p.city.length < 8 && p.city.length > 0
  );

  return (
    <PowerPanel label={t('power.seize')} tone="bg-red-700 hover:bg-red-600"
      title={t('power.seizeTitle')} hint={t('power.seizeHint')}>
      {close => (
        <div className="space-y-1.5 max-h-56 overflow-y-auto">
          {targets.map(p => (
            <div key={p.id}>
              <p className="text-[10px] text-slate-400">{t('power.citySuffix', { player: p.name })}</p>
              <div className="flex flex-wrap gap-1">
                {p.city.map((d, i) => {
                  const price = districtValue(d);
                  const blocked = d.name === 'Keep' || price > 3 || price > myGold ||
                    myCity.some(x => x.name === d.name);
                  return (
                    <button key={i} disabled={blocked} className={`${CHIP} bg-red-700 hover:bg-red-600`}
                      onClick={() => { onAction({ type: 'MARSHAL_SEIZE', targetPlayerId: p.id, districtIndex: i }); close(); }}>
                      {t('power.pay', { district: d.name, price })}
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
  const t = useT();
  const me = view.players[view.myIndex];
  const myCity = me?.city ?? [];
  const myGold = me?.gold ?? 0;
  const [myIndex, setMyIndex] = useState<number | null>(null);

  const targets = view.players.filter((p, i) =>
    i !== view.myIndex && p.revealedCharacter?.name !== 'Bishop' && p.city.length < 8 && p.city.length > 0
  );

  return (
    <PowerPanel label={t('power.exchange')} tone="bg-red-700 hover:bg-red-600"
      title={t('power.exchangeTitle')} hint={t('power.exchangeHint')}>
      {close => (
        <>
          <p className="text-[10px] text-slate-500">{t('power.districtToGive')}</p>
          <div className="flex flex-wrap gap-1">
            {myCity.map((d, i) => (
              <button key={i} disabled={d.name === 'Keep'} onClick={() => setMyIndex(i)}
                className={`${CHIP} ${myIndex === i ? 'bg-cyan-700' : 'bg-slate-600 hover:bg-slate-500'}`}>
                {t.district(d.name)} ({districtValue(d)})
              </button>
            ))}
          </div>

          {myIndex !== null && (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {targets.map(p => {
                const greatWall = p.city.some(d => d.name === 'Great Wall');
                return (
                  <div key={p.id}>
                    <p className="text-[10px] text-slate-400">{t('power.citySuffix', { player: p.name })}</p>
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
                            {t.district(d.name)}{difference > 0 ? ` (+${difference})` : ''}
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
  const t = useT();
  const myCity = view.players[view.myIndex]?.city ?? [];
  const left = 2 - (view.turnState?.beautifiedCount ?? 0);

  return (
    <PowerPanel label={t('power.beautify', { count: left })} tone="bg-pink-700 hover:bg-pink-600"
      title={t('power.beautifyTitle')} hint={t('power.beautifyHint')}>
      {close => (
        <div className="flex flex-wrap gap-1">
          {myCity.map((d, i) => (
            <button key={i} disabled={!!d.beautified} className={`${CHIP} bg-pink-700 hover:bg-pink-600`}
              onClick={() => { onAction({ type: 'ARTIST_BEAUTIFY', districtIndex: i }); close(); }}>
              {t.district(d.name)} {d.beautified ? '✦' : `(${d.cost})`}
            </button>
          ))}
        </div>
      )}
    </PowerPanel>
  );
}
