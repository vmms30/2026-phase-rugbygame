/**
 * Kicking component — encapsulates kick type logic and power bar.
 *
 * Kick types:
 * - Punt:         high, long, for territory gain
 * - Grubber:      low, bounces unpredictably
 * - Box kick:     high & short, scrum-half specialty
 * - Drop goal:    through the posts from open play
 * - Touch finder: aimed at touchline for lineout
 * - Restart:      kickoff/22m dropout
 */

export const KickType = {
  PUNT: 'PUNT',
  GRUBBER: 'GRUBBER',
  BOX_KICK: 'BOX_KICK',
  DROP_GOAL: 'DROP_GOAL',
  TOUCH_FINDER: 'TOUCH_FINDER',
  RESTART: 'RESTART',
} as const;
export type KickType = (typeof KickType)[keyof typeof KickType];

export interface KickConfig {
  /** Base distance (px) × (kicking/100) × power */
  baseDistance: number;
  /** Maximum arc height multiplier */
  arcHeight: number;
  /** Flight duration multiplier (seconds) */
  flightDuration: number;
  /** Accuracy modifier for direction (lower = more deviation) */
  accuracy: number;
  /** Whether the ball bounces on landing */
  bounces: boolean;
  /** Angle deviation on bounce (degrees) */
  bounceDeviation: number;
}

export const KICK_CONFIGS: Record<KickType, KickConfig> = {
  [KickType.PUNT]: {
    baseDistance: 500,
    arcHeight: 0.25,
    flightDuration: 1.8,
    accuracy: 0.85,
    bounces: false,
    bounceDeviation: 0,
  },
  [KickType.GRUBBER]: {
    baseDistance: 200,
    arcHeight: 0.04,
    flightDuration: 0.6,
    accuracy: 0.7,
    bounces: true,
    bounceDeviation: 20,
  },
  [KickType.BOX_KICK]: {
    baseDistance: 250,
    arcHeight: 0.4,
    flightDuration: 2.0,
    accuracy: 0.75,
    bounces: false,
    bounceDeviation: 0,
  },
  [KickType.DROP_GOAL]: {
    baseDistance: 350,
    arcHeight: 0.2,
    flightDuration: 1.2,
    accuracy: 0.6,
    bounces: false,
    bounceDeviation: 0,
  },
  [KickType.TOUCH_FINDER]: {
    baseDistance: 400,
    arcHeight: 0.18,
    flightDuration: 1.5,
    accuracy: 0.8,
    bounces: false,
    bounceDeviation: 0,
  },
  [KickType.RESTART]: {
    baseDistance: 350,
    arcHeight: 0.3,
    flightDuration: 1.6,
    accuracy: 0.9,
    bounces: false,
    bounceDeviation: 0,
  },
};

/**
 * Power bar state machine.
 * Charging fills 0→1 over KICK_CHARGE_DURATION ms.
 */
export class PowerBar {
  power: number = 0;
  isCharging: boolean = false;
  private startTime: number = 0;
  private chargeDuration: number;

  constructor(chargeDurationMs: number = 1500) {
    this.chargeDuration = chargeDurationMs;
  }

  startCharging(): void {
    this.isCharging = true;
    this.startTime = Date.now();
    this.power = 0;
  }

  update(): void {
    if (!this.isCharging) return;
    const elapsed = Date.now() - this.startTime;
    this.power = Math.min(1.0, elapsed / this.chargeDuration);
  }

  release(): number {
    this.isCharging = false;
    const finalPower = this.power;
    this.power = 0;
    return finalPower;
  }

  reset(): void {
    this.isCharging = false;
    this.power = 0;
  }

  /**
   * Get power bar color based on current charge.
   * Green (good) → Yellow (mid) → Red (over-hit)
   */
  getColor(): number {
    if (this.power < 0.5) return 0x22c55e;  // Green
    if (this.power < 0.8) return 0xeab308;  // Yellow
    return 0xef4444;                          // Red
  }
}

/**
 * Calculate actual kick distance from stats and power.
 */
export function calculateKickDistance(
  kickType: KickType,
  kickingStat: number,
  power: number,
): number {
  const config = KICK_CONFIGS[kickType];
  return config.baseDistance * (kickingStat / 100) * power;
}

/**
 * Calculate direction deviation for a kick based on accuracy and stats.
 * Returns angle deviation in radians.
 */
export function calculateKickDeviation(
  kickType: KickType,
  kickingStat: number,
  power: number,
): number {
  const config = KICK_CONFIGS[kickType];
  const accuracy = config.accuracy * (kickingStat / 100);

  // Over-powered kicks are less accurate
  const overPowerPenalty = power > 0.85 ? (power - 0.85) * 3 : 0;

  const maxDeviation = (1 - accuracy + overPowerPenalty) * 0.4; // Up to ~23° deviation
  return (Math.random() - 0.5) * 2 * maxDeviation;
}
