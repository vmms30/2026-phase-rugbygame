import { describe, it, expect, beforeEach } from 'vitest';
import { vi } from 'vitest';
vi.mock('phaser', () => ({
  default: {
    GameObjects: { Graphics: class {}, Text: class {}, Sprite: class {} },
    Scene: class {},
    Math: { Distance: { Between: () => 0 } }
  }
}));
import { OffsidesSystem } from '../../src/systems/OffsidesSystem';
import { Player } from '../../src/entities/Player';

describe('OffsidesSystem', () => {
  let offsidesSystem: OffsidesSystem;

  beforeEach(() => {
    offsidesSystem = new OffsidesSystem();
  });

  it('should set ruck offside lines correctly and enforce them', () => {
    // Mock ruck at x=500. RUCK_RADIUS=60. 
    // Home attacks right. Home offside line = 500 - 60 = 440.
    // Away attacks left. Away offside line = 500 + 60 = 560.
    offsidesSystem.setRuckOffsideLine(500, true);
    
    expect(offsidesSystem.isActive()).toBe(true);
    expect(offsidesSystem.getOffsideLine('home')).toBe(440);
    expect(offsidesSystem.getOffsideLine('away')).toBe(560);
    
    // Mock players
    const homePlayerOnside = { teamSide: 'home', sprite: { x: 400, y: 100 } } as Player;
    const homePlayerOffside = { teamSide: 'home', sprite: { x: 450, y: 100 } } as Player;
    const awayPlayerOnside = { teamSide: 'away', sprite: { x: 600, y: 100 } } as Player;
    const awayPlayerOffside = { teamSide: 'away', sprite: { x: 550, y: 100 } } as Player;
    
    // Check offsides
    expect(offsidesSystem.isOffside(homePlayerOnside)).toBe(false);
    expect(offsidesSystem.isOffside(homePlayerOffside)).toBe(true);
    
    expect(offsidesSystem.isOffside(awayPlayerOnside)).toBe(false);
    expect(offsidesSystem.isOffside(awayPlayerOffside)).toBe(true);
    
    // Check detailed penalty response
    const penalty = offsidesSystem.getOffsidePenalty(homePlayerOffside, false);
    expect(penalty.isOffside).toBe(true);
    expect(penalty.penaltyPos).toEqual({ x: 440, y: 100 });
  });

  it('should clear ruck offsides correctly', () => {
    offsidesSystem.setRuckOffsideLine(500, true);
    offsidesSystem.clearRuckOffside();
    
    expect(offsidesSystem.isActive()).toBe(false);
    
    const homePlayerOffside = { teamSide: 'home', sprite: { x: 600, y: 100 } } as Player;
    // Should not flag offside if ruck is inactive
    expect(offsidesSystem.isOffside(homePlayerOffside)).toBe(false);
  });

  it('should have working debug mode toggle', () => {
    expect(offsidesSystem.isDebugActive()).toBe(false);
    
    offsidesSystem.toggleDebug();
    expect(offsidesSystem.isDebugActive()).toBe(true);
    
    offsidesSystem.toggleDebug();
    expect(offsidesSystem.isDebugActive()).toBe(false);
  });
});
