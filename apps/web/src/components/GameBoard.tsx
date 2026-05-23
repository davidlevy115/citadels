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
  const [showLog, setShowLog] = useState(false);

  // Current character being called
  const calledCharacter = CHARACTERS.find(c => c.rank === view.currentCharacterRank);

  return (
    <div className="min-h-screen flex flex-col">
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

      {view.phase === 'gameOver' && view.scores && (
        <GameOverOverlay view={view} />
      )}

      <AnimatePresence>
        {detailTarget?.type === 'district' && (
          <DistrictDetailModal card={detailTarget.card} onClose={() => setDetailTarget(null)} />
        )}
        {detailTarget?.type === 'character' && (
          <CharacterDetailModal character={detailTarget.character} onClose={() => setDetailTarget(null)} />
        )}
      </AnimatePresence>

      {/* Top bar */}
      <div className="bg-slate-900/80 border-b border-slate-700 px-4 py-2">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold text-amber-400">Citadels</h1>
            {roomId && (
              <button
                onClick={() => navigator.clipboard.writeText(roomId)}
                className="flex items-center gap-1 px-2 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-xs transition-colors group"
                title="Click to copy room code"
              >
                <span className="text-slate-400">Room:</span>
                <span className="text-amber-300 font-bold tracking-widest">{roomId}</span>
                <span className="text-slate-500 group-hover:text-slate-300 text-[10px]">&#x2398;</span>
              </button>
            )}
            <span className="text-xs text-slate-400">Round {view.round}</span>
            <span className="text-xs text-slate-400">Deck: {view.districtDeckCount}</span>
          </div>
          <div className="flex items-center gap-3">
            {view.myCharacter && (
              <button
                onClick={() => setDetailTarget({ type: 'character', character: view.myCharacter! })}
                className="text-sm hover:bg-slate-700/50 rounded px-2 py-1 transition-colors"
              >
                <span className="text-slate-400">Playing as:</span>{' '}
                <span className="text-amber-300 font-medium underline decoration-dotted underline-offset-2">{view.myCharacter.name}</span>
              </button>
            )}
            {view.gameEndTriggered && (
              <span className="text-xs bg-red-600 px-2 py-0.5 rounded-full animate-pulse">Final Round</span>
            )}
            <button
              onClick={() => setShowLog(!showLog)}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-2 py-1"
              title="Toggle game log"
            >
              {showLog ? 'Hide Log' : 'Log'}
            </button>
          </div>
        </div>
      </div>

      {/* Main board area */}
      <div className="flex-1 flex flex-col max-w-6xl mx-auto w-full p-4 gap-4">

        {/* The Board: players around a center */}
        <div className="flex-1 flex flex-col gap-4">

          {/* Player seats grid */}
          <div className={`grid gap-3 ${
            view.players.length <= 4
              ? 'grid-cols-2 lg:grid-cols-4'
              : view.players.length <= 6
                ? 'grid-cols-2 lg:grid-cols-3'
                : 'grid-cols-2 lg:grid-cols-4'
          }`}>
            {view.players.map((p, i) => {
              const charRank = p.revealedCharacter?.rank;
              return (
                <PlayerSeat
                  key={p.id}
                  player={p}
                  isMe={i === view.myIndex}
                  hasCrown={i === view.crownPlayerIndex}
                  isActive={
                    view.phase === 'playerTurns' &&
                    charRank === view.currentCharacterRank
                  }
                  isMurdered={charRank != null && view.murderedCharacter === charRank}
                  isRobbed={charRank != null && view.robbedCharacter === charRank}
                  latestActions={getPlayerActions(view.log, p.name, 2)}
                  onCharacterClick={p.revealedCharacter ? () => setDetailTarget({ type: 'character', character: p.revealedCharacter! }) : undefined}
                  onDistrictClick={(d) => setDetailTarget({ type: 'district', card: d })}
                />
              );
            })}
          </div>

          {/* Center table area */}
          <div className="relative">
            {/* Table surface */}
            <div className="bg-gradient-to-b from-slate-800/70 to-slate-900/70 rounded-2xl border border-slate-700 p-5 backdrop-blur-sm">

              {/* Round / phase banner */}
              <div className="text-center mb-4">
                {view.phase === 'chooseCharacters' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <div className="text-xs text-slate-500 uppercase tracking-widest mb-1">Round {view.round}</div>
                    <div className="text-sm text-slate-300">
                      {view.isMyTurnToChoose
                        ? 'Choose your character!'
                        : 'Characters are being chosen...'}
                    </div>
                    {!view.isMyTurnToChoose && (
                      <motion.div
                        className="mt-2 flex justify-center gap-1"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                      >
                        {[0, 1, 2].map(i => (
                          <div key={i} className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        ))}
                      </motion.div>
                    )}
                  </motion.div>
                )}

                {view.phase === 'playerTurns' && (
                  <motion.div
                    key={view.currentCharacterRank}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="text-xs text-slate-500 uppercase tracking-widest mb-1">
                      Round {view.round} &middot; Calling Characters
                    </div>
                    {calledCharacter && (
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-lg">{calledCharacter.name === 'Assassin' ? '\u2620' : calledCharacter.name === 'Thief' ? '\u2666' : calledCharacter.name === 'Magician' ? '\u2728' : calledCharacter.name === 'King' ? '\u265A' : calledCharacter.name === 'Bishop' ? '\u2657' : calledCharacter.name === 'Merchant' ? '\u2696' : calledCharacter.name === 'Architect' ? '\u25B2' : '\u2694'}</span>
                        <span className="text-base font-semibold text-amber-300">{calledCharacter.name}</span>
                        <span className="text-xs text-slate-500">#{calledCharacter.rank}</span>
                      </div>
                    )}
                    {!isMyTurn && (
                      <div className="text-xs text-slate-400 mt-1">
                        {view.players.find(p => p.revealedCharacter?.rank === view.currentCharacterRank)?.name ?? 'Unknown'} is playing...
                      </div>
                    )}
                  </motion.div>
                )}

                {view.phase === 'gameOver' && (
                  <div className="text-xl font-bold text-amber-400">Game Over</div>
                )}
              </div>

              {/* Removed characters this round */}
              {(view.removedCharactersFaceUp.length > 0 || view.removedCharactersFaceDownCount > 0) && view.phase !== 'gameOver' && (
                <div className="mb-4 py-3 border-y border-slate-700/50">
                  <RemovedCharacters
                    faceUp={view.removedCharactersFaceUp}
                    faceDownCount={view.removedCharactersFaceDownCount}
                    onCharacterClick={(char) => setDetailTarget({ type: 'character', character: char })}
                  />
                </div>
              )}

              {/* Round events: targeting actions */}
              {view.phase === 'playerTurns' && view.roundEvents.length > 0 && (
                <div className="mb-4">
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
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="bg-red-900/50 border border-red-700 rounded-lg px-3 py-2 text-sm text-red-300 mb-3"
                  >
                    {actionError}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* My action controls */}
              {isMyTurn && turnState && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  {/* Prompt */}
                  <div className="text-center text-xs text-cyan-300 font-medium">
                    {!turnState.actionTaken
                      ? 'Your turn \u2014 take an action'
                      : turnState.phase === 'choosingCard'
                        ? 'Pick a card to keep'
                        : 'Build a district, use powers, or end your turn'}
                  </div>

                  {/* Action buttons */}
                  {!turnState.actionTaken && (
                    <div className="flex gap-3 justify-center">
                      <button
                        onClick={() => onAction({ type: 'TAKE_GOLD' })}
                        className="px-5 py-2.5 bg-yellow-600 hover:bg-yellow-500 rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-yellow-600/20"
                      >
                        &#9733; Take 2 Gold
                      </button>
                      <button
                        onClick={() => onAction({ type: 'DRAW_CARDS' })}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-blue-600/20"
                      >
                        &#9830; Draw Cards
                      </button>
                    </div>
                  )}

                  {/* Character power actions */}
                  <div className="flex justify-center">
                    <PowerActions view={view} onAction={onAction} />
                  </div>

                  {/* End turn */}
                  {turnState.actionTaken && turnState.phase !== 'choosingCard' && (
                    <div className="flex justify-center">
                      <button
                        onClick={() => onAction({ type: 'END_TURN' })}
                        className="px-5 py-2 bg-slate-600 hover:bg-slate-500 rounded-xl text-sm font-medium transition-colors"
                      >
                        End Turn &rarr;
                      </button>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Waiting state when not my turn */}
              {view.phase === 'playerTurns' && !isMyTurn && (
                <div className="flex justify-center py-2">
                  <motion.div
                    className="flex items-center gap-2 text-sm text-slate-400"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                  >
                    <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    Waiting...
                  </motion.div>
                </div>
              )}
            </div>
          </div>

          {/* Collapsible game log */}
          <AnimatePresence>
            {showLog && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-slate-900/60 rounded-lg p-3 border border-slate-700 max-h-32 overflow-y-auto">
                  <div className="space-y-0.5">
                    {view.log.slice(-30).reverse().map((entry, i) => (
                      <div key={i} className={`text-[11px] ${i === 0 ? 'text-slate-200' : 'text-slate-500'}`}>
                        {entry.message}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom: My hand */}
      <div className="bg-slate-900/90 border-t border-slate-700 px-4 py-3">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Your Hand</h3>

            <GoldDisplay amount={me?.gold ?? 0} size="lg" />

            {isMyTurn && turnState?.actionTaken && (turnState?.districtsBuilt ?? 0) < (turnState?.maxDistricts ?? 1) && (
              <span className="text-[10px] text-cyan-400 animate-pulse">Click a card to build it</span>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
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
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -40 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <DistrictCardView
                      card={card}
                      onClick={canBuild ? () => onAction({ type: 'BUILD_DISTRICT', cardIndex: i }) : undefined}
                      onDetail={() => setDetailTarget({ type: 'district', card })}
                      disabled={!canBuild}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {view.myHand.length === 0 && (
              <div className="text-slate-500 text-sm italic py-4">No cards in hand</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-overlays (unchanged logic, kept here) ───────────────────

function CardChoiceOverlay({ cards, onChoose, onDetail }: { cards: DistrictCard[]; onChoose: (i: number) => void; onDetail: (card: DistrictCard) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
    >
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-600">
        <h2 className="text-lg font-bold text-center mb-2">Choose a Card to Keep</h2>
        <p className="text-xs text-slate-400 text-center mb-4">Click to keep. Tap the card name for details.</p>
        <div className="flex gap-4 justify-center">
          {cards.map((card, i) => (
            <DistrictCardView
              key={i}
              card={card}
              onClick={() => onChoose(i)}
              onDetail={() => onDetail(card)}
            />
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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
    >
      <div className="bg-slate-800 rounded-xl p-8 max-w-md w-full mx-4 border border-amber-500/50">
        <h2 className="text-2xl font-bold text-center text-amber-400 mb-6">Game Over</h2>
        <div className="space-y-3">
          {sorted.map((score, i) => (
            <div
              key={score.playerId}
              className={`flex items-center justify-between p-3 rounded-lg ${
                i === 0 ? 'bg-amber-900/30 border border-amber-600' : 'bg-slate-700/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`text-lg font-bold ${i === 0 ? 'text-amber-400' : 'text-slate-400'}`}>#{i + 1}</span>
                <div>
                  <div className="font-medium text-sm">{score.playerName}</div>
                  <div className="text-xs text-slate-400">
                    Districts: {score.districtPoints}
                    {score.colorBonusPoints > 0 && ` | Colors: +${score.colorBonusPoints}`}
                    {score.firstToEightPoints > 0 && ` | First: +${score.firstToEightPoints}`}
                    {score.otherEightPoints > 0 && ` | Complete: +${score.otherEightPoints}`}
                  </div>
                </div>
              </div>
              <span className={`text-xl font-bold ${i === 0 ? 'text-amber-400' : ''}`}>{score.totalPoints}</span>
            </div>
          ))}
        </div>
        <div className="mt-6 text-center">
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-amber-600 hover:bg-amber-500 rounded-lg font-medium transition-colors"
          >
            Play Again
          </button>
        </div>
      </div>
    </motion.div>
  );
}
