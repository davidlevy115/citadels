import type { GameState, PlayerScore, DistrictType } from './types.js';

export function calculateScores(state: GameState, shorterGame: boolean): PlayerScore[] {
  const limit = shorterGame ? 7 : 8;

  return state.players.map(player => {
    // 1. Total cost of districts
    let districtPoints = 0;
    for (const d of player.city) {
      // Dragon Gate and University are worth 8 instead of their cost
      if (d.name === 'Dragon Gate' || d.name === 'University') {
        districtPoints += 8;
      } else {
        districtPoints += d.cost;
      }
    }

    // 2. Color bonus: 3 points for having all 5 types
    const types = new Set<DistrictType>();
    for (const d of player.city) {
      if (d.name === 'Haunted City') {
        // Haunted City: determine which color helps most
        // It counts as any type — we'll add the missing one if any
      } else {
        types.add(d.type);
      }
    }
    // Haunted City: if player has it and is missing exactly 1 type, it fills that gap
    const hasHauntedCity = player.city.some(d => d.name === 'Haunted City');
    const allTypes: DistrictType[] = ['noble', 'religious', 'trade', 'military', 'special'];
    let colorBonusPoints = 0;
    if (hasHauntedCity) {
      // Haunted City already adds 'special' via its own type, but it also counts as any type
      // Check if with one wildcard we can reach all 5
      const missingTypes = allTypes.filter(t => !types.has(t));
      if (missingTypes.length <= 1) {
        colorBonusPoints = 3;
      }
    } else if (allTypes.every(t => types.has(t))) {
      colorBonusPoints = 3;
    }

    // 3. First to reach limit: 4 points
    const firstToEightPoints = state.firstToEightDistricts === player.id ? 4 : 0;

    // 4. Others who also reached limit: 2 points
    const otherEightPoints =
      state.firstToEightDistricts !== player.id && player.city.length >= limit ? 2 : 0;

    const totalPoints = districtPoints + colorBonusPoints + firstToEightPoints + otherEightPoints;

    return {
      playerId: player.id,
      playerName: player.name,
      districtPoints,
      colorBonusPoints,
      firstToEightPoints,
      otherEightPoints,
      totalPoints,
    };
  });
}

export function determineWinner(scores: PlayerScore[], players: { id: string; gold: number }[]): PlayerScore {
  const sorted = [...scores].sort((a, b) => {
    // Highest total points
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    // Tiebreaker 1: highest district points
    if (b.districtPoints !== a.districtPoints) return b.districtPoints - a.districtPoints;
    // Tiebreaker 2: most gold
    const goldA = players.find(p => p.id === a.playerId)?.gold ?? 0;
    const goldB = players.find(p => p.id === b.playerId)?.gold ?? 0;
    return goldB - goldA;
  });
  return sorted[0];
}
