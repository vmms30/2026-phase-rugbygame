/**
 * Team entity — manages a squad of 15 players.
 *
 * Handles formation positioning and AI movement
 * for non-controlled players with proper rugby defense/attack behavior.
 */
import Phaser from 'phaser';
import { Player } from './Player';
import { Ball } from './Ball';
import { Position, PITCH, PLAYER, DIFFICULTY } from '../utils/Constants';
import type { DifficultyConfig } from '../utils/Constants';
import { distance } from '../utils/MathHelpers';
import { EventBus } from '../utils/EventBus';
import { resolveTackle } from '../components/Tackle';

/**
 * Default formation positions for attack (relative to halfway, normalized 0–1).
 * These are then scaled to actual pitch coordinates.
 */
const ATTACK_FORMATION: Record<Position, { rx: number; ry: number }> = {
  // Forwards
  [Position.LOOSEHEAD_PROP]:    { rx: 0.42, ry: 0.40 },
  [Position.HOOKER]:            { rx: 0.42, ry: 0.50 },
  [Position.TIGHTHEAD_PROP]:    { rx: 0.42, ry: 0.60 },
  [Position.LOCK_4]:            { rx: 0.40, ry: 0.44 },
  [Position.LOCK_5]:            { rx: 0.40, ry: 0.56 },
  [Position.BLINDSIDE_FLANKER]: { rx: 0.44, ry: 0.35 },
  [Position.OPENSIDE_FLANKER]:  { rx: 0.44, ry: 0.65 },
  [Position.NUMBER_8]:          { rx: 0.41, ry: 0.50 },

  // Backs
  [Position.SCRUM_HALF]:        { rx: 0.45, ry: 0.48 },
  [Position.FLY_HALF]:          { rx: 0.50, ry: 0.45 },
  [Position.LEFT_WING]:         { rx: 0.55, ry: 0.10 },
  [Position.INSIDE_CENTRE]:     { rx: 0.53, ry: 0.38 },
  [Position.OUTSIDE_CENTRE]:    { rx: 0.56, ry: 0.30 },
  [Position.RIGHT_WING]:        { rx: 0.55, ry: 0.90 },
  [Position.FULLBACK]:          { rx: 0.35, ry: 0.50 },
};

const DEFENSE_FORMATION: Record<Position, { rx: number; ry: number }> = {
  [Position.LOOSEHEAD_PROP]:    { rx: 0.55, ry: 0.42 },
  [Position.HOOKER]:            { rx: 0.55, ry: 0.50 },
  [Position.TIGHTHEAD_PROP]:    { rx: 0.55, ry: 0.58 },
  [Position.LOCK_4]:            { rx: 0.53, ry: 0.46 },
  [Position.LOCK_5]:            { rx: 0.53, ry: 0.54 },
  [Position.BLINDSIDE_FLANKER]: { rx: 0.56, ry: 0.35 },
  [Position.OPENSIDE_FLANKER]:  { rx: 0.56, ry: 0.65 },
  [Position.NUMBER_8]:          { rx: 0.54, ry: 0.50 },

  [Position.SCRUM_HALF]:        { rx: 0.57, ry: 0.48 },
  [Position.FLY_HALF]:          { rx: 0.60, ry: 0.45 },
  [Position.LEFT_WING]:         { rx: 0.62, ry: 0.08 },
  [Position.INSIDE_CENTRE]:     { rx: 0.62, ry: 0.35 },
  [Position.OUTSIDE_CENTRE]:    { rx: 0.63, ry: 0.25 },
  [Position.RIGHT_WING]:        { rx: 0.62, ry: 0.92 },
  [Position.FULLBACK]:          { rx: 0.70, ry: 0.50 },
};

export interface TeamStats {
  rating: number; // Overall team rating
  strength: number; // Pack strength
  speed: number;
  kicking: number;
  handling: number;
  color: number;
}

export class Team {
  readonly side: 'home' | 'away';
  readonly color: number;
  readonly scene: Phaser.Scene;
  readonly players: Player[] = [];

  /** Cooldown to prevent tackle spam (per player) */
  private tackleCooldowns = new Map<string, number>();

  /** Current difficulty configuration */
  private difficulty: DifficultyConfig = DIFFICULTY.MEDIUM;

  // AI / Tactics
  ruckAggression: number = 3; // 1-5, how many players commit to ruck
  
  // Average stats for quick access
  public avgStamina: number = 100;

  constructor(scene: Phaser.Scene, side: 'home' | 'away', stats: TeamStats) {
    this.scene = scene;
    this.side = side;
    this.color = stats.color;

    // Create all 15 players
    const formation = side === 'home' ? ATTACK_FORMATION : DEFENSE_FORMATION;

    const allPositions = [
      Position.LOOSEHEAD_PROP, Position.HOOKER, Position.TIGHTHEAD_PROP,
      Position.LOCK_4, Position.LOCK_5,
      Position.BLINDSIDE_FLANKER, Position.OPENSIDE_FLANKER, Position.NUMBER_8,
      Position.SCRUM_HALF, Position.FLY_HALF,
      Position.LEFT_WING, Position.INSIDE_CENTRE, Position.OUTSIDE_CENTRE,
      Position.RIGHT_WING, Position.FULLBACK,
    ];

    for (const pos of allPositions) {
      const f = formation[pos];
      let x: number, y: number;

      if (side === 'home') {
        // Home attacks right
        x = f.rx * PITCH.WIDTH_PX;
        y = f.ry * PITCH.HEIGHT_PX;
      } else {
        // Away attacks left — mirror horizontally
        x = (1 - f.rx) * PITCH.WIDTH_PX;
        y = f.ry * PITCH.HEIGHT_PX;
      }

      const player = new Player(scene, x, y, pos, side, this.color);
      player.team = this;
      this.players.push(player);
    }
  }

  /**
   * Get a player by their positional number.
   */
  getPlayerByPosition(pos: Position): Player {
    const p = this.players.find((pl) => pl.position === pos);
    if (!p) throw new Error(`No player found for position ${pos}`);
    return p;
  }

  /**
   * Update all AI-controlled players on this team.
   * @param controlledPlayer If set, this player is human-controlled and skipped.
   */
  update(delta: number, ball: Ball, controlledPlayer: Player | null): void {
    // Calculate average stamina
    let totalStamina = 0;
    for (const p of this.players) {
      totalStamina += p.stamina;
    }
    this.avgStamina = totalStamina / this.players.length;

    const weHaveBall = ball.carrier && ball.carrier.teamSide === this.side;
    const opponentHasBall = ball.carrier && ball.carrier.teamSide !== this.side;

    if (weHaveBall) {
      this.updateAttack(delta, ball, controlledPlayer);
    } else if (opponentHasBall) {
      this.updateDefense(delta, ball, controlledPlayer);
    } else {
      this.updateLooseBall(delta, ball, controlledPlayer);
    }
  }

  // ────────────────────────────────────────────────────────
  // DEFENSE AI — Proper rugby defensive line + auto-tackle
  // ────────────────────────────────────────────────────────

  /**
   * Defensive behavior:
   * - Flat line at ball carrier's X
   * - Drift 0.3x toward ball Y
   * - Designated tackler chases at 1.2x speed
   * - Fullback sweeps 80px behind line
   */
  private updateDefense(_delta: number, ball: Ball, controlledPlayer: Player | null): void {
    // 1. Formation handled by TeamAI

    // 2. Determine defensive line X (flat line)
    // We want to be on our side of the ball.
    if (!ball.carrier) return;

    const carrier = ball.carrier;
    const carrierX = carrier.sprite.x;
    const carrierY = carrier.sprite.y;

    // Our try line (the one we're defending)
    const ourTryLine = this.side === 'home' ? PITCH.TRY_LINE_LEFT : PITCH.TRY_LINE_RIGHT;
    // Defensive line sits slightly ahead of ball carrier, between them and our try line
    const defenseLineOffset = this.side === 'home' ? -40 : 40;
    const defenseLineX = carrierX + defenseLineOffset;

    // Gather available defenders
    const available: Player[] = [];
    for (const p of this.players) {
      if (p === controlledPlayer || p.isGrounded || p.isInRuck) continue;
      available.push(p);
    }
    if (available.length === 0) return;

    // Find designated tackler — closest defender to ball carrier
    let designatedTackler: Player | null = null;
    let closestDist = Infinity;
    for (const p of available) {
      const d = distance({ x: p.sprite.x, y: p.sprite.y }, { x: carrierX, y: carrierY });
      if (d < closestDist) {
        closestDist = d;
        designatedTackler = p;
      }
    }

    // Assign roles
    const fullback = available.find(p => p.position === Position.FULLBACK);
    const lineDefenders = available.filter(p =>
      p !== designatedTackler && p !== fullback
    );

    // 1. DESIGNATED TACKLER — Sprint toward ball carrier
    if (designatedTackler) {
      // designatedTackler.moveToward(carrierX, carrierY, 1.2);
       designatedTackler.updateAI(0, available, { x: carrierX, y: carrierY }); 
       // Note: updateAI calculates force based on maxSpeed. We might need to boost maxSpeed for sprint?
       // For now, let's rely on standard stats. The 1.2x was a cheat.
       // We can temporarily boost stats? Or just let standard stats apply.
       // Let's stick to standard stats for now to see if natural speed separation works.

      // AUTO-TACKLE: If in range, attempt tackle
      const tacklerDist = distance(
        { x: designatedTackler.sprite.x, y: designatedTackler.sprite.y },
        { x: carrierX, y: carrierY }
      );
      if (tacklerDist < PLAYER.TACKLE_RANGE && designatedTackler !== controlledPlayer) {
        this.attemptAITackle(designatedTackler, carrier, ball);
      }
    }

    // 2. DEFENSIVE LINE — Flat line with proper spacing
    const sortedDefenders = [...lineDefenders].sort(
      (a, b) => a.sprite.y - b.sprite.y
    );
    const lineCount = sortedDefenders.length;
    const pitchTop = 30;
    const pitchBottom = PITCH.HEIGHT_PX - 30;
    const spacing = lineCount > 0 ? (pitchBottom - pitchTop) / (lineCount + 1) : 0;

    for (let i = 0; i < sortedDefenders.length; i++) {
      const defender = sortedDefenders[i];
      const channelY = pitchTop + spacing * (i + 1);

      // Drift toward ball carrier Y, but maintain channel spacing
      const driftFactor = 0.3;
      const targetY = channelY + (carrierY - channelY) * driftFactor;

      // X position: stay on defensive line, clamped
      const minX = Math.min(ourTryLine, defenseLineX);
      const maxX = Math.max(ourTryLine, defenseLineX);
      const targetX = Math.max(minX, Math.min(maxX, defenseLineX));

      // defender.moveToward(targetX, targetY, 0.7);
      defender.updateAI(0, sortedDefenders, { x: targetX, y: targetY });

      // Second tackler — if very close to carrier, also tackle
      const dist = distance(
        { x: defender.sprite.x, y: defender.sprite.y },
        { x: carrierX, y: carrierY }
      );
      if (dist < PLAYER.TACKLE_RANGE * 1.2 && defender !== controlledPlayer) {
        this.attemptAITackle(defender, carrier, ball);
      }
    }

    // 3. FULLBACK SWEEPER — Hang back behind defensive line
    if (fullback && fullback !== controlledPlayer && fullback !== designatedTackler) {
      const sweepOffset = this.side === 'home' ? -80 : 80;
      const sweepX = defenseLineX + sweepOffset;
      const sweepY = carrierY * 0.6 + (PITCH.HEIGHT_PX / 2) * 0.4;
      // fullback.moveToward(sweepX, sweepY, 0.6);
      fullback.updateAI(0, available, { x: sweepX, y: sweepY });
    }
  }

  // ────────────────────────────────────────────────────────
  // ATTACK AI — Support lines with depth and width
  // ────────────────────────────────────────────────────────

  private updateAttack(_delta: number, ball: Ball, controlledPlayer: Player | null): void {
    if (!ball.carrier) return;

    for (const player of this.players) {
      if (player === controlledPlayer || player.isGrounded || player.isInRuck) continue;

      // Ball carrier AI — run forward with slight weave
      if (player.hasBall) {
        const targetX = this.side === 'home' ? PITCH.TRY_LINE_RIGHT : PITCH.TRY_LINE_LEFT;
        const weaveY = player.sprite.y + Math.sin(Date.now() / 600) * 20;
        // player.moveToward(targetX, weaveY, 0.85);
        player.updateAI(0, this.players, { x: targetX, y: weaveY });
        continue;
      }

      // Support runner logic handled by TeamAI
      // We just move toward our assigned formation position
      // player.moveToward(player.formationX, player.formationY, speed);
      player.updateAI(0, this.players, { x: player.formationX, y: player.formationY });
    }
  }

  // ────────────────────────────────────────────────────────
  // LOOSE BALL — Contest for possession
  // ────────────────────────────────────────────────────────

  private updateLooseBall(_delta: number, ball: Ball, controlledPlayer: Player | null): void {
    const ballPos = { x: ball.sprite.x, y: ball.sprite.y };
    let chaserCount = 0;
    const MAX_CHASERS = 3;

    const sortedByDist = [...this.players]
      .filter(p => p !== controlledPlayer && !p.isGrounded && !p.isInRuck)
      .sort((a, b) =>
        distance({ x: a.sprite.x, y: a.sprite.y }, ballPos) -
        distance({ x: b.sprite.x, y: b.sprite.y }, ballPos)
      );

    for (const player of sortedByDist) {
      const distToBall = distance({ x: player.sprite.x, y: player.sprite.y }, ballPos);

      if (chaserCount < MAX_CHASERS && distToBall < 200) {
        // player.moveToward(ballPos.x, ballPos.y, 1.0);
        player.updateAI(0, sortedByDist, { x: ballPos.x, y: ballPos.y });
        chaserCount++;

        if (distToBall < 15 && !ball.carrier && ball.state === 'loose') {
          ball.attachToPlayer(player);
        }
      } else {
        // player.moveToward(player.formationX, player.formationY, 0.4);
        player.updateAI(0, this.players, { x: player.formationX, y: player.formationY });
      }
    }
  }

  // ────────────────────────────────────────────────────────
  // AI AUTO-TACKLE
  // ────────────────────────────────────────────────────────

  attemptAITackle(tackler: Player, carrier: Player, ball: Ball): void {
    const now = Date.now();
    const lastTackle = this.tackleCooldowns.get(tackler.id) ?? 0;
    if (now - lastTackle < 1500) return; // 1.5s cooldown

    if (tackler.isGrounded || tackler.isInRuck || carrier.isGrounded) return;

    const carrierSprinting = Math.abs(carrier.sprite.body?.velocity?.x ?? 0) > 100 ||
                             Math.abs(carrier.sprite.body?.velocity?.y ?? 0) > 100;

    // Apply difficulty modifier to tackler's stats if they are AI
    const tacklerStats = { ...tackler.stats };
    // If tackler is on this team (AI), apply difficulty bonus/penalty
    // Note: Human player is on 'home' team usually, but 'controlledPlayer' check handles human input.
    // This method is called for AI tackles.
    tacklerStats.tackling += this.difficulty.tackleBonus;

    const result = resolveTackle(tacklerStats, carrier.stats, carrierSprinting, false);
    this.tackleCooldowns.set(tackler.id, now);

    EventBus.emit('tackle', {
      tacklerId: tackler.id,
      carrierId: carrier.id,
      outcome: result.outcome,
    });

    switch (result.outcome) {
      case 'dominant':
        carrier.getsTackled();
        tackler.isGrounded = true;
        setTimeout(() => { tackler.isGrounded = false; }, result.tacklerRecoveryMs);
        if (carrier.hasBall) {
          carrier.releaseBall();
          ball.dropLoose(carrier.sprite.x, carrier.sprite.y);
        }
        break;

      case 'normal':
        carrier.getsTackled();
        tackler.isGrounded = true;
        setTimeout(() => { tackler.isGrounded = false; }, result.tacklerRecoveryMs);
        if (carrier.hasBall) {
          carrier.releaseBall();
          ball.dropLoose(carrier.sprite.x, carrier.sprite.y);
        }
        break;

      case 'missed':
        tackler.sprite.setVelocity(0, 0);
        tackler.isGrounded = true;
        setTimeout(() => { tackler.isGrounded = false; }, result.tacklerRecoveryMs);
        break;

      case 'fendOff':
        tackler.sprite.setVelocity(0, 0);
        tackler.isGrounded = true;
        setTimeout(() => { tackler.isGrounded = false; }, result.tacklerRecoveryMs);
        break;
    }
  }

  /**
   * Set the team to attack formation positions.
   */
  setAttackFormation(): void {
    for (const player of this.players) {
      const f = ATTACK_FORMATION[player.position];
      if (this.side === 'home') {
        player.formationX = f.rx * PITCH.WIDTH_PX;
        player.formationY = f.ry * PITCH.HEIGHT_PX;
      } else {
        player.formationX = (1 - f.rx) * PITCH.WIDTH_PX;
        player.formationY = f.ry * PITCH.HEIGHT_PX;
      }
    }
  }

  /**
   * Set the team to defense formation positions.
   */
  setDefenseFormation(): void {
    for (const player of this.players) {
      const f = DEFENSE_FORMATION[player.position];
      if (this.side === 'home') {
        player.formationX = f.rx * PITCH.WIDTH_PX;
        player.formationY = f.ry * PITCH.HEIGHT_PX;
      } else {
        player.formationX = (1 - f.rx) * PITCH.WIDTH_PX;
        player.formationY = f.ry * PITCH.HEIGHT_PX;
      }
    }
  }

  /**
   * Update difficulty configuration.
   */
  setDifficulty(config: DifficultyConfig): void {
    this.difficulty = config;
  }

  /**
   * AI requests a drop goal.
   */
  requestDropGoal(player: Player): void {
    if ((this.scene as any).attemptDropGoal) {
      (this.scene as any).attemptDropGoal(player);
    }
  }

  /**
   * Find the closest teammate to a position, optionally excluding specific players.
   */
  getClosestPlayer(x: number, y: number, exclude: Player[] = []): Player | null {
    let closest: Player | null = null;
    let minDist = Infinity;

    for (const p of this.players) {
      if (exclude.includes(p)) continue;
      const d = Phaser.Math.Distance.Between(x, y, p.sprite.x, p.sprite.y);
      if (d < minDist) {
        minDist = d;
        closest = p;
      }
    }
    return closest;
  }
  /**
   * Set players for Kickoff Chase (Kicking Team).
   * Kicker (Fly Half) at center.
   * Chasers spread along the line.
   */
  setKickoffChaseFormation(): void {
    const startX = PITCH.HALFWAY;
    const direction = this.side === 'home' ? 1 : -1;
    
    // Kicker (10) is handled by KickoffSystem (placed at ball).
    // Others line up behind 10m line? No, behind halfway.
    // Let's space them out across the width.
    
    const spacing = PITCH.HEIGHT_PX / (this.players.length + 1);
    
    let index = 0;
    for (const player of this.players) {
      if (player.position === Position.FLY_HALF) continue; // Skip kicker
      
      const y = spacing * (index + 1);
      // Slightly behind halfway to be onside
      const x = startX - (50 * direction); 
      
      player.setPosition(x, y);
      player.setRotation(this.side === 'home' ? 0 : Math.PI);
      player.setVelocity(0, 0);
      index++;
    }
  }

  /**
   * Set players for Kickoff Receive (Receiving Team).
   * Forwards in pods for lifting/catching (10m line).
   * Backs deep covering kicks.
   */
  setKickoffReceiveFormation(): void {
    const direction = this.side === 'home' ? 1 : -1;
    // 10m line for this team
    const tenMeterLine = this.side === 'home' ? PITCH.LINE_10_LEFT : PITCH.LINE_10_RIGHT; 
    // 22m line 
    const twentyTwoLine = this.side === 'home' ? PITCH.LINE_22_LEFT : PITCH.LINE_22_RIGHT;

    // Forwards (1-8) at 10m line waiting for short kick
    const forwards = [1,2,3,4,5,6,7,8];
    const backs = [9,10,11,12,13,14,15];

    let fIndex = 0;
    for (const pos of forwards) {
      const p = this.getPlayerByPosition(pos as any);
      const y = (PITCH.HEIGHT_PX / 9) * (fIndex + 1);
      // Stand 5m behind 10m line
      const x = tenMeterLine - (50 * direction); // if Home (attacks right), 10mLeft is x=600. home side is < 600. wait.
      // If Home attacks Right, Home defends Left.
      // Home 10m line is 600. Offside is > 600? No. 
      // Kickoff comes from center (700). 
      // Receiving team stands on their side of 10m.
      // If Home receiving (defending Left side), kickoff from 700. 10m line is 600. Ball must cross 600.
      // Home players stand at ~500-600.
      
      // Let's just use explicit logic based on side
      // Home receives: Ball typically lands between 600 and 0.
      // Away receives: Ball typically lands between 800 and 1400.
      
      // We place forwards near the 10m line (most common contest point)
      // Backs deep.
      
      p.setPosition(x, y);
      p.setRotation(this.side === 'home' ? 0 : Math.PI); 
      p.setVelocity(0, 0);
      fIndex++;
    }

    // Backs scattered deep (22m to 50m)
    let bIndex = 0;
    for (const pos of backs) {
       const p = this.getPlayerByPosition(pos as any);
       const y = (PITCH.HEIGHT_PX / 8) * (bIndex + 1);
       const x = twentyTwoLine; // On the 22
       
       p.setPosition(x, y);
       p.setRotation(this.side === 'home' ? 0 : Math.PI);
       p.setVelocity(0, 0);
       bIndex++;
    }
  }

  /**
   * Helper to set position directly for formation
   */
  // private setPlayerPos(pos: Position, x: number, y: number) {
  //     const p = this.getPlayerByPosition(pos);
  //     p.setPosition(x, y);
  //     p.setVelocity(0,0);
  // }
}
