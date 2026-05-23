'use client';

import { motion } from 'framer-motion';

interface GoldDisplayProps {
  amount: number;
  size?: 'sm' | 'lg';
}

const COIN_SIZE = { sm: 24, lg: 32 };
const COIN_THICKNESS = { sm: 5, lg: 7 };

function Coin({ diameter, thickness }: { diameter: number; thickness: number }) {
  return (
    <div className="relative" style={{ width: diameter, height: diameter + thickness }}>
      {/* 3D edge */}
      <div
        className="absolute rounded-full"
        style={{
          width: diameter,
          height: diameter,
          top: thickness,
          background: 'linear-gradient(to bottom, #b45309, #78350f)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
        }}
      />
      {/* Face */}
      <div
        className="absolute rounded-full"
        style={{
          width: diameter,
          height: diameter,
          top: 0,
          background: 'radial-gradient(ellipse at 38% 32%, #fef3c7 0%, #fbbf24 40%, #d97706 85%, #b45309 100%)',
          boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.5), inset 0 -2px 3px rgba(0,0,0,0.15), 0 1px 2px rgba(0,0,0,0.3)',
        }}
      >
        {/* Inner rim */}
        <div
          className="absolute rounded-full"
          style={{
            inset: diameter * 0.14,
            border: '1.5px solid rgba(180,83,9,0.35)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -0.5px 0 rgba(0,0,0,0.1)',
          }}
        />
        {/* Center star */}
        <div
          className="absolute flex items-center justify-center"
          style={{ inset: diameter * 0.22 }}
        >
          <span
            style={{ fontSize: diameter * 0.32, lineHeight: 1, color: 'rgba(146,64,14,0.5)' }}
          >
            &#9733;
          </span>
        </div>
      </div>
    </div>
  );
}

export function GoldDisplay({ amount, size = 'sm' }: GoldDisplayProps) {
  const d = COIN_SIZE[size];
  const t = COIN_THICKNESS[size];
  const coinsPerRow = size === 'sm' ? 5 : 8;
  const numberSize = size === 'sm' ? 'text-lg' : 'text-2xl';
  const gap = size === 'sm' ? 3 : 4;

  // Build rows of coins
  const rows: number[] = [];
  let remaining = amount;
  while (remaining > 0) {
    const row = Math.min(remaining, coinsPerRow);
    rows.push(row);
    remaining -= row;
  }

  return (
    <div className="flex items-center gap-2" title={`${amount} gold`}>
      {/* Coins grid */}
      {amount > 0 ? (
        <div className="flex flex-col-reverse" style={{ gap: gap }}>
          {rows.map((count, rowIdx) => (
            <div key={rowIdx} className="flex" style={{ gap: gap }}>
              {Array.from({ length: count }, (_, coinIdx) => (
                <motion.div
                  key={`${rowIdx}-${coinIdx}`}
                  initial={{ opacity: 0, scale: 0.5, y: -6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: (rowIdx * coinsPerRow + coinIdx) * 0.02, type: 'spring', damping: 18 }}
                >
                  <Coin diameter={d} thickness={t} />
                </motion.div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="opacity-25">
          <Coin diameter={d} thickness={t} />
        </div>
      )}

      {/* Number */}
      <motion.span
        key={amount}
        initial={{ scale: 1.5 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', damping: 12 }}
        className={`${numberSize} font-extrabold text-amber-200 tabular-nums leading-none drop-shadow`}
      >
        {amount}
      </motion.span>
    </div>
  );
}
