import { PITCH } from '../utils/Constants';
import type { Player } from '../entities/Player';

export class OffsidesSystem {
  private homeOffsideLineX = 0;
  private awayOffsideLineX: number = PITCH.WIDTH_PX;
  private debugMode = false;

  // Track if we are in a ruck state to enforce strict lines
  private isRuckActive = false;

  /**
   * Set offside lines based on ruck position.
   * @param ruckX X position of the ruck center
   * @param isActive Whether ruck is active
   */
  setRuckOffsideLine(ruckX: number, isActive: boolean): void {
    this.isRuckActive = isActive;
    if (isActive) {
      // Ruck radius approx 60px
      const RUCK_RADIUS = 60;
      // Home attacks Right -> Offside line is Left of ruck (min X)
      this.homeOffsideLineX = ruckX - RUCK_RADIUS;
      // Away attacks Left -> Offside line is Right of ruck (max X)
      this.awayOffsideLineX = ruckX + RUCK_RADIUS;
    }
  }

  clearRuckOffside(): void {
    this.isRuckActive = false;
  }

  /**
   * Set general play offside line (e.g. based on ball)
   * In open play, you just need to be behind the ball carrier to receive.
   * For defense, there isn't a static "offside line" across the field unless a kick happens (10m law).
   * For now, we set them to extremes to allow play.
   */
  setGeneralOffsideLine(_ballX: number): void {
    if (!this.isRuckActive) {
      this.homeOffsideLineX = 0; 
      this.awayOffsideLineX = PITCH.WIDTH_PX;
    }
  }

  /**
   * Check if specific player is offside and return penalty details.
   */
  getOffsidePenalty(player: Player, _opponentAttacksRight: boolean): { isOffside: boolean; penaltyPos?: {x: number, y: number} } {
    if (player.teamSide === 'home') {
      // Home must be > homeOffsideLineX (Right of line) in specific contexts?
      // WAIT.
      // Home attacks Right (Increasing X). 
      // To be "behind" the ball/ruck, they must be to the LEFT (Smaller X).
      // So Valid Home Region is X < homeOffsideLineX.
      // Offside is X > homeOffsideLineX.
      if (player.sprite.x > this.homeOffsideLineX) {
        return { isOffside: true, penaltyPos: { x: this.homeOffsideLineX, y: player.sprite.y } };
      }
    } else {
      // Away attacks Left (Decreasing X).
      // To be "behind" ball/ruck, they must be to the RIGHT (Larger X).
      // So Valid Away Region is X > awayOffsideLineX.
      // Offside is X < awayOffsideLineX.
      if (player.sprite.x < this.awayOffsideLineX) {
        return { isOffside: true, penaltyPos: { x: this.awayOffsideLineX, y: player.sprite.y } };
      }
    }
    return { isOffside: false };
  }

  /**
   * Check if a player is offside (simple boolean).
   */
  isOffside(player: Player): boolean {
    const result = this.getOffsidePenalty(player, player.teamSide !== 'home'); // generic assumption for second arg
    return result.isOffside;
  }

  getOffsideLine(side: 'home' | 'away'): number {
    return side === 'home' ? this.homeOffsideLineX : this.awayOffsideLineX;
  }
  
  toggleDebug(): void {
    this.debugMode = !this.debugMode;
  }
}
