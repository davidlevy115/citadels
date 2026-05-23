'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { BuiltDistrict } from '@citadels/game-logic';
import { DistrictCardView } from './Card';

interface CityProps {
  districts: BuiltDistrict[];
  playerName: string;
  isMe: boolean;
  onDistrictClick?: (district: BuiltDistrict) => void;
}

export function City({ districts, playerName, isMe, onDistrictClick }: CityProps) {
  if (districts.length === 0) {
    return (
      <div className="text-slate-500 text-xs italic text-center py-2">
        No districts built yet
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 justify-center">
        <AnimatePresence>
          {districts.map((d, i) => (
            <motion.div
              key={d.id}
              initial={{ opacity: 0, scale: 0.5, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <DistrictCardView
                card={d}
                small
                disabled
                onDetail={onDistrictClick ? () => onDistrictClick(d) : undefined}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
