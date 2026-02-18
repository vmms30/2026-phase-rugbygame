/**
 * HUD — In-match heads-up display manager.
 *
 * Manages all HUD elements: scoreboard, clock, phase counter,
 * stamina bar, action prompts, controlled player name, possession indicator.
 */

import Phaser from 'phaser';
import type { Player } from '../entities/Player';
import type { ClockSystem } from '../systems/ClockSystem';

export class HUD {
  private scene: Phaser.Scene;
  private elements: Phaser.GameObjects.GameObject[] = [];

  // Score
  private scoreText!: Phaser.GameObjects.Text;
  // Clock
  private clockText!: Phaser.GameObjects.Text;
  // Phase
  private phaseText!: Phaser.GameObjects.Text;
  // Stamina
  private staminaBg!: Phaser.GameObjects.Rectangle;
  private staminaBar!: Phaser.GameObjects.Rectangle;
  private staminaLabel!: Phaser.GameObjects.Text;
  // Sprint meter
  private sprintLabel!: Phaser.GameObjects.Text;
  // Action prompts
  private actionPrompt!: Phaser.GameObjects.Text;
  // Player name
  private playerLabel!: Phaser.GameObjects.Text;
  // Possession
  private possessionBar!: Phaser.GameObjects.Rectangle;
  private possessionBg!: Phaser.GameObjects.Rectangle;
  // Kick type
  private kickTypeText!: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.create();
  }

  private create(): void {
    const { width } = this.scene.cameras.main;

    // Score (top center)
    this.scoreText = this.scene.add.text(width / 2, 8, 'HOME 0 — 0 AWAY', {
      fontSize: '14px', fontFamily: 'monospace', color: '#ffffff',
      backgroundColor: '#00000088', padding: { x: 10, y: 4 },
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100);

    // Clock (below score)
    this.clockText = this.scene.add.text(width / 2, 30, '00:00', {
      fontSize: '12px', fontFamily: 'monospace', color: '#eab308',
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100);

    // Phase counter
    this.phaseText = this.scene.add.text(width / 2, 46, 'Phase 0 | OPEN PLAY', {
      fontSize: '10px', fontFamily: 'monospace', color: '#94a3b8',
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100);

    // Possession bar (top, below phase)
    this.possessionBg = this.scene.add.rectangle(width / 2 - 60, 62, 120, 6, 0xdc2626)
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(100);
    this.possessionBar = this.scene.add.rectangle(width / 2 - 60, 62, 60, 6, 0x2563eb)
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(100);

    // Stamina bar (bottom left)
    this.staminaLabel = this.scene.add.text(16, 508, 'STAMINA', {
      fontSize: '8px', fontFamily: 'monospace', color: '#94a3b8',
    }).setScrollFactor(0).setDepth(100);
    this.staminaBg = this.scene.add.rectangle(16, 520, 100, 8, 0x333333)
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(100);
    this.staminaBar = this.scene.add.rectangle(16, 520, 100, 8, 0x22c55e)
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(100);

    // Sprint label
    this.sprintLabel = this.scene.add.text(16, 530, '', {
      fontSize: '8px', fontFamily: 'monospace', color: '#eab308',
    }).setScrollFactor(0).setDepth(100);

    // Player name label
    this.playerLabel = this.scene.add.text(16, 495, '', {
      fontSize: '9px', fontFamily: 'monospace', color: '#ffffff',
    }).setScrollFactor(0).setDepth(100);

    // Action prompts (bottom center)
    this.actionPrompt = this.scene.add.text(width / 2, 555, '', {
      fontSize: '9px', fontFamily: 'monospace', color: '#94a3b8',
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100);

    // Kick type (top right)
    this.kickTypeText = this.scene.add.text(width - 120, 12, 'Kick: PUNT', {
      fontSize: '9px', fontFamily: 'monospace', color: '#94a3b8',
    }).setScrollFactor(0).setDepth(100);

    this.elements = [
      this.scoreText, this.clockText, this.phaseText,
      this.possessionBg, this.possessionBar,
      this.staminaBg, this.staminaBar, this.staminaLabel,
      this.sprintLabel, this.playerLabel,
      this.actionPrompt, this.kickTypeText,
    ];
  }

  update(
    homeScore: number, awayScore: number,
    clock: ClockSystem,
    phaseCount: number, phaseState: string,
    controlledPlayer: Player,
    hasBall: boolean, kickType: string,
    isRuckActive: boolean,
    possessionPct: number = 50,
  ): void {
    this.scoreText.setText(`HOME ${homeScore} — ${awayScore} AWAY`);

    // Clock with injury time flash
    const clockStr = clock.getClockString();
    this.clockText.setText(clock.isInInjuryTime() ? `${clockStr} +` : clockStr);
    if (clock.isInInjuryTime()) {
      this.clockText.setColor(Date.now() % 1000 < 500 ? '#ef4444' : '#eab308');
    }

    // Phase
    this.phaseText.setText(`Phase ${phaseCount} | ${phaseState.replace(/_/g, ' ')}`);

    // Possession
    this.possessionBar.width = 120 * (possessionPct / 100);

    // Stamina
    const staminaPct = controlledPlayer.stamina / 100;
    this.staminaBar.width = 100 * staminaPct;
    this.staminaBar.setFillStyle(staminaPct > 0.5 ? 0x22c55e : staminaPct > 0.2 ? 0xeab308 : 0xef4444);

    // Sprint
    this.sprintLabel.setText(staminaPct < 0.2 ? 'EXHAUSTED' : '');

    // Player name
    this.playerLabel.setText(`#${controlledPlayer.position} ${controlledPlayer.teamSide.toUpperCase()}`);

    // Action prompts
    const prompts: string[] = [];
    if (hasBall) prompts.push('Q/E:Pass  R:Kick  T:KickType');
    else prompts.push('Space:Tackle  F:Switch');
    if (isRuckActive) prompts.push('RUCK');
    this.actionPrompt.setText(prompts.join(' | '));

    // Kick type
    this.kickTypeText.setText(`Kick: ${kickType.replace(/_/g, ' ')}`);
  }

  getElements(): Phaser.GameObjects.GameObject[] {
    return this.elements;
  }
}
