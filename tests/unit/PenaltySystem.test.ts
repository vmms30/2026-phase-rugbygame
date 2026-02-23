import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PenaltySystem } from '../../src/systems/PenaltySystem';
import { EventBus } from '../../src/utils/EventBus';

describe('PenaltySystem', () => {
  let penaltySystem: PenaltySystem;

  beforeEach(() => {
    penaltySystem = new PenaltySystem();
    vi.spyOn(EventBus, 'emit').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should signal an infringement and play advantage', () => {
    penaltySystem.signalInfringement('offside', 300, 400, 'away', true);
    
    const state = penaltySystem.getState();
    expect(state.active).toBe(true);
    expect(state.infringement).toBe('offside');
    expect(state.againstTeam).toBe('away');
    expect(state.advantagePlaying).toBe(true);
    expect(state.advantageStartX).toBe(300);
    expect(state.severity).toBe('penalty');
    
    // Should emit event
    expect(EventBus.emit).toHaveBeenCalledWith('penaltyAwarded', {
      x: 300, y: 400, reason: 'offside', againstAttack: false, severity: 'penalty'
    });
  });

  it('should signal an infringement and award penalty immediately if advantage = false', () => {
    penaltySystem.signalInfringement('high_tackle', 500, 200, 'home', false);
    
    const state = penaltySystem.getState();
    expect(state.active).toBe(true);
    expect(state.advantagePlaying).toBe(false);
    
    // Should emit whistle event because penalty is awarded
    expect(EventBus.emit).toHaveBeenCalledWith('whistle', { type: 'short' });
  });

  it('should set severity to free_kick for early engagement', () => {
    penaltySystem.signalInfringement('early_engagement', 400, 300, 'home', false);
    
    const state = penaltySystem.getState();
    expect(state.severity).toBe('free_kick');
  });

  it('should check if advantage is gained correctly for home team benefitting', () => {
    // Home team benefits (against away). Starts at 300. Home attacks right. Gained if x > 400 (300 + 100).
    penaltySystem.signalInfringement('offside', 300, 400, 'away', true);
    
    // Has not gained 100px
    const notGained = penaltySystem.checkAdvantageGained(350, 'home');
    expect(notGained).toBe(false);
    expect(penaltySystem.getState().active).toBe(true);
    
    // Has gained 100px+
    const gained = penaltySystem.checkAdvantageGained(450, 'home');
    expect(gained).toBe(true);
    expect(penaltySystem.getState().active).toBe(false);
    expect(penaltySystem.getState().advantagePlaying).toBe(false);
  });

  it('should check if advantage is gained correctly for away team benefitting', () => {
    // Away team benefits (against home). Starts at 700. Away attacks left. Gained if x < 600 (700 - 100).
    penaltySystem.signalInfringement('not_releasing', 700, 400, 'home', true);
    
    // Has not gained 100px (moved to 650)
    const notGained = penaltySystem.checkAdvantageGained(650, 'away');
    expect(notGained).toBe(false);
    
    // Has gained 100px+ (moved to 500)
    const gained = penaltySystem.checkAdvantageGained(500, 'away');
    expect(gained).toBe(true);
    expect(penaltySystem.getState().active).toBe(false);
  });

  it('should call back for penalty if advantage is over and not gained', () => {
    penaltySystem.signalInfringement('hands_in_ruck', 500, 500, 'away', true);
    
    penaltySystem.advantageOver();
    
    expect(penaltySystem.getState().advantagePlaying).toBe(false);
    expect(penaltySystem.getState().active).toBe(true);
    expect(EventBus.emit).toHaveBeenCalledWith('whistle', { type: 'short' });
  });

  it('should handle select penalty option', () => {
    penaltySystem.signalInfringement('hands_in_ruck', 500, 500, 'away', false);
    
    penaltySystem.selectOption('kick_to_touch');
    
    expect(penaltySystem.getState().active).toBe(false);
  });

  it('should reset state correctly', () => {
    penaltySystem.signalInfringement('offside', 100, 100, 'home', true);
    penaltySystem.reset();
    
    expect(penaltySystem.getState().active).toBe(false);
    expect(penaltySystem.getState().advantagePlaying).toBe(false);
  });
});
