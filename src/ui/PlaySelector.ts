/**
 * PlaySelector — tactical play overlay.
 *
 * Tab key opens the overlay, number keys 1–4 quick-select plays.
 * Closes after selection or 3s timeout.
 */

import Phaser from 'phaser';

export type TacticalPlay = 'CRASH_BALL' | 'SKIP_PASS' | 'SWITCH' | 'LOOP' | 'INSIDE_BALL' | 'KICK' | 'BOX_KICK' | 'GRUBBER';

const PLAYS: { name: string; key: string; play: TacticalPlay }[] = [
  { name: '1. Crash Ball', key: '1', play: 'CRASH_BALL' },
  { name: '2. Skip Pass', key: '2', play: 'SKIP_PASS' },
  { name: '3. Switch', key: '3', play: 'SWITCH' },
  { name: '4. Loop', key: '4', play: 'LOOP' },
  { name: '5. Inside Ball', key: '5', play: 'INSIDE_BALL' },
  { name: '6. Box Kick', key: '6', play: 'BOX_KICK' },
  { name: '7. Grubber', key: '7', play: 'GRUBBER' },
  { name: '8. Kick', key: '8', play: 'KICK' },
];

export class PlaySelector {
  private scene: Phaser.Scene;
  private isOpen = false;
  private items: Phaser.GameObjects.Text[] = [];
  private bg: Phaser.GameObjects.Rectangle | null = null;
  private selectedPlay: TacticalPlay = 'CRASH_BALL';
  private closeTimer: Phaser.Time.TimerEvent | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open(): void {
    if (this.isOpen) return;
    this.isOpen = true;

    const { width, height } = this.scene.cameras.main;

    // Background
    this.bg = this.scene.add.rectangle(width / 2, height / 2, 200, PLAYS.length * 24 + 30, 0x000000, 0.85)
      .setScrollFactor(0).setDepth(200);

    // Title
    const title = this.scene.add.text(width / 2, height / 2 - (PLAYS.length * 12) - 5, 'SELECT PLAY', {
      fontSize: '11px', fontFamily: 'monospace', color: '#4ade80',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    this.items.push(title);

    // Play options
    for (let i = 0; i < PLAYS.length; i++) {
      const p = PLAYS[i];
      const y = height / 2 - (PLAYS.length * 12) + 20 + i * 22;
      const text = this.scene.add.text(width / 2, y, p.name, {
        fontSize: '10px', fontFamily: 'monospace',
        color: p.play === this.selectedPlay ? '#4ade80' : '#ffffff',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
      this.items.push(text);
    }

    // Key listeners
    if (this.scene.input.keyboard) {
      for (let i = 0; i < PLAYS.length; i++) {
        const keyCode = Phaser.Input.Keyboard.KeyCodes.ONE + i;
        const key = this.scene.input.keyboard.addKey(keyCode);
        key.once('down', () => {
          this.selectedPlay = PLAYS[i].play;
          this.close();
        });
      }
    }

    // Auto-close
    this.closeTimer = this.scene.time.delayedCall(3000, () => this.close());
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;

    this.bg?.destroy();
    this.bg = null;
    for (const item of this.items) item.destroy();
    this.items = [];
    this.closeTimer?.remove();
    this.closeTimer = null;
  }

  getSelectedPlay(): TacticalPlay {
    return this.selectedPlay;
  }

  isVisible(): boolean {
    return this.isOpen;
  }
}
