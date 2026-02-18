/**
 * Stats component — standalone stat container for a player.
 *
 * Encapsulates all player attributes on a 0–100 scale.
 * Used by Player entity and AI decision-making.
 */

export interface PlayerStats {
  speed: number;        // 0–100 — affects run/sprint velocity
  strength: number;     // 0–100 — tackle/ruck/maul contests
  handling: number;     // 0–100 — pass/catch accuracy, offload chance
  kicking: number;      // 0–100 — kick distance and accuracy
  stamina: number;      // 0–100 — base max stamina, affects drain rate
  tackling: number;     // 0–100 — tackle success probability
  awareness: number;    // 0–100 — AI decision quality, read play speed
  workRate: number;     // 0–100 — willingness to support, ruck commitment
}

/**
 * Calculate a stat-weighted probability check.
 * @param stat The relevant stat value (0–100)
 * @param difficulty Bonus/penalty from difficulty setting
 * @returns true if the check passes
 */
export function statCheck(stat: number, difficulty: number = 0): boolean {
  const threshold = stat + difficulty;
  const roll = Math.random() * 100;
  return roll < threshold;
}

/**
 * Blend two stats for a combined check (e.g., tackling + strength).
 * @param a First stat
 * @param b Second stat
 * @param weightA Weight for first stat (0–1)
 * @returns Blended value
 */
export function blendStats(a: number, b: number, weightA: number = 0.5): number {
  return a * weightA + b * (1 - weightA);
}

/**
 * Calculate catch probability based on handling stat and pass accuracy.
 * @param handling Receiver's handling stat
 * @param passAccuracy Pass accuracy modifier (0–1, 1 = perfect)
 * @returns Probability 0–1
 */
export function catchProbability(handling: number, passAccuracy: number): number {
  const base = (handling / 100) * 0.85 + 0.15; // 15–100% base chance
  return Math.min(1, base * passAccuracy);
}

/**
 * Calculate tackle success probability.
 * @param tackler Tackler stats
 * @param carrier Ball carrier stats
 * @param carrierMomentum 0–1 momentum factor (higher = harder to tackle)
 * @returns Object with probabilities for each outcome
 */
export function tackleProbabilities(
  tackler: PlayerStats,
  carrier: PlayerStats,
  carrierMomentum: number = 0.5,
): { dominant: number; normal: number; missed: number; fendOff: number } {
  const tacklerPower = tackler.tackling * 0.6 + tackler.strength * 0.4;
  const carrierPower = carrier.strength * 0.5 + carrier.speed * carrierMomentum * 0.5;

  const ratio = tacklerPower / Math.max(carrierPower, 1);

  // Normalize into probability buckets
  const dominantChance = Math.min(0.3, (ratio - 1) * 0.4);
  const normalChance = Math.min(0.6, ratio * 0.45);
  const missedChance = Math.max(0.05, (1 - ratio) * 0.3);
  const fendOffChance = Math.max(0.05, (1 - ratio) * 0.25);

  // Normalize to sum to 1
  const total = dominantChance + normalChance + missedChance + fendOffChance;
  return {
    dominant: Math.max(0, dominantChance / total),
    normal: normalChance / total,
    missed: missedChance / total,
    fendOff: fendOffChance / total,
  };
}

/**
 * Roll a tackle outcome using the computed probabilities.
 */
export function rollTackleOutcome(
  tackler: PlayerStats,
  carrier: PlayerStats,
  carrierMomentum: number = 0.5,
): 'dominant' | 'normal' | 'missed' | 'fendOff' {
  const probs = tackleProbabilities(tackler, carrier, carrierMomentum);
  const roll = Math.random();

  if (roll < probs.dominant) return 'dominant';
  if (roll < probs.dominant + probs.normal) return 'normal';
  if (roll < probs.dominant + probs.normal + probs.missed) return 'missed';
  return 'fendOff';
}
