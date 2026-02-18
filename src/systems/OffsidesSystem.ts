/**
 * OffsidesSystem — tracks and enforces offside lines.
 *
 * Tracks offside at rucks, scrums, lineouts, and in general play.
 * AI players respect the line; infringements trigger penalties.
 */

import type { Player } from '../entities/Player';

export class OffsidesSystem {
  private ruckOffsideLine = 0;
  private generalOffsideLine = 0;
  private isRuckActive = false;

  /**
   * Set the offside line at a ruck/maul.
   * The line is the x-coordinate of the hindmost foot of the last player.
   */
  setRuckOffsideLine(x: number, _attackingRight: boolean): void {
    this.ruckOffsideLine = x;
    this.isRuckActive = true;
  }

  /**
   * Set the general play offside line (behind last player who played the ball).
   */
  setGeneralOffsideLine(x: number): void {
    this.generalOffsideLine = x;
  }

  clearRuckOffside(): void {
    this.isRuckActive = false;
  }

  /**
   * Check if a defending player is offside.
   * @param player The defender to check
   * @param teamAttacksRight Whether the defending team's opponents attack right
   * @returns true if offside
   */
  isPlayerOffside(player: Player, teamAttacksRight: boolean): boolean {
    const px = player.sprite.x;

    if (this.isRuckActive) {
      // At a ruck: defender must be behind the ruck offside line
      if (teamAttacksRight) {
        return px > this.ruckOffsideLine;
      } else {
        return px < this.ruckOffsideLine;
      }
    }

    // General play: behind the ball
    if (teamAttacksRight) {
      return px > this.generalOffsideLine;
    } else {
      return px < this.generalOffsideLine;
    }
  }

  /**
   * Get the target x-position a defender should retreat to in order to be onside.
   */
  getOnsideTargetX(teamAttacksRight: boolean): number {
    if (this.isRuckActive) {
      return teamAttacksRight ? this.ruckOffsideLine - 5 : this.ruckOffsideLine + 5;
    }
    return teamAttacksRight ? this.generalOffsideLine - 5 : this.generalOffsideLine + 5;
  }

  reset(): void {
    this.ruckOffsideLine = 0;
    this.generalOffsideLine = 0;
    this.isRuckActive = false;
  }
}
