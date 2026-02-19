import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Phaser completely to avoid window requirement
vi.mock('phaser', () => {
  return {
    default: {
      Physics: { 
        Arcade: { 
          Image: class {
            constructor(scene, x, y, texture) { this.x = x; this.y = y; this.body = { velocity: { x: 0, y: 0 }, speed: 0 }; }
            setCircle() {}
            setDepth() {}
            setCollideWorldBounds() {}
            setBounce() {}
            setTint() {}
            setData() {}
            getData() { return undefined; }
            setPosition(x, y) { this.x = x; this.y = y; }
            setVelocity(x, y) { this.body.velocity.x = x; this.body.velocity.y = y; }
          }, 
          Body: class {} 
        } 
      },
      GameObjects: { 
        Image: class { setDepth() { return this; } setPosition() {} }, 
        Text: class { setOrigin() { return this; } setDepth() { return this; } setPosition() {} setScrollFactor() { return this; } }, 
        Graphics: class { lineStyle() {} fillRect() {} strokeRect() {} beginPath() {} moveTo() {} lineTo() {} strokePath() {} fillCircle() {} strokeCircle() {} clear() {} setDepth() { return this; } }, 
        Ellipse: class { setDepth() {} setPosition() {} }, 
        Rectangle: class { setDepth() {} setAlpha() {} setOrigin() {} } 
      },
      Scene: class {
        add = {
            image: () => new (vi.mocked(Phaser.GameObjects.Image))(),
            sprite: () => new (vi.mocked(Phaser.Physics.Arcade.Image))(),
            text: () => new (vi.mocked(Phaser.GameObjects.Text))(),
            graphics: () => new (vi.mocked(Phaser.GameObjects.Graphics))(),
            ellipse: () => new (vi.mocked(Phaser.GameObjects.Ellipse))(),
            circle: () => ({ setStrokeStyle: () => {}, setDepth: () => {} }),
            rectangle: () => new (vi.mocked(Phaser.GameObjects.Rectangle))()
        };
        physics = {
            add: {
                image: () => new (vi.mocked(Phaser.Physics.Arcade.Image))(),
                sprite: () => new (vi.mocked(Phaser.Physics.Arcade.Image))()
            }
        };
        cameras = {
            main: {
                width: 800,
                height: 600,
                setBounds: () => {},
                startFollow: () => {},
                setZoom: () => {},
                fadeIn: () => {}
            }
        };
        events = { on: () => {} };
      },
      Math: { 
        Distance: { Between: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1) } 
      }
    }
  }
});

import Phaser from 'phaser';
import { PlayerAI } from '../../src/ai/PlayerAI';
import { Player } from '../../src/entities/Player';
import { Ball } from '../../src/entities/Ball';
import { Team } from '../../src/entities/Team';

// Mock Scene for injection
const mockScene = new Phaser.Scene();

describe('PlayerAI Ruck Commitment', () => {
  let player: Player;
  let ball: Ball;
  let team: Team;
  let ai: PlayerAI;

  beforeEach(() => {
    // Setup Team and Player
    // Mock TeamStats
    const stats = { rating: 80, strength: 80, speed: 80, kicking: 80, handling: 80, color: 0xFFFFFF };
    team = new Team(mockScene, 'home', stats);
    team.ruckAggression = 3; // Default

    player = new Player(mockScene, 100, 100, 6, 'home', 0xFFFFFF); // Flanker (Pos 6)
    player.team = team; // Ensure back-ref is set (Player constructor might not do it if Team creates players, but here we manually link)
    // Actually Team constructor creates players. let's use one of those.
    player = team.players[5]; // Blindside Flanker is at index 5 (Pos 6)
    player.setPosition(100, 100);

    ball = new Ball(mockScene, 200, 200);
    ball.state = 'ruck'; // Simulate ruck state

    ai = new PlayerAI(player, ball);
  });

  it('should join ruck if within range and aggression is adequate', () => {
    // Distance 100px. Aggression 3 -> Range 120px. Should join.
    ai.update(16, ball, 100, 100, false, undefined);
    
    // Check transition
    // Since we can't easily check private FSM state name without getter (getState added?)
    expect(ai.getState()).toBe('RUCK_BIND');
  });

  it('should NOT join ruck if too far', () => {
    player.setPosition(0, 0); // Distance 282px to (200,200)
    // Range 120px. Should NOT join.
    
    ai.update(16, ball, 0, 0, false, undefined);
    
    expect(ai.getState()).not.toBe('RUCK_BIND');
    expect(ai.getState()).toBe('IDLE'); // Default
  });

  it('should join from further away with high aggression', () => {
    // Mock team with high aggression
    player.team = { ruckAggression: 5 }; 
    player.setPosition(20, 200); // Distance 180px.
    
    ai.update(16, ball, 20, 200, false, undefined);
    
    expect(ai.getState()).toBe('RUCK_BIND');
  });

  it('should NOT join if low aggression', () => {
    team.ruckAggression = 1; // Range 40px
    player.setPosition(150, 200); // Distance 50px
    
    ai.update(16, ball, 150, 200, false, undefined);
    
    expect(ai.getState()).not.toBe('RUCK_BIND');
  });
  
  it('should not join if player is a back (e.g. Winger)', () => {
    // Get a winger (Pos 11 or 14)
    const winger = team.getPlayerByPosition(11);
    winger.setPosition(150, 200); // Close enough
    
    const wingerAI = new PlayerAI(winger, ball);
    
    wingerAI.update(16, ball, 150, 200, false, undefined);
    
    expect(wingerAI.getState()).not.toBe('RUCK_BIND');
  });
});
