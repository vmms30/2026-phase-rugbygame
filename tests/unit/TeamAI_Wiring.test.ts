
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TeamAI } from '../../src/ai/TeamAI';
import { PlayerAI } from '../../src/ai/PlayerAI';
import { Team } from '../../src/entities/Team';
import { Ball } from '../../src/entities/Ball';
import { Player } from '../../src/entities/Player';
import { EventBus } from '../../src/utils/EventBus';
import { Position } from '../../src/utils/Constants';

// Mock Phaser
vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    Physics: {
      Arcade: {
        Image: class {
          setTint = vi.fn();
          setCircle = vi.fn();
          setCollideWorldBounds = vi.fn();
          setDepth = vi.fn();
          setData = vi.fn();
          setVelocity = vi.fn();
          setPosition = vi.fn();
          setRotation = vi.fn();
          x = 0;
          y = 0;
        }
      }
    },
    Math: {
      Distance: {
        Between: (x1: number, y1: number, x2: number, y2: number) => Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2))
      }
    }
  }
}));

describe('TeamAI -> PlayerAI Wiring', () => {
  let teamAI: TeamAI;
  let team: Team;
  let player: Player;
  let ball: Ball;
  let playerAI: PlayerAI;

  beforeEach(() => {
    // Setup mocks
    const scene = new (vi.fn())();
    
    // Mock Team
    team = {
      players: [],
      getPlayerByPosition: vi.fn(),
      requestDropGoal: vi.fn(),
      avgStamina: 100
    } as any;

    // Mock Player
    player = {
      id: 'p1',
      position: Position.FLY_HALF,
      teamSide: 'home',
      stats: { speed: 50, kicking: 50 },
      sprite: { x: 100, y: 100, setVelocity: vi.fn() },
      formationX: 100,
      formationY: 100,
      moveToward: vi.fn(),
      hasBall: true, // User has ball
      isGrounded: false,
      isInRuck: false
    } as any;
    team.players.push(player);

    // Mock Ball
    ball = {
      sprite: { x: 100, y: 100 },
      carrier: player,
      kickWithType: vi.fn(),
      passTo: vi.fn()
    } as any;

    // init TeamAI
    teamAI = new TeamAI(team, 'home');
    
    // Initialize PlayerAI (which listens to EventBus)
    playerAI = new PlayerAI(player, ball);
    
    // Spy on FSM transition
    vi.spyOn(playerAI['fsm'], 'forceState');
  });

  it('should trigger KICK state in PlayerAI when TeamAI orders KICK', () => {
    // Force TeamAI decision
    // We can't easily force private currentPlay, but we can verify the EventBus emission processing
    
    // Simulate TeamAI emitting the order
    EventBus.emit('teamOrder', { playerId: player.id, order: 'KICK' });

    expect(playerAI['fsm'].forceState).toHaveBeenCalledWith('KICKING');
  });

  it('should trigger PASS state in PlayerAI when TeamAI orders PASS', () => {
     EventBus.emit('teamOrder', { playerId: player.id, order: 'PASS' });
     expect(playerAI['fsm'].forceState).toHaveBeenCalledWith('PASSING');
  });

  it('should NOT trigger state change if playerId does not match', () => {
    EventBus.emit('teamOrder', { playerId: 'other_player', order: 'KICK' });
    expect(playerAI['fsm'].forceState).not.toHaveBeenCalled();
  });
});
