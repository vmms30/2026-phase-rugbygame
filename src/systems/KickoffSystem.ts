import { Ball } from '../entities/Ball';
import { Player } from '../entities/Player';
import { Team } from '../entities/Team';
import { PITCH, GamePhase } from '../utils/Constants';
import { EventBus } from '../utils/EventBus';

export class KickoffSystem {
  private phase: 'SETUP' | 'RUN_UP' | 'KICK' | 'FLIGHT' | 'COMPLETE' = 'SETUP';
  private kicker: Player | null = null;
  private ball: Ball;
  private kickingTeam: Team | null = null;
  private kickOrigin: { x: number, y: number } = { x: 0, y: 0 };
  
  // Logic to track 10m rule
  private crossed10mLine = false;

  constructor(ball: Ball) {
    this.ball = ball;
  }

  /**
   * Initialize a kickoff
   * @param kickingTeam The team performing the kickoff
   * @param receivingTeam The receiving team
   * @param type 'KICK_OFF' | '22_DROP_OUT'
   */
  startKickoff(kickingTeam: Team, receivingTeam: Team, type: GamePhase): void {
    this.kickingTeam = kickingTeam;
    this.phase = 'SETUP';
    this.crossed10mLine = false;

    // Determine kick origin
    // Home attacks Right -> Kickoff from Center (Width/2)
    // Away attacks Left -> Kickoff from Center (Width/2)
    // For 22 drop out, it would be the 22m line.
    
    let startX = PITCH.HALFWAY;
    if (type === 'KICK_OFF') {
      startX = PITCH.HALFWAY;
    } else { // 22 Drop out logic later? OR assume standard kickoff for now
      startX = PITCH.HALFWAY;
    }

    this.kickOrigin = { x: startX, y: PITCH.HEIGHT_PX / 2 };

    // Set Ball Position
    this.ball.setPosition(this.kickOrigin.x, this.kickOrigin.y);
    this.ball.setVelocity(0, 0);
    this.ball.state = 'loose'; // or 'held' if we want a tee? "loose" on ground is fine for now.

    // Assign Kicker (Fly Half usually)
    this.kicker = kickingTeam.getPlayerByPosition(10); // Fly Half
    
    // Position Kicker slightly behind ball
    const kickerOffsetX = kickingTeam.side === 'home' ? -50 : 50;
    this.kicker.setPosition(this.kickOrigin.x + kickerOffsetX, this.kickOrigin.y);
    this.kicker.setRotation(kickingTeam.side === 'home' ? 0 : Math.PI); // Face opponent

    // Setup Formations
    kickingTeam.setKickoffChaseFormation();
    receivingTeam.setKickoffReceiveFormation();

    console.log(`[KickoffSystem] Started ${type} by ${kickingTeam.side}`);
  }

  update(_delta: number): void {
    if (this.phase === 'SETUP') {
      // Trigger run up (for now auto)
      if (Math.random() < 0.05) {
         this.phase = 'RUN_UP';
      }
      return;
    }

    if (this.phase === 'RUN_UP') {
      if (!this.kicker) return;
      
      const dist = Phaser.Math.Distance.Between(this.kicker.sprite.x, this.kicker.sprite.y, this.ball.sprite.x, this.ball.sprite.y);
      if (dist < 10) {
        this.executeKick();
      } else {
        this.kicker.moveToward(this.ball.sprite.x, this.ball.sprite.y, 1.0);
      }
    }

    if (this.phase === 'FLIGHT') {
      if (this.kickingTeam?.side === 'home') {
        if (this.ball.sprite.x > PITCH.LINE_10_RIGHT) this.crossed10mLine = true;
      } else {
        if (this.ball.sprite.x < PITCH.LINE_10_LEFT) this.crossed10mLine = true;
      }

      if (this.ball.isGrounded()) {
         this.completeKickoff();
      }
    }
  }

  private executeKick(): void {
    if (!this.kicker || !this.kickingTeam) return;

    this.phase = 'FLIGHT';
    
    let targetX = 0;
    if (this.kickingTeam.side === 'home') {
      targetX = Phaser.Math.Between(PITCH.LINE_22_RIGHT, PITCH.TRY_LINE_RIGHT - 50);
    } else {
      targetX = Phaser.Math.Between(PITCH.TRY_LINE_LEFT + 50, PITCH.LINE_22_LEFT);
    }

    const targetY = Phaser.Math.Between(100, PITCH.HEIGHT_PX - 100);

    // Calculate params for high kick
    const kickDist = Phaser.Math.Distance.Between(this.ball.sprite.x, this.ball.sprite.y, targetX, targetY);
    const power = Math.min(1, kickDist / 800); 

    EventBus.emit('ballKicked', { kickerId: this.kicker.id, type: 'kickoff', power });
    
    // Use kickWithType for high, hanging kick
    this.ball.kickWithType(
      this.kicker,
      power,
      kickDist,
      targetX, targetY,
      0.3, // High arc
      3.0, // Long hang time (3s)
      true, // Bounces
      20    // Random deviation
    );
    
    console.log('[KickoffSystem] Kick executed!');
  }

  private completeKickoff(): void {
    this.phase = 'COMPLETE';
    
    if (!this.crossed10mLine) {
        // Not 10m? Scrum to receiving team at center
        console.log('[KickoffSystem] Kick did not travel 10m! Scrum.');
        // Trigger Scrum (EventBus or PhaseManager direct?)
        // EventBus.emit('phaseChain', { to: 'SCRUM', reason: 'NOT_10M' }); 
        // For simplicity, just valid for now.
    }

    // Transition games state to OPEN_PLAY
    EventBus.emit('phaseChange', { from: 'KICK_OFF', to: 'OPEN_PLAY' });
  }

  isActive(): boolean {
    return this.phase !== 'COMPLETE' && this.phase !== 'SETUP'; // Active during run/kick/flight
  }
}
