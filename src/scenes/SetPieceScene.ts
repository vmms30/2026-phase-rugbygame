/**
 * SetPieceScene — overlay scene that handles scrums and lineouts.
 *
 * Launched as a parallel scene on top of MatchScene.
 * Manages the mini-game interactions and returns control to MatchScene.
 */

import { EventBus } from '../utils/EventBus';

type SetPieceType = 'scrum' | 'lineout' | 'conversion' | 'penalty_kick';

interface SetPieceConfig {
  type: SetPieceType;
  x: number;
  y: number;
  team: 'home' | 'away';
}

export class SetPieceScene extends Phaser.Scene {
  private config!: SetPieceConfig;
  private phaseText!: Phaser.GameObjects.Text;
  private instructionText!: Phaser.GameObjects.Text;
  private powerBar!: Phaser.GameObjects.Rectangle;
  // @ts-ignore — created for visual, referenced by Phaser renderer
  private _powerBarBg!: Phaser.GameObjects.Rectangle;
  private powerLevel = 0;
  private isCharging = false;
  private phase: 'setup' | 'engage' | 'contest' | 'complete' = 'setup';
  private tapCount = 0;
  // @ts-ignore — used by scrum engagement timing
  private tapTimer = 0;
  private contestDuration = 3000;
  private contestElapsed = 0;
  private aimAngle = 0;
  private aimDirection = 1;

  // Lineout target selection
  private lineoutTarget: 'front' | 'middle' | 'back' = 'middle';

  constructor() {
    super({ key: 'SetPieceScene' });
  }

  init(data: SetPieceConfig): void {
    this.config = data;
    this.phase = 'setup';
    this.tapCount = 0;
    this.contestElapsed = 0;
    this.powerLevel = 0;
    this.isCharging = false;
  }

  create(): void {
    const { width, height } = this.cameras.main;

    // Semi-transparent overlay
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.4)
      .setScrollFactor(0).setDepth(0);

    // Title
    const title = this.config.type === 'scrum' ? '⚙️ SCRUM' :
                  this.config.type === 'lineout' ? '📐 LINEOUT' :
                  this.config.type === 'conversion' ? '🏉 CONVERSION' : '🏉 PENALTY KICK';

    this.phaseText = this.add.text(width / 2, 60, title, {
      fontSize: '24px', fontFamily: 'monospace', color: '#ffffff',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10);

    this.instructionText = this.add.text(width / 2, height - 60, '', {
      fontSize: '14px', fontFamily: 'monospace', color: '#aaaaaa',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10);

    // Power bar
    this._powerBarBg = this.add.rectangle(width / 2 - 75, height / 2 + 80, 150, 16, 0x333333)
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(10);
    this.powerBar = this.add.rectangle(width / 2 - 75, height / 2 + 80, 0, 16, 0x22c55e)
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(10);

    // Start the appropriate mini-game
    switch (this.config.type) {
      case 'scrum': this.startScrum(); break;
      case 'lineout': this.startLineout(); break;
      case 'conversion':
      case 'penalty_kick': this.startKickAtGoal(); break;
    }
  }

  update(_time: number, delta: number): void {
    switch (this.config.type) {
      case 'scrum': this.updateScrum(delta); break;
      case 'lineout': this.updateLineout(delta); break;
      case 'conversion':
      case 'penalty_kick': this.updateKickAtGoal(delta); break;
    }
  }

  // ─────────────────────────────────────────────────────────
  // SCRUM MINI-GAME
  // ─────────────────────────────────────────────────────────

  private startScrum(): void {
    this.phase = 'setup';
    this.instructionText.setText('Press SPACE on "SET" for good engagement');

    // Draw scrum formation visual
    const { width, height } = this.cameras.main;
    const cx = width / 2;
    const cy = height / 2;

    // Front row
    for (let i = -1; i <= 1; i++) {
      this.add.circle(cx - 30, cy + i * 25, 8, 0x2563eb).setScrollFactor(0).setDepth(5);
      this.add.circle(cx + 30, cy + i * 25, 8, 0xdc2626).setScrollFactor(0).setDepth(5);
    }
    // Second row
    for (let i = 0; i <= 1; i++) {
      this.add.circle(cx - 55, cy + (i - 0.5) * 25, 8, 0x2563eb).setScrollFactor(0).setDepth(5);
      this.add.circle(cx + 55, cy + (i - 0.5) * 25, 8, 0xdc2626).setScrollFactor(0).setDepth(5);
    }
    // No. 8
    this.add.circle(cx - 75, cy, 8, 0x2563eb).setScrollFactor(0).setDepth(5);
    this.add.circle(cx + 75, cy, 8, 0xdc2626).setScrollFactor(0).setDepth(5);

    // Engagement sequence with delays
    let earlyEngagement = false;

    const earlyCheck = () => {
       if (this.phase === 'setup' && !earlyEngagement) {
          earlyEngagement = true;
          this.handleEarlyEngagement();
       }
    };
    this.input.keyboard?.on('keydown-SPACE', earlyCheck);

    this.time.delayedCall(800, () => {
      if (!earlyEngagement) this.phaseText.setText('CROUCH');
    });
    this.time.delayedCall(1600, () => {
      if (!earlyEngagement) this.phaseText.setText('BIND');
    });
    this.time.delayedCall(2400, () => {
      this.input.keyboard?.off('keydown-SPACE', earlyCheck);
      
      if (earlyEngagement) return;

      this.phaseText.setText('SET!');
      this.phase = 'engage';

      // Listen for space
      this.input.keyboard?.once('keydown-SPACE', () => {
        // Check timing — must be within 400ms of "SET"
        this.phase = 'contest';
        this.phaseText.setText('PUSH! Tap SPACE rapidly!');
        this.instructionText.setText('Tap SPACE as fast as you can!');
        this.contestElapsed = 0;
        this.tapCount = 0;
      });

      this.tapTimer = Date.now();
    });
  }

  private handleEarlyEngagement(): void {
    this.phase = 'complete';
    this.phaseText.setText('EARLY ENGAGEMENT!');
    this.instructionText.setText('Penalty to opposition');
    
    // Visual feedback (shake?)
    this.cameras.main.shake(100, 0.01);

    this.time.delayedCall(2000, () => {
      this.scene.stop();
      // Opposition wins
      EventBus.emit('ruckResolved', { team: this.config.team === 'home' ? 'away' : 'home' });
    });
  }

  private updateScrum(delta: number): void {
    if (this.phase !== 'contest') return;

    this.contestElapsed += delta;

    // Count taps during contest
    if (this.input.keyboard) {
      const spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      if (Phaser.Input.Keyboard.JustDown(spaceKey)) {
        this.tapCount++;
      }
    }

    // Update power bar based on taps
    const targetTaps = 15; // Need ~15 taps to fully win
    this.powerLevel = Math.min(1, this.tapCount / targetTaps);
    this.powerBar.width = 150 * this.powerLevel;
    this.powerBar.setFillStyle(this.powerLevel > 0.6 ? 0x22c55e : 0xeab308);

    // Contest complete after 3 seconds
    if (this.contestElapsed >= this.contestDuration) {
      this.phase = 'complete';
      const won = this.powerLevel > 0.4;
      this.phaseText.setText(won ? 'BALL WON!' : 'BALL LOST!');
      this.instructionText.setText('');

      this.time.delayedCall(1000, () => {
        this.scene.stop();
        EventBus.emit('ruckResolved', { team: won ? this.config.team : (this.config.team === 'home' ? 'away' : 'home') });
      });
    }
  }

  // ─────────────────────────────────────────────────────────
  // LINEOUT MINI-GAME
  // ─────────────────────────────────────────────────────────

  // Store lineout players for animation
  private lineoutSprites: Record<string, Phaser.GameObjects.Arc> = {};

  private startLineout(): void {
    this.phase = 'setup';
    this.lineoutTarget = 'middle';
    this.lineoutSprites = {};

    const { width, height } = this.cameras.main;
    const cx = width / 2;

    // Draw lineout formation
    const positions = [height / 2 - 60, height / 2, height / 2 + 60];
    const labels = ['FRONT', 'MIDDLE', 'BACK'];
    const keys = ['front', 'middle', 'back'];

    for (let i = 0; i < 3; i++) {
      const circle = this.add.circle(cx - 20, positions[i], 8, 0x2563eb).setScrollFactor(0).setDepth(5);
      this.lineoutSprites[keys[i]] = circle;
      
      this.add.circle(cx + 20, positions[i], 8, 0xdc2626).setScrollFactor(0).setDepth(5);
      this.add.text(cx - 60, positions[i], labels[i], {
        fontSize: '10px', fontFamily: 'monospace', color: '#94a3b8',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(5);
    }

    this.instructionText.setText('↑/↓ Select target, SPACE to throw');

    // Arrow key listeners
    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-UP', () => {
        if (this.phase !== 'setup') return;
        this.lineoutTarget = this.lineoutTarget === 'back' ? 'middle' : 'front';
        this.phaseText.setText(`Target: ${this.lineoutTarget.toUpperCase()}`);
        this.highlightTarget();
      });
      this.input.keyboard.on('keydown-DOWN', () => {
        if (this.phase !== 'setup') return;
        this.lineoutTarget = this.lineoutTarget === 'front' ? 'middle' : 'back';
        this.phaseText.setText(`Target: ${this.lineoutTarget.toUpperCase()}`);
        this.highlightTarget();
      });
      this.input.keyboard.on('keydown-SPACE', () => {
        if (this.phase !== 'setup') return;
        this.phase = 'contest';
        this.phaseText.setText('THROWING...');
        this.instructionText.setText('Press SPACE to JUMP!');
        this.isCharging = true;
      });
    }
    
    this.highlightTarget();
  }

  private highlightTarget(): void {
     // visual feedback for selection
     Object.values(this.lineoutSprites).forEach(s => s.setStrokeStyle(0));
     const target = this.lineoutSprites[this.lineoutTarget];
     if (target) target.setStrokeStyle(2, 0xffff00);
  }

  private updateLineout(delta: number): void {
    if (this.phase === 'contest' && this.isCharging) {
      this.powerLevel += delta / 1500; // 1.5s charge
      this.powerBar.width = 150 * Math.min(1, this.powerLevel);

      if (this.powerLevel >= 1) {
        this.resolveLineout();
      }

      // Jump timing
      if (this.input.keyboard) {
        const spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        if (Phaser.Input.Keyboard.JustDown(spaceKey) && this.powerLevel > 0.3) {
           // Simulate Lift
           const jumper = this.lineoutSprites[this.lineoutTarget];
           if (jumper) {
             this.tweens.add({
                targets: jumper,
                scaleX: 1.4, scaleY: 1.4, // "Jump" towards scaling or slight offset?
                duration: 200,
                yoyo: true
             });
           }
          this.resolveLineout();
        }
      }
    }
  }

  private resolveLineout(): void {
    this.isCharging = false;
    this.phase = 'complete';

    // Timing-based success: sweet spot at power 0.5–0.8
    // Opposition contest logic based on difficulty (placeholder: 30% chance to steal if timing bad)
    const timingGood = (this.powerLevel > 0.5 && this.powerLevel < 0.8);
    const stealChance = timingGood ? 0.1 : 0.6;
    
    const success = Math.random() > stealChance;

    this.phaseText.setText(success ? 'BALL WON - SECURE!' : 'STOLEN BY OPPOSITION!');

    this.time.delayedCall(1500, () => {
      this.scene.stop();
      EventBus.emit('ruckResolved', { team: success ? this.config.team : (this.config.team === 'home' ? 'away' : 'home') });
    });
  }

  // ─────────────────────────────────────────────────────────
  // KICK AT GOAL (Conversion / Penalty)
  // ─────────────────────────────────────────────────────────

  private startKickAtGoal(): void {
    this.phase = 'setup';
    this.aimAngle = 0;
    this.aimDirection = 1;

    const { width, height } = this.cameras.main;

    // Draw posts
    this.add.rectangle(width / 2 - 20, height / 2 - 80, 4, 60, 0xf0e68c).setScrollFactor(0).setDepth(5);
    this.add.rectangle(width / 2 + 20, height / 2 - 80, 4, 60, 0xf0e68c).setScrollFactor(0).setDepth(5);
    this.add.rectangle(width / 2, height / 2 - 80, 44, 4, 0xf0e68c).setScrollFactor(0).setDepth(5);

    // Aim indicator
    this.add.triangle(width / 2, height / 2 + 20, 0, 10, 5, 0, -5, 0, 0x22c55e)
      .setScrollFactor(0).setDepth(5);

    this.instructionText.setText('SPACE to set aim, then SPACE for power');
    this.phaseText.setText('AIM');
  }

  private updateKickAtGoal(delta: number): void {
    if (this.phase === 'setup') {
      // Oscillate aim
      this.aimAngle += this.aimDirection * delta * 0.002;
      if (Math.abs(this.aimAngle) > 0.5) this.aimDirection *= -1;

      if (this.input.keyboard) {
        const spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        if (Phaser.Input.Keyboard.JustDown(spaceKey)) {
          this.phase = 'contest';
          this.phaseText.setText('POWER');
          this.powerLevel = 0;
          this.isCharging = true;
        }
      }
    }

    if (this.phase === 'contest' && this.isCharging) {
      this.powerLevel += delta / 1500;
      this.powerBar.width = 150 * Math.min(1, this.powerLevel);

      const color = this.powerLevel < 0.5 ? 0x22c55e : this.powerLevel < 0.8 ? 0xeab308 : 0xef4444;
      this.powerBar.setFillStyle(color);

      if (this.input.keyboard) {
        const spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        if (Phaser.Input.Keyboard.JustDown(spaceKey)) {
          this.resolveKickAtGoal();
        }
      }

      if (this.powerLevel >= 1) {
        this.resolveKickAtGoal();
      }
    }
  }

  private resolveKickAtGoal(): void {
    this.isCharging = false;
    this.phase = 'complete';

    // Accuracy based on aim angle (closer to 0 = better)
    const aimAccuracy = 1 - Math.abs(this.aimAngle) * 2;
    // Power sweet spot: 0.6–0.85
    const powerAccuracy = (this.powerLevel > 0.5 && this.powerLevel < 0.85) ? 1.0 : 0.4;

    const success = aimAccuracy > 0.5 && powerAccuracy > 0.5 && Math.random() < (aimAccuracy * powerAccuracy);

    this.phaseText.setText(success ? '✓ SUCCESSFUL!' : '✗ MISSED!');

    if (success) {
      EventBus.emit('score', {
        team: this.config.team,
        type: this.config.type === 'conversion' ? 'conversion' : 'penalty',
        points: this.config.type === 'conversion' ? 2 : 3,
      });
    }

    this.time.delayedCall(1500, () => {
      this.scene.stop();
    });
  }
}
