'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import type { PlayerGameView } from '@citadels/game-logic';
import { CHARACTERS } from '@citadels/game-logic';

interface PowerActionsProps {
  view: PlayerGameView;
  onAction: (action: any) => void;
}

export function PowerActions({ view, onAction }: PowerActionsProps) {
  const char = view.myCharacter;
  if (!char || !view.isMyTurn || !view.turnState) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {char.name === 'Assassin' && !view.turnState.powerUsed && (
        <AssassinAction onAction={onAction} murderedCharacter={null} />
      )}
      {char.name === 'Thief' && !view.turnState.powerUsed && (
        <ThiefAction onAction={onAction} murderedCharacter={null} />
      )}
      {char.name === 'Magician' && !view.turnState.powerUsed && (
        <MagicianAction view={view} onAction={onAction} />
      )}
      {['King', 'Bishop', 'Merchant', 'Warlord'].includes(char.name) && !view.turnState.powerUsed && view.turnState.actionTaken && (
        <button
          onClick={() => onAction({ type: 'USE_POWER' })}
          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 rounded text-sm font-medium transition-colors"
        >
          Collect Income
        </button>
      )}
      {char.name === 'Warlord' && !view.turnState.powerUsed && view.turnState.actionTaken && (
        <WarlordAction view={view} onAction={onAction} />
      )}
    </div>
  );
}

function AssassinAction({ onAction, murderedCharacter }: { onAction: (a: any) => void; murderedCharacter: number | null }) {
  const [showPicker, setShowPicker] = useState(false);
  const targets = CHARACTERS.filter(c => c.rank >= 2 && c.rank <= 8);

  if (!showPicker) {
    return (
      <button
        onClick={() => setShowPicker(true)}
        className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm font-medium transition-colors"
      >
        Murder...
      </button>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      <span className="text-xs text-slate-400 self-center mr-1">Kill:</span>
      {targets.map(c => (
        <button
          key={c.rank}
          onClick={() => { onAction({ type: 'ASSASSIN_KILL', targetRank: c.rank }); setShowPicker(false); }}
          className="px-2 py-1 bg-gray-700 hover:bg-red-700 rounded text-xs transition-colors"
        >
          {c.name}
        </button>
      ))}
    </div>
  );
}

function ThiefAction({ onAction, murderedCharacter }: { onAction: (a: any) => void; murderedCharacter: number | null }) {
  const [showPicker, setShowPicker] = useState(false);
  const targets = CHARACTERS.filter(c => c.rank >= 3 && c.rank <= 8);

  if (!showPicker) {
    return (
      <button
        onClick={() => setShowPicker(true)}
        className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm font-medium transition-colors"
      >
        Steal from...
      </button>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      <span className="text-xs text-slate-400 self-center mr-1">Rob:</span>
      {targets.map(c => (
        <button
          key={c.rank}
          onClick={() => { onAction({ type: 'THIEF_STEAL', targetRank: c.rank }); setShowPicker(false); }}
          className="px-2 py-1 bg-gray-700 hover:bg-amber-700 rounded text-xs transition-colors"
        >
          {c.name}
        </button>
      ))}
    </div>
  );
}

function MagicianAction({ view, onAction }: { view: PlayerGameView; onAction: (a: any) => void }) {
  const [showOptions, setShowOptions] = useState(false);
  const [selectedCards, setSelectedCards] = useState<number[]>([]);

  if (!showOptions) {
    return (
      <button
        onClick={() => setShowOptions(true)}
        className="px-3 py-1.5 bg-indigo-700 hover:bg-indigo-600 rounded text-sm font-medium transition-colors"
      >
        Use Magic...
      </button>
    );
  }

  return (
    <div className="space-y-2 bg-slate-800 rounded p-3 border border-slate-600">
      <p className="text-xs text-slate-400">Magician Power:</p>
      <div className="flex flex-wrap gap-2">
        {view.players.filter(p => p.id !== view.players[view.myIndex].id).map(p => (
          <button
            key={p.id}
            onClick={() => { onAction({ type: 'MAGICIAN_SWAP_PLAYER', targetPlayerId: p.id }); setShowOptions(false); }}
            className="px-2 py-1 bg-indigo-700 hover:bg-indigo-600 rounded text-xs transition-colors"
          >
            Swap with {p.name} ({p.handSize} cards)
          </button>
        ))}
      </div>
      {view.myHand.length > 0 && (
        <div>
          <p className="text-xs text-slate-400 mb-1">Or discard cards to draw replacements:</p>
          <div className="flex flex-wrap gap-1 mb-2">
            {view.myHand.map((card, i) => (
              <button
                key={i}
                onClick={() => setSelectedCards(prev =>
                  prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]
                )}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  selectedCards.includes(i) ? 'bg-red-600' : 'bg-slate-600 hover:bg-slate-500'
                }`}
              >
                {card.name}
              </button>
            ))}
          </div>
          {selectedCards.length > 0 && (
            <button
              onClick={() => { onAction({ type: 'MAGICIAN_SWAP_DECK', cardIndices: selectedCards }); setShowOptions(false); }}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-xs transition-colors"
            >
              Discard {selectedCards.length} & Draw
            </button>
          )}
        </div>
      )}
      <button
        onClick={() => setShowOptions(false)}
        className="px-2 py-1 bg-slate-600 hover:bg-slate-500 rounded text-xs transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}

function WarlordAction({ view, onAction }: { view: PlayerGameView; onAction: (a: any) => void }) {
  const [showTargets, setShowTargets] = useState(false);

  if (!showTargets) {
    return (
      <button
        onClick={() => setShowTargets(true)}
        className="px-3 py-1.5 bg-red-700 hover:bg-red-600 rounded text-sm font-medium transition-colors"
      >
        Destroy District...
      </button>
    );
  }

  const targets = view.players.filter(p => {
    if (p.revealedCharacter?.name === 'Bishop') return false;
    if (p.city.length >= 8) return false;
    return p.city.length > 0;
  });

  return (
    <div className="space-y-2 bg-slate-800 rounded p-3 border border-slate-600">
      <p className="text-xs text-slate-400">Destroy a district:</p>
      {targets.map(p => (
        <div key={p.id} className="space-y-1">
          <p className="text-xs font-medium">{p.name}'s city:</p>
          <div className="flex flex-wrap gap-1">
            {p.city.map((d, i) => {
              const cost = Math.max(0, d.cost - 1);
              const isKeep = d.name === 'Keep';
              return (
                <button
                  key={i}
                  disabled={isKeep || cost > (view.players[view.myIndex]?.gold ?? 0)}
                  onClick={() => { onAction({ type: 'WARLORD_DESTROY', targetPlayerId: p.id, districtIndex: i }); setShowTargets(false); }}
                  className={`px-2 py-1 rounded text-xs transition-colors ${
                    isKeep || cost > (view.players[view.myIndex]?.gold ?? 0)
                      ? 'bg-slate-700 opacity-50 cursor-not-allowed'
                      : 'bg-red-700 hover:bg-red-600'
                  }`}
                >
                  {d.name} ({cost}g)
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <div className="flex gap-2">
        <button
          onClick={() => { onAction({ type: 'WARLORD_PASS' }); setShowTargets(false); }}
          className="px-2 py-1 bg-slate-600 hover:bg-slate-500 rounded text-xs transition-colors"
        >
          Don't Destroy
        </button>
        <button
          onClick={() => setShowTargets(false)}
          className="px-2 py-1 bg-slate-600 hover:bg-slate-500 rounded text-xs transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
