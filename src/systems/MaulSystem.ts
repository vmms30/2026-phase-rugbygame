/**
 * MaulSystem — handles maul formation, progression, and resolution.
 *
 * A maul forms when a ball carrier is held up (stays on feet) and
 * a supporting teammate arrives within 1 second. The maul then
 * progresses forward based on attacking vs defending strength ratio.
 */

import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Ball } from '../entities/Ball';
import { EventBus } from '../utils/EventBus';

interface MaulState {
  active: boolean;
  x: number;
  y: number;
  carrier: Player | null;
  attackers: Player[];
  defenders: Player[];
  startTime: number;
  /** Direction of maul movement: 1 = right, -1 = left */
  direction: 1 | -1;
}

export class MaulSystem {
  private state: MaulState = {
    active: false, x: 0, y: 0,
    carrier: null, attackers: [], defenders: [],
    startTime: 0, direction: 1,
  };
  // @ts-ignore — used for delayed calls and particle effects
  private scene: Phaser.Scene;

  /** Maul collapses after this duration (ms) */
  private static readonly MAX_DURATION = 8000;
  /** Crawl speed when maul is moving (px/s) */
  private static readonly CRAWL_SPEED = 20;
  /** Stall timer — if no progress for this long, collapse */
  private static readonly STALL_TIMEOUT = 3000;
  private stallTimer = 0;
  private lastX = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Start a maul at the given position.
   * @param carrier The ball carrier
   * @param attacker The supporting attacker
   * @param attacksRight Whether the attacking team attacks to the right
   */
  startMaul(carrier: Player, tackler: Player, attacker: Player, attacksRight: boolean): void {
    this.state = {
      active: true,
      x: carrier.sprite.x,
      y: carrier.sprite.y,
      carrier,
      attackers: [carrier, attacker],
      defenders: [tackler],
      startTime: Date.now(),
      direction: attacksRight ? 1 : -1,
    };
    this.lastX = this.state.x;
    this.stallTimer = 0;

    // Lock carrier + attacker + defender in maul
    carrier.isInRuck = true;
    attacker.isInRuck = true;
    tackler.isInRuck = true;

    EventBus.emit('ruckFormed', { x: this.state.x, y: this.state.y, attackingTeam: carrier.teamSide });
  }

  /** Commit a player to the maul */
  commitPlayer(player: Player, isAttacker: boolean): void {
    if (!this.state.active) return;
    player.isInRuck = true;
    if (isAttacker) {
      this.state.attackers.push(player);
    } else {
      this.state.defenders.push(player);
    }
  }

  isActive(): boolean {
    return this.state.active;
  }

  getState(): Readonly<MaulState> {
    return this.state;
  }

  /**
   * Update the maul each frame.
   */
  update(delta: number, ball: Ball): void {
    if (!this.state.active) return;

    const elapsed = Date.now() - this.state.startTime;

    // Timeout — collapse
    if (elapsed > MaulSystem.MAX_DURATION) {
      this.collapse();
      return;
    }

    // Calculate push strength
    const atkStrength = this.state.attackers.reduce((sum, p) => sum + p.stats.strength, 0);
    const defStrength = this.state.defenders.reduce((sum, p) => sum + p.stats.strength, 0);
    const ratio = defStrength > 0 ? atkStrength / defStrength : 2.0;

    // Defense overpowering — collapse if ratio < 0.8 for STALL_TIMEOUT
    if (ratio < 0.8) {
      this.stallTimer += delta;
      if (this.stallTimer > MaulSystem.STALL_TIMEOUT) {
        this.collapse();
        return;
      }
    } else {
      this.stallTimer = 0;
    }

    // Movement: crawl forward based on ratio
    if (ratio > 1.0) {
      const moveSpeed = MaulSystem.CRAWL_SPEED * ratio * (delta / 1000);
      this.state.x += moveSpeed * this.state.direction;

      // Move all maul participants
      for (const p of [...this.state.attackers, ...this.state.defenders]) {
        p.sprite.x = this.state.x + (Math.random() - 0.5) * 20;
      }

      // Move ball with maul
      ball.sprite.setPosition(this.state.x, this.state.y);
    }

    // Stall check — if barely moved
    if (Math.abs(this.state.x - this.lastX) < 0.1) {
      this.stallTimer += delta;
      if (this.stallTimer > MaulSystem.STALL_TIMEOUT) {
        this.collapse();
        return;
      }
    } else {
      this.lastX = this.state.x;
    }
  }

  /** Maul collapses — awards a scrum */
  private collapse(): void {
    this.endMaul();
    EventBus.emit('ruckTimeout', { x: this.state.x, y: this.state.y });
  }

  /** End the maul and release all players */
  endMaul(): void {
    for (const p of [...this.state.attackers, ...this.state.defenders]) {
      p.isInRuck = false;
    }
    this.state.active = false;
    this.state.attackers = [];
    this.state.defenders = [];
    this.state.carrier = null;
  }

  /** Ball emerges from back of maul — attacking team retains */
  releaseBall(): void {
    // Read state BEFORE endMaul() clears it
    const x = this.state.x;
    const y = this.state.y;
    const attackingTeam = this.state.carrier?.teamSide ?? 'home';
    this.endMaul();
    EventBus.emit('ruckBallAvailable', { x, y, attackingTeam });
  }

  reset(): void {
    this.endMaul();
    this.stallTimer = 0;
  }
}
