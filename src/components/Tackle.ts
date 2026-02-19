/**
 * Tackle component — handles tackle initiation, outcome resolution,
 * and post-tackle state transitions.
 */

import type { PlayerStats } from './Stats';
import { rollTackleOutcome } from './Stats';

export type TackleOutcome = 'dominant' | 'normal' | 'missed' | 'fendOff' | 'heldUp';

export interface TackleResult {
  outcome: TackleOutcome;
  /** Whether the ball is dislodged (loose ball) */
  ballDislodged: boolean;
  /** Whether a ruck should form */
  ruckTrigger: boolean;
  /** Recovery time for tackler in ms */
  tacklerRecoveryMs: number;
  /** Recovery time for carrier in ms */
  carrierRecoveryMs: number;
}

/**
 * Resolve a tackle attempt between two players.
 * @param tackler Stats of the tackling player
 * @param carrier Stats of the ball carrier
 * @param carrierSprinting Whether the carrier was sprinting (adds momentum)
 * @param carrierFending Whether the carrier pressed the fend button
 * @returns TackleResult with outcome and consequences
 */
export function resolveTackle(
  tackler: PlayerStats,
  carrier: PlayerStats,
  carrierSprinting: boolean = false,
  carrierFending: boolean = false,
): TackleResult {
  const momentum = carrierSprinting ? 0.8 : 0.4;

  // If carrier is fending, shift probabilities in their favour
  const effectiveTackler: PlayerStats = carrierFending
    ? { ...tackler, tackling: tackler.tackling * 0.7, strength: tackler.strength * 0.8 }
    : tackler;

  const effectiveCarrier: PlayerStats = carrierFending
    ? { ...carrier, strength: carrier.strength * 1.2 }
    : carrier;

  const outcome = rollTackleOutcome(effectiveTackler, effectiveCarrier, momentum);
  
  // Check for 'held up' (maul potential) logic
  // If carrier is strong and not sprinting, they might stay on feet
  if (outcome === 'normal' && effectiveCarrier.strength > effectiveTackler.strength + 10 && !carrierSprinting) {
     return {
        outcome: 'heldUp',
        ballDislodged: false,
        ruckTrigger: false, // Wait for maul trigger
        tacklerRecoveryMs: 1000,
        carrierRecoveryMs: 500,
     };
  }

  switch (outcome) {
    case 'dominant':
      return {
        outcome: 'dominant',
        ballDislodged: true,
        ruckTrigger: false, // Ball is loose, not presented
        tacklerRecoveryMs: 800,
        carrierRecoveryMs: 1200,
      };
    case 'normal':
      return {
        outcome: 'normal',
        ballDislodged: false,
        ruckTrigger: true,
        tacklerRecoveryMs: 1000,
        carrierRecoveryMs: 1000,
      };
    case 'missed':
      return {
        outcome: 'missed',
        ballDislodged: false,
        ruckTrigger: false,
        tacklerRecoveryMs: 600, // Stumble recovery
        carrierRecoveryMs: 0,   // Carrier keeps going
      };
    case 'fendOff':
      return {
        outcome: 'fendOff',
        ballDislodged: false,
        ruckTrigger: false,
        tacklerRecoveryMs: 800,
        carrierRecoveryMs: 200, // Slight slowdown from fend
      };
  }
}

/**
 * Check if a tackler is within tackle range of a ball carrier.
 */
export function isInTackleRange(
  tacklerX: number, tacklerY: number,
  carrierX: number, carrierY: number,
  tackleRange: number,
): boolean {
  const dx = tacklerX - carrierX;
  const dy = tacklerY - carrierY;
  return (dx * dx + dy * dy) <= tackleRange * tackleRange;
}
