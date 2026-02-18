/**
 * ScoringSystem — detects tries, conversions, penalty goals, drop goals.
 *
 * Monitors ball position relative to in-goal areas and posts.
 * Triggers scoring events and manages the conversion/penalty kick mini-game.
 */

import { PITCH, SCORING } from '../utils/Constants';
import { EventBus } from '../utils/EventBus';
import type { Ball } from '../entities/Ball';

export interface ScoreState {
  home: number;
  away: number;
}

export class ScoringSystem {
  private score: ScoreState = { home: 0, away: 0 };
  private conversionPending = false;
  private conversionTeam: 'home' | 'away' = 'home';
  // @ts-ignore — stores try position for conversion mini-game placement
  private _conversionX = 0;

  getScore(): Readonly<ScoreState> {
    return this.score;
  }

  /**
   * Check if a try has been scored.
   * Ball carrier must be in the opponent's in-goal area.
   */
  checkTry(ball: Ball): { scored: boolean; team: 'home' | 'away' } | null {
    if (!ball.carrier) return null;

    const x = ball.sprite.x;
    const carrierTeam = ball.carrier.teamSide;

    // Home team attacks right → scores in right in-goal
    if (carrierTeam === 'home' && x >= PITCH.TRY_LINE_RIGHT) {
      this.awardTry('home', ball.sprite.y);
      return { scored: true, team: 'home' };
    }

    // Away team attacks left → scores in left in-goal
    if (carrierTeam === 'away' && x <= PITCH.TRY_LINE_LEFT) {
      this.awardTry('away', ball.sprite.y);
      return { scored: true, team: 'away' };
    }

    return null;
  }

  private awardTry(team: 'home' | 'away', yPos: number): void {
    this.score[team] += SCORING.TRY;
    this.conversionPending = true;
    this.conversionTeam = team;
    this._conversionX = yPos; // Conversion taken in line with where try scored
    EventBus.emit('score', { team, type: 'try', points: SCORING.TRY });
  }

  /**
   * Attempt a conversion after a try.
   * @param accuracy 0–1 how accurate the kick was
   * @param power 0–1 how powered
   * @param kickerStat kicker's kicking stat
   * @returns true if successful
   */
  attemptConversion(accuracy: number, power: number, kickerStat: number): boolean {
    if (!this.conversionPending) return false;
    this.conversionPending = false;

    const successChance = (kickerStat / 100) * accuracy * (power > 0.4 && power < 0.9 ? 1.0 : 0.6);
    const success = Math.random() < successChance;

    if (success) {
      this.score[this.conversionTeam] += SCORING.CONVERSION;
      EventBus.emit('score', { team: this.conversionTeam, type: 'conversion', points: SCORING.CONVERSION });
    }
    return success;
  }

  /**
   * Attempt a penalty goal.
   */
  attemptPenaltyGoal(team: 'home' | 'away', accuracy: number, power: number, kickerStat: number, distancePx: number): boolean {
    const distFactor = Math.max(0.3, 1 - distancePx / 600);
    const successChance = (kickerStat / 100) * accuracy * distFactor * (power > 0.4 && power < 0.85 ? 1.0 : 0.5);
    const success = Math.random() < successChance;

    if (success) {
      this.score[team] += SCORING.PENALTY_GOAL;
      EventBus.emit('score', { team, type: 'penalty', points: SCORING.PENALTY_GOAL });
    }
    return success;
  }

  /**
   * Attempt a drop goal.
   */
  attemptDropGoal(team: 'home' | 'away', kickerStat: number, distancePx: number): boolean {
    const distFactor = Math.max(0.2, 1 - distancePx / 500);
    const successChance = (kickerStat / 100) * 0.5 * distFactor;
    const success = Math.random() < successChance;

    if (success) {
      this.score[team] += SCORING.DROP_GOAL;
      EventBus.emit('score', { team, type: 'dropGoal', points: SCORING.DROP_GOAL });
    }
    return success;
  }

  isConversionPending(): boolean {
    return this.conversionPending;
  }

  getConversionTeam(): 'home' | 'away' {
    return this.conversionTeam;
  }

  reset(): void {
    this.score = { home: 0, away: 0 };
    this.conversionPending = false;
  }
}
