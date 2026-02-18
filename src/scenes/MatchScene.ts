/**
 * MatchScene — The core gameplay scene.
 *
 * Renders the pitch, spawns two teams of 15, manages the ball,
 * handles player input, and drives the main game loop.
 *
 * M2 integration: PhaseManager, RuckSystem, Tackle, Kicking (PowerBar),
 * Passing types, and improved player switching.
 * M3 integration: ClockSystem, ScoringSystem, kickoff, half-time, full-time.
 */
import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Ball } from '../entities/Ball';
import { Team } from '../entities/Team';
import { PITCH, CAMERA, TEAM_COLORS, PLAYER, Position, DIFFICULTY } from '../utils/Constants';
import type { DifficultyConfig } from '../utils/Constants';
import { EventBus } from '../utils/EventBus';
import { distance } from '../utils/MathHelpers';
import { PhaseManager } from '../systems/PhaseManager';
import { RuckSystem } from '../systems/RuckSystem';
import { ClockSystem } from '../systems/ClockSystem';
import { ScoringSystem } from '../systems/ScoringSystem';
import { MaulSystem } from '../systems/MaulSystem';
import { OffsidesSystem } from '../systems/OffsidesSystem';
import { resolveTackle, isInTackleRange } from '../components/Tackle';
import { PowerBar, KickType, KICK_CONFIGS, calculateKickDistance, calculateKickDeviation } from '../components/Kicking';
import { selectPassType, PASS_CONFIGS } from '../components/Passing';
import { catchProbability } from '../components/Stats';

export class MatchScene extends Phaser.Scene {
  // ── Teams & Ball ───────────────────────────────────────
  homeTeam!: Team;
  awayTeam!: Team;
  ball!: Ball;

  // ── Currently controlled player ────────────────────────
  controlledPlayer!: Player;
  selectionRing!: Phaser.GameObjects.Image;
  private controlArrow!: Phaser.GameObjects.Text;

  // ── Input cursors ──────────────────────────────────────
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;

  // ── Minimap ────────────────────────────────────────────
  private minimapCamera!: Phaser.Cameras.Scene2D.Camera;

  // ── HUD elements ───────────────────────────────────────
  private scoreText!: Phaser.GameObjects.Text;
  private clockText!: Phaser.GameObjects.Text;
  private phaseText!: Phaser.GameObjects.Text;
  private staminaBar!: Phaser.GameObjects.Rectangle;
  private staminaBg!: Phaser.GameObjects.Rectangle;
  private staminaLabel!: Phaser.GameObjects.Text;
  private powerBarBg!: Phaser.GameObjects.Rectangle;
  private powerBarFill!: Phaser.GameObjects.Rectangle;
  private powerBarLabel!: Phaser.GameObjects.Text;
  private kickTypeText!: Phaser.GameObjects.Text;
  private actionPrompt!: Phaser.GameObjects.Text;

  // ── M2/M3/M5 Systems ────────────────────────────────────
  private phaseManager!: PhaseManager;
  private ruckSystem!: RuckSystem;
  private clockSystem!: ClockSystem;
  private scoringSystem!: ScoringSystem;
  private maulSystem!: MaulSystem;
  private offsidesSystem!: OffsidesSystem;
  // @ts-ignore — used by M5 AI difficulty scaling
  private difficulty: DifficultyConfig = DIFFICULTY.MEDIUM;
  private powerBar!: PowerBar;
  private selectedKickType: KickType = KickType.PUNT;
  private kickSelectorOpen = false;
  private kickSelectorItems: Phaser.GameObjects.Text[] = [];

  // ── Game state ─────────────────────────────────────────
  private autoSwitchTimer = 0;
  // @ts-ignore — used by fend mechanic
  private _fendingActive = false;

  // ── HUD helpers ────────────────────────────────────────
  private hudElements: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super({ key: 'MatchScene' });
  }

  create(): void {
    // ── Draw the pitch ──────────────────────────────────
    this.drawPitch();

    // ── Create teams ────────────────────────────────────
    this.homeTeam = new Team(this, 'home', TEAM_COLORS.HOME);
    this.awayTeam = new Team(this, 'away', TEAM_COLORS.AWAY);

    // ── Create ball ─────────────────────────────────────
    this.ball = new Ball(this, PITCH.HALFWAY, PITCH.HEIGHT_PX / 2);

    // ── Set initial controlled player (home fly-half) ───
    this.controlledPlayer = this.homeTeam.getPlayerByPosition(Position.FLY_HALF);
    this.selectionRing = this.add.image(
      this.controlledPlayer.sprite.x,
      this.controlledPlayer.sprite.y,
      'selection_ring'
    ).setDepth(0);

    // Arrow above controlled player
    this.controlArrow = this.add.text(
      this.controlledPlayer.sprite.x,
      this.controlledPlayer.sprite.y - 18,
      '▼', { fontSize: '10px', color: '#ffff00' }
    ).setOrigin(0.5).setDepth(3);

    // ── Camera setup ────────────────────────────────────
    this.cameras.main.setBounds(0, 0, PITCH.WIDTH_PX, PITCH.HEIGHT_PX);
    this.cameras.main.startFollow(this.controlledPlayer.sprite, true, CAMERA.FOLLOW_LERP, CAMERA.FOLLOW_LERP);
    this.cameras.main.setZoom(CAMERA.ZOOM_DEFAULT);

    // ── M2/M3/M5 Systems ───────────────────────────────────
    this.phaseManager = new PhaseManager('KICK_OFF');
    this.ruckSystem = new RuckSystem(this);
    this.clockSystem = new ClockSystem();
    this.scoringSystem = new ScoringSystem();
    this.maulSystem = new MaulSystem(this);
    this.offsidesSystem = new OffsidesSystem();
    this.powerBar = new PowerBar();

    // Start with kickoff → open play
    this.phaseManager.transition('OPEN_PLAY');
    this.performKickoff();

    // ── Event listeners ─────────────────────────────────
    this.setupEventListeners();

    // ── Minimap ─────────────────────────────────────────
    this.setupMinimap();

    // ── Input ───────────────────────────────────────────
    this.setupInput();

    // ── HUD ─────────────────────────────────────────────
    this.createHUD();

    // ── Fade in ─────────────────────────────────────────
    this.cameras.main.fadeIn(400, 0, 0, 0);
  }

  update(_time: number, delta: number): void {
    // ── Update match clock ──────────────────────────────
    this.clockSystem.update(delta);

    // ── Handle controlled player input ──────────────────
    this.handlePlayerInput(delta);

    // ── Update selection ring + arrow ────────────────────
    this.selectionRing.setPosition(
      this.controlledPlayer.sprite.x,
      this.controlledPlayer.sprite.y
    );
    this.controlArrow.setPosition(
      this.controlledPlayer.sprite.x,
      this.controlledPlayer.sprite.y - 18
    );

    // ── Low stamina red tint ────────────────────────────
    if (this.controlledPlayer.stamina < PLAYER.STAMINA_MIN_SPRINT) {
      this.controlledPlayer.sprite.setTint(0xff6666);
    } else if (!this.controlledPlayer.isGrounded) {
      this.controlledPlayer.sprite.setTint(TEAM_COLORS.HOME);
    }

    // ── Update power bar if charging ────────────────────
    this.powerBar.update();
    this.updatePowerBarUI();

    // ── Update ball ─────────────────────────────────────
    this.ball.update(delta);

    // ── Update ruck system ──────────────────────────────
    this.ruckSystem.update(delta);

    // ── Auto ruck commit ────────────────────────────────
    if (this.ruckSystem.isActive()) {
      this.autoCommitToRuck();
    }

    // ── Update maul system ──────────────────────────────
    if (this.maulSystem.isActive()) {
      this.maulSystem.update(delta, this.ball);
    }

    // ── Update offside lines ────────────────────────────
    if (this.ruckSystem.isActive()) {
      const ruckState = this.ruckSystem.getState();
      this.offsidesSystem.setRuckOffsideLine(ruckState.x, true);
    } else {
      this.offsidesSystem.clearRuckOffside();
      this.offsidesSystem.setGeneralOffsideLine(this.ball.sprite.x);
    }

    // ── Check for try scored ────────────────────────────
    if (this.phaseManager.getPhase() === 'OPEN_PLAY') {
      const tryResult = this.scoringSystem.checkTry(this.ball);
      if (tryResult && tryResult.scored) {
        this.handleTryScored(tryResult.team);
      }
    }

    // ── Auto-switch on defense ──────────────────────────
    this.autoSwitchTimer += delta;
    if (this.autoSwitchTimer > 1000 && !this.controlledPlayer.hasBall) {
      this.autoSwitchOnDefense();
      this.autoSwitchTimer = 0;
    }

    // ── Update AI players ───────────────────────────────
    this.homeTeam.update(delta, this.ball, this.controlledPlayer);
    this.awayTeam.update(delta, this.ball, null);

    // ── Update HUD ──────────────────────────────────────
    this.updateHUD();
  }

  // ─────────────────────────────────────────────────────────
  // EVENT LISTENERS
  // ─────────────────────────────────────────────────────────

  private setupEventListeners(): void {
    EventBus.on('ruckBallAvailable', () => {
      if (this.phaseManager.canTransition('OPEN_PLAY')) {
        this.phaseManager.transition('OPEN_PLAY');
        this.ruckSystem.endRuck();
        const sh = this.homeTeam.getPlayerByPosition(Position.SCRUM_HALF);
        this.ball.attachToPlayer(sh);
      }
    });

    EventBus.on('ruckTurnover', () => {
      if (this.phaseManager.canTransition('OPEN_PLAY')) {
        this.phaseManager.transition('OPEN_PLAY');
        this.ruckSystem.endRuck();
        const awaySH = this.awayTeam.getPlayerByPosition(Position.SCRUM_HALF);
        this.ball.attachToPlayer(awaySH);
      }
    });

    EventBus.on('ruckTimeout', () => {
      this.ruckSystem.endRuck();
      if (this.phaseManager.canTransition('SCRUM')) {
        this.phaseManager.transition('SCRUM');
        this.time.delayedCall(2000, () => {
          if (this.phaseManager.canTransition('OPEN_PLAY')) {
            this.phaseManager.transition('OPEN_PLAY');
            const sh = this.homeTeam.getPlayerByPosition(Position.SCRUM_HALF);
            this.ball.attachToPlayer(sh);
          }
        });
      }
    });

    EventBus.on('penaltyAwarded', (_data) => {
      if (this.phaseManager.canTransition('PENALTY')) {
        this.phaseManager.transition('PENALTY');
        this.ruckSystem.endRuck();
        this.time.delayedCall(1500, () => {
          if (this.phaseManager.canTransition('TAP_AND_GO')) {
            this.phaseManager.transition('TAP_AND_GO');
            this.phaseManager.transition('OPEN_PLAY');
            const flyHalf = this.homeTeam.getPlayerByPosition(Position.FLY_HALF);
            this.ball.attachToPlayer(flyHalf);
          }
        });
      }
    });

    // ── M3: Clock events ─────────────────────────────────
    EventBus.on('halfTime', () => {
      if (this.phaseManager.canTransition('HALF_TIME')) {
        this.phaseManager.transition('HALF_TIME');
      } else {
        this.phaseManager.forcePhase('HALF_TIME');
      }
      this.clockSystem.pause();
      // Launch half-time scene overlay
      const score = this.scoringSystem.getScore();
      this.scene.launch('HalfTimeScene', {
        homeScore: score.home,
        awayScore: score.away,
        possession: 50,
        tackles: { home: 0, away: 0 },
        passes: { home: 0, away: 0 },
        carries: { home: 0, away: 0 },
        penalties: { home: 0, away: 0 },
      });
      this.scene.pause();
    });

    EventBus.on('fullTime', () => {
      if (this.phaseManager.canTransition('FULL_TIME')) {
        this.phaseManager.transition('FULL_TIME');
      } else {
        this.phaseManager.forcePhase('FULL_TIME');
      }
      this.clockSystem.pause();
      const score = this.scoringSystem.getScore();
      this.scene.start('ResultScene', {
        homeScore: score.home,
        awayScore: score.away,
        stats: {
          possession: { home: 50, away: 50 },
          tackles: { home: 0, away: 0 },
          carries: { home: 0, away: 0 },
          passes: { home: 0, away: 0 },
          penalties: { home: 0, away: 0 },
        },
      });
    });

    // Resume from half-time
    EventBus.on('secondHalfStart', () => {
      this.clockSystem.startSecondHalf();
      this.phaseManager.forcePhase('KICK_OFF');
      this.phaseManager.transition('OPEN_PLAY');
      this.performKickoff();
      this.scene.resume();
    });

    // ── Score event for HUD ──────────────────────────────
    EventBus.on('score', () => {
      // HUD picks up new score in updateHUD()
    });
  }

  // ─────────────────────────────────────────────────────────
  // PITCH DRAWING
  // ─────────────────────────────────────────────────────────

  private drawPitch(): void {
    const gfx = this.add.graphics();

    // Grass background with stripe effect
    for (let x = 0; x < PITCH.WIDTH_PX; x += 100) {
      const shade = (x / 100) % 2 === 0 ? 0x2d7d2d : 0x339933;
      gfx.fillStyle(shade, 1);
      gfx.fillRect(x, 0, 100, PITCH.HEIGHT_PX);
    }

    // In-goal areas (lighter tint)
    gfx.fillStyle(0x3d8d3d, 1);
    gfx.fillRect(0, 0, PITCH.TRY_LINE_LEFT, PITCH.HEIGHT_PX);
    gfx.fillRect(PITCH.TRY_LINE_RIGHT, 0, PITCH.WIDTH_PX - PITCH.TRY_LINE_RIGHT, PITCH.HEIGHT_PX);

    // Field lines
    gfx.lineStyle(2, 0xffffff, 0.8);

    // Touchlines
    gfx.strokeRect(PITCH.TRY_LINE_LEFT, 0, PITCH.TRY_LINE_RIGHT - PITCH.TRY_LINE_LEFT, PITCH.HEIGHT_PX);

    // Halfway
    gfx.beginPath();
    gfx.moveTo(PITCH.HALFWAY, 0);
    gfx.lineTo(PITCH.HALFWAY, PITCH.HEIGHT_PX);
    gfx.strokePath();

    // 22m lines
    this.drawDashedLine(gfx, PITCH.LINE_22_LEFT, 0, PITCH.LINE_22_LEFT, PITCH.HEIGHT_PX);
    this.drawDashedLine(gfx, PITCH.LINE_22_RIGHT, 0, PITCH.LINE_22_RIGHT, PITCH.HEIGHT_PX);

    // 10m lines
    this.drawDashedLine(gfx, PITCH.LINE_10_LEFT, 0, PITCH.LINE_10_LEFT, PITCH.HEIGHT_PX);
    this.drawDashedLine(gfx, PITCH.LINE_10_RIGHT, 0, PITCH.LINE_10_RIGHT, PITCH.HEIGHT_PX);

    // Try lines (solid, thicker)
    gfx.lineStyle(3, 0xffffff, 1);
    gfx.beginPath();
    gfx.moveTo(PITCH.TRY_LINE_LEFT, 0);
    gfx.lineTo(PITCH.TRY_LINE_LEFT, PITCH.HEIGHT_PX);
    gfx.strokePath();
    gfx.beginPath();
    gfx.moveTo(PITCH.TRY_LINE_RIGHT, 0);
    gfx.lineTo(PITCH.TRY_LINE_RIGHT, PITCH.HEIGHT_PX);
    gfx.strokePath();

    // Dead-ball lines
    gfx.lineStyle(2, 0xffffff, 0.5);
    gfx.beginPath();
    gfx.moveTo(50, 0);
    gfx.lineTo(50, PITCH.HEIGHT_PX);
    gfx.strokePath();
    gfx.beginPath();
    gfx.moveTo(PITCH.WIDTH_PX - 50, 0);
    gfx.lineTo(PITCH.WIDTH_PX - 50, PITCH.HEIGHT_PX);
    gfx.strokePath();

    // Halfway circle
    gfx.lineStyle(2, 0xffffff, 0.6);
    gfx.strokeCircle(PITCH.HALFWAY, PITCH.HEIGHT_PX / 2, 50);

    // Goal posts
    this.drawGoalPosts(gfx, PITCH.POST_LEFT_X, PITCH.POST_Y);
    this.drawGoalPosts(gfx, PITCH.POST_RIGHT_X, PITCH.POST_Y);

    // 5m dashes along touchlines
    gfx.lineStyle(1, 0xffffff, 0.4);
    for (let x = PITCH.TRY_LINE_LEFT; x <= PITCH.TRY_LINE_RIGHT; x += 50) {
      gfx.beginPath();
      gfx.moveTo(x, 0);
      gfx.lineTo(x, 10);
      gfx.strokePath();
      gfx.beginPath();
      gfx.moveTo(x, PITCH.HEIGHT_PX - 10);
      gfx.lineTo(x, PITCH.HEIGHT_PX);
      gfx.strokePath();
    }

    gfx.setDepth(-1);
    this.physics.world.setBounds(0, 0, PITCH.WIDTH_PX, PITCH.HEIGHT_PX);
  }

  private drawDashedLine(gfx: Phaser.GameObjects.Graphics, x1: number, y1: number, x2: number, y2: number): void {
    const dashLength = 10;
    const gapLength = 6;
    const totalLength = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    const dx = (x2 - x1) / totalLength;
    const dy = (y2 - y1) / totalLength;
    let drawn = 0;
    let drawing = true;

    gfx.lineStyle(1, 0xffffff, 0.5);
    while (drawn < totalLength) {
      const segLen = drawing ? dashLength : gapLength;
      const endDraw = Math.min(drawn + segLen, totalLength);
      if (drawing) {
        gfx.beginPath();
        gfx.moveTo(x1 + dx * drawn, y1 + dy * drawn);
        gfx.lineTo(x1 + dx * endDraw, y1 + dy * endDraw);
        gfx.strokePath();
      }
      drawn = endDraw;
      drawing = !drawing;
    }
  }

  private drawGoalPosts(gfx: Phaser.GameObjects.Graphics, x: number, y: number): void {
    const postWidth = PITCH.POST_WIDTH;
    const halfPost = postWidth / 2;
    gfx.lineStyle(3, 0xf0e68c, 1);
    gfx.beginPath();
    gfx.moveTo(x, y - halfPost);
    gfx.lineTo(x, y + halfPost);
    gfx.strokePath();
    gfx.lineStyle(3, 0xf0e68c, 1);
    gfx.beginPath();
    gfx.moveTo(x - 5, y - halfPost);
    gfx.lineTo(x - 5, y + halfPost);
    gfx.strokePath();
    gfx.fillStyle(0xffd700, 1);
    gfx.fillCircle(x - 5, y - halfPost, 3);
    gfx.fillCircle(x - 5, y + halfPost, 3);
  }

  // ─────────────────────────────────────────────────────────
  // MINIMAP
  // ─────────────────────────────────────────────────────────

  private setupMinimap(): void {
    const mapW = 180;
    const mapH = 90;
    const padding = 10;
    const { width, height } = this.cameras.main;

    this.minimapCamera = this.cameras.add(
      width - mapW - padding,
      height - mapH - padding,
      mapW, mapH
    );
    this.minimapCamera.setZoom(mapW / PITCH.WIDTH_PX);
    this.minimapCamera.setScroll(0, 0);
    this.minimapCamera.setBackgroundColor(0x1a3a1a);
    this.minimapCamera.setAlpha(0.85);
    this.minimapCamera.setName('minimap');

    const border = this.add.rectangle(
      width - mapW / 2 - padding,
      height - mapH / 2 - padding,
      mapW + 2, mapH + 2
    ).setStrokeStyle(1, 0x4ade80).setScrollFactor(0).setDepth(100);
    this.minimapCamera.ignore(border);
    this.hudElements.push(border);
  }

  // ─────────────────────────────────────────────────────────
  // INPUT
  // ─────────────────────────────────────────────────────────

  private setupInput(): void {
    if (!this.input.keyboard) return;

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = {
      W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.keys = {
      SHIFT: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
      SPACE: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      Q: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q),
      E: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E),
      R: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R),
      F: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F),
      T: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.T),
    };

    // Player switch
    this.keys.F.on('down', () => this.switchPlayer());

    // Pass left/right
    this.keys.Q.on('down', () => this.tryPass('left'));
    this.keys.E.on('down', () => this.tryPass('right'));

    // Kick — hold R to charge, release to kick
    this.keys.R.on('down', () => this.startKickCharge());
    this.keys.R.on('up', () => this.releaseKick());

    // Tackle / Fend
    this.keys.SPACE.on('down', () => this.tryTackleOrFend());
    this.keys.SPACE.on('up', () => { this._fendingActive = false; });

    // Kick type selector
    this.keys.T.on('down', () => this.toggleKickSelector());
  }

  private handlePlayerInput(delta: number): void {
    const player = this.controlledPlayer;
    let vx = 0;
    let vy = 0;

    if (this.wasd.A.isDown || this.cursors.left.isDown) vx -= 1;
    if (this.wasd.D.isDown || this.cursors.right.isDown) vx += 1;
    if (this.wasd.W.isDown || this.cursors.up.isDown) vy -= 1;
    if (this.wasd.S.isDown || this.cursors.down.isDown) vy += 1;

    if (vx !== 0 && vy !== 0) {
      const diag = 1 / Math.SQRT2;
      vx *= diag;
      vy *= diag;
    }

    const sprinting = this.keys.SHIFT.isDown && player.stamina > 0;
    player.moveInDirection(vx, vy, sprinting, delta);
  }

  // ─────────────────────────────────────────────────────────
  // PLAYER SWITCHING
  // ─────────────────────────────────────────────────────────

  private switchPlayer(): void {
    const ballPos = { x: this.ball.sprite.x, y: this.ball.sprite.y };
    let closest: Player | null = null;
    let closestDist = Infinity;

    for (const p of this.homeTeam.players) {
      if (p === this.controlledPlayer) continue;
      if (p.isGrounded || p.isInRuck) continue;
      const d = distance({ x: p.sprite.x, y: p.sprite.y }, ballPos);
      if (d < closestDist) {
        closestDist = d;
        closest = p;
      }
    }

    if (closest) {
      this.controlledPlayer = closest;
      this.cameras.main.startFollow(this.controlledPlayer.sprite, true, CAMERA.FOLLOW_LERP, CAMERA.FOLLOW_LERP);
      EventBus.emit('playerSwitched', { playerId: closest.id });
    }
  }

  /** Auto-switch to nearest player to ball carrier on defense */
  private autoSwitchOnDefense(): void {
    // Only auto-switch when away team has ball
    const awayHasBall = this.ball.carrier && this.ball.carrier.teamSide === 'away';
    if (!awayHasBall) return;

    // Don't switch if player is the ball carrier (shouldn't happen for defense)
    if (this.controlledPlayer.hasBall) return;

    const carrierPos = { x: this.ball.carrier!.sprite.x, y: this.ball.carrier!.sprite.y };
    let closest: Player | null = null;
    let closestDist = Infinity;

    for (const p of this.homeTeam.players) {
      if (p.isGrounded || p.isInRuck) continue;
      const d = distance({ x: p.sprite.x, y: p.sprite.y }, carrierPos);
      if (d < closestDist) {
        closestDist = d;
        closest = p;
      }
    }

    if (closest && closest !== this.controlledPlayer) {
      this.controlledPlayer = closest;
      this.cameras.main.startFollow(this.controlledPlayer.sprite, true, CAMERA.FOLLOW_LERP, CAMERA.FOLLOW_LERP);
    }
  }

  // ─────────────────────────────────────────────────────────
  // PASSING (M2.5)
  // ─────────────────────────────────────────────────────────

  private tryPass(direction: 'left' | 'right'): void {
    if (!this.controlledPlayer.hasBall) return;

    const carrier = this.controlledPlayer;
    const carrierPos = { x: carrier.sprite.x, y: carrier.sprite.y };

    let bestTarget: Player | null = null;
    let bestDist = Infinity;

    for (const p of this.homeTeam.players) {
      if (p === carrier) continue;

      const pPos = { x: p.sprite.x, y: p.sprite.y };

      // Direction check
      if (direction === 'left' && pPos.y >= carrierPos.y) continue;
      if (direction === 'right' && pPos.y <= carrierPos.y) continue;

      // Onside check — receiver must be behind or level
      const behind = pPos.x <= carrierPos.x + 20;
      if (!behind) continue;

      const d = distance(carrierPos, pPos);

      // Auto-select pass type and check range
      const passType = selectPassType(d, carrier.stats.handling);
      const config = PASS_CONFIGS[passType];
      const maxRange = config.baseRange * (carrier.stats.handling / 100);
      if (d > maxRange) continue;

      if (d < bestDist) {
        bestDist = d;
        bestTarget = p;
      }
    }

    if (bestTarget) {
      const passType = selectPassType(bestDist, carrier.stats.handling);
      const config = PASS_CONFIGS[passType];

      this.ball.passTo(carrier, bestTarget);
      EventBus.emit('ballPassed', {
        passerId: carrier.id,
        receiverId: bestTarget.id,
        type: passType,
      });

      // Catch probability check — on pass completion
      this.time.delayedCall(300, () => {
        if (this.ball.state === 'carried' && this.ball.carrier === bestTarget) {
          const catchChance = catchProbability(bestTarget.stats.handling, config.accuracyMod);
          if (Math.random() > catchChance) {
            // Knock-on!
            this.ball.dropLoose(bestTarget.sprite.x, bestTarget.sprite.y);
            bestTarget.releaseBall();
            EventBus.emit('knockOn', { playerId: bestTarget.id });

            if (this.phaseManager.canTransition('KNOCK_ON')) {
              this.phaseManager.transition('KNOCK_ON');
              // Award scrum after knock-on
              this.time.delayedCall(1500, () => {
                if (this.phaseManager.canTransition('SCRUM')) {
                  this.phaseManager.transition('SCRUM');
                  this.time.delayedCall(2000, () => {
                    if (this.phaseManager.canTransition('OPEN_PLAY')) {
                      this.phaseManager.transition('OPEN_PLAY');
                    }
                  });
                }
              });
            }
          }
        }
      });
    }
  }

  // ─────────────────────────────────────────────────────────
  // KICKING (M2.7) — Power bar + kick types
  // ─────────────────────────────────────────────────────────

  private startKickCharge(): void {
    if (!this.controlledPlayer.hasBall) return;
    this.powerBar.startCharging();
    this.showPowerBar();
  }

  private releaseKick(): void {
    if (!this.powerBar.isCharging) return;

    const power = this.powerBar.release();
    const kicker = this.controlledPlayer;
    const kickType = this.selectedKickType;

    const kickDist = calculateKickDistance(kickType, kicker.stats.kicking, power);
    const deviation = calculateKickDeviation(kickType, kicker.stats.kicking, power);
    const angle = this.ball.facingToAngle(kicker.facing) + deviation;
    const config = KICK_CONFIGS[kickType];

    kicker.releaseBall();
    this.ball.carrier = null;

    // Calculate end position
    const endX = kicker.sprite.x + Math.cos(angle) * kickDist;
    const endY = kicker.sprite.y + Math.sin(angle) * kickDist;

    this.ball.kickWithType(
      kicker, power, kickDist,
      endX, endY,
      config.arcHeight,
      config.flightDuration,
      config.bounces,
      config.bounceDeviation,
    );

    this.hidePowerBar();
    EventBus.emit('ballKicked', { kickerId: kicker.id, type: kickType, power });
  }

  private showPowerBar(): void {
    this.powerBarBg.setVisible(true);
    this.powerBarFill.setVisible(true);
    this.powerBarLabel.setVisible(true);
  }

  private hidePowerBar(): void {
    this.powerBarBg.setVisible(false);
    this.powerBarFill.setVisible(false);
    this.powerBarLabel.setVisible(false);
  }

  private updatePowerBarUI(): void {
    if (!this.powerBar.isCharging) return;
    this.powerBarFill.width = 120 * this.powerBar.power;
    this.powerBarFill.setFillStyle(this.powerBar.getColor());
  }

  // ─────────────────────────────────────────────────────────
  // KICK TYPE SELECTOR (T key)
  // ─────────────────────────────────────────────────────────

  private toggleKickSelector(): void {
    if (this.kickSelectorOpen) {
      this.closeKickSelector();
      return;
    }

    this.kickSelectorOpen = true;
    const { width, height } = this.cameras.main;
    const types = [KickType.PUNT, KickType.GRUBBER, KickType.BOX_KICK, KickType.DROP_GOAL, KickType.TOUCH_FINDER];
    const startY = height / 2 - (types.length * 20) / 2;

    for (let i = 0; i < types.length; i++) {
      const kt = types[i];
      const selected = kt === this.selectedKickType ? '▸ ' : '  ';
      const label = this.add.text(width / 2, startY + i * 22, `${selected}${i + 1}. ${kt.replace('_', ' ')}`, {
        fontSize: '11px',
        fontFamily: 'monospace',
        color: kt === this.selectedKickType ? '#4ade80' : '#ffffff',
        backgroundColor: '#000000cc',
        padding: { x: 8, y: 3 },
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(200);

      this.kickSelectorItems.push(label);
      this.minimapCamera.ignore(label);
    }

    // Auto-close after 3s
    this.time.delayedCall(3000, () => this.closeKickSelector());

    // Listen for number keys 1–5
    if (this.input.keyboard) {
      for (let i = 0; i < types.length; i++) {
        const key = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE + i);
        key.once('down', () => {
          this.selectedKickType = types[i];
          this.closeKickSelector();
        });
      }
    }
  }

  private closeKickSelector(): void {
    this.kickSelectorOpen = false;
    for (const item of this.kickSelectorItems) {
      item.destroy();
    }
    this.kickSelectorItems = [];
  }

  // ─────────────────────────────────────────────────────────
  // TACKLING & FENDING (M2.8)
  // ─────────────────────────────────────────────────────────

  private tryTackleOrFend(): void {
    // If player has ball → fend
    if (this.controlledPlayer.hasBall) {
      this._fendingActive = true;
      return;
    }

    // Otherwise → tackle nearest opponent with ball
    for (const p of this.awayTeam.players) {
      if (!p.hasBall) continue;

      if (!isInTackleRange(
        this.controlledPlayer.sprite.x, this.controlledPlayer.sprite.y,
        p.sprite.x, p.sprite.y,
        PLAYER.TACKLE_RANGE
      )) continue;

      const carrierSprinting = Math.abs(p.sprite.body?.velocity.x ?? 0) > 100 ||
                               Math.abs(p.sprite.body?.velocity.y ?? 0) > 100;

      const result = resolveTackle(
        this.controlledPlayer.stats,
        p.stats,
        carrierSprinting,
        false, // Away team doesn't fend (AI will handle this later)
      );

      EventBus.emit('tackle', {
        tacklerId: this.controlledPlayer.id,
        carrierId: p.id,
        outcome: result.outcome,
      });

      switch (result.outcome) {
        case 'dominant':
          // Ball dislodged — loose ball
          p.getsTackled();
          this.controlledPlayer.isGrounded = true;
          this.time.delayedCall(result.tacklerRecoveryMs, () => {
            this.controlledPlayer.isGrounded = false;
          });
          this.ball.dropLoose(p.sprite.x, p.sprite.y);
          break;

        case 'normal':
          // Normal tackle → ruck forms
          p.getsTackled();
          this.controlledPlayer.isGrounded = true;
          this.time.delayedCall(result.tacklerRecoveryMs, () => {
            this.controlledPlayer.isGrounded = false;
          });
          this.ball.dropLoose(p.sprite.x, p.sprite.y);

          // Transition to TACKLE then RUCK
          if (this.phaseManager.canTransition('TACKLE')) {
            this.phaseManager.transition('TACKLE');
            this.time.delayedCall(500, () => {
              if (this.phaseManager.canTransition('RUCK')) {
                this.phaseManager.transition('RUCK');
                this.ruckSystem.startRuck(p.sprite.x, p.sprite.y);
              }
            });
          }
          break;

        case 'missed':
          // Tackler stumbles, carrier keeps going
          this.controlledPlayer.sprite.setVelocity(0, 0);
          this.controlledPlayer.isGrounded = true;
          this.time.delayedCall(result.tacklerRecoveryMs, () => {
            this.controlledPlayer.isGrounded = false;
          });
          break;

        case 'fendOff':
          // Carrier fended off the tackler
          this.controlledPlayer.sprite.setVelocity(0, 0);
          this.controlledPlayer.isGrounded = true;
          this.time.delayedCall(result.tacklerRecoveryMs, () => {
            this.controlledPlayer.isGrounded = false;
          });
          break;
      }
      break; // Only tackle one player
    }
  }

  // ─────────────────────────────────────────────────────────
  // RUCK AUTO-COMMIT (M2.9)
  // ─────────────────────────────────────────────────────────

  private autoCommitToRuck(): void {
    const ruckState = this.ruckSystem.getState();
    if (!ruckState.active) return;

    const ruckPos = { x: ruckState.x, y: ruckState.y };

    // Commit nearest non-controlled, non-grounded players
    for (const p of this.homeTeam.players) {
      if (p === this.controlledPlayer || p.isGrounded || p.isInRuck) continue;
      const d = distance({ x: p.sprite.x, y: p.sprite.y }, ruckPos);
      if (d < 80 && ruckState.attackers.length < 4) {
        p.isInRuck = true;
        p.moveToward(ruckState.x, ruckState.y, 0.5);
        this.ruckSystem.commitPlayer(p, true);
      }
    }

    for (const p of this.awayTeam.players) {
      if (p.isGrounded || p.isInRuck) continue;
      const d = distance({ x: p.sprite.x, y: p.sprite.y }, ruckPos);
      if (d < 80 && ruckState.defenders.length < 3) {
        p.isInRuck = true;
        p.moveToward(ruckState.x, ruckState.y, 0.5);
        this.ruckSystem.commitPlayer(p, false);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // KICKOFF (M3)
  // ─────────────────────────────────────────────────────────────

  private performKickoff(): void {
    // Place ball at halfway
    this.ball.sprite.setPosition(PITCH.HALFWAY, PITCH.HEIGHT_PX / 2);
    this.ball.sprite.setVelocity(0, 0);

    // Give ball to fly-half 
    const kicker = this.homeTeam.getPlayerByPosition(Position.FLY_HALF);
    this.ball.attachToPlayer(kicker);

    // Reset all players to formation
    this.homeTeam.setAttackFormation();
    this.awayTeam.setDefenseFormation();

    // Reset all grounded/ruck states
    for (const p of [...this.homeTeam.players, ...this.awayTeam.players]) {
      p.isGrounded = false;
      p.isInRuck = false;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // TRY SCORED (M3)
  // ─────────────────────────────────────────────────────────────

  private handleTryScored(team: 'home' | 'away'): void {
    // Transition phase: TRY_SCORED
    if (this.phaseManager.canTransition('TRY_SCORED')) {
      this.phaseManager.transition('TRY_SCORED');
    } else {
      this.phaseManager.forcePhase('TRY_SCORED');
    }

    // Pause clock during try celebration
    this.clockSystem.pause();

    // Flash "TRY!" text
    const { width, height } = this.cameras.main;
    const tryText = this.add.text(width / 2, height / 2, 'TRY!', {
      fontSize: '48px', fontFamily: 'monospace', color: '#22c55e',
      backgroundColor: '#00000088', padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200);

    // After celebration, attempt conversion
    this.time.delayedCall(2000, () => {
      tryText.destroy();

      // Conversion attempt (auto for now — random accuracy/power)
      const accuracy = 0.5 + Math.random() * 0.4;
      const power = 0.5 + Math.random() * 0.3;
      const kicker = team === 'home'
        ? this.homeTeam.getPlayerByPosition(Position.FLY_HALF)
        : this.awayTeam.getPlayerByPosition(Position.FLY_HALF);
      const conversionSuccess = this.scoringSystem.attemptConversion(accuracy, power, kicker.stats.kicking);

      // Show conversion result
      const convText = this.add.text(width / 2, height / 2,
        conversionSuccess ? 'CONVERSION!' : 'MISSED', {
        fontSize: '32px', fontFamily: 'monospace',
        color: conversionSuccess ? '#22c55e' : '#ef4444',
        backgroundColor: '#00000088', padding: { x: 16, y: 8 },
      }).setOrigin(0.5).setScrollFactor(0).setDepth(200);

      // After conversion, kickoff
      this.time.delayedCall(1500, () => {
        convText.destroy();
        this.phaseManager.forcePhase('KICK_OFF');
        this.phaseManager.transition('OPEN_PLAY');
        this.performKickoff();
        this.clockSystem.resume();
      });
    });
  }

  // ─────────────────────────────────────────────────────────
  // HUD
  // ─────────────────────────────────────────────────────────

  private createHUD(): void {
    const { width } = this.cameras.main;

    // Score
    this.scoreText = this.add.text(width / 2, 12, 'HOME 0 — 0 AWAY', {
      fontSize: '14px', fontFamily: 'monospace', color: '#ffffff',
      backgroundColor: '#00000088', padding: { x: 10, y: 4 },
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100);

    // Clock
    this.clockText = this.add.text(width / 2, 34, '00:00 | 1st Half', {
      fontSize: '11px', fontFamily: 'monospace', color: '#fbbf24',
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100);

    // Phase counter
    this.phaseText = this.add.text(width / 2, 48, 'Phase 0 | OPEN PLAY', {
      fontSize: '10px', fontFamily: 'monospace', color: '#94a3b8',
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100);

    // Stamina bar
    this.staminaBg = this.add.rectangle(20, 520, 100, 8, 0x333333)
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(100);
    this.staminaBar = this.add.rectangle(20, 520, 100, 8, 0x22c55e)
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(100);
    this.staminaLabel = this.add.text(20, 508, 'STAMINA', {
      fontSize: '8px', fontFamily: 'monospace', color: '#94a3b8',
    }).setScrollFactor(0).setDepth(100);

    // Power bar (hidden by default)
    this.powerBarBg = this.add.rectangle(width / 2 - 60, 540, 120, 12, 0x333333)
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(100).setVisible(false);
    this.powerBarFill = this.add.rectangle(width / 2 - 60, 540, 0, 12, 0x22c55e)
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(100).setVisible(false);
    this.powerBarLabel = this.add.text(width / 2, 528, 'KICK POWER', {
      fontSize: '8px', fontFamily: 'monospace', color: '#ffffff',
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100).setVisible(false);

    // Kick type display
    this.kickTypeText = this.add.text(width - 120, 12, `Kick: ${this.selectedKickType}`, {
      fontSize: '9px', fontFamily: 'monospace', color: '#94a3b8',
    }).setScrollFactor(0).setDepth(100);

    // Action prompt
    this.actionPrompt = this.add.text(width / 2, 555, '', {
      fontSize: '9px', fontFamily: 'monospace', color: '#94a3b8',
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100);

    // Collect all HUD elements
    this.hudElements.push(
      this.scoreText, this.clockText, this.phaseText,
      this.staminaBg, this.staminaBar, this.staminaLabel,
      this.powerBarBg, this.powerBarFill, this.powerBarLabel,
      this.kickTypeText, this.actionPrompt,
    );

    // Ignore HUD from minimap
    this.minimapCamera.ignore(this.hudElements);
  }

  private updateHUD(): void {
    const score = this.scoringSystem.getScore();
    this.scoreText.setText(`HOME ${score.home} — ${score.away} AWAY`);

    // Clock
    const halfLabel = this.clockSystem.getHalf() === 1 ? '1st Half' : '2nd Half';
    const injuryTag = this.clockSystem.isInInjuryTime() ? ' +' : '';
    this.clockText.setText(`${this.clockSystem.getClockString()}${injuryTag} | ${halfLabel}`);

    const phase = this.phaseManager.getPhase().replace('_', ' ');
    this.phaseText.setText(`Phase ${this.phaseManager.getPhaseCount()} | ${phase}`);

    // Stamina bar
    const staminaPct = this.controlledPlayer.stamina / 100;
    this.staminaBar.width = 100 * staminaPct;
    if (staminaPct > 0.5) {
      this.staminaBar.setFillStyle(0x22c55e);
    } else if (staminaPct > 0.2) {
      this.staminaBar.setFillStyle(0xeab308);
    } else {
      this.staminaBar.setFillStyle(0xef4444);
    }

    // Kick type display
    this.kickTypeText.setText(`Kick: ${this.selectedKickType.replace('_', ' ')}`);

    // Action prompts
    const prompts: string[] = [];
    if (this.controlledPlayer.hasBall) {
      prompts.push('Q/E:Pass  R:Kick  T:KickType');
    } else {
      prompts.push('Space:Tackle  F:Switch');
    }
    if (this.ruckSystem.isActive()) {
      prompts.push('RUCK IN PROGRESS');
    }
    this.actionPrompt.setText(prompts.join('  |  '));
  }
}
