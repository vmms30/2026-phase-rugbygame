import Phaser from 'phaser';
import { AudioManager } from '../systems/AudioManager';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // ── Loading bar ──────────────────────────────────────
    const { width, height } = this.cameras.main;
    const barWidth = width * 0.5;
    const barHeight = 20;
    const barX = (width - barWidth) / 2;
    const barY = height / 2;

    // Background bar
    const bgBar = this.add.rectangle(barX, barY, barWidth, barHeight, 0x333333).setOrigin(0, 0.5);

    // Progress bar
    const progressBar = this.add.rectangle(barX, barY, 0, barHeight, 0x00ff88).setOrigin(0, 0.5);

    // Loading text
    const loadingText = this.add.text(width / 2, barY - 30, 'Loading...', {
      fontSize: '18px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif',
    }).setOrigin(0.5);

    // Update progress bar
    this.load.on('progress', (value: number) => {
      progressBar.width = barWidth * value;
    });

    this.load.on('complete', () => {
      bgBar.destroy();
      progressBar.destroy();
      loadingText.destroy();
    });

    // ── Generate placeholder assets programmatically ─────
    this.createPlaceholderTextures();

    // ── Generate placeholder audio ──────────────────────
    AudioManager.generatePlaceholderSounds(this);
  }

  create(): void {
    this.scene.start('MenuScene');
  }

  /**
   * Creates coloured circle textures as placeholder sprites.
   * These will be replaced by proper spritesheets later.
   */
  private createPlaceholderTextures(): void {
    // Player placeholder (circle)
    const playerGfx = this.make.graphics({ x: 0, y: 0 });
    playerGfx.fillStyle(0xffffff, 1);
    playerGfx.fillCircle(10, 10, 10);
    playerGfx.generateTexture('player', 20, 20);
    playerGfx.destroy();

    // Ball placeholder (small circle)
    const ballGfx = this.make.graphics({ x: 0, y: 0 });
    ballGfx.fillStyle(0xf5f5dc, 1);
    ballGfx.fillCircle(5, 5, 5);
    ballGfx.generateTexture('ball', 10, 10);
    ballGfx.destroy();

    // Ruck zone indicator (semi-transparent circle)
    const ruckGfx = this.make.graphics({ x: 0, y: 0 });
    ruckGfx.fillStyle(0xff8800, 0.25);
    ruckGfx.fillCircle(60, 60, 60);
    ruckGfx.lineStyle(2, 0xff8800, 0.6);
    ruckGfx.strokeCircle(60, 60, 60);
    ruckGfx.generateTexture('ruck_zone', 120, 120);
    ruckGfx.destroy();

    // Selection ring placeholder
    const ringGfx = this.make.graphics({ x: 0, y: 0 });
    ringGfx.lineStyle(2, 0xffff00, 1);
    ringGfx.strokeCircle(12, 12, 12);
    ringGfx.generateTexture('selection_ring', 24, 24);
    ringGfx.destroy();

    // Goal posts placeholder
    const postGfx = this.make.graphics({ x: 0, y: 0 });
    postGfx.fillStyle(0xffffff, 1);
    postGfx.fillRect(0, 0, 4, 56);
    postGfx.fillRect(0, 0, 56, 4);
    postGfx.fillRect(52, 0, 4, 56);
    postGfx.generateTexture('goal_posts', 56, 56);
    postGfx.destroy();
  }
}
