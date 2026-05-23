'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PlayerGameView, DistrictCard, Character, BuiltDistrict } from '@citadels/game-logic';
import { CHARACTERS } from '@citadels/game-logic';
import { DistrictCardView } from './Card';
import { DistrictDetailModal, CharacterDetailModal } from './CardDetailModal';
import { CharacterSelect } from './CharacterSelect';
import { PlayerSeat, getPlayerActions } from './PlayerSeat';
import { RoundEvents } from './RoundEvents';
import { RemovedCharacters } from './RemovedCharacters';
import { GoldDisplay } from './GoldDisplay';
import { PowerActions } from './PowerActions';

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

  // Split players: me vs others
  const otherPlayers = view.players.filter((_, i) => i !== view.myIndex);

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden">
      {/* Overlays */}
      {view.isMyTurnToChoose && view.availableCharacters.length > 0 && (
        <CharacterSelect
          characters={view.availableCharacters}
          removedFaceUp={view.removedCharactersFaceUp}
          onSelect={(rank) => onAction({ type: 'CHOOSE_CHARACTER', characterRank: rank })}
          onDetail={(char) => setDetailTarget({ type: 'character', character: char })}
        />
      )}
      {turnState?.phase === 'choosingCard' && isMyTurn && turnState.drawnCards.length > 0 && (
        <CardChoiceOverlay
          cards={turnState.drawnCards}
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

      {/* ═══ BOARD LAYOUT ═══ */}
      {/* Top strip: info bar */}
      <div className="shrink-0 flex items-center justify-between px-3 py-1.5" style={{ background: 'rgba(20,12,8,0.9)' }}>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-amber-400 tracking-wide">CITADELS</span>
          {roomId && (
            <button
              onClick={() => navigator.clipboard.writeText(roomId)}
              className="px-2 py-0.5 bg-amber-900/40 hover:bg-amber-900/60 rounded text-[10px] text-amber-300 font-mono tracking-widest transition-colors"
              title="Click to copy room code"
            >
              {roomId}
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-slate-400">
          <span>Round {view.round}</span>
          <span>Deck {view.districtDeckCount}</span>
          {view.myCharacter && (
            <button
              onClick={() => setDetailTarget({ type: 'character', character: view.myCharacter! })}
              className="text-amber-300 hover:text-amber-200 font-medium transition-colors"
            >
              {view.myCharacter.name}
            </button>
          )}
          {view.gameEndTriggered && (
            <span className="bg-red-600 px-1.5 py-0.5 rounded text-[10px] text-white animate-pulse">FINAL</span>
          )}
        </div>
      </div>

      {/* Main board: players on sides, felt table center */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* Left column: first half of opponents */}
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
          </div>
        </div>

        {/* Right column: second half of opponents */}
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

      {/* Bottom: My hand tray */}
      <div className="hand-tray shrink-0 px-3 py-2">
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

          {/* Separator */}
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
                      disabled={!canBuild}
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

          {/* My city dots */}
          {me && me.city.length > 0 && (
            <>
              <div className="w-px h-10 bg-amber-900/40" />
              <div className="shrink-0 flex flex-col items-center gap-1">
                <div className="flex gap-0.5">
                  {me.city.map(d => {
                    const col = { noble: 'bg-yellow-500', religious: 'bg-blue-500', trade: 'bg-green-500', military: 'bg-red-500', special: 'bg-purple-500' }[d.type];
                    return (
                      <button key={d.id} onClick={() => setDetailTarget({ type: 'district', card: d })}
                        className={`w-3 h-4 rounded-[2px] ${col} opacity-80 hover:opacity-100 border border-white/10`}
                        title={d.name} />
                    );
                  })}
                </div>
                <span className="text-[9px] text-slate-500">{me.city.length}/8</span>
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

function CardChoiceOverlay({ cards, onChoose, onDetail }: { cards: DistrictCard[]; onChoose: (i: number) => void; onDetail: (card: DistrictCard) => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-800 rounded-xl p-5 border border-slate-600">
        <h2 className="text-base font-bold text-center mb-3 text-amber-300">Choose a Card</h2>
        <div className="flex gap-3 justify-center">
          {cards.map((card, i) => (
            <DistrictCardView key={i} card={card} onClick={() => onChoose(i)} onDetail={() => onDetail(card)} />
          ))}
        </div>
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
