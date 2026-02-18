/**
 * Team entity — manages a squad of 15 players.
 *
 * Handles formation positioning and basic AI movement
 * for non-controlled players.
 */
import Phaser from 'phaser';
import { Player } from './Player';
import { Ball } from './Ball';
import { Position, PITCH } from '../utils/Constants';
import { distance } from '../utils/MathHelpers';

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

export class Team {
  readonly side: 'home' | 'away';
  readonly color: number;
  readonly players: Player[] = [];

  constructor(scene: Phaser.Scene, side: 'home' | 'away', color: number) {
    this.side = side;
    this.color = color;

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

      const player = new Player(scene, x, y, pos, side, color);
      this.players.push(player);
    }
  }

  /**
   * Get a player by their positional number.
   */
  getPlayerByPosition(pos: Position): Player {
    const p = this.players.find((p) => p.position === pos);
    if (!p) throw new Error(`No player found for position ${pos}`);
    return p;
  }

  /**
   * Update all AI-controlled players on this team.
   * @param controlledPlayer If set, this player is human-controlled and skipped.
   */
  update(_delta: number, ball: Ball, controlledPlayer: Player | null): void {
    for (const player of this.players) {
      // Skip human-controlled player
      if (player === controlledPlayer) continue;

      // Skip grounded players
      if (player.isGrounded) continue;

      // ── Basic AI: move toward formation position ────
      // For now, players drift back to their formation spot
      // unless they are near the ball and need to react.

      const ballPos = { x: ball.sprite.x, y: ball.sprite.y };
      const playerPos = { x: player.sprite.x, y: player.sprite.y };
      const distToBall = distance(playerPos, ballPos);

      // Ball carrier AI
      if (player.hasBall) {
        // Simple: run forward (toward opponent try line)
        const targetX = this.side === 'home' ? PITCH.TRY_LINE_RIGHT : PITCH.TRY_LINE_LEFT;
        player.moveToward(targetX, player.sprite.y, 0.8);
        continue;
      }

      // Loose ball nearby — chase it
      if (ball.state === 'loose' && distToBall < 80) {
        player.moveToward(ballPos.x, ballPos.y, 1.0);

        // Pick up if close enough
        if (distToBall < 15 && !ball.carrier) {
          ball.attachToPlayer(player);
        }
        continue;
      }

      // Support the ball carrier (same team)
      if (ball.carrier && ball.carrier.teamSide === this.side && distToBall < 150) {
        // Run a support line slightly behind and to the side
        const offsetX = this.side === 'home' ? -30 : 30;
        const offsetY = (player.position % 2 === 0 ? 20 : -20);
        player.moveToward(ball.carrier.sprite.x + offsetX, ball.carrier.sprite.y + offsetY, 0.7);
        continue;
      }

      // Default: drift toward formation position
      player.moveToward(player.formationX, player.formationY, 0.4);
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
}
