/**
 * TeamAI — coach brain, runs every 0.5s to make tactical decisions.
 *
 * Selects formations, play calls, and kick decisions.
 * Drives the FormationManager and influences PlayerAI states.
 */

import { FormationManager, FormationType } from './FormationManager';
import { AI, PITCH } from '../utils/Constants';
import type { Team } from '../entities/Team';
import type { Ball } from '../entities/Ball';

export type PlayCall = 'CRASH_BALL' | 'SKIP_PASS' | 'SWITCH' | 'LOOP' | 'INSIDE_BALL' | 'KICK' | 'BOX_KICK' | 'GRUBBER' | 'DROP_GOAL_ATTEMPT';

export class TeamAI {
  readonly formationManager: FormationManager;
  // @ts-ignore — used by advanced AI queries in M5
  private _team: Team;
  private side: 'home' | 'away';
  private thinkTimer = 0;
  private currentPlay: PlayCall = 'CRASH_BALL';
  private riskAppetite = 0.5; // 0 = conservative, 1 = aggressive

  // Score-awareness
  private ownScore = 0;
  private opponentScore = 0;
  private gameMinutes = 0;

  constructor(team: Team, side: 'home' | 'away') {
    this._team = team;
    this.side = side;
    this.formationManager = new FormationManager();
  }

  /**
   * Update the team AI.
   * @param delta Frame delta ms
   * @param ball Ball reference
   * @param phaseCount Current phase count from PhaseManager
   */
  update(delta: number, ball: Ball, phaseCount: number): void {
    this.thinkTimer += delta;
    if (this.thinkTimer < AI.TEAM_THINK_INTERVAL) return;
    this.thinkTimer = 0;

    // Update formation manager with ball position
    this.formationManager.setBallPosition(ball.sprite.x);

    const hasPossession = ball.carrier?.teamSide === this.side;

    if (hasPossession) {
      this.decideAttack(ball, phaseCount);
    } else {
      this.decideDefense(ball);
    }
  }

  private decideAttack(ball: Ball, phaseCount: number): void {
    // Select formation
    if (this.riskAppetite > 0.7) {
      this.formationManager.setFormation(FormationType.WIDE_ATTACK);
    } else if (phaseCount > 5) {
      this.formationManager.setFormation(FormationType.NARROW_CRASH);
    } else {
      this.formationManager.setFormation(FormationType.STANDARD);
    }

    // Play call
    const ballX = ball.sprite.x;
    const inOwnHalf = this.side === 'home' ? ballX < PITCH.HALFWAY : ballX > PITCH.HALFWAY;
    const deep = this.side === 'home' ? ballX < PITCH.LINE_22_LEFT : ballX > PITCH.LINE_22_RIGHT;

    // Kick for territory if deep in own half or after many phases
    if (deep || phaseCount >= AI.KICK_PHASE_THRESHOLD) {
      this.currentPlay = 'KICK';
      return;
    }

    // Risk-weighted play selection
    const plays: PlayCall[] = ['CRASH_BALL', 'SKIP_PASS'];
    if (this.riskAppetite > 0.5) plays.push('SWITCH', 'LOOP');
    if (this.riskAppetite > 0.7) plays.push('INSIDE_BALL');
    if (inOwnHalf && Math.random() < 0.2) plays.push('BOX_KICK');

    // Trailing → more aggressive
    if (this.ownScore < this.opponentScore && this.gameMinutes > 60) {
      this.riskAppetite = Math.min(1.0, this.riskAppetite + 0.1);
    }

    this.currentPlay = plays[Math.floor(Math.random() * plays.length)];
  }

  private decideDefense(ball: Ball): void {
    const ballX = ball.sprite.x;
    const nearOwnLine = this.side === 'home'
      ? ballX < PITCH.LINE_22_LEFT + 50
      : ballX > PITCH.LINE_22_RIGHT - 50;

    if (nearOwnLine) {
      this.formationManager.setFormation(FormationType.BLITZ_DEFENSE);
    } else if (this.riskAppetite > 0.6) {
      this.formationManager.setFormation(FormationType.DRIFT_DEFENSE);
    } else {
      this.formationManager.setFormation(FormationType.STANDARD_DEFENSE);
    }
  }

  /** Update score context for decision-making */
  updateContext(ownScore: number, opponentScore: number, gameMinutes: number): void {
    this.ownScore = ownScore;
    this.opponentScore = opponentScore;
    this.gameMinutes = gameMinutes;

    // Adapt risk appetite based on situation
    if (ownScore < opponentScore) {
      this.riskAppetite = Math.min(1.0, 0.5 + (opponentScore - ownScore) * 0.05);
    } else if (ownScore > opponentScore) {
      this.riskAppetite = Math.max(0.2, 0.5 - (ownScore - opponentScore) * 0.03);
    }
  }

  getCurrentPlay(): PlayCall {
    return this.currentPlay;
  }

  getRiskAppetite(): number {
    return this.riskAppetite;
  }
}
