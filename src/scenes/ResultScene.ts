/**
 * ResultScene — Full-time results with stats and Man of the Match.
 */

import Phaser from 'phaser';

interface ResultData {
  homeScore: number;
  awayScore: number;
  possession: number;
  tackles: { home: number; away: number };
  passes: { home: number; away: number };
  penalties: { home: number; away: number };
  carries: { home: number; away: number };
  manOfMatch: string; // Player position + team
}

export class ResultScene extends Phaser.Scene {
  private sceneData!: ResultData;

  constructor() {
    super({ key: 'ResultScene' });
  }

  init(data: ResultData): void {
    this.sceneData = data;
  }

  create(): void {
    const { width, height } = this.cameras.main;

    // Background gradient effect
    this.add.rectangle(width / 2, height / 2, width, height, 0x0f172a);

    // Title
    this.add.text(width / 2, 30, 'FULL TIME', {
      fontSize: '32px', fontFamily: 'monospace', color: '#f8fafc',
    }).setOrigin(0.5);

    // Score (large)
    const winner = this.sceneData.homeScore > this.sceneData.awayScore ? 'HOME WINS!' :
                   this.sceneData.awayScore > this.sceneData.homeScore ? 'AWAY WINS!' : 'DRAW';
    this.add.text(width / 2, 80, `HOME ${this.sceneData.homeScore} — ${this.sceneData.awayScore} AWAY`, {
      fontSize: '24px', fontFamily: 'monospace', color: '#eab308',
    }).setOrigin(0.5);
    this.add.text(width / 2, 110, winner, {
      fontSize: '16px', fontFamily: 'monospace', color: '#4ade80',
    }).setOrigin(0.5);

    // Man of the Match
    this.add.text(width / 2, 150, `🏆 Man of the Match: ${this.sceneData.manOfMatch}`, {
      fontSize: '12px', fontFamily: 'monospace', color: '#fbbf24',
    }).setOrigin(0.5);

    // Stats
    const stats = [
      ['Possession', `${this.sceneData.possession}%`, `${100 - this.sceneData.possession}%`],
      ['Tackles', String(this.sceneData.tackles.home), String(this.sceneData.tackles.away)],
      ['Passes', String(this.sceneData.passes.home), String(this.sceneData.passes.away)],
      ['Penalties', String(this.sceneData.penalties.home), String(this.sceneData.penalties.away)],
      ['Carries', String(this.sceneData.carries.home), String(this.sceneData.carries.away)],
    ];

    const startY = 200;
    this.add.text(width / 2 - 100, startY - 20, 'HOME', { fontSize: '10px', fontFamily: 'monospace', color: '#3b82f6' }).setOrigin(0.5);
    this.add.text(width / 2 + 100, startY - 20, 'AWAY', { fontSize: '10px', fontFamily: 'monospace', color: '#ef4444' }).setOrigin(0.5);

    stats.forEach(([label, home, away], i) => {
      const y = startY + i * 24;
      this.add.text(width / 2 - 100, y, home, { fontSize: '11px', fontFamily: 'monospace', color: '#ffffff' }).setOrigin(0.5);
      this.add.text(width / 2, y, label, { fontSize: '11px', fontFamily: 'monospace', color: '#94a3b8' }).setOrigin(0.5);
      this.add.text(width / 2 + 100, y, away, { fontSize: '11px', fontFamily: 'monospace', color: '#ffffff' }).setOrigin(0.5);
    });

    // Buttons
    const playAgain = this.add.text(width / 2 - 80, height - 50, '↻ PLAY AGAIN', {
      fontSize: '12px', fontFamily: 'monospace', color: '#0f172a',
      backgroundColor: '#4ade80', padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setInteractive();
    playAgain.on('pointerdown', () => this.scene.start('MatchScene'));

    const toMenu = this.add.text(width / 2 + 80, height - 50, '◀ MENU', {
      fontSize: '12px', fontFamily: 'monospace', color: '#94a3b8',
      backgroundColor: '#1e293b', padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setInteractive();
    toMenu.on('pointerdown', () => this.scene.start('MenuScene'));
  }
}
