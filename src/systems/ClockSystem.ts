/**
 * ClockSystem — match timing with accelerated game clock.
 *
 * 1 real second ≈ 4 game seconds (configurable via MATCH.TIME_SCALE).
 * 80-minute match ≈ 20 minutes real time.
 * Tracks halves, injury time, and pause states.
 */

import { MATCH } from '../utils/Constants';
import { EventBus } from '../utils/EventBus';

export class ClockSystem {
  private gameSeconds = 0;
  private half: 1 | 2 = 1;
  private paused = false;
  private injuryTimeSeconds = 0;
  private injuryTimeAdded = false;
  private matchEnded = false;

  /** Total game minutes elapsed */
  getMinutes(): number {
    return Math.floor(this.gameSeconds / 60);
  }

  /** Game seconds within current minute */
  getSeconds(): number {
    return Math.floor(this.gameSeconds % 60);
  }

  /** Formatted clock string MM:SS */
  getClockString(): string {
    return `${String(this.getMinutes()).padStart(2, '0')}:${String(this.getSeconds()).padStart(2, '0')}`;
  }

  getHalf(): 1 | 2 {
    return this.half;
  }

  isInInjuryTime(): boolean {
    const halfEnd = this.half === 1 ? MATCH.HALF_DURATION : MATCH.HALF_DURATION * 2;
    return this.getMinutes() >= halfEnd;
  }

  isPaused(): boolean {
    return this.paused;
  }

  isMatchEnded(): boolean {
    return this.matchEnded;
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  /**
   * Update the clock. Call once per frame.
   * @param deltaMs Frame delta in milliseconds
   */
  update(deltaMs: number): void {
    if (this.paused || this.matchEnded) return;

    // Accelerate time
    this.gameSeconds += (deltaMs / 1000) * MATCH.TIME_SCALE;

    const minutes = this.getMinutes();

    // Emit clock tick every game second
    EventBus.emit('clockTick', {
      gameMinutes: minutes,
      gameSeconds: this.getSeconds(),
      half: this.half,
    });

    // Half-time check
    if (this.half === 1 && minutes >= MATCH.HALF_DURATION) {
      if (!this.injuryTimeAdded) {
        this.injuryTimeSeconds = (MATCH.INJURY_TIME_MIN + Math.random() * (MATCH.INJURY_TIME_MAX - MATCH.INJURY_TIME_MIN)) * 60;
        this.injuryTimeAdded = true;
      }
      if (this.gameSeconds >= (MATCH.HALF_DURATION * 60 + this.injuryTimeSeconds)) {
        this.triggerHalfTime();
      }
    }

    // Full-time check
    if (this.half === 2 && minutes >= MATCH.HALF_DURATION * 2) {
      if (!this.injuryTimeAdded) {
        this.injuryTimeSeconds = (MATCH.INJURY_TIME_MIN + Math.random() * (MATCH.INJURY_TIME_MAX - MATCH.INJURY_TIME_MIN)) * 60;
        this.injuryTimeAdded = true;
      }
      if (this.gameSeconds >= (MATCH.HALF_DURATION * 2 * 60 + this.injuryTimeSeconds)) {
        this.triggerFullTime();
      }
    }
  }

  private triggerHalfTime(): void {
    this.paused = true;
    this.injuryTimeAdded = false;
    EventBus.emit('halfTime', {} as Record<string, never>);
  }

  /** Start second half */
  startSecondHalf(): void {
    this.half = 2;
    this.gameSeconds = MATCH.HALF_DURATION * 60;
    this.paused = false;
    this.injuryTimeAdded = false;
  }

  private triggerFullTime(): void {
    this.matchEnded = true;
    this.paused = true;
    EventBus.emit('fullTime', {} as Record<string, never>);
  }

  reset(): void {
    this.gameSeconds = 0;
    this.half = 1;
    this.paused = false;
    this.injuryTimeSeconds = 0;
    this.injuryTimeAdded = false;
    this.matchEnded = false;
  }
}
