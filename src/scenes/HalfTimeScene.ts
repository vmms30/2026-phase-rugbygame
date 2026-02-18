/**
 * HalfTimeScene — displays first-half stats.
 */

import Phaser from 'phaser';

interface HalfTimeData {
  homeScore: number;
  awayScore: number;
  possession: number; // Home possession %
  tackles: { home: number; away: number };
  passes: { home: number; away: number };
  penalties: { home: number; away: number };
  carries: { home: number; away: number };
}

export class HalfTimeScene extends Phaser.Scene {
  private sceneData!: HalfTimeData;

  constructor() {
    super({ key: 'HalfTimeScene' });
  }

  init(data: HalfTimeData): void {
    this.sceneData = data;
  }

  create(): void {
    const { width, height } = this.cameras.main;

    // Background
    this.add.rectangle(width / 2, height / 2, width, height, 0x0f172a);

    // Title
    this.add.text(width / 2, 40, 'HALF TIME', {
      fontSize: '28px', fontFamily: 'monospace', color: '#f8fafc',
    }).setOrigin(0.5);

    // Score
    this.add.text(width / 2, 90, `HOME ${this.sceneData.homeScore} — ${this.sceneData.awayScore} AWAY`, {
      fontSize: '20px', fontFamily: 'monospace', color: '#eab308',
    }).setOrigin(0.5);

    // Stats table
    const stats = [
      ['Possession', `${this.sceneData.possession}%`, `${100 - this.sceneData.possession}%`],
      ['Tackles', String(this.sceneData.tackles.home), String(this.sceneData.tackles.away)],
      ['Passes', String(this.sceneData.passes.home), String(this.sceneData.passes.away)],
      ['Penalties', String(this.sceneData.penalties.home), String(this.sceneData.penalties.away)],
      ['Carries', String(this.sceneData.carries.home), String(this.sceneData.carries.away)],
    ];

    const startY = 150;
    // Headers
    this.add.text(width / 2 - 100, startY - 25, 'HOME', { fontSize: '11px', fontFamily: 'monospace', color: '#3b82f6' }).setOrigin(0.5);
    this.add.text(width / 2, startY - 25, 'STAT', { fontSize: '11px', fontFamily: 'monospace', color: '#94a3b8' }).setOrigin(0.5);
    this.add.text(width / 2 + 100, startY - 25, 'AWAY', { fontSize: '11px', fontFamily: 'monospace', color: '#ef4444' }).setOrigin(0.5);

    stats.forEach(([label, home, away], i) => {
      const y = startY + i * 28;
      this.add.text(width / 2 - 100, y, home, { fontSize: '12px', fontFamily: 'monospace', color: '#ffffff' }).setOrigin(0.5);
      this.add.text(width / 2, y, label, { fontSize: '12px', fontFamily: 'monospace', color: '#94a3b8' }).setOrigin(0.5);
      this.add.text(width / 2 + 100, y, away, { fontSize: '12px', fontFamily: 'monospace', color: '#ffffff' }).setOrigin(0.5);
    });

    // Continue button
    const btn = this.add.text(width / 2, height - 80, '▶ CONTINUE', {
      fontSize: '16px', fontFamily: 'monospace', color: '#0f172a',
      backgroundColor: '#4ade80', padding: { x: 20, y: 8 },
    }).setOrigin(0.5).setInteractive();

    btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#22c55e' }));
    btn.on('pointerout', () => btn.setStyle({ backgroundColor: '#4ade80' }));
    btn.on('pointerdown', () => {
      this.scene.stop();
      this.scene.resume('MatchScene');
    });
  }
}
