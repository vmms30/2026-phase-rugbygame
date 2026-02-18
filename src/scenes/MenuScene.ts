/**
 * MenuScene — Title screen with Play button.
 * Transitions to MatchScene on play.
 */
import Phaser from 'phaser';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    const { width, height } = this.cameras.main;

    // ── Background ───────────────────────────────────────
    this.cameras.main.setBackgroundColor('#0f172a');

    // ── Title ────────────────────────────────────────────
    const title = this.add.text(width / 2, height * 0.25, '🏉 RUGBY PHASE', {
      fontSize: '42px',
      fontFamily: 'Georgia, serif',
      color: '#22d3ee',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Subtle pulse animation on title
    this.tweens.add({
      targets: title,
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // ── Subtitle ─────────────────────────────────────────
    this.add.text(width / 2, height * 0.37, 'A 2D Top-Down Rugby Experience', {
      fontSize: '16px',
      fontFamily: 'Arial, sans-serif',
      color: '#94a3b8',
    }).setOrigin(0.5);

    // ── Play Button ──────────────────────────────────────
    const btnWidth = 220;
    const btnHeight = 50;
    const btnY = height * 0.55;

    const btnBg = this.add.rectangle(width / 2, btnY, btnWidth, btnHeight, 0x16a34a, 1)
      .setInteractive({ useHandCursor: true })
      .setOrigin(0.5);

    // Rounded corners via stroke
    this.add.rectangle(width / 2, btnY, btnWidth, btnHeight)
      .setStrokeStyle(2, 0x22c55e)
      .setOrigin(0.5);

    const btnText = this.add.text(width / 2, btnY, '▶  PLAY MATCH', {
      fontSize: '20px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Hover effects
    btnBg.on('pointerover', () => {
      btnBg.setFillStyle(0x22c55e);
      btnText.setScale(1.05);
    });
    btnBg.on('pointerout', () => {
      btnBg.setFillStyle(0x16a34a);
      btnText.setScale(1.0);
    });
    btnBg.on('pointerdown', () => {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.time.delayedCall(300, () => {
        this.scene.start('MatchScene');
      });
    });

    // ── Controls hint ────────────────────────────────────
    const controls = [
      'WASD — Move   |   Shift — Sprint   |   Q/E — Pass',
      'R — Kick   |   Space — Tackle/Fend   |   F — Switch Player',
    ];
    controls.forEach((line, i) => {
      this.add.text(width / 2, height * 0.75 + i * 22, line, {
        fontSize: '12px',
        fontFamily: 'monospace',
        color: '#64748b',
      }).setOrigin(0.5);
    });

    // ── Version ──────────────────────────────────────────
    this.add.text(width - 10, height - 10, 'v0.1.0', {
      fontSize: '10px',
      color: '#475569',
    }).setOrigin(1, 1);

    // Fade in
    this.cameras.main.fadeIn(400, 0, 0, 0);
  }
}
