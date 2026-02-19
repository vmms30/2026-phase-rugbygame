import Phaser from 'phaser';
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
      const RUCK_RADIUS = 60;
      this.homeOffsideLineX = ruckX - RUCK_RADIUS;
      this.awayOffsideLineX = ruckX + RUCK_RADIUS;
    }
  }

  clearRuckOffside(): void {
    this.isRuckActive = false;
  }

  /**
   * Set general play offside line (e.g. based on ball)
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
      if (player.sprite.x > this.homeOffsideLineX) {
        return { isOffside: true, penaltyPos: { x: this.homeOffsideLineX, y: player.sprite.y } };
      }
    } else {
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
    const result = this.getOffsidePenalty(player, player.teamSide !== 'home');
    return result.isOffside;
  }

  getOffsideLine(side: 'home' | 'away'): number {
    return side === 'home' ? this.homeOffsideLineX : this.awayOffsideLineX;
  }
  
  toggleDebug(): void {
    this.debugMode = !this.debugMode;
  }

  isDebugActive(): boolean {
    return this.debugMode;
  }

  /**
   * Render offside debug lines on the pitch (M5.4).
   * Draws dotted red line for home offside, blue for away.
   */
  renderDebugLine(graphics: Phaser.GameObjects.Graphics): void {
    if (!this.debugMode || !this.isRuckActive) return;

    const pitchTop = 0;
    const pitchBottom = PITCH.HEIGHT_PX;
    const dashLength = 10;
    const gapLength = 8;

    // Home offside line (red)
    graphics.lineStyle(2, 0xff0000, 0.7);
    for (let y = pitchTop; y < pitchBottom; y += dashLength + gapLength) {
      graphics.lineBetween(
        this.homeOffsideLineX, y,
        this.homeOffsideLineX, Math.min(y + dashLength, pitchBottom)
      );
    }

    // Away offside line (blue)
    graphics.lineStyle(2, 0x0000ff, 0.7);
    for (let y = pitchTop; y < pitchBottom; y += dashLength + gapLength) {
      graphics.lineBetween(
        this.awayOffsideLineX, y,
        this.awayOffsideLineX, Math.min(y + dashLength, pitchBottom)
      );
    }
  }
}
