/**
 * TeamSelectScene — pre-match team and difficulty selection.
 */

import Phaser from 'phaser';

const TEAMS = [
  { name: 'All Blacks', color: 0x1a1a2e },
  { name: 'Springboks', color: 0x2d6a2d },
  { name: 'Wallabies', color: 0xd4a017 },
  { name: 'England', color: 0xffffff },
  { name: 'France', color: 0x2563eb },
  { name: 'Ireland', color: 0x22c55e },
  { name: 'Wales', color: 0xdc2626 },
  { name: 'Scotland', color: 0x1e3a5f },
];

export class TeamSelectScene extends Phaser.Scene {
  private homeIndex = 0;
  private awayIndex = 1;
  private difficulty: 'EASY' | 'MEDIUM' | 'HARD' = 'MEDIUM';
  private homeText!: Phaser.GameObjects.Text;
  private awayText!: Phaser.GameObjects.Text;
  private diffText!: Phaser.GameObjects.Text;
  private homePreview!: Phaser.GameObjects.Arc;
  private awayPreview!: Phaser.GameObjects.Arc;

  constructor() {
    super({ key: 'TeamSelectScene' });
  }

  create(): void {
    const { width, height } = this.cameras.main;

    this.add.rectangle(width / 2, height / 2, width, height, 0x0f172a);

    this.add.text(width / 2, 30, 'TEAM SELECT', {
      fontSize: '24px', fontFamily: 'monospace', color: '#f8fafc',
    }).setOrigin(0.5);

    // Home team
    this.add.text(width / 4, 80, 'HOME', { fontSize: '14px', fontFamily: 'monospace', color: '#3b82f6' }).setOrigin(0.5);
    this.homePreview = this.add.circle(width / 4, 130, 20, TEAMS[this.homeIndex].color);
    this.homeText = this.add.text(width / 4, 170, TEAMS[this.homeIndex].name, {
      fontSize: '14px', fontFamily: 'monospace', color: '#ffffff',
    }).setOrigin(0.5);

    // Navigation buttons for home
    this.createNavButton(width / 4 - 80, 130, '◀', () => {
      this.homeIndex = (this.homeIndex - 1 + TEAMS.length) % TEAMS.length;
      this.updateDisplay();
    });
    this.createNavButton(width / 4 + 80, 130, '▶', () => {
      this.homeIndex = (this.homeIndex + 1) % TEAMS.length;
      this.updateDisplay();
    });

    // Away team
    this.add.text(3 * width / 4, 80, 'AWAY', { fontSize: '14px', fontFamily: 'monospace', color: '#ef4444' }).setOrigin(0.5);
    this.awayPreview = this.add.circle(3 * width / 4, 130, 20, TEAMS[this.awayIndex].color);
    this.awayText = this.add.text(3 * width / 4, 170, TEAMS[this.awayIndex].name, {
      fontSize: '14px', fontFamily: 'monospace', color: '#ffffff',
    }).setOrigin(0.5);

    this.createNavButton(3 * width / 4 - 80, 130, '◀', () => {
      this.awayIndex = (this.awayIndex - 1 + TEAMS.length) % TEAMS.length;
      this.updateDisplay();
    });
    this.createNavButton(3 * width / 4 + 80, 130, '▶', () => {
      this.awayIndex = (this.awayIndex + 1) % TEAMS.length;
      this.updateDisplay();
    });

    // VS
    this.add.text(width / 2, 130, 'VS', {
      fontSize: '20px', fontFamily: 'monospace', color: '#94a3b8',
    }).setOrigin(0.5);

    // Difficulty
    this.add.text(width / 2, 240, 'DIFFICULTY', {
      fontSize: '12px', fontFamily: 'monospace', color: '#94a3b8',
    }).setOrigin(0.5);

    this.diffText = this.add.text(width / 2, 268, this.difficulty, {
      fontSize: '14px', fontFamily: 'monospace', color: '#eab308',
    }).setOrigin(0.5);

    this.createNavButton(width / 2 - 70, 268, '◀', () => {
      const diffs: Array<'EASY' | 'MEDIUM' | 'HARD'> = ['EASY', 'MEDIUM', 'HARD'];
      const idx = diffs.indexOf(this.difficulty);
      this.difficulty = diffs[(idx - 1 + 3) % 3];
      this.diffText.setText(this.difficulty);
    });
    this.createNavButton(width / 2 + 70, 268, '▶', () => {
      const diffs: Array<'EASY' | 'MEDIUM' | 'HARD'> = ['EASY', 'MEDIUM', 'HARD'];
      const idx = diffs.indexOf(this.difficulty);
      this.difficulty = diffs[(idx + 1) % 3];
      this.diffText.setText(this.difficulty);
    });

    // Start Match button
    const startBtn = this.add.text(width / 2, height - 60, '▶ START MATCH', {
      fontSize: '18px', fontFamily: 'monospace', color: '#0f172a',
      backgroundColor: '#4ade80', padding: { x: 24, y: 10 },
    }).setOrigin(0.5).setInteractive();

    startBtn.on('pointerover', () => startBtn.setStyle({ backgroundColor: '#22c55e' }));
    startBtn.on('pointerout', () => startBtn.setStyle({ backgroundColor: '#4ade80' }));
    startBtn.on('pointerdown', () => {
      this.scene.start('MatchScene', {
        homeTeam: TEAMS[this.homeIndex],
        awayTeam: TEAMS[this.awayIndex],
        difficulty: this.difficulty,
      });
    });

    // Back button
    const backBtn = this.add.text(40, height - 30, '◀ Back', {
      fontSize: '11px', fontFamily: 'monospace', color: '#94a3b8',
    }).setInteractive();
    backBtn.on('pointerdown', () => this.scene.start('MenuScene'));
  }

  private createNavButton(x: number, y: number, label: string, action: () => void): void {
    const btn = this.add.text(x, y, label, {
      fontSize: '16px', fontFamily: 'monospace', color: '#94a3b8',
    }).setOrigin(0.5).setInteractive();
    btn.on('pointerover', () => btn.setColor('#ffffff'));
    btn.on('pointerout', () => btn.setColor('#94a3b8'));
    btn.on('pointerdown', action);
  }

  private updateDisplay(): void {
    this.homeText.setText(TEAMS[this.homeIndex].name);
    this.homePreview.setFillStyle(TEAMS[this.homeIndex].color);
    this.awayText.setText(TEAMS[this.awayIndex].name);
    this.awayPreview.setFillStyle(TEAMS[this.awayIndex].color);
  }
}
