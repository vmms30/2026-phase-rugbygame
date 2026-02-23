import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClockSystem } from '../../src/systems/ClockSystem';
import { MATCH } from '../../src/utils/Constants';
import { EventBus } from '../../src/utils/EventBus';

describe('ClockSystem', () => {
  let clockSystem: ClockSystem;

  beforeEach(() => {
    clockSystem = new ClockSystem();
    vi.spyOn(EventBus, 'emit').mockImplementation(() => {});
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // Predictable injury time
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should start at 00:00 in the first half', () => {
    expect(clockSystem.getMinutes()).toBe(0);
    expect(clockSystem.getSeconds()).toBe(0);
    expect(clockSystem.getHalf()).toBe(1);
    expect(clockSystem.getClockString()).toBe('00:00');
    expect(clockSystem.isPaused()).toBe(false);
  });

  it('should advance time correctly based on delta and time scale', () => {
    // Delta is in ms. 1000ms real time = MATCH.TIME_SCALE game seconds
    // Let's say TIME_SCALE is 4. 1000ms = 4s game time.
    clockSystem.update(1000); 
    
    expect(clockSystem.getSeconds()).toBe(MATCH.TIME_SCALE);
    expect(EventBus.emit).toHaveBeenCalledWith('clockTick', expect.any(Object));
  });

  it('should format clock string correctly', () => {
    // 65 game seconds = 1:05
    clockSystem['gameSeconds'] = 65; 
    expect(clockSystem.getClockString()).toBe('01:05');
    
    // 600 game seconds = 10:00
    clockSystem['gameSeconds'] = 600;
    expect(clockSystem.getClockString()).toBe('10:00');
  });

  it('should trigger half-time when duration reached (including injury time)', () => {
    // Advance to 40 minutes (half time)
    const fortyMinsInSeconds = MATCH.HALF_DURATION * 60;
    clockSystem['gameSeconds'] = fortyMinsInSeconds - 1;
    
    clockSystem.update((1000 / MATCH.TIME_SCALE) * 2); // advance 2 game seconds
    
    expect(clockSystem.isInInjuryTime()).toBe(true);
    // Note: Half time may not trigger immediately if injury time > 0
    // With Math.random() = 0.5, injury time is exactly halfway between MIN and MAX.
    const expectedInjuryTimeSeconds = (MATCH.INJURY_TIME_MIN + 0.5 * (MATCH.INJURY_TIME_MAX - MATCH.INJURY_TIME_MIN)) * 60;
    
    // Fast forward through injury time
    clockSystem['gameSeconds'] = fortyMinsInSeconds + expectedInjuryTimeSeconds;
    clockSystem.update(1000); // one more update to trigger
    
    expect(EventBus.emit).toHaveBeenCalledWith('halfTime', expect.any(Object));
    expect(clockSystem.isPaused()).toBe(true);
  });

  it('should start second half correctly', () => {
    clockSystem.startSecondHalf();
    
    expect(clockSystem.getHalf()).toBe(2);
    expect(clockSystem.getMinutes()).toBe(MATCH.HALF_DURATION);
    expect(clockSystem.isPaused()).toBe(false);
  });

  it('should trigger full-time when second half duration reached', () => {
    clockSystem.startSecondHalf();
    const eightyMinsInSeconds = MATCH.HALF_DURATION * 2 * 60;
    
    // Fast forward to end of injury time
    const expectedInjuryTimeSeconds = (MATCH.INJURY_TIME_MIN + 0.5 * (MATCH.INJURY_TIME_MAX - MATCH.INJURY_TIME_MIN)) * 60;
    clockSystem['gameSeconds'] = eightyMinsInSeconds + expectedInjuryTimeSeconds;
    
    clockSystem.update(1000);
    
    expect(EventBus.emit).toHaveBeenCalledWith('fullTime', expect.any(Object));
    expect(clockSystem.isMatchEnded()).toBe(true);
    expect(clockSystem.isPaused()).toBe(true);
  });

  it('should respect pause state and not advance time', () => {
    clockSystem.pause();
    clockSystem.update(1000);
    
    expect(clockSystem.getSeconds()).toBe(0);
    
    clockSystem.resume();
    clockSystem.update(1000);
    
    expect(clockSystem.getSeconds()).toBe(MATCH.TIME_SCALE);
  });

  it('should reset correctly', () => {
    clockSystem.update(60000); // advance 1 min real time
    clockSystem.pause();
    
    clockSystem.reset();
    
    expect(clockSystem.getSeconds()).toBe(0);
    expect(clockSystem.getMinutes()).toBe(0);
    expect(clockSystem.isPaused()).toBe(false);
    expect(clockSystem.getHalf()).toBe(1);
    expect(clockSystem.isMatchEnded()).toBe(false);
  });
});
