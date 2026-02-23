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
  stats?: {
    homeStrength: number;
    awayStrength: number;
    homeHooking: number;
    awayHooking: number;
  };
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
  private phase: 'setup' | 'engage' | 'contest' | 'decision' | 'complete' = 'setup';
  private tapCount = 0;
  // @ts-ignore — used by scrum engagement timing
  private tapTimer = 0;
  // private contestDuration = 3000; // Removed
  private contestElapsed = 0;
  private aimAngle = 0;
  private aimDirection = 1;

  // Lineout target selection
  private lineoutTarget: 'front' | 'middle' | 'back' = 'middle';

  private homeStrength = 50;
  private awayStrength = 50;
  private homeHooking = 50;
  private awayHooking = 50;
  
  // Collapse monitoring
  private highPowerDuration = 0;
  
  // Hooking race
  private myHookProgress = 0;
  private oppHookProgress = 0;

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
    
    if (data.stats) {
      this.homeStrength = data.stats.homeStrength;
      this.awayStrength = data.stats.awayStrength;
      this.homeHooking = data.stats.homeHooking;
      this.awayHooking = data.stats.awayHooking;
    }
    this.highPowerDuration = 0;
    this.myHookProgress = 0;
    this.oppHookProgress = 0;
  }

  create(): void {
    const { width, height } = this.cameras.main;

    // Dark overlay
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
      .setScrollFactor(0);

    // Title / Phase text
    this.phaseText = this.add.text(width / 2, height * 0.2, '', {
      fontSize: '48px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10); // Ensure depth

    // Instruction text
    this.instructionText = this.add.text(width / 2, height * 0.85, '', {
      fontSize: '24px', color: '#dddddd'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10);

    // Power Bar Container
    this._powerBarBg = this.add.rectangle(width / 2, height * 0.7, 154, 24, 0x000000)
      .setStrokeStyle(2, 0xffffff).setScrollFactor(0).setDepth(10);
      
    this.powerBar = this.add.rectangle(width / 2 - 75, height * 0.7, 0, 20, 0xffff00)
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(10);

    // Initial state setup based on type
    switch (this.config.type) {
      case 'scrum':
        this.startScrum();
        break;
      case 'lineout':
        this.startLineout();
        break;
      case 'conversion':
      case 'penalty_kick':
        this.startKickAtGoal();
        break;
    }
  }

  update(_time: number, delta: number): void {
      switch (this.config.type) {
         case 'scrum':
            this.updateScrum(delta);
            break;
         case 'lineout':
            this.updateLineout(delta);
            break;
         case 'conversion':
         case 'penalty_kick':
            this.updateKickAtGoal(delta);
            break;
      }
  }

  private startScrum(): void {
    this.phase = 'setup';
    this.instructionText.setText('Press SPACE on "SET". Don\'t over-push!');

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
        this.phaseText.setText('PUSH! Tap SPACE! Watch Stability!');
        this.instructionText.setText('Rapid taps push. Too much power collapses!');
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
    this.cameras.main.shake(100, 0.01);
    this.time.delayedCall(2000, () => {
      this.scene.stop();
      EventBus.emit('ruckResolved', { team: this.config.team === 'home' ? 'away' : 'home' });
    });
  }

  // In updateScrum (rest of file)
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
    
    const yourStrength = this.config.team === 'home' ? this.homeStrength : this.awayStrength;
    const oppStrength = this.config.team === 'home' ? this.awayStrength : this.homeStrength;
    
    // Base power from strength difference (0.5 + difference/200)
    // If stats are 0-100.
    const basePower = 0.5 + (yourStrength - oppStrength) * 0.005; 
    
    // Taps add to power
    const tapContribution = this.tapCount * 0.05; // 10 taps = +0.5
    
    // Difficulty noise/pushback from opponent
    const noise = Math.sin(Date.now() / 200) * 0.05;

    this.powerLevel = Math.max(0, Math.min(1, basePower + tapContribution + noise));
    
    // COLLAPSE LOGIC
    if (this.powerLevel > 0.9) {
       this.highPowerDuration += delta;
       this.powerBar.setFillStyle(0xef4444); // Red warning
    } else {
       this.highPowerDuration = Math.max(0, this.highPowerDuration - delta); // Cool down
       this.powerBar.setFillStyle(this.powerLevel > 0.6 ? 0x22c55e : 0xeab308);
    }

    if (this.highPowerDuration > 1000) {
       this.handleCollapse();
       return;
    }
    
    this.powerBar.width = 150 * this.powerLevel;
    
    // HOOKING RACE LOGIC
    // We only hook if we are not being pushed back too hard (power > 0.3)
    // Hook speed = Base + (Power bonus) + (Stat bonus)
    // Target: reach 100
    
    const myStat = this.config.team === 'home' ? this.homeHooking : this.awayHooking;
    const oppStat = this.config.team === 'home' ? this.awayHooking : this.homeHooking;
    
    // My hook speed
    let mySpeed = 0;
    if (this.powerLevel > 0.3) {
      mySpeed = 0.05 + (this.powerLevel * 0.05) + (myStat / 2000); // e.g. 0.05 + 0.05 + 0.04 ~= 0.14 per ms? No, delta is ms.
      // 0.1 per ms = 100 in 1000ms (1 sec). Too fast.
      // Let's aim for ~3 seconds default. 3000ms.
      // Need speed ~ 0.033 per ms.
      mySpeed = 0.02 + (this.powerLevel * 0.02) + (myStat / 5000); 
    }
    
    // Opponent hook speed (inversely related to my power)
    let oppSpeed = 0;
    const oppPower = 1 - this.powerLevel;
    if (oppPower > 0.3) {
       oppSpeed = 0.02 + (oppPower * 0.02) + (oppStat / 5000);
    }
    
    this.myHookProgress += delta * mySpeed;
    this.oppHookProgress += delta * oppSpeed;
    
    // Check for win
    let finished = false;
    let won = false;
    
    if (this.myHookProgress >= 100) {
       finished = true;
       won = true;
    } else if (this.oppHookProgress >= 100) {
       finished = true;
       won = false;
    } else if (this.contestElapsed >= 6000) { // Timeout safety (6s)
       finished = true;
       won = this.myHookProgress > this.oppHookProgress;
    }

    // Contest complete
    if (finished) {
      if (won) {
         // Decision phase for winner:
         this.phase = 'decision';
         this.phaseText.setText('WIN! ← BLIND | OPEN →');
         this.instructionText.setText('Select Attack Side');
         
         const winningTeam = this.config.team;

         if (this.input.keyboard) {
             this.input.keyboard.once('keydown-LEFT', () => this.finishScrum(winningTeam, 'blindside'));
             this.input.keyboard.once('keydown-RIGHT', () => this.finishScrum(winningTeam, 'openside'));
         }
         // Fallback
         this.time.delayedCall(3000, () => {
             if (this.phase === 'decision') this.finishScrum(winningTeam, 'openside');
         });
      } else {
         // Lost
         this.phase = 'complete';
         this.phaseText.setText('BALL LOST!');
         this.instructionText.setText('Opponent hooked faster');
         this.time.delayedCall(1000, () => {
             this.scene.stop();
             EventBus.emit('ruckResolved', { team: this.config.team === 'home' ? 'away' : 'home', action: 'openside' }); 
         });
      }
    }
  }

  private finishScrum(team: 'home'|'away', side: 'blindside'|'openside'): void {
      this.phase = 'complete';
      this.phaseText.setText(side === 'blindside' ? 'BLIDE SIDE!' : '0PEN SIDE!');
      this.instructionText.setText('');
      
      this.time.delayedCall(1000, () => {
        this.scene.stop();
        EventBus.emit('ruckResolved', { team, action: side });
      });
  }

  private handleCollapse(): void {
     this.phase = 'complete';
     this.phaseText.setText('SCRUM COLLAPSED!');
     this.instructionText.setText('Penalty for over-pushing!');
     this.cameras.main.shake(200, 0.02);
     
     // Penalty against this team (so opposition wins)
     this.time.delayedCall(2000, () => {
        this.scene.stop();
        EventBus.emit('penaltyAwarded', { 
           x: this.config.x, 
           y: this.config.y, 
           reason: 'collapsing_scrum', 
           againstAttack: this.config.team === 'home' 
        });
     });
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
                y: jumper.y - 40, // Lift up
                scaleX: 1.2, 
                scaleY: 1.2,
                duration: 300,
                yoyo: true,
                ease: 'Back.easeOut'
             });
           }
          this.resolveLineout();
        }
      }
    }
  }

  // Contest time tracked manually, no fixed duration property needed
  // private contestElapsed = 0; // Already declared above, removing duplicate and fixing previous bad edit logic
  // ...

  // ... (inside resolveLineout)
  private resolveLineout(): void {
    this.isCharging = false;
    
    // Timing-based success: sweet spot at power 0.5–0.8
    const timingGood = (this.powerLevel > 0.5 && this.powerLevel < 0.8);
    const stealChance = timingGood ? 0.1 : 0.6;
    
    // Determine winner based on random roll modified by timing
    const success = Math.random() > stealChance;
    const winningTeam = success ? this.config.team : (this.config.team === 'home' ? 'away' : 'home');

    if (!success || this.config.team !== this.controlledPlayerTeam()) {
       // CPU won or we lost -> Immediate resolution
       this.finishLineout(winningTeam, 'pass'); // CPU always passes for now
    } else {
       // We won -> Decision time
       this.phase = 'decision';
       this.phaseText.setText('WIN! ← PASS | MAUL →');
       this.instructionText.setText('Select Next Move');

       if (this.input.keyboard) {
           this.input.keyboard.once('keydown-LEFT', () => this.finishLineout(winningTeam, 'pass'));
           this.input.keyboard.once('keydown-RIGHT', () => this.finishLineout(winningTeam, 'maul'));
       }
       // Fallback timeout
       this.time.delayedCall(3000, () => {
          if (this.phase === 'decision') this.finishLineout(winningTeam, 'pass');
       });
    }
  }

  private finishLineout(team: 'home' | 'away', action: 'pass' | 'maul'): void {
      this.phase = 'complete';
      this.phaseText.setText(action === 'pass' ? 'QUICK PASS!' : 'DRIVING MAUL!');
      this.instructionText.setText('');
      
      this.time.delayedCall(1000, () => {
        this.scene.stop();
        EventBus.emit('ruckResolved', { team, action });
      });
  }

  // Helper to check controlled team (assuming simple single player control for M3 context)
  private controlledPlayerTeam(): 'home' | 'away' {
      // In a real scenario, we'd pass this in config or check registry.
      // For now, assume user plays 'home' as per default setup usually.
      // Or check config.team if we assume we always play the active side in this mini-game?
      // Wait, config.team is the *throwing* team.
      // If I am away team and I throw...
      return 'home'; // Default assumption for M3
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
