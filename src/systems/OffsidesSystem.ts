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
   * Set general play offside line (e.g. based on ball).
   * In general play (no ruck), offside is not enforced —
   * only ruck situations have meaningful offside lines.
   */
  setGeneralOffsideLine(_ballX: number): void {
    // No-op: offside only enforced during ruck
  }

  /**
   * Check if specific player is offside and return penalty details.
   * Only returns offside during active ruck.
   */
  getOffsidePenalty(player: Player, _opponentAttacksRight: boolean): { isOffside: boolean; penaltyPos?: {x: number, y: number} } {
    // Only enforce during ruck
    if (!this.isRuckActive) return { isOffside: false };

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
   * Only returns true during active ruck.
   */
  isOffside(player: Player): boolean {
    if (!this.isRuckActive) return false;
    const result = this.getOffsidePenalty(player, player.teamSide !== 'home');
    return result.isOffside;
  }

  getOffsideLine(side: 'home' | 'away'): number {
    return side === 'home' ? this.homeOffsideLineX : this.awayOffsideLineX;
  }
  
  /** Returns true only when ruck offside is active */
  isActive(): boolean {
    return this.isRuckActive;
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

