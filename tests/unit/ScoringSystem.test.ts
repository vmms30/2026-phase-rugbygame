import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('phaser', () => ({
  default: {
    GameObjects: { Graphics: class {}, Text: class {}, Sprite: class {} },
    Scene: class {},
    Math: { Distance: { Between: () => 0 } }
  }
}));
import { ScoringSystem } from '../../src/systems/ScoringSystem';
import { Ball } from '../../src/entities/Ball';
import { Player } from '../../src/entities/Player';
import { PITCH, SCORING } from '../../src/utils/Constants';
import { EventBus } from '../../src/utils/EventBus';

describe('ScoringSystem', () => {
  let scoringSystem: ScoringSystem;
  let mockBall: Partial<Ball>;
  let mockCarrier: Partial<Player>;

  beforeEach(() => {
    scoringSystem = new ScoringSystem();
    vi.spyOn(EventBus, 'emit').mockImplementation(() => {});

    mockCarrier = {
      teamSide: 'home',
    };

    mockBall = {
      carrier: mockCarrier as Player,
      sprite: {
        x: 0,
        y: PITCH.HEIGHT_PX / 2,
      } as any
    };
  });

  it('should detect a try for the home team', () => {
    mockCarrier.teamSide = 'home';
    mockBall.sprite!.x = PITCH.TRY_LINE_RIGHT + 10;

    const result = scoringSystem.checkTry(mockBall as Ball);
    
    expect(result).toEqual({ scored: true, team: 'home' });
    expect(scoringSystem.getScore().home).toBe(SCORING.TRY);
    expect(scoringSystem.getScore().away).toBe(0);
    expect(scoringSystem.isConversionPending()).toBe(true);
    expect(scoringSystem.getConversionTeam()).toBe('home');
    expect(EventBus.emit).toHaveBeenCalledWith('score', { team: 'home', type: 'try', points: SCORING.TRY });
  });

  it('should detect a try for the away team', () => {
    mockCarrier.teamSide = 'away';
    mockBall.sprite!.x = PITCH.TRY_LINE_LEFT - 10;

    const result = scoringSystem.checkTry(mockBall as Ball);
    
    expect(result).toEqual({ scored: true, team: 'away' });
    expect(scoringSystem.getScore().away).toBe(SCORING.TRY);
    expect(scoringSystem.getScore().home).toBe(0);
    expect(scoringSystem.isConversionPending()).toBe(true);
    expect(scoringSystem.getConversionTeam()).toBe('away');
  });

  it('should not detect a try if ball is not in in-goal area', () => {
    mockCarrier.teamSide = 'home';
    mockBall.sprite!.x = PITCH.HALFWAY;

    const result = scoringSystem.checkTry(mockBall as Ball);
    
    expect(result).toBeNull();
    expect(scoringSystem.getScore().home).toBe(0);
    expect(scoringSystem.isConversionPending()).toBe(false);
  });

  it('should handle successful conversion', () => {
    scoringSystem['awardTry']('home', 500); // Manually trigger try to prep conversion
    expect(scoringSystem.isConversionPending()).toBe(true);

    // High accuracy, good power, high stat -> almost certain success
    // Stub Math.random to guarantee success
    vi.spyOn(Math, 'random').mockReturnValue(0.1); 
    
    const success = scoringSystem.attemptConversion(1.0, 0.75, 90);
    
    expect(success).toBe(true);
    expect(scoringSystem.getScore().home).toBe(SCORING.TRY + SCORING.CONVERSION);
    expect(scoringSystem.isConversionPending()).toBe(false);
    expect(EventBus.emit).toHaveBeenCalledWith('score', { team: 'home', type: 'conversion', points: SCORING.CONVERSION });
    
    vi.restoreAllMocks();
  });

  it('should handle missed conversion', () => {
    scoringSystem['awardTry']('away', 500);
    
    // Stub Math.random to guarantee failure
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    
    const success = scoringSystem.attemptConversion(0.5, 0.2, 50);
    
    expect(success).toBe(false);
    expect(scoringSystem.getScore().away).toBe(SCORING.TRY); // Score doesn't change
    expect(scoringSystem.isConversionPending()).toBe(false);
    
    vi.restoreAllMocks();
  });

  it('should handle penalty goal success', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    
    const success = scoringSystem.attemptPenaltyGoal('home', 1.0, 0.75, 90, 200);
    
    expect(success).toBe(true);
    expect(scoringSystem.getScore().home).toBe(SCORING.PENALTY_GOAL);
    expect(EventBus.emit).toHaveBeenCalledWith('score', { team: 'home', type: 'penalty', points: SCORING.PENALTY_GOAL });
    
    vi.restoreAllMocks();
  });

  it('should handle drop goal success', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    
    const success = scoringSystem.attemptDropGoal('away', 90, 200);
    
    expect(success).toBe(true);
    expect(scoringSystem.getScore().away).toBe(SCORING.DROP_GOAL);
    expect(EventBus.emit).toHaveBeenCalledWith('score', { team: 'away', type: 'dropGoal', points: SCORING.DROP_GOAL });
    
    vi.restoreAllMocks();
  });

  it('should reset score and conversion state', () => {
    scoringSystem['awardTry']('home', 500);
    scoringSystem.reset();
    
    expect(scoringSystem.getScore()).toEqual({ home: 0, away: 0 });
    expect(scoringSystem.isConversionPending()).toBe(false);
  });
});
