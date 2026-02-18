/**
 * PauseMenu — Esc key overlay for pausing the match.
 *
 * Options: Resume, Restart, Settings, Quit to Menu.
 */

import Phaser from 'phaser';

export class PauseMenu {
  private scene: Phaser.Scene;
  private isOpen = false;
  private elements: Phaser.GameObjects.GameObject[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  open(): void {
    if (this.isOpen) return;
    this.isOpen = true;
    this.scene.physics.pause();

    const { width, height } = this.scene.cameras.main;

    // Dim overlay
    const overlay = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6)
      .setScrollFactor(0).setDepth(300);
    this.elements.push(overlay);

    // Title
    const title = this.scene.add.text(width / 2, height / 2 - 80, 'PAUSED', {
      fontSize: '28px', fontFamily: 'monospace', color: '#ffffff',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(301);
    this.elements.push(title);

    // Buttons
    const buttons = [
      { label: 'Resume', action: () => this.close() },
      { label: 'Restart Match', action: () => this.scene.scene.restart() },
      { label: 'Quit to Menu', action: () => this.scene.scene.start('MenuScene') },
    ];

    buttons.forEach((btn, i) => {
      const y = height / 2 - 20 + i * 35;
      const text = this.scene.add.text(width / 2, y, btn.label, {
        fontSize: '14px', fontFamily: 'monospace', color: '#94a3b8',
        backgroundColor: '#1e293b', padding: { x: 20, y: 6 },
      }).setOrigin(0.5).setScrollFactor(0).setDepth(301).setInteractive();

      text.on('pointerover', () => text.setColor('#4ade80'));
      text.on('pointerout', () => text.setColor('#94a3b8'));
      text.on('pointerdown', btn.action);
      this.elements.push(text);
    });
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.scene.physics.resume();

    for (const el of this.elements) el.destroy();
    this.elements = [];
  }

  isPaused(): boolean {
    return this.isOpen;
  }
}
