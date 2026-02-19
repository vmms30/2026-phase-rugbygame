/**
 * PenaltySystem — detects infringements and manages advantage.
 *
 * Infringement types: offside, hands_in_ruck, not_releasing,
 * high_tackle, obstruction, collapsing_scrum.
 */

import { EventBus } from '../utils/EventBus';

export type InfringementType =
  | 'offside'
  | 'hands_in_ruck'
  | 'not_releasing'
  | 'high_tackle'
  | 'obstruction'
  | 'collapsing_scrum'
  | 'collapsing_scrum'
  | 'offside_at_ruck'
  | 'early_engagement';

export type PenaltySeverity = 'penalty' | 'free_kick';

export type PenaltyOption = 'kick_at_goal' | 'kick_to_touch' | 'scrum' | 'tap_and_go';

export interface PenaltyState {
  active: boolean;
  x: number;
  y: number;
  infringement: InfringementType;
  againstTeam: 'home' | 'away';
  advantagePlaying: boolean;
  advantageStartX: number;
  severity: PenaltySeverity;
}

export class PenaltySystem {
  private state: PenaltyState = {
    active: false, x: 0, y: 0,
    infringement: 'offside',
    againstTeam: 'home',
    advantagePlaying: false,
    advantageStartX: 0,
    severity: 'penalty',
  };

  /**
   * Signal an infringement.
   * If advantage is applicable, play continues until gain or no gain.
   */
  signalInfringement(
    type: InfringementType,
    x: number, y: number,
    againstTeam: 'home' | 'away',
    playAdvantage: boolean = true,
  ): void {
    if (this.state.active) return; // Don't stack penalties

    const severity: PenaltySeverity = (type === 'early_engagement') ? 'free_kick' : 'penalty';

    this.state = {
      active: true, x, y,
      infringement: type,
      againstTeam,
      advantagePlaying: playAdvantage,
      advantageStartX: x,
      severity,
    };

    if (!playAdvantage) {
      this.awardPenalty();
    }

    EventBus.emit('penaltyAwarded', { 
       x, y, 
       reason: type, 
       againstAttack: againstTeam === 'home',
       severity 
    });
  }

  /**
   * Check if advantage has been gained.
   * @param currentBallX Current ball x position
   * @param benefitTeam Team that would benefit
   * @returns true if advantage has been gained (10m+ territory)
   */
  checkAdvantageGained(currentBallX: number, benefitTeam: 'home' | 'away'): boolean {
    if (!this.state.advantagePlaying) return false;

    const gained = benefitTeam === 'home'
      ? currentBallX - this.state.advantageStartX > 100  // 10m forward
      : this.state.advantageStartX - currentBallX > 100;

    if (gained) {
      this.state.active = false;
      this.state.advantagePlaying = false;
      return true;
    }
    return false;
  }

  /**
   * Advantage over, no gain → award penalty at original mark.
   */
  advantageOver(): void {
    if (this.state.advantagePlaying) {
      this.state.advantagePlaying = false;
      this.awardPenalty();
    }
  }

  private awardPenalty(): void {
    // Penalty is now stoppable — awaiting team choice
    EventBus.emit('whistle', { type: 'short' });
  }

  /**
   * Team selects a penalty option.
   */
  selectOption(_option: PenaltyOption): void {
    this.state.active = false;
    // The option handling is done by MatchScene/PhaseManager
  }

  getState(): Readonly<PenaltyState> {
    return this.state;
  }

  isActive(): boolean {
    return this.state.active;
  }

  reset(): void {
    this.state.active = false;
    this.state.advantagePlaying = false;
  }
}
