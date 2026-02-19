/**
 * Passing component — encapsulates pass type logic.
 *
 * Three pass types:
 * - Pop pass:  short range, flat arc, fast
 * - Spin pass: medium range, slight arc, moderate speed
 * - Skip pass: long range, high arc, slower but covers distance
 */

export const PassType = {
  POP: 'POP',
  SPIN: 'SPIN',
  SKIP: 'SKIP',
} as const;
export type PassType = (typeof PassType)[keyof typeof PassType];

export interface PassConfig {
  /** Maximum range (px) multiplied by handling/100 */
  baseRange: number;
  /** Arc height multiplier (higher = more lofted) */
  arcFactor: number;
  /** Speed multiplier (higher = faster travel) */
  speedFactor: number;
  /** Accuracy modifier (0–1, higher = more accurate) */
  accuracyMod: number;
}

export const PASS_CONFIGS: Record<PassType, PassConfig> = {
  [PassType.POP]: {
    baseRange: 80,
    arcFactor: 0.05,
    speedFactor: 2.0,
    accuracyMod: 0.95,
  },
  [PassType.SPIN]: {
    baseRange: 160,
    arcFactor: 0.12,
    speedFactor: 1.2,
    accuracyMod: 0.85,
  },
  [PassType.SKIP]: {
    baseRange: 280,
    arcFactor: 0.25,
    speedFactor: 0.8,
    accuracyMod: 0.70,
  },
};

/**
 * Select the appropriate pass type based on distance to receiver.
 * Short = pop, medium = spin, long = skip.
 */
export function selectPassType(distance: number, handling: number): PassType {
  const maxRange = handling * 2.8; // ~280 px for handling=100
  const ratio = distance / maxRange;

  if (ratio < 0.3) return PassType.POP;
  if (ratio < 0.65) return PassType.SPIN;
  return PassType.SKIP;
}

/**
 * Determine if a pass should be an offload.
 * Requirements: carrier handling > 75, being tackled, teammate nearby.
 */
export function canOffload(handling: number, isBeingTackled: boolean, nearbyTeammateDistance: number): boolean {
  if (!isBeingTackled) return false;
  if (handling < 75) return false;
  if (nearbyTeammateDistance > 60) return false;

  // Probability scales with handling
  const chance = (handling - 75) / 25; // 0–1 for handling 75–100
  return Math.random() < chance * 0.6; // Max 60% chance
}

/**
 * Attempt to perform an offload.
 * Returns the target player if successful, null otherwise.
 */
import type { Player } from '../entities/Player';

/**
 * Offload Outcome Types
 */
export type OffloadResult = 
  | { type: 'SUCCESS', target: Player }
  | { type: 'FAILED_KNOCKON' }
  | { type: 'NO_ATTEMPT' };

export function attemptOffload(
  carrier: Player,
  supportPlayers: Player[]
): OffloadResult {
  // 1. Valid stats check
  if (carrier.stats.handling < 70) return { type: 'NO_ATTEMPT' };

  // 2. Determine best support player
  let bestSupport: Player | null = null;
  let minDist = 1000;

  for (const p of supportPlayers) {
    if (p === carrier || p.isGrounded || p.isInRuck) continue;
    // Offload must be close range
    const d = Phaser.Math.Distance.Between(carrier.sprite.x, carrier.sprite.y, p.sprite.x, p.sprite.y);
    if (d < 60 && d < minDist) {
      minDist = d;
      bestSupport = p;
    }
  }

  if (!bestSupport) return { type: 'NO_ATTEMPT' };

  // 3. Success check
  // Higher handling = better chance. Pressure from tackle reduces it.
  const handling = carrier.stats.handling;
  const baseChance = (handling / 100) * 0.8; 
  
  if (Math.random() < baseChance) {
    return { type: 'SUCCESS', target: bestSupport };
  } else {
    // Failed attempt!
    // High handling reduces knock-on chance on fail
    // If handling is 70, fail chance is high. Knock-on chance should be existing.
    // e.g. 20% chance of knock-on if failed?
    if (Math.random() < 0.3) {
       return { type: 'FAILED_KNOCKON' };
    }
  }

  return { type: 'NO_ATTEMPT' };
}
