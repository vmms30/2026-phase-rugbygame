/**
 * Ball entity — the rugby ball.
 *
 * Handles passing (bezier arc), kicking (parabolic trajectory),
 * loose ball physics, and attachment to the carrier.
 */
import Phaser from 'phaser';
import { Player } from './Player';
import { BALL } from '../utils/Constants';
import { quadraticBezier, parabolicArc, vec2, distance as vecDist } from '../utils/MathHelpers';

type BallState = 'carried' | 'passing' | 'kicked' | 'loose';

export class Ball {
  sprite: Phaser.Physics.Arcade.Image;
  shadow: Phaser.GameObjects.Ellipse;
  state: BallState = 'loose';

  /** Current carrier (null when loose, passing, or kicked) */
  carrier: Player | null = null;

  // ── Pass interpolation ─────────────────────────────────
  private passStart = vec2(0, 0);
  private passControl = vec2(0, 0);
  private passEnd = vec2(0, 0);
  private passT = 0;
  private passSpeed = 0;
  private passTarget: Player | null = null;

  // ── Kick interpolation ─────────────────────────────────
  private kickStartPos = vec2(0, 0);
  private kickEndPos = vec2(0, 0);
  private kickT = 0;
  private kickDuration = 0;
  private kickMaxHeight = 0;
  private kickBounces = false;
  private kickBounceDeviation = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {


    // Ball sprite
    this.sprite = scene.physics.add.image(x, y, 'ball');
    this.sprite.setCircle(BALL.BODY_RADIUS);
    this.sprite.setDepth(3);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setBounce(0.6);

    // Shadow (for aerial kicks)
    this.shadow = scene.add.ellipse(x, y, 8, 4, 0x000000, 0.3);
    this.shadow.setDepth(0);
  }

  update(delta: number): void {
    const dt = delta / 1000;

    switch (this.state) {
      case 'carried':
        this.updateCarried();
        break;
      case 'passing':
        this.updatePassing(dt);
        break;
      case 'kicked':
        this.updateKicked(dt);
        break;
      case 'loose':
        this.updateLoose();
        break;
    }

    // Shadow always on ground at ball's x,y
    this.shadow.setPosition(this.sprite.x, this.sprite.y);
  }

  // ─────────────────────────────────────────────────────────
  // STATE HANDLERS
  // ─────────────────────────────────────────────────────────

  private updateCarried(): void {
    if (!this.carrier) {
      this.state = 'loose';
      return;
    }
    // Snap ball to carrier with slight offset in facing direction
    this.sprite.setPosition(this.carrier.sprite.x + 5, this.carrier.sprite.y);
    this.sprite.setVelocity(0, 0);
  }

  private updatePassing(dt: number): void {
    this.passT += dt * this.passSpeed;

    if (this.passT >= 1) {
      // Pass complete — snap to target
      this.passT = 1;
      this.sprite.setPosition(this.passEnd.x, this.passEnd.y);
      this.sprite.setVelocity(0, 0);

      if (this.passTarget) {
        // Check catch (simplified: always catch for now)
        this.attachToPlayer(this.passTarget);
      } else {
        this.state = 'loose';
      }
      return;
    }

    // Interpolate along bezier
    const pos = quadraticBezier(this.passStart, this.passControl, this.passEnd, this.passT);
    this.sprite.setPosition(pos.x, pos.y);
    this.sprite.setVelocity(0, 0);
  }

  private updateKicked(dt: number): void {
    this.kickT += dt / this.kickDuration;

    if (this.kickT >= 1) {
      this.kickT = 1;
      this.sprite.setPosition(this.kickEndPos.x, this.kickEndPos.y);
      this.sprite.setVelocity(0, 0);
      this.state = 'loose';

      // Apply some ground roll
      const dx = this.kickEndPos.x - this.kickStartPos.x;
      const dy = this.kickEndPos.y - this.kickStartPos.y;
      const mag = Math.sqrt(dx * dx + dy * dy);
      if (mag > 0) {
        let rollSpeed = 50;
        // Bouncing kicks (grubber) get extra random bounce
        if (this.kickBounces) {
          const devRad = (this.kickBounceDeviation * Math.PI) / 180;
          const bounceAngle = Math.atan2(dy, dx) + (Math.random() - 0.5) * devRad * 2;
          rollSpeed = 80;
          this.sprite.setVelocity(Math.cos(bounceAngle) * rollSpeed, Math.sin(bounceAngle) * rollSpeed);
        } else {
          this.sprite.setVelocity((dx / mag) * rollSpeed, (dy / mag) * rollSpeed);
        }
      }
      return;
    }

    // Linear x,y interpolation
    const x = this.kickStartPos.x + (this.kickEndPos.x - this.kickStartPos.x) * this.kickT;
    const y = this.kickStartPos.y + (this.kickEndPos.y - this.kickStartPos.y) * this.kickT;
    const height = parabolicArc(this.kickT, this.kickMaxHeight);

    // Position sprite elevated (y offset simulates height in top-down)
    this.sprite.setPosition(x, y - height);
    this.shadow.setPosition(x, y);
    this.sprite.setVelocity(0, 0);
  }

  private updateLoose(): void {
    // Friction on ground
    const vx = this.sprite.body?.velocity.x ?? 0;
    const vy = this.sprite.body?.velocity.y ?? 0;

    if (Math.abs(vx) > 0.5 || Math.abs(vy) > 0.5) {
      this.sprite.setVelocity(vx * BALL.FRICTION, vy * BALL.FRICTION);
    } else {
      this.sprite.setVelocity(0, 0);
    }

    // Check if any player picks it up (within range)
    // This will be handled by collision overlap in MatchScene later
  }

  // ─────────────────────────────────────────────────────────
  // ACTIONS
  // ─────────────────────────────────────────────────────────

  /**
   * Pass the ball from carrier to a target player.
   */
  passTo(from: Player, to: Player): void {
    from.releaseBall();
    this.carrier = null;

    this.passStart = vec2(from.sprite.x, from.sprite.y);
    this.passEnd = vec2(to.sprite.x, to.sprite.y);

    // Control point: midpoint raised for arc
    const midX = (this.passStart.x + this.passEnd.x) / 2;
    const midY = (this.passStart.y + this.passEnd.y) / 2;
    const dist = vecDist(this.passStart, this.passEnd);
    const arcHeight = Math.min(dist * 0.15, 30); // Short passes = flatter
    this.passControl = vec2(midX, midY - arcHeight);

    this.passT = 0;
    this.passSpeed = BALL.PASS_SPEED / Math.max(dist / 100, 0.5); // Faster for short passes
    this.passTarget = to;
    this.state = 'passing';
  }

  /**
   * Kick the ball from a player.
   * Power is 0–1.
   */
  kick(from: Player, power: number): void {
    from.releaseBall();
    this.carrier = null;

    const kickDist = (from.stats.kicking / 100) * 400 * power;
    const angle = this.facingToAngle(from.facing);

    this.kickStartPos = vec2(from.sprite.x, from.sprite.y);
    this.kickEndPos = vec2(
      from.sprite.x + Math.cos(angle) * kickDist,
      from.sprite.y + Math.sin(angle) * kickDist,
    );
    this.kickT = 0;
    this.kickDuration = 1.0 + (kickDist / 400) * 1.5; // Longer kicks take more time
    this.kickMaxHeight = kickDist * 0.15; // Higher arc for longer kicks
    this.kickBounces = false;
    this.kickBounceDeviation = 0;
    this.state = 'kicked';
  }

  /**
   * Kick the ball with detailed type parameters (M2 typed kicks).
   */
  kickWithType(
    from: Player, power: number, kickDist: number,
    endX: number, endY: number,
    arcHeight: number, flightDuration: number,
    bounces: boolean, bounceDeviation: number,
  ): void {
    from.releaseBall();
    this.carrier = null;

    this.kickStartPos = vec2(from.sprite.x, from.sprite.y);
    this.kickEndPos = vec2(endX, endY);
    this.kickT = 0;
    this.kickDuration = flightDuration * (0.5 + power * 0.5);
    this.kickMaxHeight = kickDist * arcHeight;
    this.kickBounces = bounces;
    this.kickBounceDeviation = bounceDeviation;
    this.state = 'kicked';
  }

  /**
   * Drop the ball loose at a position (e.g., after tackle / knock-on).
   */
  dropLoose(x: number, y: number): void {
    this.carrier?.releaseBall();
    this.carrier = null;
    this.state = 'loose';
    this.sprite.setPosition(x, y);
    // Random small velocity
    this.sprite.setVelocity(
      (Math.random() - 0.5) * 40,
      (Math.random() - 0.5) * 40,
    );
  }

  /**
   * Attach the ball to a player (pick up or catch).
   */
  attachToPlayer(player: Player): void {
    this.carrier = player;
    player.pickUpBall();
    this.state = 'carried';
    this.passTarget = null;
  }

  /**
   * Convert a Direction enum to an angle in radians.
   */
  facingToAngle(facing: string): number {
    const angles: Record<string, number> = {
      E: 0,
      SE: Math.PI / 4,
      S: Math.PI / 2,
      SW: (3 * Math.PI) / 4,
      W: Math.PI,
      NW: -(3 * Math.PI) / 4,
      N: -Math.PI / 2,
      NE: -Math.PI / 4,
    };
    return angles[facing] ?? 0;
  }
}
