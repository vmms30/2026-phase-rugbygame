/**
 * Strongly-typed EventBus for decoupled communication between game systems.
 *
 * Usage:
 *   EventBus.emit('phaseChange', { from: 'OPEN_PLAY', to: 'TACKLE' });
 *   EventBus.on('phaseChange', (data) => { ... });
 */

import type { GamePhase } from './Constants';

// ─── Event Definitions ──────────────────────────────────────
export interface GameEvents {
  /** Fired when the game phase transitions */
  phaseChange: { from: GamePhase; to: GamePhase };
  /** Fired when a score occurs */
  score: { team: 'home' | 'away'; type: 'try' | 'conversion' | 'penalty' | 'dropGoal'; points: number };
  /** Ball possession changed */
  possessionChange: { team: 'home' | 'away' };
  /** Tackle occurred */
  tackle: { tacklerId: string; carrierId: string; outcome?: string; dominant?: boolean };
  /** Ruck formed */
  ruckFormed: { x: number; y: number };
  /** Ruck resolved — ball recycled */
  ruckResolved: { team: 'home' | 'away' };
  /** Ruck ball available for pickup */
  ruckBallAvailable: { x: number; y: number };
  /** Ruck turnover occurred */
  ruckTurnover: { x: number; y: number };
  /** Ruck timed out */
  ruckTimeout: { x: number; y: number };
  /** Ball kicked */
  ballKicked: { kickerId: string; type: string; power: number };
  /** Ball passed */
  ballPassed: { passerId: string; receiverId: string; type?: string };
  /** Knock-on occurred */
  knockOn: { playerId: string; x?: number; y?: number };
  /** Ball went into touch */
  touch: { x: number; y: number; team: 'home' | 'away' };
  /** Penalty awarded */
  penaltyAwarded: { x: number; y: number; reason: string; team?: 'home' | 'away'; againstAttack?: boolean };
  /** Whistle blown */
  whistle: { type: 'short' | 'long' };
  /** Player switched */
  playerSwitched: { playerId: string };
  /** Match clock tick */
  clockTick: { gameMinutes: number; gameSeconds: number; half: 1 | 2 };
  /** Half-time reached */
  halfTime: Record<string, never>;
  /** Full-time reached */
  fullTime: Record<string, never>;
}

type EventCallback<T> = (data: T) => void;

class EventBusClass {
  private listeners: Map<string, Set<EventCallback<unknown>>> = new Map();

  /**
   * Subscribe to an event.
   */
  on<K extends keyof GameEvents>(event: K, callback: EventCallback<GameEvents[K]>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as EventCallback<unknown>);
  }

  /**
   * Unsubscribe from an event.
   */
  off<K extends keyof GameEvents>(event: K, callback: EventCallback<GameEvents[K]>): void {
    this.listeners.get(event)?.delete(callback as EventCallback<unknown>);
  }

  /**
   * Emit an event with data.
   */
  emit<K extends keyof GameEvents>(event: K, data: GameEvents[K]): void {
    this.listeners.get(event)?.forEach((cb) => {
      try {
        cb(data);
      } catch (err) {
        console.error(`[EventBus] Error in handler for "${event}":`, err);
      }
    });
  }

  /**
   * Subscribe once — automatically unsubscribes after first fire.
   */
  once<K extends keyof GameEvents>(event: K, callback: EventCallback<GameEvents[K]>): void {
    const wrapper: EventCallback<GameEvents[K]> = (data) => {
      this.off(event, wrapper);
      callback(data);
    };
    this.on(event, wrapper);
  }

  /**
   * Remove all listeners (useful on scene shutdown).
   */
  clear(): void {
    this.listeners.clear();
  }
}

/** Singleton EventBus instance */
export const EventBus = new EventBusClass();
