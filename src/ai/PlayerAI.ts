/**
 * PlayerAI — FSM-driven AI for individual player behavior.
 *
 * States: IDLE, SUPPORT_ATTACK, CARRY_BALL, DEFEND, CHASE_BALL,
 *         TACKLE, RUCK_BIND, RETURN_POSITION, SET_PIECE, CELEBRATE
 */

import { FSM } from './FSM';
import type { Player } from '../entities/Player';
import type { Ball } from '../entities/Ball';
import { pursue, interpose } from './SteeringBehaviors';
import { PLAYER, PITCH } from '../utils/Constants';

export interface PlayerAIContext {
  player: Player;
  ball: Ball;
  teamSide: 'home' | 'away';
  formationX: number;
  formationY: number;
  isControlled: boolean;
  ballCarrierPos: { x: number; y: number } | null;
  nearbyTeammatePositions: { x: number; y: number }[];
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
          ctx.player.moveToward(ctx.formationX, ctx.formationY, 0.5);
        }
      },
    });

    this.fsm.addState({
      name: 'CHASE_BALL',
      update: (ctx) => {
        ctx.player.moveToward(ctx.ball.sprite.x, ctx.ball.sprite.y, 1.0);
      },
    });

    this.fsm.addState({
      name: 'TACKLE_STATE',
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
      update: () => {
        // Movement handled by RuckSystem
      },
    });

    this.fsm.addState({
      name: 'RETURN_POSITION',
      update: (ctx) => {
        ctx.player.moveToward(ctx.formationX, ctx.formationY, 0.5);
      },
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

    // → CHASE_BALL when ball is loose and nearby
    this.fsm.addTransition({ from: 'IDLE', to: 'CHASE_BALL', condition: ctx => ctx.ball.state === 'loose' && distToBall(ctx) < 100, priority: 5 });
    this.fsm.addTransition({ from: 'DEFEND', to: 'CHASE_BALL', condition: ctx => ctx.ball.state === 'loose' && distToBall(ctx) < 80, priority: 5 });
    this.fsm.addTransition({ from: 'RETURN_POSITION', to: 'CHASE_BALL', condition: ctx => ctx.ball.state === 'loose' && distToBall(ctx) < 80, priority: 5 });

    // → SUPPORT_ATTACK when teammate has ball nearby
    this.fsm.addTransition({ from: 'IDLE', to: 'SUPPORT_ATTACK', condition: ctx => !!ctx.ballCarrierPos && ctx.ball.carrier?.teamSide === ctx.teamSide && distToBall(ctx) < 200 && !ctx.player.hasBall, priority: 3 });
    this.fsm.addTransition({ from: 'RETURN_POSITION', to: 'SUPPORT_ATTACK', condition: ctx => !!ctx.ballCarrierPos && ctx.ball.carrier?.teamSide === ctx.teamSide && distToBall(ctx) < 150, priority: 3 });

    // → DEFEND when opponent has ball
    this.fsm.addTransition({ from: 'IDLE', to: 'DEFEND', condition: ctx => !!ctx.ball.carrier && ctx.ball.carrier.teamSide !== ctx.teamSide, priority: 2 });
    this.fsm.addTransition({ from: 'RETURN_POSITION', to: 'DEFEND', condition: ctx => !!ctx.ball.carrier && ctx.ball.carrier.teamSide !== ctx.teamSide, priority: 2 });

    // → TACKLE_STATE when close to opponent carrier
    this.fsm.addTransition({ from: 'DEFEND', to: 'TACKLE_STATE', condition: ctx => !!ctx.ballCarrierPos && ctx.ball.carrier?.teamSide !== ctx.teamSide && distToBall(ctx) < 60, priority: 8 });

    // → RUCK_BIND when player is in ruck
    this.fsm.addTransition({ from: 'IDLE', to: 'RUCK_BIND', condition: ctx => ctx.player.isInRuck, priority: 9 });
    this.fsm.addTransition({ from: 'DEFEND', to: 'RUCK_BIND', condition: ctx => ctx.player.isInRuck, priority: 9 });
    this.fsm.addTransition({ from: 'SUPPORT_ATTACK', to: 'RUCK_BIND', condition: ctx => ctx.player.isInRuck, priority: 9 });

    // → RETURN_POSITION from carry when ball lost
    this.fsm.addTransition({ from: 'CARRY_BALL', to: 'RETURN_POSITION', condition: ctx => !ctx.player.hasBall, priority: 1 });
    this.fsm.addTransition({ from: 'RUCK_BIND', to: 'RETURN_POSITION', condition: ctx => !ctx.player.isInRuck, priority: 1 });
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
  update(delta: number, ball: Ball, formationX: number, formationY: number, isControlled: boolean): void {
    this.context.ball = ball;
    this.context.formationX = formationX;
    this.context.formationY = formationY;
    this.context.isControlled = isControlled;

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
