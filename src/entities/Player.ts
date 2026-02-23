/**
 * Player entity — represents a single rugby player on the pitch.
 *
 * Each player has stats, a positional role, stamina, and can carry/pass/kick the ball.
 * Movement is driven either by human input or AI steering behaviors.
 */
import Phaser from 'phaser';
import { PLAYER, Direction, Position } from '../utils/Constants';
import { arrive, separation, blendForces } from '../ai/SteeringBehaviors';

/** Player stat profile */
export interface PlayerStats {
  speed: number;        // 0–100
  strength: number;
  handling: number;
  kicking: number;
  stamina: number;
  tackling: number;
  awareness: number;
  workRate: number;
}

/** Default stat profiles by position group */
const FORWARD_STATS: PlayerStats = {
  speed: 60, strength: 85, handling: 55, kicking: 40,
  stamina: 75, tackling: 80, awareness: 60, workRate: 80,
};

const BACK_STATS: PlayerStats = {
  speed: 82, strength: 60, handling: 80, kicking: 70,
  stamina: 80, tackling: 65, awareness: 80, workRate: 65,
};

/** Position-specific stat overrides */
const POSITION_STATS: Partial<Record<Position, Partial<PlayerStats>>> = {
  [Position.HOOKER]:           { handling: 70, kicking: 30 },
  [Position.OPENSIDE_FLANKER]: { speed: 72, tackling: 90, workRate: 90 },
  [Position.NUMBER_8]:         { speed: 70, strength: 88, handling: 65 },
  [Position.SCRUM_HALF]:       { speed: 80, strength: 55, handling: 88, kicking: 65, awareness: 88 },
  [Position.FLY_HALF]:         { speed: 78, handling: 90, kicking: 90, awareness: 90 },
  [Position.INSIDE_CENTRE]:    { speed: 80, strength: 75, handling: 78 },
  [Position.OUTSIDE_CENTRE]:   { speed: 85, strength: 70, handling: 80 },
  [Position.LEFT_WING]:        { speed: 92, handling: 75 },
  [Position.RIGHT_WING]:       { speed: 92, handling: 75 },
  [Position.FULLBACK]:         { speed: 85, kicking: 85, handling: 82, awareness: 85 },
};

let playerIdCounter = 0;

export class Player {
  readonly id: string;
  readonly position: Position;
  readonly teamSide: 'home' | 'away';
  readonly stats: PlayerStats;
  public team: any; // Circular dependency workaround

  sprite: Phaser.Physics.Arcade.Image;
  facing: Direction = Direction.E;
  stamina: number = 100;
  hasBall: boolean = false;
  isGrounded: boolean = false;
  isInRuck: boolean = false;

  /** Stored team tint so it can be restored after tackle */
  readonly teamTint: number;

  /** Position to return to when not actively involved */
  formationX: number = 0;
  formationY: number = 0;

  private scene: Phaser.Scene;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    position: Position,
    teamSide: 'home' | 'away',
    tint: number,
  ) {
    this.scene = scene;
    this.id = `player_${playerIdCounter++}`;
    this.position = position;
    this.teamSide = teamSide;
    this.teamTint = tint;
    this.formationX = x;
    this.formationY = y;

    // Build stats
    const isForward = position <= Position.NUMBER_8;
    const baseStats = isForward ? { ...FORWARD_STATS } : { ...BACK_STATS };
    const overrides = POSITION_STATS[position] ?? {};
    this.stats = { ...baseStats, ...overrides };
    this.stamina = this.stats.stamina;

    // Create sprite
    this.sprite = scene.physics.add.image(x, y, 'player');
    this.sprite.setTint(tint);
    // Center the circular physics body on the sprite
    // Texture is 20x20; radius=10 means offset=(0,0) centers correctly
    this.sprite.setCircle(PLAYER.BODY_RADIUS, 0, 0);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setDepth(1);
    this.sprite.setData('playerRef', this);

    // Number label
    const label = scene.add.text(x, y + 12, String(position), {
      fontSize: '7px',
      fontFamily: 'monospace',
      color: '#ffffff',
    }).setOrigin(0.5).setDepth(2);

    // Update label position in update
    scene.events.on('update', () => {
      label.setPosition(this.sprite.x, this.sprite.y + 12);
    });
  }

  /**
   * Move the player in a given direction.
   * Called by human input or AI.
   */
  moveInDirection(vx: number, vy: number, sprinting: boolean, _delta: number): void {
    if (this.isGrounded) {
      this.sprite.setVelocity(0, 0);
      return;
    }

    // Determine speed
    const baseSpeed = (this.stats.speed / 100) * PLAYER.RUN_SPEED * 100;
    let speed = baseSpeed;

    if (sprinting && this.stamina > PLAYER.STAMINA_MIN_SPRINT) {
      speed *= PLAYER.SPRINT_MULTIPLIER;
      this.stamina = Math.max(0, this.stamina - PLAYER.STAMINA_DRAIN_RATE);
    } else if (this.stamina < PLAYER.STAMINA_MIN_SPRINT) {
      speed *= PLAYER.LOW_STAMINA_SPEED_PENALTY;
    }

    // Recover stamina when not sprinting
    if (!sprinting) {
      this.stamina = Math.min(100, this.stamina + PLAYER.STAMINA_RECOVERY_RATE);
    }

    // Optional separation block if neighbors are tracked, but typically moveInDirection is user-controlled so we don't force separation.
    this.sprite.setVelocity(vx * speed, vy * speed);

    // Update facing direction
    if (vx !== 0 || vy !== 0) {
      this.facing = this.computeDirection(vx, vy);
    }
  }

  /**
   * Move toward a target position (used by AI).
   * Optional neighbors array provides separation.
   */
  moveToward(targetX: number, targetY: number, speedFactor: number = 1, neighbors: Player[] = []): void {
    const pos = { x: this.sprite.x, y: this.sprite.y };
    const dx = targetX - pos.x;
    const dy = targetY - pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 5) {
      this.sprite.setVelocity(0, 0);
      return;
    }

    const baseSpeed = (this.stats.speed / 100) * PLAYER.RUN_SPEED * 100 * speedFactor;
    
    let nx = dx / dist;
    let ny = dy / dist;
    
    // Apply soft separation if neighbors provided
    if (neighbors.length > 0) {
      const neighborPos = neighbors
        .filter(n => n !== this && !n.isGrounded && !n.isInRuck)
        .map(n => ({ x: n.sprite.x, y: n.sprite.y }));
        
      const sep = separation(pos, neighborPos, 40); // 40px desired separation
      
      // Blend 80% seek / 20% separation
      const totalForce = blendForces([
        { force: { x: nx * baseSpeed, y: ny * baseSpeed }, weight: 0.8 },
        { force: sep, weight: 0.2 }
      ], baseSpeed);
      
      this.sprite.setVelocity(totalForce.x, totalForce.y);
      this.facing = this.computeDirection(totalForce.x, totalForce.y);
    } else {
      this.sprite.setVelocity(nx * baseSpeed, ny * baseSpeed);
      this.facing = this.computeDirection(nx, ny);
    }
  }

  /**
   * Player receives a tackle.
   */
  getsTackled(): void {
    this.isGrounded = true;
    this.hasBall = false;
    this.sprite.setVelocity(0, 0);
    this.sprite.setTintFill(0xff4444); // Red flash

    this.scene.time.delayedCall(PLAYER.GROUNDED_DURATION, () => {
      this.isGrounded = false;
      this.sprite.setTint(this.teamTint); // Restore team colour
    });
  }

  /**
   * Stun the player for a short duration (recovery).
   */
  recover(durationMs: number): void {
    this.isGrounded = true;
    this.sprite.setVelocity(0, 0);
    this.sprite.setTint(0xaaaaaa);

    this.scene.time.delayedCall(durationMs, () => {
      this.isGrounded = false;
      this.sprite.setTint(this.teamTint); // Restore team colour
    });
  }

  /**
   * Pick up a loose ball.
   */
  pickUpBall(): void {
    this.hasBall = true;
  }

  /**
   * Release the ball (pass, kick, or knocked on).
   */
  releaseBall(): void {
    this.hasBall = false;
  }

  /**
   * Compute 8-directional direction from velocity components.
   */
  private computeDirection(vx: number, vy: number): Direction {
    const angle = Math.atan2(vy, vx) * (180 / Math.PI);
    if (angle >= -22.5 && angle < 22.5) return Direction.E;
    if (angle >= 22.5 && angle < 67.5) return Direction.SE;
    if (angle >= 67.5 && angle < 112.5) return Direction.S;
    if (angle >= 112.5 && angle < 157.5) return Direction.SW;
    if (angle >= 157.5 || angle < -157.5) return Direction.W;
    if (angle >= -157.5 && angle < -112.5) return Direction.NW;
    if (angle >= -112.5 && angle < -67.5) return Direction.N;
    return Direction.NE;
  }

  /**
   * Set player position directly.
   */
  setPosition(x: number, y: number): void {
    this.sprite.setPosition(x, y);
    this.formationX = x;
    this.formationY = y;
  }

  /**
   * Set player velocity directly.
   */
  setVelocity(x: number, y: number): void {
    this.sprite.setVelocity(x, y);
  }

  /**
   * AI Update: Calculate steering forces.
   */
  updateAI(_delta: number, neighbors: Player[], targetPos: { x: number, y: number }, weights?: { arrive?: number; separation?: number }): void {
    if (this.isGrounded || this.isInRuck) {
      this.sprite.setVelocity(0, 0);
      return;
    }

    const pos = { x: this.sprite.x, y: this.sprite.y };
    const maxSpeed = (this.stats.speed / 100) * PLAYER.RUN_SPEED * 100;

    // 1. Arrive at target (Formation)
    const arriveForce = arrive(pos, targetPos, maxSpeed, 50);

    // 2. Separation from neighbors (prevent bunching)
    const neighborPos = neighbors
      .filter(n => n !== this && !n.isGrounded && !n.isInRuck)
      .map(n => ({ x: n.sprite.x, y: n.sprite.y }));
    
    const separationForce = separation(pos, neighborPos, 60);

    // 3. Blend forces — higher separation weight keeps circles from overlapping
    const wArrive = weights?.arrive ?? 1.0;
    const wSep = weights?.separation ?? 3.0;

    const totalForce = blendForces([
      { force: arriveForce, weight: wArrive },
      { force: separationForce, weight: wSep }
    ], maxSpeed); 

    this.sprite.setVelocity(totalForce.x, totalForce.y);

    // Update facing
    if (totalForce.x !== 0 || totalForce.y !== 0) {
      this.facing = this.computeDirection(totalForce.x, totalForce.y);
    }
  }

  /**
   * Set player rotation.
   */
  setRotation(radians: number): void {
    this.sprite.setRotation(radians);
  }
}
