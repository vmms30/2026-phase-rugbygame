/**
 * PlayerAI — FSM-driven AI for individual player behavior.
 *
 * States: IDLE, SUPPORT_ATTACK, CARRY_BALL, DEFEND, CHASE_BALL,
 *         TACKLE, RUCK_BIND, RETURN_POSITION, SET_PIECE, CELEBRATE
 */

import Phaser from 'phaser';
import { FSM } from './FSM';
import type { Player } from '../entities/Player';
import type { Ball } from '../entities/Ball';
import { pursue, interpose } from './SteeringBehaviors';
import { PLAYER, PITCH } from '../utils/Constants';
import { EventBus } from '../utils/EventBus';

export interface PlayerAIContext {
  player: Player;
  ball: Ball;
  teamSide: 'home' | 'away';
  formationX: number;
  formationY: number;
  isControlled: boolean;
  ballCarrierPos: { x: number; y: number } | null;
  nearbyTeammatePositions: { x: number; y: number }[];
  offsideLineX: number | null; // New context field
}

export class PlayerAI {
  private fsm: FSM<PlayerAIContext>;
  private context: PlayerAIContext;

  constructor(player: Player, ball: Ball) {
    this.context = {
      player,
      ball,
      teamSide: player.teamSide,
      formationX: player.formationX,
      formationY: player.formationY,
      isControlled: false,
      ballCarrierPos: null,
      nearbyTeammatePositions: [],
      offsideLineX: null,
    };

    this.fsm = new FSM<PlayerAIContext>(this.context);

    // ─── Define states ─────────────────────────────────
    this.fsm.addState({
      name: 'IDLE',
      update: (ctx) => {
        ctx.player.moveToward(ctx.formationX, ctx.formationY, 0.3);
      },
    });

    this.fsm.addState({
      name: 'SUPPORT_ATTACK',
      update: (ctx) => {
        if (!ctx.ballCarrierPos) return;
        const offsetX = ctx.teamSide === 'home' ? -25 : 25;
        const offsetY = (ctx.player.position % 2 === 0 ? 20 : -20);
        ctx.player.moveToward(
          ctx.ballCarrierPos.x + offsetX,
          ctx.ballCarrierPos.y + offsetY,
          0.7,
        );
      },
    });

    this.fsm.addState({
      name: 'CARRY_BALL',
      update: (ctx) => {
        const targetX = ctx.teamSide === 'home' ? PITCH.TRY_LINE_RIGHT : PITCH.TRY_LINE_LEFT;
        ctx.player.moveToward(targetX, ctx.player.sprite.y, 0.85);
      },
    });

    this.fsm.addState({
      name: 'DEFEND',
      update: (ctx) => {
        if (ctx.ballCarrierPos) {
          const force = interpose(
            { x: ctx.player.sprite.x, y: ctx.player.sprite.y },
            ctx.ballCarrierPos,
            { x: ctx.teamSide === 'home' ? PITCH.TRY_LINE_LEFT : PITCH.TRY_LINE_RIGHT, y: ctx.ballCarrierPos.y },
            PLAYER.RUN_SPEED * 80,
          );
          ctx.player.sprite.setVelocity(force.x, force.y);
        } else {
          // Strong formation keeping
          ctx.player.updateAI(0, [], { x: ctx.formationX, y: ctx.formationY }, { arrive: 2.0, separation: 0.8 });
        }
      },
    });

    this.fsm.addState({
      name: 'CHASE_BALL',
      update: (ctx) => {
        // High aggression chase
        ctx.player.moveToward(ctx.ball.sprite.x, ctx.ball.sprite.y, 1.0);
      },
    });

    this.fsm.addState({
      name: 'TACKLE',
      enter: (ctx) => {
        // ... tackle logic ...
      },
      update: (ctx) => {
        if (ctx.ballCarrierPos) {
          const vel = ctx.ball.carrier?.sprite.body?.velocity ?? { x: 0, y: 0 };
          const force = pursue(
            { x: ctx.player.sprite.x, y: ctx.player.sprite.y },
            ctx.ballCarrierPos,
            vel,
            PLAYER.RUN_SPEED * 100,
          );
          ctx.player.sprite.setVelocity(force.x, force.y);
        }
      },
    });

    this.fsm.addState({
      name: 'RUCK_BIND',
      update: (ctx) => {
         // Pack tight, ignore separation
         // Access ruck position from context or find nearest ruck logic
         // For now assuming we move to ball
         ctx.player.updateAI(0, [], { x: ctx.ball.sprite.x, y: ctx.ball.sprite.y }, { arrive: 3.0, separation: 0.1 });
      }
    });

    this.fsm.addState({
      name: 'RETURN_POSITION',
      update: (ctx) => {
        ctx.player.moveToward(ctx.formationX, ctx.formationY, 0.5);
      },
    });

    this.fsm.addState({
      name: 'PASSING',
      enter: (ctx) => {
        // Simple logic: Find best receiver
        // 1. Identify teammates
        // We need access to the actual Player entities, not just positions.
        // Context currently only has positions. We might need to upgrade Context or finding mechanism.
        // For now, let's assume we can trigger the pass via the Player entity's internal methods if helpful, 
        // OR we just pick a target from nearby positions if we can map them back.
        // BETTER: PlayerAI should probably have access to the Team or list of teammates?
        // Context has `nearbyTeammatePositions`. functionality is limited without entity refs.
        // Let's rely on the `ball` entity's `passTo` which requires a Player arg.
        
        // HACK: We need teammates. Let's assume `ctx.player.team.players` is accessible? 
        // `Player` entity likely has a `back reference` to Team or we need to pass it in context.
        // Checking Player.ts... assuming Player has `team` property.
        
        const teammates = ctx.player.team?.players || [];
        
        // Find best receiver: Behind ball, close enough, not me
        let bestReceiver: Player | null = null;
        let bestScore = -Infinity;

        const myX = ctx.player.sprite.x;
        const myY = ctx.player.sprite.y;
        // const forwardDir = ctx.teamSide === 'home' ? 1 : -1; // Unused

        for (const tm of teammates) {
          if (tm === ctx.player) continue;
          
          // const dx = tm.sprite.x - myX;
          // const dy = tm.sprite.y - myY;
          const dist = Phaser.Math.Distance.Between(myX, myY, tm.sprite.x, tm.sprite.y);
          
          // Rule 1: Must be behind ball (rugby law)
          // Home attacking right -> Receiver must be to the left (x < myX)
          const isBehind = (ctx.teamSide === 'home') ? (tm.sprite.x < myX) : (tm.sprite.x > myX);
          
          if (isBehind && dist < 200 && dist > 20) {
             // Score: Closer is better (but not too close), deeper alignment is good
             let score = 1000 - dist;
             // Bias towards centers/wings if available?
             if (tm.position > 8) score += 50;
             
             if (score > bestScore) {
               bestScore = score;
               bestReceiver = tm;
             }
          }
        }

        if (bestReceiver) {
           ctx.ball.passTo(ctx.player, bestReceiver);
        } else {
           // No receiver? carry on or kick?
           // Transition back to CARRY via update
        }
      },
      update: (ctx) => {
         // If ball passed, transition to SUPPORT
         if (!ctx.player.hasBall) {
            // Wait for FSM transition or force it
         }
      }
    });

    // Listen for Team Orders
    EventBus.on('teamOrder', (data: { playerId: string; order: 'KICK' | 'PASS' }) => {
       if (this.context.player.id === data.playerId) {
          if (data.order === 'KICK') {
             this.fsm.forceState('KICKING');
          } else if (data.order === 'PASS') {
             this.fsm.forceState('PASSING');
          }
       }
    });

    this.fsm.addState({
      name: 'KICKING',
      enter: (ctx) => {
         // Simple kick: Kick for touch or territory
         // Power 0.8
         // Angle: 30 degrees towards touchline? or straight downfield?
         
         // Logic: Aim for corners
         const targetX = ctx.teamSide === 'home' ? PITCH.WIDTH_PX : 0;
         const targetY = (ctx.player.sprite.y < PITCH.HEIGHT_PX / 2) ? 0 : PITCH.HEIGHT_PX;
         
         // Distance to target
         const dist = Phaser.Math.Distance.Between(ctx.player.sprite.x, ctx.player.sprite.y, targetX, targetY);
         const power = Math.min(1.0, dist / 400); // 400px reference kick
         
         ctx.ball.kickWithType(
            ctx.player,
            power,
            dist,
            targetX, targetY,
            0.2, // Arc
            1.5, // Duration
            true, // Bounces
            15 // Deviation
         );
      },
      update: (_ctx) => {
         // Ball is gone, transition via generic rules
      }
    });

    this.fsm.addState({
      name: 'MAUL_BIND',
      update: (ctx) => {
         // Move to ball position (maul center)
         const ballX = ctx.ball.sprite.x;
         const ballY = ctx.ball.sprite.y;
         
         // If close, stop and push (simulated by RuckSystem/MaulSystem?)
         const dist = Phaser.Math.Distance.Between(ctx.player.sprite.x, ctx.player.sprite.y, ballX, ballY);
         
         if (dist > 30) {
            ctx.player.moveToward(ballX, ballY, 0.6);
         } else {
            // "Bound" - push logic handled elsewhere or just hold position
            ctx.player.sprite.setVelocity(0, 0);
         }
      }
    });

    this.fsm.addState({ name: 'SET_PIECE', update: () => {} });
    this.fsm.addState({ name: 'CELEBRATE', update: () => {} });

    // ─── Define transitions ────────────────────────────
    const distToBall = (ctx: PlayerAIContext) => {
      const dx = ctx.player.sprite.x - ctx.ball.sprite.x;
      const dy = ctx.player.sprite.y - ctx.ball.sprite.y;
      return Math.sqrt(dx * dx + dy * dy);
    };

    // → CARRY_BALL when has ball
    this.fsm.addTransition({ from: 'IDLE', to: 'CARRY_BALL', condition: ctx => ctx.player.hasBall, priority: 10 });
    this.fsm.addTransition({ from: 'SUPPORT_ATTACK', to: 'CARRY_BALL', condition: ctx => ctx.player.hasBall, priority: 10 });
    this.fsm.addTransition({ from: 'CHASE_BALL', to: 'CARRY_BALL', condition: ctx => ctx.player.hasBall, priority: 10 });

    // → PASSING or KICKING from CARRY_BALL
    // Placeholder conditions for now - effectively driven by TeamAI or events,
    // but here we might add autonomous triggers later.
    
    this.fsm.addState({
      name: 'RETURN_ONSIDE',
      update: (ctx) => {
        if (ctx.offsideLineX === null) return;
        // Move towards safety (behind line)
        // Home (Attacking Right) -> needs X < line -> Move Left (-X)
        // BUT OffsidesSystem.isOffside logic: Home X > line
        
        // Move 20px behind line to be safe
        const safeX = ctx.teamSide === 'home' ? ctx.offsideLineX - 50 : ctx.offsideLineX + 50;
        ctx.player.moveToward(safeX, ctx.player.sprite.y, 0.9); 
      }
    });

    // → CHASE_BALL when ball is loose and nearby
    this.fsm.addTransition({ from: 'IDLE', to: 'CHASE_BALL', condition: ctx => ctx.ball.state === 'loose' && distToBall(ctx) < 100, priority: 5 });
    this.fsm.addTransition({ from: 'DEFEND', to: 'CHASE_BALL', condition: ctx => ctx.ball.state === 'loose' && distToBall(ctx) < 80, priority: 5 });
    this.fsm.addTransition({ from: 'RETURN_POSITION', to: 'CHASE_BALL', condition: ctx => ctx.ball.state === 'loose' && distToBall(ctx) < 80, priority: 5 });
    
    // → RETURN_ONSIDE if offside
    const isOffside = (ctx: PlayerAIContext) => {
       if (ctx.offsideLineX === null) return false;
       if (ctx.teamSide === 'home') return ctx.player.sprite.x > ctx.offsideLineX;
       else return ctx.player.sprite.x < ctx.offsideLineX;
    };
    
    this.fsm.addTransition({ from: 'DEFEND', to: 'RETURN_ONSIDE', condition: isOffside, priority: 11 });
    this.fsm.addTransition({ from: 'IDLE', to: 'RETURN_ONSIDE', condition: isOffside, priority: 11 });
    this.fsm.addTransition({ from: 'RETURN_POSITION', to: 'RETURN_ONSIDE', condition: isOffside, priority: 11 });

    // → IDLE from RETURN_ONSIDE when safe
    this.fsm.addTransition({ from: 'RETURN_ONSIDE', to: 'IDLE', condition: ctx => !isOffside(ctx), priority: 1 });

    // → SUPPORT_ATTACK when teammate has ball nearby
    this.fsm.addTransition({ from: 'IDLE', to: 'SUPPORT_ATTACK', condition: ctx => !!ctx.ballCarrierPos && ctx.ball.carrier?.teamSide === ctx.teamSide && distToBall(ctx) < 200 && !ctx.player.hasBall, priority: 3 });
    this.fsm.addTransition({ from: 'RETURN_POSITION', to: 'SUPPORT_ATTACK', condition: ctx => !!ctx.ballCarrierPos && ctx.ball.carrier?.teamSide === ctx.teamSide && distToBall(ctx) < 150, priority: 3 });

    // → DEFEND when opponent has ball
    this.fsm.addTransition({ from: 'IDLE', to: 'DEFEND', condition: ctx => !!ctx.ball.carrier && ctx.ball.carrier.teamSide !== ctx.teamSide, priority: 2 });
    this.fsm.addTransition({ from: 'RETURN_POSITION', to: 'DEFEND', condition: ctx => !!ctx.ball.carrier && ctx.ball.carrier.teamSide !== ctx.teamSide, priority: 2 });

    // → TACKLE when close to opponent carrier
    this.fsm.addTransition({ from: 'DEFEND', to: 'TACKLE', condition: ctx => !!ctx.ballCarrierPos && ctx.ball.carrier?.teamSide !== ctx.teamSide && distToBall(ctx) < 60, priority: 8 });

    // → RUCK_BIND when player is in ruck OR needs to join
    // If already bound (isInRuck), stay.
    // If not bound, join if close enough based on aggression.
    const shouldJoinRuck = (ctx: PlayerAIContext) => {
       if (ctx.player.isInRuck) return true;
       // Only forwards and maybe centers join rucks typically
       if (ctx.player.position > 13) return false; // Wingers/FB don't ruck often
       
       if (ctx.ball.state === 'ruck' || ctx.ball.speed < 10 /* effectively stopped */) {
          const dist = distToBall(ctx);
          const aggression = ctx.player.team?.ruckAggression || 3;
          // Higher aggression = join from further away
          const joinRange = aggression * 40; // 3->120, 5->200
          
          return dist < joinRange;
       }
       return false;
    };

    this.fsm.addTransition({ from: 'IDLE', to: 'RUCK_BIND', condition: shouldJoinRuck, priority: 9 });
    this.fsm.addTransition({ from: 'DEFEND', to: 'RUCK_BIND', condition: shouldJoinRuck, priority: 9 });
    this.fsm.addTransition({ from: 'SUPPORT_ATTACK', to: 'RUCK_BIND', condition: shouldJoinRuck, priority: 9 });

    // → MAUL_BIND (Placeholder logic - check if player is in maul)
    // this.fsm.addTransition({ from: 'IDLE', to: 'MAUL_BIND', condition: ctx => ctx.player.isInMaul, priority: 9 });

    // → RETURN_POSITION from carry when ball lost
    this.fsm.addTransition({ from: 'CARRY_BALL', to: 'RETURN_POSITION', condition: ctx => !ctx.player.hasBall, priority: 1 });
    this.fsm.addTransition({ from: 'RUCK_BIND', to: 'RETURN_POSITION', condition: ctx => !ctx.player.isInRuck, priority: 1 });
    this.fsm.addTransition({ from: 'MAUL_BIND', to: 'RETURN_POSITION', condition: _ctx => !false /* placeholder for !isInMaul */, priority: 1 });
    this.fsm.addTransition({ from: 'TACKLE_STATE', to: 'RETURN_POSITION', condition: ctx => !ctx.ballCarrierPos || distToBall(ctx) > 100, priority: 1 });
    this.fsm.addTransition({ from: 'CHASE_BALL', to: 'RETURN_POSITION', condition: ctx => ctx.ball.state !== 'loose', priority: 1 });

    // → IDLE when near formation position and nothing to do
    this.fsm.addTransition({ from: 'RETURN_POSITION', to: 'IDLE', condition: ctx => {
      const dx = ctx.player.sprite.x - ctx.formationX;
      const dy = ctx.player.sprite.y - ctx.formationY;
      return Math.sqrt(dx * dx + dy * dy) < 10;
    }, priority: 0 });

    this.fsm.setInitialState('IDLE');
  }

  /**
   * Update with latest context info.
   */
  update(delta: number, ball: Ball, formationX: number, formationY: number, isControlled: boolean, offsideLineX?: number): void {
    this.context.ball = ball;
    this.context.formationX = formationX;
    this.context.formationY = formationY;
    this.context.isControlled = isControlled;
    this.context.offsideLineX = offsideLineX ?? null;

    if (ball.carrier) {
      this.context.ballCarrierPos = { x: ball.carrier.sprite.x, y: ball.carrier.sprite.y };
    } else {
      this.context.ballCarrierPos = null;
    }

    if (isControlled || this.context.player.isGrounded) return;
    this.fsm.update(delta);
  }

  getState(): string {
    return this.fsm.getCurrentStateName();
  }
}
