/**
 * MenuScene — Title screen with Play, Settings, and Credits.
 * Transitions to TeamSelectScene on play.
 */
import Phaser from 'phaser';

export class MenuScene extends Phaser.Scene {
  private settingsOverlay: Phaser.GameObjects.GameObject[] = [];
  private creditsOverlay: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    const { width, height } = this.cameras.main;

    // ── Gradient Background ─────────────────────────────
    this.cameras.main.setBackgroundColor('#0f172a');
    // Faint radial gradient effect
    const glow = this.add.ellipse(width / 2, height * 0.3, 600, 400, 0x1e3a5f, 0.4);
    glow.setBlendMode(Phaser.BlendModes.ADD);

    // ── Title ────────────────────────────────────────────
    const title = this.add.text(width / 2, height * 0.2, '🏉 RUGBY PHASE', {
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
    this.add.text(width / 2, height * 0.33, 'A 2D Top-Down Rugby Experience', {
      fontSize: '16px',
      fontFamily: 'Arial, sans-serif',
      color: '#94a3b8',
    }).setOrigin(0.5);

    // ── Buttons ──────────────────────────────────────────
    const buttons = [
      { label: '▶  PLAY MATCH', action: () => this.startMatch(), color: 0x16a34a, hoverColor: 0x22c55e },
      { label: '⚙  SETTINGS', action: () => this.toggleSettings(), color: 0x334155, hoverColor: 0x475569 },
      { label: '📝  CREDITS', action: () => this.toggleCredits(), color: 0x334155, hoverColor: 0x475569 },
    ];

    const btnWidth = 220;
    const btnHeight = 44;
    const startY = height * 0.48;
    const spacing = 55;

    buttons.forEach((btn, i) => {
      const y = startY + i * spacing;

      const bg = this.add.rectangle(width / 2, y, btnWidth, btnHeight, btn.color, 1)
        .setInteractive({ useHandCursor: true }).setOrigin(0.5);
      this.add.rectangle(width / 2, y, btnWidth, btnHeight)
        .setStrokeStyle(2, 0x4ade80).setOrigin(0.5);

      const text = this.add.text(width / 2, y, btn.label, {
        fontSize: '18px', fontFamily: 'Arial, sans-serif',
        color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5);

      bg.on('pointerover', () => { bg.setFillStyle(btn.hoverColor); text.setScale(1.05); });
      bg.on('pointerout', () => { bg.setFillStyle(btn.color); text.setScale(1.0); });
      bg.on('pointerdown', btn.action);
    });

    // ── Controls hint ────────────────────────────────────
    const controls = [
      'WASD — Move   |   Shift — Sprint   |   Q/E — Pass',
      'R — Kick   |   Space — Tackle/Fend   |   F — Switch Player',
    ];
    controls.forEach((line, i) => {
      this.add.text(width / 2, height * 0.82 + i * 22, line, {
        fontSize: '11px', fontFamily: 'monospace', color: '#64748b',
      }).setOrigin(0.5);
    });

    // ── Version ──────────────────────────────────────────
    this.add.text(width - 10, height - 10, 'v0.2.0', {
      fontSize: '10px', color: '#475569',
    }).setOrigin(1, 1);

    // Fade in
    this.cameras.main.fadeIn(400, 0, 0, 0);
  }

  private startMatch(): void {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.time.delayedCall(300, () => {
      this.scene.start('TeamSelectScene');
    });
  }

  // ── Settings Overlay ──────────────────────────────────
  private toggleSettings(): void {
    if (this.settingsOverlay.length > 0) {
      this.closeSettings();
      return;
    }
    this.closeCredits();

    const { width, height } = this.cameras.main;
    const bg = this.add.rectangle(width / 2, height / 2, 340, 280, 0x0f172a, 0.95)
      .setStrokeStyle(2, 0x4ade80).setDepth(200);
    this.settingsOverlay.push(bg);

    const title = this.add.text(width / 2, height / 2 - 110, '⚙ SETTINGS', {
      fontSize: '20px', fontFamily: 'monospace', color: '#4ade80',
    }).setOrigin(0.5).setDepth(201);
    this.settingsOverlay.push(title);

    // Volume controls
    const volumeLabels = ['Master', 'SFX', 'Crowd'];
    volumeLabels.forEach((label, i) => {
      const y = height / 2 - 55 + i * 45;

      const lbl = this.add.text(width / 2 - 120, y, label, {
        fontSize: '13px', fontFamily: 'monospace', color: '#94a3b8',
      }).setDepth(201);
      this.settingsOverlay.push(lbl);

      // Slider track
      const track = this.add.rectangle(width / 2 + 30, y + 8, 150, 6, 0x333333)
        .setOrigin(0, 0.5).setDepth(201);
      this.settingsOverlay.push(track);

      // Slider fill
      const fill = this.add.rectangle(width / 2 + 30, y + 8, 112, 6, 0x4ade80)
        .setOrigin(0, 0.5).setDepth(201);
      this.settingsOverlay.push(fill);

      // Volume label
      const pct = this.add.text(width / 2 + 185, y, '75%', {
        fontSize: '11px', fontFamily: 'monospace', color: '#ffffff',
      }).setDepth(201);
      this.settingsOverlay.push(pct);
    });

    // Close button
    const closeBtn = this.add.text(width / 2, height / 2 + 105, '✕ CLOSE', {
      fontSize: '14px', fontFamily: 'monospace', color: '#ef4444',
      backgroundColor: '#1e293b', padding: { x: 16, y: 6 },
    }).setOrigin(0.5).setDepth(201).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.closeSettings());
    closeBtn.on('pointerover', () => closeBtn.setColor('#ff6b6b'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#ef4444'));
    this.settingsOverlay.push(closeBtn);
  }

  private closeSettings(): void {
    for (const el of this.settingsOverlay) el.destroy();
    this.settingsOverlay = [];
  }

  // ── Credits Overlay ───────────────────────────────────
  private toggleCredits(): void {
    if (this.creditsOverlay.length > 0) {
      this.closeCredits();
      return;
    }
    this.closeSettings();

    const { width, height } = this.cameras.main;
    const bg = this.add.rectangle(width / 2, height / 2, 340, 280, 0x0f172a, 0.95)
      .setStrokeStyle(2, 0x4ade80).setDepth(200);
    this.creditsOverlay.push(bg);

    const title = this.add.text(width / 2, height / 2 - 110, '📝 CREDITS', {
      fontSize: '20px', fontFamily: 'monospace', color: '#4ade80',
    }).setOrigin(0.5).setDepth(201);
    this.creditsOverlay.push(title);

    const credits = [
      'Game Design & Development',
      'Vincent Soweto',
      '',
      'Built with Phaser 3',
      'TypeScript + Vite',
      '',
      '© 2026 All Rights Reserved',
    ];
    credits.forEach((line, i) => {
      const isHeader = i === 0;
      const txt = this.add.text(width / 2, height / 2 - 60 + i * 24, line, {
        fontSize: isHeader ? '14px' : '12px',
        fontFamily: 'monospace',
        color: isHeader ? '#ffffff' : '#94a3b8',
        fontStyle: isHeader ? 'bold' : 'normal',
      }).setOrigin(0.5).setDepth(201);
      this.creditsOverlay.push(txt);
    });

    // Close button
    const closeBtn = this.add.text(width / 2, height / 2 + 105, '✕ CLOSE', {
      fontSize: '14px', fontFamily: 'monospace', color: '#ef4444',
      backgroundColor: '#1e293b', padding: { x: 16, y: 6 },
    }).setOrigin(0.5).setDepth(201).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.closeCredits());
    closeBtn.on('pointerover', () => closeBtn.setColor('#ff6b6b'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#ef4444'));
    this.creditsOverlay.push(closeBtn);
  }

  private closeCredits(): void {
    for (const el of this.creditsOverlay) el.destroy();
    this.creditsOverlay = [];
  }
}
