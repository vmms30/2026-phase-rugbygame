/**
 * RuckSystem — manages ruck formation, contest, and resolution.
 *
 * When a tackle occurs and the ball is presented, a ruck zone forms.
 * Nearby players auto-commit, and a tug-of-war contest ticks every 300 ms
 * until one side wins or the ruck times out.
 */

import Phaser from 'phaser';
import type { Player } from '../entities/Player';
import { RUCK } from '../utils/Constants';
import type { DifficultyConfig } from '../utils/Constants';
import { DIFFICULTY } from '../utils/Constants';
import { EventBus } from '../utils/EventBus';

export interface RuckState {
  /** Is a ruck currently active? */
  active: boolean;
  /** Centre position of the ruck */
  x: number;
  y: number;
  /** Which team is attacking (was carrying the ball) */
  attackingTeam: 'home' | 'away';
  /** Players committed by each team */
  attackers: Player[];
  defenders: Player[];
  /** Running dominance score (positive = attack winning) */
  dominance: number;
  /** Time of ruck formation */
  startTime: number;
  /** Whether the ball is available for pickup */
  ballAvailable: boolean;
}

export class RuckSystem {
  private state: RuckState = {
    active: false,
    x: 0, y: 0,
    attackingTeam: 'home',
    attackers: [], defenders: [],
    dominance: 0,
    startTime: 0,
    ballAvailable: false,
  };
  private tickTimer: number = 0;
  private scene: Phaser.Scene;
  private ruckZone: Phaser.GameObjects.Arc | null = null;
  private difficulty: DifficultyConfig = DIFFICULTY.MEDIUM;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Form a ruck at the given position */
  startRuck(x: number, y: number, attackingTeam: 'home' | 'away' = 'home'): void {
    this.state = {
      active: true,
      x, y,
      attackingTeam,
      attackers: [],
      defenders: [],
      dominance: 0,
      startTime: Date.now(),
      ballAvailable: false,
    };
    this.tickTimer = 0;

    // Draw ruck zone visually
    this.ruckZone = this.scene.add.circle(x, y, RUCK.ZONE_RADIUS, 0xffa500, 0.15);
    this.ruckZone.setStrokeStyle(2, 0xffa500, 0.5);
    this.ruckZone.setDepth(1);

    EventBus.emit('ruckFormed', { x, y, attackingTeam });
  }

  /** Commit a player to the ruck */
  commitPlayer(player: Player, isAttacker: boolean): void {
    if (!this.state.active) return;
    const list = isAttacker ? this.state.attackers : this.state.defenders;

    // Don't double-commit
    if (list.includes(player)) return;

    // Max 5 players per side in ruck
    if (list.length >= 5) return;

    list.push(player);
  }

  /**
   * Update the ruck contest — call once per frame.
   * @param delta Frame delta in ms
   */
  update(delta: number): void {
    if (!this.state.active) return;

    this.tickTimer += delta;

    // Contest tick
    if (this.tickTimer >= RUCK.TICK_INTERVAL) {
      this.tickTimer -= RUCK.TICK_INTERVAL;
      this.contestTick();
    }

    // Timeout check
    if (Date.now() - this.state.startTime > RUCK.TIMEOUT) {
      this.resolveTimeout();
    }
  }

  /** Calculate one contest tick */
  private contestTick(): void {
    const atkPower = this.state.attackers.reduce(
      (sum, p) => sum + (p.stats.strength + p.stats.workRate) / 200, 0
    );
    const defPower = this.state.defenders.reduce(
      (sum, p) => sum + (p.stats.strength + p.stats.workRate) / 200, 0
    ) * this.difficulty.ruckStrengthModifier;

    // Ensure at least some base power — minimum so dominance always climbs
    const atkTotal = Math.max(atkPower, 0.4);  // Guaranteed minimum even with 0 committed
    const defTotal = Math.max(defPower, 0.15);

    this.state.dominance += (atkTotal - defTotal) * 0.5;

    // Ball becomes available when attack dominance exceeds threshold
    if (this.state.dominance > RUCK.RELEASE_THRESHOLD && !this.state.ballAvailable) {
      this.state.ballAvailable = true;
      EventBus.emit('ruckBallAvailable', {
        x: this.state.x,
        y: this.state.y,
        attackingTeam: this.state.attackingTeam,
      });
    }

    // Turnover: defense completely dominates
    if (this.state.dominance < -RUCK.RELEASE_THRESHOLD) {
      const losingTeam: 'home' | 'away' = this.state.attackingTeam === 'home' ? 'away' : 'home';
      EventBus.emit('ruckTurnover', {
        x: this.state.x,
        y: this.state.y,
        attackingTeam: losingTeam,  // The new attacker is the former defender
      });
      this.endRuck();
    }

    // Infringement check (random, weighted by awareness)
    this.checkInfringements();
  }

  /** Set difficulty config for ruck strength scaling */
  setDifficulty(config: DifficultyConfig): void {
    this.difficulty = config;
  }

  /** Random infringement check during ruck */
  private checkInfringements(): void {
    // Small chance of penalty each tick
    const penaltyChance = 0.02; // 2% per tick

    if (Math.random() < penaltyChance) {
      const types = ['hands_in_ruck', 'not_releasing', 'offside_at_ruck'];
      const type = types[Math.floor(Math.random() * types.length)];
      EventBus.emit('penaltyAwarded', {
        x: this.state.x,
        y: this.state.y,
        reason: type,
        // Alternate between teams — simplified
        againstAttack: Math.random() < 0.4,
      });
      this.endRuck();
    }
  }

  /** Ruck timed out — award scrum */
  private resolveTimeout(): void {
    EventBus.emit('ruckTimeout', {
      x: this.state.x,
      y: this.state.y,
    });
    this.endRuck(); // Ensure players are released from ruck bounds
  }

  /** Clean up ruck state */
  endRuck(): void {
    // Release all committed players
    for (const p of [...this.state.attackers, ...this.state.defenders]) {
      p.isInRuck = false;
    }

    this.state.active = false;
    this.state.attackers = [];
    this.state.defenders = [];
    this.state.dominance = 0;
    this.state.ballAvailable = false;

    if (this.ruckZone) {
      this.ruckZone.destroy();
      this.ruckZone = null;
    }
  }

  /** Get current ruck state (read-only) */
  getState(): Readonly<RuckState> {
    return this.state;
  }

  /** Is the ruck active? */
  isActive(): boolean {
    return this.state.active;
  }

  /** Is the ball available at the ruck? */
  isBallAvailable(): boolean {
    return this.state.ballAvailable;
  }

  /** Which team is attacking at this ruck? */
  getAttackingTeam(): 'home' | 'away' {
    return this.state.attackingTeam;
  }
}
