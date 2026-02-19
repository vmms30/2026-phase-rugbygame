/**
 * TeamAI — coach brain, runs every 0.5s to make tactical decisions.
 *
 * Selects formations, play calls, and kick decisions.
 * Drives the FormationManager and influences PlayerAI states.
 */

import { FormationManager, FormationType } from './FormationManager';
import { AI, PITCH, DIFFICULTY } from '../utils/Constants';
import type { DifficultyConfig } from '../utils/Constants';
import type { Team } from '../entities/Team';
import type { Ball } from '../entities/Ball';
import { EventBus } from '../utils/EventBus';

export type PlayCall = 'CRASH_BALL' | 'SKIP_PASS' | 'SWITCH' | 'LOOP' | 'INSIDE_BALL' | 'KICK' | 'BOX_KICK' | 'GRUBBER' | 'DROP_GOAL_ATTEMPT';

export class TeamAI {
  readonly formationManager: FormationManager;
  private _team: Team;
  private side: 'home' | 'away';
  private thinkTimer = 0;
  private currentPlay: PlayCall = 'CRASH_BALL';
  private riskAppetite = 0.5; // 0 = conservative, 1 = aggressive
  private difficulty: DifficultyConfig = DIFFICULTY.MEDIUM;

  // Score-awareness
  private ownScore = 0;
  private opponentScore = 0;
  private gameMinutes = 0;

  // Adaptive logic
  private lastBallX = 0;
  private playSuccessStats = new Map<PlayCall, number>(); // Higher = more meters gained
  private opponentGainingGround = false;

  // Adaptive defense: track opponent's recent successful plays
  private opponentPlayHistory: PlayCall[] = [];
  private static readonly OPPONENT_HISTORY_SIZE = 5;

  constructor(team: Team, side: 'home' | 'away') {
    this._team = team;
    this.side = side;
    this.formationManager = new FormationManager();
    // Initialize success stats
    this.playSuccessStats.set('CRASH_BALL', 10);
    this.playSuccessStats.set('SKIP_PASS', 10);
  }

  /**
  /**
   * Update the team AI.
   * @param delta Frame delta ms
   * @param ball Ball reference
   * @param phaseCount Current phase count from PhaseManager
   */
  update(delta: number, ball: Ball, phaseCount: number): void {
    // 1. Tactical decisions (throttled)
    this.thinkTimer += delta;
    const reactionDelay = AI.TEAM_THINK_INTERVAL + this.difficulty.aiReactionDelay;

    if (this.thinkTimer >= reactionDelay) {
      this.thinkTimer = 0;
      this.updateTactics(ball, phaseCount);
    }

    // 2. Position updates (every frame for smooth movement)
    this.updatePositions(ball);
  }

  private updateTactics(ball: Ball, phaseCount: number): void {
    // Update formation manager with ball position
    this.formationManager.setBallPosition(ball.sprite.x);

    // Track adaptive stats (meters gained/lost)
    const currentBallX = ball.sprite.x;
    const gainedMeters = this.side === 'home' 
      ? (currentBallX - this.lastBallX) 
      : (this.lastBallX - currentBallX);
    
    // Update success of current play
    if (this.currentPlay) {
      const prevScore = this.playSuccessStats.get(this.currentPlay) || 10;
      this.playSuccessStats.set(this.currentPlay, prevScore * 0.9 + gainedMeters * 0.1);
    }

    this.opponentGainingGround = gainedMeters < -5;
    this.lastBallX = currentBallX;

    const hasPossession = ball.carrier?.teamSide === this.side;

    if (hasPossession) {
      this.decideAttack(ball, phaseCount);
    } else {
      this.decideDefense(ball);
    }
  }

  /**
   * Calculate and push target positions to all players.
   * Implements M5 Off-Ball Intelligence (support lines, stagger, decoys).
   */
  private updatePositions(ball: Ball): void {
    const basePositions = this.formationManager.getAllPositions(this.side);
    const hasPossession = ball.carrier?.teamSide === this.side;
    const ballX = ball.sprite.x;
    const ballY = ball.sprite.y;
    const isInRuck = ball.state === 'ruck';

    // ── Post-contact ruck support: 2 nearest forwards auto-seek ruck ──
    if (isInRuck && hasPossession) {
      const forwards = this._team.players
        .filter(p => p.position <= 8 && !p.isInRuck && !p.isGrounded)
        .map(p => ({
          player: p,
          dist: Math.hypot(p.sprite.x - ballX, p.sprite.y - ballY),
        }))
        .sort((a, b) => a.dist - b.dist);

      // Send 2 nearest forwards to ruck cleanup positions
      for (let i = 0; i < Math.min(2, forwards.length); i++) {
        const fw = forwards[i].player;
        const offsetY = i === 0 ? -25 : 25; // Stagger either side
        fw.formationX = ballX + (this.side === 'home' ? -30 : 30);
        fw.formationY = ballY + offsetY;
      }
    }

    // Track back positions for width enforcement
    const backPositionsY: { position: number; y: number }[] = [];

    // Iterate all players and set their formation target
    for (const player of this._team.players) {
      // Skip if player is strictly controlled by Physics (e.g. tackled/ruck)
      if (player.isInRuck || player.isGrounded) continue;

      let target = basePositions.get(player.position);
      if (!target) continue;

      // Apply Off-Ball Intelligence modifiers if attacking
      if (hasPossession) {
        // 1. Forwards (1-8): Run support lines with depth variation
        if (player.position <= 8) {
          const dist = Math.abs(player.sprite.x - ballX);
          if (dist < 200) {
            // Sort by closeness to determine depth tier
            const isNearSupporter = dist < 100;
            const supportDepth = isNearSupporter ? 30 : 60; // Nearest 2 at -30px, others at -60px
            const offset = (player.id.charCodeAt(0) % 3 - 1) * 30;
            if (this.side === 'home') {
              target.x = ballX - supportDepth;
            } else {
              target.x = ballX + supportDepth;
            }
            target.y = ballY + offset;
          }
        }

        // 2. Backs (9-15): Staggered depth + lateral run-line angle offset
        if (player.position >= 10) {
           let depthOffset = 0;
           let lateralOffset = 0; // Run-line angle offset
           if (player.position === 12) { depthOffset = 30; lateralOffset = -15; }
           if (player.position === 13) { depthOffset = 50; lateralOffset = -25; }
           if (player.position === 11) { depthOffset = 70; lateralOffset = -40; } // Left Wing
           if (player.position === 14) { depthOffset = 70; lateralOffset = 40; }  // Right Wing
           if (player.position === 15) { depthOffset = 80; lateralOffset = 0; }

           if (this.side === 'home') {
             target.x -= depthOffset;
           } else {
             target.x += depthOffset;
           }
           target.y += lateralOffset;

           // 3. Fullback insert
           const inOpp22 = this.side === 'home' ? ballX > PITCH.LINE_22_RIGHT : ballX < PITCH.LINE_22_LEFT;
           if (player.position === 15 && inOpp22) {
              const p12 = this._team.getPlayerByPosition(12);
              const p13 = this._team.getPlayerByPosition(13);
              if (p12 && p13) {
                 target.y = (p12.sprite.y + p13.sprite.y) / 2;
                 target.x = (p12.sprite.x + p13.sprite.x) / 2;
              }
           }

           // Track for width enforcement
           backPositionsY.push({ position: player.position, y: target.y });
        }
      }

      // 4. Decoy runners: Flankers run 'unders' lines on SKIP_PASS
      if (hasPossession && (player.position === 6 || player.position === 7)) {
         if (this.currentPlay === 'SKIP_PASS') {
            target.y = ballY + (player.position === 6 ? -50 : 50);
         }
      }

      // Push target to player
      player.formationX = target.x;
      player.formationY = target.y;
    }

    // 5. Width/depth maintenance: enforce minimum 40px Y separation between backs
    if (hasPossession && backPositionsY.length > 1) {
      backPositionsY.sort((a, b) => a.y - b.y);
      for (let i = 1; i < backPositionsY.length; i++) {
        const gap = backPositionsY[i].y - backPositionsY[i - 1].y;
        if (gap < 40) {
          const adjustment = (40 - gap) / 2;
          // Find and adjust corresponding player formation targets
          for (const player of this._team.players) {
            if (player.position === backPositionsY[i].position) {
              player.formationY += adjustment;
            }
            if (player.position === backPositionsY[i - 1].position) {
              player.formationY -= adjustment;
            }
          }
        }
      }
    }
  }

  private decideAttack(ball: Ball, phaseCount: number): void {
    // Fatigue check — stricter threshold for heavy fatigue
    const isFatigued = this._team.avgStamina < 50;
    const isHeavilyFatigued = this._team.avgStamina < 40;
    
    // Fatigue-aware: reduce risk when heavily fatigued
    if (isHeavilyFatigued) {
      this.riskAppetite = Math.max(0.1, this.riskAppetite - 0.2);
    }

    // Select formation
    if (this.riskAppetite > 0.7 && !isFatigued) {
      this.formationManager.setFormation(FormationType.WIDE_ATTACK);
    } else if (phaseCount > 5 || isFatigued) {
      this.formationManager.setFormation(FormationType.NARROW_CRASH);
    } else {
      this.formationManager.setFormation(FormationType.STANDARD);
    }

    // Play call
    const ballX = ball.sprite.x;
    const inOwnHalf = this.side === 'home' ? ballX < PITCH.HALFWAY : ballX > PITCH.HALFWAY;
    const deep = this.side === 'home' ? ballX < PITCH.LINE_22_LEFT : ballX > PITCH.LINE_22_RIGHT;
    const inOpp22 = this.side === 'home' ? ballX > PITCH.LINE_22_RIGHT : ballX < PITCH.LINE_22_LEFT;

    // Kick for territory criteria
    if (deep || phaseCount >= AI.KICK_PHASE_THRESHOLD) {
      this.currentPlay = 'KICK';
      return;
    }

    // Drop goal opportunity
    const scoreDiff = this.opponentScore - this.ownScore;
    if (inOpp22 && Math.abs(scoreDiff) <= 3 && Math.random() < 0.05 * this.riskAppetite) {
      if (ball.carrier) this._team.requestDropGoal(ball.carrier);
      this.currentPlay = 'DROP_GOAL_ATTEMPT';
      return;
    }

    // Available plays based on difficulty & risk & fatigue
    const plays: PlayCall[] = ['CRASH_BALL', 'SKIP_PASS'];

    // Fatigue-aware: heavily fatigued teams stick to simple plays
    if (isHeavilyFatigued) {
      // Try to substitute the most fatigued player
      this._team.substituteFatigued(25);
      // Only crash ball and simple passes when exhausted
      this.currentPlay = 'CRASH_BALL';
      return;
    }

    // Difficulty limits variety
    const variety = this.difficulty.playVariety;
    
    if (variety >= 3 && this.riskAppetite > 0.4 && !isFatigued) plays.push('SWITCH');
    if (variety >= 6 && this.riskAppetite > 0.5) plays.push('LOOP');
    if (variety >= 6 && this.riskAppetite > 0.7 && !isFatigued) plays.push('INSIDE_BALL');
    if (variety >= 6 && inOwnHalf && Math.random() < 0.2) plays.push('BOX_KICK');
    if (variety >= 12 && inOpp22 && Math.random() < 0.3) plays.push('GRUBBER');

    // Adaptive weighting: duplicate plays that have high success scores
    //   Scaling by difficulty: EASY = flat, MEDIUM = weak boost, HARD = strong boost
    const weightedPlays: PlayCall[] = [];
    const adaptDivisor = this.difficulty.playVariety <= 3 ? 0 : (this.difficulty.playVariety <= 6 ? 10 : 5);
    for (const p of plays) {
      if (adaptDivisor === 0) {
        weightedPlays.push(p); // EASY: flat weighting, no adaptation
      } else {
        const score = this.playSuccessStats.get(p) || 10;
        const weight = Math.max(1, Math.floor(score / adaptDivisor));
        for (let i = 0; i < weight; i++) weightedPlays.push(p);
      }
    }

    // Trailing logic
    if (this.ownScore < this.opponentScore && this.gameMinutes > 60) {
      this.riskAppetite = Math.min(1.0, this.riskAppetite + 0.1);
    }

    // Pick random from weighted
    this.currentPlay = weightedPlays[Math.floor(Math.random() * weightedPlays.length)] || 'CRASH_BALL';

    // TRIGGER ACT: If carrier is AI, force state based on play
    if (ball.carrier && ball.carrier.teamSide === this.side && !ball.carrier.isGrounded && !ball.carrier.isInRuck) {
       // We need access to the PlayerAI instance for the carrier. 
       // Currently `TeamAI` doesn't hold references to `PlayerAI`s, only `Player` entities.
       // `Player` entity doesn't expose its AI.
       // ARCHITECTURE ISSUE: TeamAI needs to signal the PlayerAI.
       // Option A: EventBus event 'teamOrder' -> PlayerAI listens.
       // Option B: PlayerAI polls TeamAI?
       // Let's use EventBus for loose coupling.
       
       if (this.currentPlay === 'KICK' || this.currentPlay === 'BOX_KICK' || this.currentPlay === 'GRUBBER') {
          EventBus.emit('teamOrder', { playerId: ball.carrier.id, order: 'KICK' });
       } else if (this.currentPlay === 'SKIP_PASS' || this.currentPlay === 'SWITCH' || this.currentPlay === 'LOOP') {
           // For pass plays, we might want to delay slightly or let Carry state handle it?
           // For now, let's force PASSING state immediately for demonstration of wiring.
           EventBus.emit('teamOrder', { playerId: ball.carrier.id, order: 'PASS' });
       }
       // CRASH_BALL just implies CARRY implies default behavior.
    }
  }

  private decideDefense(ball: Ball): void {
    const ballX = ball.sprite.x;
    const nearOwnLine = this.side === 'home'
      ? ballX < PITCH.LINE_22_LEFT + 50
      : ballX > PITCH.LINE_22_RIGHT - 50;

    // Adaptive defense: detect opponent play patterns
    const dominantPlay = this.detectOpponentPattern();
    
    // If opponent repeatedly uses wide plays, go Blitz to disrupt
    if (dominantPlay === 'SKIP_PASS' || dominantPlay === 'SWITCH' || dominantPlay === 'LOOP') {
      this.formationManager.setFormation(FormationType.BLITZ_DEFENSE);
    } else if (nearOwnLine || (this.opponentGainingGround && this.difficulty.playVariety > 3)) {
      this.formationManager.setFormation(FormationType.BLITZ_DEFENSE);
    } else if (this.riskAppetite > 0.6) {
      this.formationManager.setFormation(FormationType.DRIFT_DEFENSE);
    } else {
      this.formationManager.setFormation(FormationType.STANDARD_DEFENSE);
    }
    
    // Ruck Aggression
    if (nearOwnLine) {
        this._team.ruckAggression = 5;
    } else if (this.formationManager.getCurrentFormation() === FormationType.DRIFT_DEFENSE) {
        this._team.ruckAggression = 2;
    } else {
        this._team.ruckAggression = 3;
    }
  }

  /** Update score context for decision-making */
  updateContext(ownScore: number, opponentScore: number, gameMinutes: number): void {
    this.ownScore = ownScore;
    this.opponentScore = opponentScore;
    this.gameMinutes = gameMinutes;

    // Adapt risk appetite based on situation
    if (ownScore < opponentScore) {
      this.riskAppetite = Math.min(1.0, 0.5 + (opponentScore - ownScore) * 0.05);
    } else if (ownScore > opponentScore) {
      this.riskAppetite = Math.max(0.2, 0.5 - (ownScore - opponentScore) * 0.03);
    }
  }

  /** Record an opponent play call for adaptive defense tracking */
  recordOpponentPlay(play: PlayCall): void {
    this.opponentPlayHistory.push(play);
    if (this.opponentPlayHistory.length > TeamAI.OPPONENT_HISTORY_SIZE) {
      this.opponentPlayHistory.shift();
    }
  }

  /** Detect if opponent is repeating a specific play pattern.
   *  Gated by difficulty: EASY=disabled, MEDIUM=needs 5+ plays, HARD=needs 3.
   */
  private detectOpponentPattern(): PlayCall | null {
    // Strategic adaptation scaling (M5.6)
    if (this.difficulty.playVariety <= 3) return null; // EASY: no adaptation
    const minHistory = this.difficulty.playVariety <= 6 ? 5 : 3; // MEDIUM vs HARD threshold
    if (this.opponentPlayHistory.length < minHistory) return null;
    
    // Count occurrences of each play in recent history
    const counts = new Map<PlayCall, number>();
    for (const play of this.opponentPlayHistory) {
      counts.set(play, (counts.get(play) || 0) + 1);
    }
    
    // If any play used 3+ times in last 5 plays, it's a pattern
    for (const [play, count] of counts) {
      if (count >= 3) return play;
    }
    return null;
  }

  setDifficulty(config: DifficultyConfig): void {
    this.difficulty = config;
  }

  getCurrentPlay(): PlayCall {
    return this.currentPlay;
  }

  /** Override the current play call (e.g. from PlaySelector UI). */
  setCurrentPlay(play: PlayCall): void {
    this.currentPlay = play;
  }

  getRiskAppetite(): number {
    return this.riskAppetite;
  }
}
