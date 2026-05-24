'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PlayerGameView, PlayerPublicInfo, DistrictCard, Character, BuiltDistrict } from '@citadels/game-logic';
import { CHARACTERS } from '@citadels/game-logic';
import { DistrictCardView } from './Card';
import { DistrictDetailModal, CharacterDetailModal } from './CardDetailModal';
import { CharacterSelect } from './CharacterSelect';
import { PlayerSeat, getPlayerActions } from './PlayerSeat';
import { RoundEvents } from './RoundEvents';
import { RemovedCharacters } from './RemovedCharacters';
import { GoldDisplay } from './GoldDisplay';
import { PowerActions } from './PowerActions';
import { GameLog } from './GameLog';

const PILL_BG: Record<string, string> = {
  noble: 'bg-yellow-900/60 border-yellow-700/60',
  religious: 'bg-blue-900/60 border-blue-700/60',
  trade: 'bg-green-900/60 border-green-700/60',
  military: 'bg-red-900/60 border-red-700/60',
  special: 'bg-purple-900/60 border-purple-700/60',
};

const PILL_TEXT: Record<string, string> = {
  noble: 'text-yellow-200',
  religious: 'text-blue-200',
  trade: 'text-green-200',
  military: 'text-red-200',
  special: 'text-purple-200',
};

type DetailTarget =
  | { type: 'district'; card: DistrictCard | BuiltDistrict }
  | { type: 'character'; character: Character }
  | null;

interface GameBoardProps {
  view: PlayerGameView;
  onAction: (action: any) => void;
  actionError: string | null;
  roomId?: string | null;
}

export function GameBoard({ view, onAction, actionError, roomId }: GameBoardProps) {
  const me = view.players[view.myIndex];
  const turnState = view.turnState;
  const isMyTurn = view.isMyTurn;
  const [detailTarget, setDetailTarget] = useState<DetailTarget>(null);

  const calledCharacter = CHARACTERS.find(c => c.rank === view.currentCharacterRank);
  const otherPlayers = view.players.filter((_, i) => i !== view.myIndex);

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden">
      {/* ═══ SHARED OVERLAYS ═══ */}
      {view.isMyTurnToChoose && view.availableCharacters.length > 0 && (
        <CharacterSelect
          characters={view.availableCharacters}
          removedFaceUp={view.removedCharactersFaceUp}
          players={view.players}
          myIndex={view.myIndex}
          crownPlayerIndex={view.crownPlayerIndex}
          onSelect={(rank) => onAction({ type: 'CHOOSE_CHARACTER', characterRank: rank })}
          onDetail={(char) => setDetailTarget({ type: 'character', character: char })}
        />
      )}
      {turnState?.phase === 'choosingCard' && isMyTurn && turnState.drawnCards.length > 0 && (
        <CardChoiceOverlay
          cards={turnState.drawnCards}
          myHand={view.myHand}
          onChoose={(idx) => onAction({ type: 'KEEP_CARD', cardIndex: idx })}
          onDetail={(card) => setDetailTarget({ type: 'district', card })}
        />
      )}
      {view.phase === 'gameOver' && view.scores && <GameOverOverlay view={view} />}
      <AnimatePresence>
        {detailTarget?.type === 'district' && (
          <DistrictDetailModal card={detailTarget.card} onClose={() => setDetailTarget(null)} />
        )}
        {detailTarget?.type === 'character' && (
          <CharacterDetailModal character={detailTarget.character} onClose={() => setDetailTarget(null)} />
        )}
      </AnimatePresence>

      {/* ═══ TOP BAR ═══ */}
      <div className="shrink-0 flex items-center justify-between px-2 md:px-3 py-0.5 md:py-1.5" style={{ background: 'rgba(20,12,8,0.9)' }}>
        <div className="flex items-center gap-2 md:gap-3">
          <span className="text-xs md:text-sm font-bold text-amber-400 tracking-wide">CITADELS</span>
          {roomId && (
            <button
              onClick={() => navigator.clipboard.writeText(roomId)}
              className="px-1.5 py-0.5 bg-amber-900/40 hover:bg-amber-900/60 rounded text-[9px] md:text-[10px] text-amber-300 font-mono tracking-widest transition-colors"
              title="Click to copy room code"
            >
              {roomId}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 md:gap-3 text-[10px] md:text-[11px] text-slate-400">
          <span>R{view.round}</span>
          <span className="hidden md:inline">Deck {view.districtDeckCount}</span>
          {view.myCharacter && (
            <button
              onClick={() => setDetailTarget({ type: 'character', character: view.myCharacter! })}
              className="text-amber-300 hover:text-amber-200 font-medium transition-colors"
            >
              {view.myCharacter.name}
            </button>
          )}
          {/* Mobile: inline gold */}
          <span className="md:hidden text-yellow-400 font-bold">{me?.gold ?? 0}g</span>
          {view.gameEndTriggered && (
            <span className="bg-red-600 px-1 py-0.5 rounded text-[9px] text-white animate-pulse">FINAL</span>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* ═══ MOBILE LANDSCAPE LAYOUT (< md) ═══                */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className="md:hidden flex-1 flex flex-col min-h-0 overflow-hidden">

        {/* Opponents strip */}
        <div className="shrink-0 flex items-center gap-1 px-2 py-0.5" style={{ background: 'rgba(30,20,12,0.7)' }}>
          {otherPlayers.map((p) => {
            const idx = view.players.findIndex(pl => pl.id === p.id);
            const charRank = p.revealedCharacter?.rank;
            const isActive = view.phase === 'playerTurns' && charRank === view.currentCharacterRank;
            const isMurdered = charRank != null && view.murderedCharacter === charRank;
            return (
              <button
                key={p.id}
                onClick={p.revealedCharacter ? () => setDetailTarget({ type: 'character', character: p.revealedCharacter! }) : undefined}
                className={`
                  flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] shrink-0
                  ${isActive ? 'bg-yellow-900/50 ring-1 ring-yellow-500/60' : 'bg-slate-800/50'}
                  ${isMurdered ? 'opacity-40' : ''}
                `}
              >
                {idx === view.crownPlayerIndex && <span className="text-yellow-400 text-[8px]">&#9813;</span>}
                <span className="text-amber-100 font-medium truncate max-w-[50px]">{p.name}</span>
                <span className="text-yellow-400">{p.gold}g</span>
                <span className="text-slate-500">{p.handSize}c</span>
                {p.city.length > 0 && <span className="text-emerald-400">{p.city.length}d</span>}
              </button>
            );
          })}
        </div>

        {/* Center action area */}
        <div className="flex-1 flex flex-col min-h-0 px-2 py-1">
          <div className="felt-surface flex-1 rounded-lg p-2 flex flex-col justify-center min-h-0">

            {/* Phase banner — compact */}
            <div className="text-center mb-1">
              {view.phase === 'chooseCharacters' && (
                <div className="text-xs text-emerald-200 font-medium">
                  {view.isMyTurnToChoose ? 'Choose your character' : 'Choosing characters...'}
                </div>
              )}
              {view.phase === 'playerTurns' && calledCharacter && (
                <div className="text-xs">
                  <span className="text-emerald-600">Now: </span>
                  <span className="font-bold text-amber-300">{calledCharacter.name}</span>
                  <span className="text-emerald-600 text-[10px]"> #{calledCharacter.rank}</span>
                </div>
              )}
              {view.phase === 'gameOver' && (
                <div className="text-sm font-bold text-amber-400">Game Over</div>
              )}
            </div>

            {/* Round events — compact single line */}
            {view.phase === 'playerTurns' && view.roundEvents.length > 0 && (
              <div className="mb-1">
                <RoundEvents
                  events={view.roundEvents}
                  murderedCharacter={view.murderedCharacter}
                  robbedCharacter={view.robbedCharacter}
                  myCharacter={view.myCharacter}
                />
              </div>
            )}

            {/* Error */}
            <AnimatePresence>
              {actionError && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="bg-red-900/60 border border-red-700 rounded px-2 py-1 text-[10px] text-red-300 mb-1"
                >
                  {actionError}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action controls */}
            {isMyTurn && turnState && (
              <div className="space-y-1">
                <div className="text-center text-[10px] text-cyan-300 font-medium">
                  {!turnState.actionTaken ? 'Your turn — choose an action'
                    : turnState.phase === 'choosingCard' ? 'Pick a card to keep'
                    : 'Build, use powers, or end turn'}
                </div>

                {!turnState.actionTaken && (
                  <div className="flex gap-2 justify-center">
                    <button onClick={() => onAction({ type: 'TAKE_GOLD' })}
                      className="px-3 py-1 bg-yellow-700 hover:bg-yellow-600 rounded text-xs font-bold transition-colors text-yellow-100">
                      &#9733; Gold
                    </button>
                    <button onClick={() => onAction({ type: 'DRAW_CARDS' })}
                      className="px-3 py-1 bg-emerald-800 hover:bg-emerald-700 rounded text-xs font-bold transition-colors text-emerald-100">
                      &#9830; Cards
                    </button>
                  </div>
                )}

                <div className="flex justify-center">
                  <PowerActions view={view} onAction={onAction} />
                </div>

                {turnState.actionTaken && turnState.phase !== 'choosingCard' && (
                  <div className="flex justify-center">
                    <button onClick={() => onAction({ type: 'END_TURN' })}
                      className="px-3 py-1 bg-slate-700/80 hover:bg-slate-600/80 rounded text-[10px] font-medium text-slate-300 transition-colors">
                      End Turn &rarr;
                    </button>
                  </div>
                )}
              </div>
            )}

            {view.phase === 'playerTurns' && !isMyTurn && (
              <div className="flex-1 flex items-center justify-center">
                <motion.div className="text-xs text-emerald-600" animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 2 }}>
                  Waiting...
                </motion.div>
              </div>
            )}
            {view.phase === 'chooseCharacters' && !view.isMyTurnToChoose && (
              <div className="flex-1 flex items-center justify-center">
                <motion.div className="text-xs text-emerald-600" animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 2 }}>
                  Choosing...
                </motion.div>
              </div>
            )}
          </div>
        </div>

        {/* Hand tray — text pills */}
        <div className="shrink-0 px-2 py-1" style={{ background: 'rgba(26,18,13,0.95)' }}>
          <div className="flex items-center gap-1.5">
            {/* My character icon */}
            {view.myCharacter && (
              <button
                onClick={() => setDetailTarget({ type: 'character', character: view.myCharacter! })}
                className="w-6 h-6 rounded-full overflow-hidden border border-cyan-500/50 shrink-0"
              >
                <img
                  src={`/images/cards/characters/${view.myCharacter.name.toLowerCase()}.jpg`}
                  alt={view.myCharacter.name}
                  className="w-full h-full object-cover"
                />
              </button>
            )}

            <div className="w-px h-5 bg-amber-900/40 shrink-0" />

            {/* Cards as pills */}
            <div className="flex-1 flex gap-1 flex-wrap items-center">
              {view.myHand.map((card, i) => {
                const canBuild =
                  isMyTurn &&
                  turnState?.actionTaken &&
                  (turnState?.districtsBuilt ?? 0) < (turnState?.maxDistricts ?? 1) &&
                  card.cost <= (me?.gold ?? 0) &&
                  !me?.city.some(d => d.name === card.name);

                const pillBg = PILL_BG[card.type] || PILL_BG.special;
                const pillText = PILL_TEXT[card.type] || PILL_TEXT.special;

                return (
                  <button
                    key={card.id}
                    onClick={canBuild
                      ? () => onAction({ type: 'BUILD_DISTRICT', cardIndex: i })
                      : () => setDetailTarget({ type: 'district', card })
                    }
                    className={`
                      shrink-0 flex items-center gap-0.5 px-1 py-px rounded border text-[9px]
                      ${pillBg} ${pillText}
                      ${canBuild ? 'ring-1 ring-cyan-400/70' : ''}
                    `}
                  >
                    <span className="w-3 h-3 bg-yellow-400 text-black rounded-full text-[7px] font-bold flex items-center justify-center shrink-0">
                      {card.cost}
                    </span>
                    <span className="truncate max-w-[52px]">{card.name}</span>
                    {canBuild && <span className="text-cyan-300 text-[7px]">&#9650;</span>}
                  </button>
                );
              })}
              {view.myHand.length === 0 && (
                <span className="text-slate-600 text-[9px] italic">No cards</span>
              )}
            </div>

            {/* City dots */}
            {me && me.city.length > 0 && (
              <>
                <div className="w-px h-5 bg-amber-900/40 shrink-0" />
                <div className="shrink-0 flex items-center gap-0.5">
                  {me.city.map(d => {
                    const col = { noble: 'bg-yellow-500', religious: 'bg-blue-500', trade: 'bg-green-500', military: 'bg-red-500', special: 'bg-purple-500' }[d.type];
                    return (
                      <button key={d.id} onClick={() => setDetailTarget({ type: 'district', card: d })}
                        className={`w-2.5 h-3 rounded-[1px] ${col} opacity-80 hover:opacity-100 border border-white/10`}
                        title={d.name} />
                    );
                  })}
                  <span className="text-[8px] text-slate-500 ml-0.5">{me.city.length}/8</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* ═══ DESKTOP LAYOUT (>= md) ═══                        */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className="hidden md:flex flex-1 flex-row overflow-hidden min-h-0">

        {/* Left column */}
        <div className="w-52 lg:w-60 shrink-0 p-2 space-y-1.5 overflow-y-auto">
          {otherPlayers.filter((_, i) => i < Math.ceil(otherPlayers.length / 2)).map((p) => {
            const idx = view.players.findIndex(pl => pl.id === p.id);
            const charRank = p.revealedCharacter?.rank;
            return (
              <PlayerSeat
                key={p.id}
                player={p}
                isMe={false}
                hasCrown={idx === view.crownPlayerIndex}
                isActive={view.phase === 'playerTurns' && charRank === view.currentCharacterRank}
                isMurdered={charRank != null && view.murderedCharacter === charRank}
                isRobbed={charRank != null && view.robbedCharacter === charRank}
                latestActions={getPlayerActions(view.log, p.name, 1)}
                onCharacterClick={p.revealedCharacter ? () => setDetailTarget({ type: 'character', character: p.revealedCharacter! }) : undefined}
                onDistrictClick={(d) => setDetailTarget({ type: 'district', card: d })}
              />
            );
          })}
        </div>

        {/* Center: felt table */}
        <div className="flex-1 flex flex-col min-w-0 p-2">
          <div className="felt-surface flex-1 rounded-xl p-3 lg:p-4 flex flex-col min-h-0 overflow-y-auto">

            {/* Phase banner */}
            <div className="text-center mb-2">
              {view.phase === 'chooseCharacters' && (
                <div>
                  <div className="text-[10px] text-emerald-600 uppercase tracking-[0.2em]">Round {view.round}</div>
                  <div className="text-sm text-emerald-200 font-medium">
                    {view.isMyTurnToChoose ? 'Choose your character' : 'Choosing characters...'}
                  </div>
                </div>
              )}
              {view.phase === 'playerTurns' && calledCharacter && (
                <motion.div key={view.currentCharacterRank} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                  <div className="text-[10px] text-emerald-600 uppercase tracking-[0.2em]">Now playing</div>
                  <div className="text-base font-bold text-amber-300">{calledCharacter.name} <span className="text-emerald-600 text-xs">#{calledCharacter.rank}</span></div>
                </motion.div>
              )}
              {view.phase === 'gameOver' && (
                <div className="text-lg font-bold text-amber-400">Game Over</div>
              )}
            </div>

            {/* Removed characters */}
            {(view.removedCharactersFaceUp.length > 0 || view.removedCharactersFaceDownCount > 0) && view.phase !== 'gameOver' && (
              <div className="mb-2">
                <RemovedCharacters
                  faceUp={view.removedCharactersFaceUp}
                  faceDownCount={view.removedCharactersFaceDownCount}
                  onCharacterClick={(char) => setDetailTarget({ type: 'character', character: char })}
                />
              </div>
            )}

            {/* Round events */}
            {view.phase === 'playerTurns' && view.roundEvents.length > 0 && (
              <div className="mb-2">
                <RoundEvents
                  events={view.roundEvents}
                  murderedCharacter={view.murderedCharacter}
                  robbedCharacter={view.robbedCharacter}
                  myCharacter={view.myCharacter}
                />
              </div>
            )}

            {/* Error */}
            <AnimatePresence>
              {actionError && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="bg-red-900/60 border border-red-700 rounded-lg px-3 py-1.5 text-xs text-red-300 mb-2"
                >
                  {actionError}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action controls */}
            {isMyTurn && turnState && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                <div className="text-center text-[11px] text-cyan-300 font-medium">
                  {!turnState.actionTaken ? 'Your turn — choose an action'
                    : turnState.phase === 'choosingCard' ? 'Pick a card to keep'
                    : 'Build, use powers, or end turn'}
                </div>

                {!turnState.actionTaken && (
                  <div className="flex gap-2 justify-center">
                    <button onClick={() => onAction({ type: 'TAKE_GOLD' })}
                      className="px-4 py-2 bg-yellow-700 hover:bg-yellow-600 rounded-lg text-sm font-bold transition-colors shadow-lg text-yellow-100">
                      &#9733; Take Gold
                    </button>
                    <button onClick={() => onAction({ type: 'DRAW_CARDS' })}
                      className="px-4 py-2 bg-emerald-800 hover:bg-emerald-700 rounded-lg text-sm font-bold transition-colors shadow-lg text-emerald-100">
                      &#9830; Draw Cards
                    </button>
                  </div>
                )}

                <div className="flex justify-center">
                  <PowerActions view={view} onAction={onAction} />
                </div>

                {turnState.actionTaken && turnState.phase !== 'choosingCard' && (
                  <div className="flex justify-center">
                    <button onClick={() => onAction({ type: 'END_TURN' })}
                      className="px-4 py-1.5 bg-slate-700/80 hover:bg-slate-600/80 rounded-lg text-xs font-medium text-slate-300 transition-colors">
                      End Turn &rarr;
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {view.phase === 'playerTurns' && !isMyTurn && (
              <div className="flex-1 flex items-center justify-center">
                <motion.div className="text-sm text-emerald-600" animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 2 }}>
                  Waiting...
                </motion.div>
              </div>
            )}
            {view.phase === 'chooseCharacters' && !view.isMyTurnToChoose && (
              <div className="flex-1 flex items-center justify-center">
                <motion.div className="text-sm text-emerald-600" animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 2 }}>
                  Choosing...
                </motion.div>
              </div>
            )}

            {/* Game log */}
            {view.phase !== 'gameOver' && (
              <GameLog log={view.log} currentRound={view.round} />
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="w-52 lg:w-60 shrink-0 p-2 space-y-1.5 overflow-y-auto">
          {otherPlayers.filter((_, i) => i >= Math.ceil(otherPlayers.length / 2)).map((p) => {
            const idx = view.players.findIndex(pl => pl.id === p.id);
            const charRank = p.revealedCharacter?.rank;
            return (
              <PlayerSeat
                key={p.id}
                player={p}
                isMe={false}
                hasCrown={idx === view.crownPlayerIndex}
                isActive={view.phase === 'playerTurns' && charRank === view.currentCharacterRank}
                isMurdered={charRank != null && view.murderedCharacter === charRank}
                isRobbed={charRank != null && view.robbedCharacter === charRank}
                latestActions={getPlayerActions(view.log, p.name, 1)}
                onCharacterClick={p.revealedCharacter ? () => setDetailTarget({ type: 'character', character: p.revealedCharacter! }) : undefined}
                onDistrictClick={(d) => setDetailTarget({ type: 'district', card: d })}
              />
            );
          })}
        </div>
      </div>

      {/* Desktop: Hand tray */}
      <div className="hidden md:block hand-tray shrink-0 px-3 py-2">
        <div className="flex items-center gap-4 max-w-5xl mx-auto">
          {/* My info compact */}
          <div className="shrink-0 flex items-center gap-2">
            {view.myCharacter && (
              <button
                onClick={() => setDetailTarget({ type: 'character', character: view.myCharacter! })}
                className="w-8 h-8 rounded-full overflow-hidden border-2 border-cyan-500/50 shrink-0"
              >
                <img
                  src={`/images/cards/characters/${view.myCharacter.name.toLowerCase()}.jpg`}
                  alt={view.myCharacter.name}
                  className="w-full h-full object-cover"
                />
              </button>
            )}
            <GoldDisplay amount={me?.gold ?? 0} size="sm" />
          </div>

          <div className="w-px h-10 bg-amber-900/40" />

          {/* Cards */}
          <div className="flex-1 flex gap-1.5 overflow-x-auto items-end pb-0.5">
            <AnimatePresence>
              {view.myHand.map((card, i) => {
                const canBuild =
                  isMyTurn &&
                  turnState?.actionTaken &&
                  (turnState?.districtsBuilt ?? 0) < (turnState?.maxDistricts ?? 1) &&
                  card.cost <= (me?.gold ?? 0) &&
                  !me?.city.some(d => d.name === card.name);

                return (
                  <motion.div
                    key={card.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 30 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <DistrictCardView
                      card={card}
                      onClick={canBuild ? () => onAction({ type: 'BUILD_DISTRICT', cardIndex: i }) : undefined}
                      onDetail={() => setDetailTarget({ type: 'district', card })}
                      buildable={!!canBuild}
                      small
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {view.myHand.length === 0 && (
              <div className="text-slate-600 text-xs italic py-2">No cards</div>
            )}
          </div>

          {/* My city */}
          {me && me.city.length > 0 && (
            <>
              <div className="w-px h-10 bg-amber-900/40 shrink-0" />
              <div className="shrink-0">
                <div className="hidden lg:flex flex-wrap gap-1 max-w-[280px]">
                  {me.city.map(d => (
                    <DistrictCardView key={d.id} card={d} small disabled
                      onDetail={() => setDetailTarget({ type: 'district', card: d })} />
                  ))}
                </div>
                <div className="lg:hidden flex items-center gap-0.5">
                  {me.city.map(d => {
                    const col = { noble: 'bg-yellow-500', religious: 'bg-blue-500', trade: 'bg-green-500', military: 'bg-red-500', special: 'bg-purple-500' }[d.type];
                    return (
                      <button key={d.id} onClick={() => setDetailTarget({ type: 'district', card: d })}
                        className={`w-3.5 h-4 rounded-[2px] ${col} opacity-80 hover:opacity-100 border border-white/10`}
                        title={d.name} />
                    );
                  })}
                </div>
                <div className="text-[9px] text-slate-500 text-center mt-0.5">{me.city.length}/8</div>
              </div>
            </>
          )}

          {/* Build hint */}
          {isMyTurn && turnState?.actionTaken && (turnState?.districtsBuilt ?? 0) < (turnState?.maxDistricts ?? 1) && (
            <span className="text-[10px] text-cyan-400 animate-pulse shrink-0">Tap card to build</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-overlays ────────────────────────────────────────────────

function CardChoiceOverlay({ cards, myHand, onChoose, onDetail }: { cards: DistrictCard[]; myHand: DistrictCard[]; onChoose: (i: number) => void; onDetail: (card: DistrictCard) => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-800 rounded-xl p-5 border border-slate-600 max-w-lg w-full mx-4 max-h-[90dvh] overflow-y-auto">
        <h2 className="text-base font-bold text-center mb-1 text-amber-300">Choose a Card to Keep</h2>
        <p className="text-xs text-slate-400 text-center mb-4">The other{cards.length > 2 ? 's go' : ' goes'} back to the deck</p>
        <div className="flex gap-4 justify-center flex-wrap">
          {cards.map((card, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <DistrictCardView card={card} onDetail={() => onDetail(card)} />
              <button
                onClick={() => onChoose(i)}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-bold text-white transition-colors shadow-lg w-full"
              >
                Keep
              </button>
            </div>
          ))}
        </div>

        {/* Show current hand */}
        {myHand.length > 0 && (
          <div className="mt-5 pt-4 border-t border-slate-700">
            <p className="text-[10px] text-slate-500 text-center mb-2 uppercase tracking-wide">Your current hand</p>
            <div className="flex gap-1.5 justify-center flex-wrap">
              {myHand.map((card) => (
                <DistrictCardView key={card.id} card={card} small disabled onDetail={() => onDetail(card)} />
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function GameOverOverlay({ view }: { view: PlayerGameView }) {
  if (!view.scores) return null;
  const sorted = [...view.scores].sort((a, b) => b.totalPoints - a.totalPoints);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-800 rounded-xl p-6 max-w-sm w-full mx-4 border border-amber-500/50">
        <h2 className="text-xl font-bold text-center text-amber-400 mb-4">Game Over</h2>
        <div className="space-y-2">
          {sorted.map((score, i) => (
            <div key={score.playerId} className={`flex items-center justify-between p-2.5 rounded-lg ${
              i === 0 ? 'bg-amber-900/30 border border-amber-600' : 'bg-slate-700/50'
            }`}>
              <div className="flex items-center gap-2">
                <span className={`text-base font-bold ${i === 0 ? 'text-amber-400' : 'text-slate-400'}`}>#{i + 1}</span>
                <div>
                  <div className="font-medium text-sm">{score.playerName}</div>
                  <div className="text-[10px] text-slate-400">
                    {score.districtPoints}pts
                    {score.colorBonusPoints > 0 && ` +${score.colorBonusPoints}col`}
                    {score.firstToEightPoints > 0 && ` +${score.firstToEightPoints}first`}
                    {score.otherEightPoints > 0 && ` +${score.otherEightPoints}`}
                  </div>
                </div>
              </div>
              <span className={`text-lg font-bold ${i === 0 ? 'text-amber-400' : ''}`}>{score.totalPoints}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 text-center">
          <button onClick={() => window.location.reload()}
            className="px-5 py-2 bg-amber-600 hover:bg-amber-500 rounded-lg font-medium transition-colors text-sm">
            Play Again
          </button>
        </div>
      </div>
    </motion.div>
  );
}
