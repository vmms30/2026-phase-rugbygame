/**
 * PhaseManager — Finite State Machine for game phase transitions.
 *
 * Tracks the current game phase and enforces valid transitions:
 *   KICK_OFF → OPEN_PLAY → TACKLE → RUCK → OPEN_PLAY (cycle)
 *
 * Emits events via EventBus on every transition.
 */

import type { GamePhase } from '../utils/Constants';
import { EventBus } from '../utils/EventBus';

/** Valid transitions from each phase */
const TRANSITIONS: Record<string, string[]> = {
  KICK_OFF:    ['OPEN_PLAY'],
  OPEN_PLAY:   ['TACKLE', 'KNOCK_ON', 'TOUCH', 'PENALTY', 'TRY_SCORED', 'DROP_GOAL', 'MAUL', 'HALF_TIME', 'FULL_TIME'],
  TACKLE:      ['RUCK', 'MAUL', 'PENALTY', 'TRY_SCORED', 'KNOCK_ON'],
  RUCK:        ['OPEN_PLAY', 'PENALTY', 'SCRUM'],
  MAUL:        ['OPEN_PLAY', 'SCRUM', 'PENALTY', 'TRY_SCORED'], // SCRUM acts as turnover
  SCRUM:       ['OPEN_PLAY', 'PENALTY', 'SCRUM'], // SCRUM->SCRUM for resets
  LINEOUT:     ['OPEN_PLAY', 'MAUL', 'PENALTY'],
  KNOCK_ON:    ['SCRUM'],
  TOUCH:       ['LINEOUT'],
  PENALTY:     ['OPEN_PLAY', 'SCRUM', 'LINEOUT', 'CONVERSION', 'TAP_AND_GO'],
  TAP_AND_GO:  ['OPEN_PLAY'],
  TRY_SCORED:  ['CONVERSION'],
  CONVERSION:  ['KICK_OFF'],
  DROP_GOAL:   ['KICK_OFF'],
  HALF_TIME:   ['KICK_OFF'],
  FULL_TIME:   [],
};

export class PhaseManager {
  private currentPhase: GamePhase;
  private phaseCount: number = 0;
  private phaseStartTime: number = 0;

  constructor(initialPhase: GamePhase = 'KICK_OFF') {
    this.currentPhase = initialPhase;
    this.phaseStartTime = Date.now();
  }

  /** Get the current game phase */
  getPhase(): GamePhase {
    return this.currentPhase;
  }

  /** Get the running phase count (ruck recycles) */
  getPhaseCount(): number {
    return this.phaseCount;
  }

  /** Time (ms) in the current phase */
  getPhaseElapsed(): number {
    return Date.now() - this.phaseStartTime;
  }

  /**
   * Attempt to transition to a new phase.
   * @returns true if transition was valid and executed
   */
  transition(to: GamePhase): boolean {
    const allowed = TRANSITIONS[this.currentPhase];
    if (!allowed || !allowed.includes(to)) {
      console.warn(`[PhaseManager] Invalid transition: ${this.currentPhase} → ${to}`);
      return false;
    }

    const from = this.currentPhase;
    this.currentPhase = to;
    this.phaseStartTime = Date.now();

    // Increment phase counter on ruck recycle
    if (from === 'RUCK' && to === 'OPEN_PLAY') {
      this.phaseCount++;
    }

    // Reset phase count on set pieces and scoring
    if (['KICK_OFF', 'SCRUM', 'LINEOUT'].includes(to)) {
      this.phaseCount = 0;
    }

    // Emit phase change event
    EventBus.emit('phaseChange', { from, to });

    return true;
  }

  /**
   * Force-set a phase (bypass validation). Use sparingly.
   */
  forcePhase(phase: GamePhase): void {
    const from = this.currentPhase;
    this.currentPhase = phase;
    this.phaseStartTime = Date.now();
    EventBus.emit('phaseChange', { from, to: phase });
  }

  /**
   * Check if a transition to the target phase is valid.
   */
  canTransition(to: GamePhase): boolean {
    const allowed = TRANSITIONS[this.currentPhase];
    return !!allowed && allowed.includes(to);
  }

  /**
   * Reset for a new match.
   */
  reset(): void {
    this.currentPhase = 'KICK_OFF';
    this.phaseCount = 0;
    this.phaseStartTime = Date.now();
  }
}
