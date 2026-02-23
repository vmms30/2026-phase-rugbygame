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
  private settingsOpen = false;

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
    const title = this.scene.add.text(width / 2, height / 2 - 100, 'PAUSED', {
      fontSize: '28px', fontFamily: 'monospace', color: '#ffffff',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(301);
    this.elements.push(title);

    // Buttons
    const buttons = [
      { label: 'Resume', action: () => this.close() },
      { label: 'Restart Match', action: () => this.scene.scene.restart() },
      { label: 'Settings', action: () => this.toggleSettings() },
      { label: 'Quit to Menu', action: () => this.scene.scene.start('MenuScene') },
    ];

    buttons.forEach((btn, i) => {
      const y = height / 2 - 40 + i * 35;
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

  // ── Settings Sub-Panel ────────────────────────────────
  private toggleSettings(): void {
    if (this.settingsOpen) {
      this.closeSettings();
      return;
    }
    this.settingsOpen = true;

    const { width, height } = this.scene.cameras.main;
    const panelX = width / 2;
    const panelY = height / 2 + 80;

    const bg = this.scene.add.rectangle(panelX, panelY, 280, 160, 0x0f172a, 0.95)
      .setStrokeStyle(1, 0x4ade80).setScrollFactor(0).setDepth(302);
    bg.setData('settingsPanel', true);
    this.elements.push(bg);

    const settingsTitle = this.scene.add.text(panelX, panelY - 60, 'VOLUME', {
      fontSize: '12px', fontFamily: 'monospace', color: '#4ade80',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(303);
    settingsTitle.setData('settingsPanel', true);
    this.elements.push(settingsTitle);

    const labels = ['Master', 'SFX', 'Crowd'];
    labels.forEach((label, i) => {
      const y = panelY - 30 + i * 30;

      const lbl = this.scene.add.text(panelX - 100, y, label, {
        fontSize: '10px', fontFamily: 'monospace', color: '#94a3b8',
      }).setScrollFactor(0).setDepth(303);
      lbl.setData('settingsPanel', true);
      this.elements.push(lbl);

      // Slider track
      const track = this.scene.add.rectangle(panelX + 10, y + 6, 100, 4, 0x333333)
        .setOrigin(0, 0.5).setScrollFactor(0).setDepth(303);
      track.setData('settingsPanel', true);
      this.elements.push(track);

      // Slider fill
      const fill = this.scene.add.rectangle(panelX + 10, y + 6, 75, 4, 0x4ade80)
        .setOrigin(0, 0.5).setScrollFactor(0).setDepth(303);
      fill.setData('settingsPanel', true);
      this.elements.push(fill);

      const pct = this.scene.add.text(panelX + 115, y, '75%', {
        fontSize: '9px', fontFamily: 'monospace', color: '#ffffff',
      }).setScrollFactor(0).setDepth(303);
      pct.setData('settingsPanel', true);
      this.elements.push(pct);
    });
  }

  private closeSettings(): void {
    this.settingsOpen = false;
    this.elements = this.elements.filter(el => {
      if (el.getData('settingsPanel')) {
        el.destroy();
        return false;
      }
      return true;
    });
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.settingsOpen = false;
    this.scene.physics.resume();

    for (const el of this.elements) el.destroy();
    this.elements = [];
  }

  isPaused(): boolean {
    return this.isOpen;
  }
}
