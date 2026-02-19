/**
 * Game-wide constants for the Rugby Phase Game.
 * All magic numbers live here — never use literals in game code.
 */

// ─── Pitch Dimensions (1 m = 10 px) ──────────────────────────
export const PITCH = {
  /** Total width including in-goal areas (100m field + 2×10m in-goal + 2×5m dead-ball) */
  WIDTH_PX: 1400,
  /** Pitch height (70 m) */
  HEIGHT_PX: 700,
  /** Metres-to-pixels conversion */
  M_TO_PX: 10,
  /** Try line offset from left edge (dead-ball 5m + in-goal 10m = 15m = 150px) */
  TRY_LINE_LEFT: 150,
  /** Try line offset from right edge */
  TRY_LINE_RIGHT: 1250,
  /** Halfway line */
  HALFWAY: 700,
  /** 22m lines */
  LINE_22_LEFT: 370,
  LINE_22_RIGHT: 1030,
  /** 10m lines from halfway */
  LINE_10_LEFT: 600,
  LINE_10_RIGHT: 800,
  /** Touchlines (top and bottom) */
  TOUCHLINE_TOP: 0,
  TOUCHLINE_BOTTOM: 700,
  /** Goal post positions */
  POST_LEFT_X: 150,
  POST_RIGHT_X: 1250,
  POST_Y: 350,        // Centre of pitch height
  POST_WIDTH: 56,      // 5.6m between posts
  CROSSBAR_HEIGHT: 30, // 3m height
} as const;

// ─── Player Speeds (px per frame at 60 FPS) ─────────────────
export const PLAYER = {
  /** Base walk speed */
  WALK_SPEED: 0.75,
  /** Base run speed */
  RUN_SPEED: 1.25,
  /** Sprint multiplier */
  SPRINT_MULTIPLIER: 1.5,
  /** Stamina drain per frame while sprinting */
  STAMINA_DRAIN_RATE: 0.15,
  /** Stamina recovery per frame while not sprinting */
  STAMINA_RECOVERY_RATE: 0.08,
  /** Stamina threshold — sprint unavailable below this */
  STAMINA_MIN_SPRINT: 20,
  /** Speed penalty when stamina below threshold */
  LOW_STAMINA_SPEED_PENALTY: 0.85,
  /** Tackle range (px) */
  TACKLE_RANGE: 40,
  /** Grounded time after tackle (ms) */
  GROUNDED_DURATION: 1000,
  /** Size of the player circle body */
  BODY_RADIUS: 8,
  /** Player sprite scale */
  SPRITE_SCALE: 1,
} as const;

// ─── Ball ────────────────────────────────────────────────────
export const BALL = {
  /** Base pass speed */
  PASS_SPEED: 2.5,
  /** Kick speed multiplier */
  KICK_SPEED_MULTIPLIER: 8,
  /** Ground friction deceleration  */
  FRICTION: 0.98,
  /** Bounce deviation for grubber kicks (degrees) */
  GRUBBER_DEVIATION: 15,
  /** Power bar charge duration (ms) */
  KICK_CHARGE_DURATION: 1500,
  /** Ball body radius */
  BODY_RADIUS: 4,
} as const;

// ─── Ruck ────────────────────────────────────────────────────
export const RUCK = {
  /** Ruck zone radius (px) */
  ZONE_RADIUS: 60,
  /** Contest resolution tick interval (ms) */
  TICK_INTERVAL: 300,
  /** Dominance threshold to release ball */
  RELEASE_THRESHOLD: 1.3,
  /** Timeout before awarding scrum (ms) */
  TIMEOUT: 10000,
} as const;

// ─── Match Timing ────────────────────────────────────────────
export const MATCH = {
  /** Game seconds per real second */
  TIME_SCALE: 4,
  /** Half duration in game minutes */
  HALF_DURATION: 40,
  /** Min injury time in game minutes */
  INJURY_TIME_MIN: 1,
  /** Max injury time in game minutes */
  INJURY_TIME_MAX: 5,
} as const;

// ─── Scoring ─────────────────────────────────────────────────
export const SCORING = {
  TRY: 5,
  CONVERSION: 2,
  PENALTY_GOAL: 3,
  DROP_GOAL: 3,
} as const;

// ─── AI Timing ───────────────────────────────────────────────
export const AI = {
  /** TeamAI decision interval (ms) */
  TEAM_THINK_INTERVAL: 500,
  /** Phase count before considering a kick */
  KICK_PHASE_THRESHOLD: 8,
} as const;

// ─── Camera ──────────────────────────────────────────────────
export const CAMERA = {
  /** Follow lerp factor (0–1, lower = smoother) */
  FOLLOW_LERP: 0.08,
  /** Zoom presets */
  ZOOM_CLOSE: 2.0,
  ZOOM_DEFAULT: 1.0,
  ZOOM_WIDE: 0.6,
  /** Zoom transition duration (ms) */
  ZOOM_DURATION: 400,
} as const;

// ─── Directions (8-way) ─────────────────────────────────────
export const Direction = {
  N: 'N',
  NE: 'NE',
  E: 'E',
  SE: 'SE',
  S: 'S',
  SW: 'SW',
  W: 'W',
  NW: 'NW',
} as const;
export type Direction = (typeof Direction)[keyof typeof Direction];

// ─── Game Phases ─────────────────────────────────────────────
export const GamePhase = {
  KICK_OFF: 'KICK_OFF',
  OPEN_PLAY: 'OPEN_PLAY',
  TACKLE: 'TACKLE',
  RUCK: 'RUCK',
  MAUL: 'MAUL',
  SCRUM: 'SCRUM',
  LINEOUT: 'LINEOUT',
  PENALTY: 'PENALTY',
  TAP_AND_GO: 'TAP_AND_GO',
  TRY_SCORED: 'TRY_SCORED',
  CONVERSION: 'CONVERSION',
  DROP_GOAL: 'DROP_GOAL',
  KNOCK_ON: 'KNOCK_ON',
  TOUCH: 'TOUCH',
  HALF_TIME: 'HALF_TIME',
  FULL_TIME: 'FULL_TIME',
} as const;
export type GamePhase = (typeof GamePhase)[keyof typeof GamePhase];

// ─── Player Positions ────────────────────────────────────────
export const Position = {
  LOOSEHEAD_PROP: 1,
  HOOKER: 2,
  TIGHTHEAD_PROP: 3,
  LOCK_4: 4,
  LOCK_5: 5,
  BLINDSIDE_FLANKER: 6,
  OPENSIDE_FLANKER: 7,
  NUMBER_8: 8,
  SCRUM_HALF: 9,
  FLY_HALF: 10,
  LEFT_WING: 11,
  INSIDE_CENTRE: 12,
  OUTSIDE_CENTRE: 13,
  RIGHT_WING: 14,
  FULLBACK: 15,
} as const;
export type Position = (typeof Position)[keyof typeof Position];

// ─── Team Colors ─────────────────────────────────────────────
export const TEAM_COLORS = {
  HOME: 0x2563eb,   // Blue
  AWAY: 0xdc2626,   // Red
} as const;

// ─── Difficulty Presets ──────────────────────────────────────
export interface DifficultyConfig {
  aiReactionDelay: number;
  tackleBonus: number;
  passAccuracyBonus: number;
  playVariety: number;
  ruckStrengthModifier: number;
  kickAccuracyModifier: number;
}

export const DIFFICULTY: Record<'EASY' | 'MEDIUM' | 'HARD', DifficultyConfig> = {
  EASY: {
    aiReactionDelay: 400,
    tackleBonus: -15,
    passAccuracyBonus: -10,
    playVariety: 3,
    ruckStrengthModifier: 0.85,
    kickAccuracyModifier: 0.8,
  },
  MEDIUM: {
    aiReactionDelay: 200,
    tackleBonus: 0,
    passAccuracyBonus: 0,
    playVariety: 6,
    ruckStrengthModifier: 1.0,
    kickAccuracyModifier: 1.0,
  },
  HARD: {
    aiReactionDelay: 50,
    tackleBonus: 10,
    passAccuracyBonus: 15,
    playVariety: 12,
    ruckStrengthModifier: 1.15,
    kickAccuracyModifier: 1.2,
  },
} as const;
