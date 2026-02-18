/**
 * FormationManager — manages attack and defense formation shapes.
 *
 * Formations adjust relative to ball position and game phase.
 * Provides target positions for all 15 players.
 */

import { PITCH } from '../utils/Constants';

export const FormationType = {
  STANDARD: 'STANDARD',
  WIDE_ATTACK: 'WIDE_ATTACK',
  NARROW_CRASH: 'NARROW_CRASH',
  STANDARD_DEFENSE: 'STANDARD_DEFENSE',
  DRIFT_DEFENSE: 'DRIFT_DEFENSE',
  BLITZ_DEFENSE: 'BLITZ_DEFENSE',
} as const;
export type FormationType = (typeof FormationType)[keyof typeof FormationType];

interface FormationPos { rx: number; ry: number }

const FORMATIONS: Record<FormationType, Record<number, FormationPos>> = {
  [FormationType.STANDARD]: {
    1: { rx: 0.42, ry: 0.40 }, 2: { rx: 0.42, ry: 0.50 }, 3: { rx: 0.42, ry: 0.60 },
    4: { rx: 0.40, ry: 0.44 }, 5: { rx: 0.40, ry: 0.56 },
    6: { rx: 0.44, ry: 0.35 }, 7: { rx: 0.44, ry: 0.65 }, 8: { rx: 0.41, ry: 0.50 },
    9: { rx: 0.45, ry: 0.48 }, 10: { rx: 0.50, ry: 0.45 },
    11: { rx: 0.55, ry: 0.10 }, 12: { rx: 0.53, ry: 0.38 }, 13: { rx: 0.56, ry: 0.30 },
    14: { rx: 0.55, ry: 0.90 }, 15: { rx: 0.35, ry: 0.50 },
  },
  [FormationType.WIDE_ATTACK]: {
    1: { rx: 0.42, ry: 0.40 }, 2: { rx: 0.42, ry: 0.50 }, 3: { rx: 0.42, ry: 0.60 },
    4: { rx: 0.40, ry: 0.44 }, 5: { rx: 0.40, ry: 0.56 },
    6: { rx: 0.44, ry: 0.30 }, 7: { rx: 0.44, ry: 0.70 }, 8: { rx: 0.41, ry: 0.50 },
    9: { rx: 0.46, ry: 0.48 }, 10: { rx: 0.51, ry: 0.45 },
    11: { rx: 0.56, ry: 0.05 }, 12: { rx: 0.54, ry: 0.35 }, 13: { rx: 0.57, ry: 0.25 },
    14: { rx: 0.56, ry: 0.95 }, 15: { rx: 0.48, ry: 0.50 },
  },
  [FormationType.NARROW_CRASH]: {
    1: { rx: 0.44, ry: 0.42 }, 2: { rx: 0.44, ry: 0.50 }, 3: { rx: 0.44, ry: 0.58 },
    4: { rx: 0.42, ry: 0.45 }, 5: { rx: 0.42, ry: 0.55 },
    6: { rx: 0.46, ry: 0.40 }, 7: { rx: 0.46, ry: 0.60 }, 8: { rx: 0.43, ry: 0.50 },
    9: { rx: 0.47, ry: 0.48 }, 10: { rx: 0.50, ry: 0.47 },
    11: { rx: 0.52, ry: 0.30 }, 12: { rx: 0.51, ry: 0.44 }, 13: { rx: 0.52, ry: 0.40 },
    14: { rx: 0.52, ry: 0.70 }, 15: { rx: 0.38, ry: 0.50 },
  },
  [FormationType.STANDARD_DEFENSE]: {
    1: { rx: 0.55, ry: 0.42 }, 2: { rx: 0.55, ry: 0.50 }, 3: { rx: 0.55, ry: 0.58 },
    4: { rx: 0.53, ry: 0.46 }, 5: { rx: 0.53, ry: 0.54 },
    6: { rx: 0.56, ry: 0.35 }, 7: { rx: 0.56, ry: 0.65 }, 8: { rx: 0.54, ry: 0.50 },
    9: { rx: 0.57, ry: 0.48 }, 10: { rx: 0.60, ry: 0.45 },
    11: { rx: 0.62, ry: 0.08 }, 12: { rx: 0.62, ry: 0.35 }, 13: { rx: 0.63, ry: 0.25 },
    14: { rx: 0.62, ry: 0.92 }, 15: { rx: 0.70, ry: 0.50 },
  },
  [FormationType.DRIFT_DEFENSE]: {
    1: { rx: 0.55, ry: 0.44 }, 2: { rx: 0.55, ry: 0.50 }, 3: { rx: 0.55, ry: 0.56 },
    4: { rx: 0.53, ry: 0.47 }, 5: { rx: 0.53, ry: 0.53 },
    6: { rx: 0.57, ry: 0.38 }, 7: { rx: 0.57, ry: 0.62 }, 8: { rx: 0.54, ry: 0.50 },
    9: { rx: 0.58, ry: 0.46 }, 10: { rx: 0.61, ry: 0.42 },
    11: { rx: 0.63, ry: 0.12 }, 12: { rx: 0.63, ry: 0.32 }, 13: { rx: 0.64, ry: 0.22 },
    14: { rx: 0.63, ry: 0.88 }, 15: { rx: 0.72, ry: 0.50 },
  },
  [FormationType.BLITZ_DEFENSE]: {
    1: { rx: 0.52, ry: 0.42 }, 2: { rx: 0.52, ry: 0.50 }, 3: { rx: 0.52, ry: 0.58 },
    4: { rx: 0.50, ry: 0.46 }, 5: { rx: 0.50, ry: 0.54 },
    6: { rx: 0.53, ry: 0.35 }, 7: { rx: 0.53, ry: 0.65 }, 8: { rx: 0.51, ry: 0.50 },
    9: { rx: 0.54, ry: 0.48 }, 10: { rx: 0.56, ry: 0.45 },
    11: { rx: 0.58, ry: 0.08 }, 12: { rx: 0.58, ry: 0.35 }, 13: { rx: 0.59, ry: 0.25 },
    14: { rx: 0.58, ry: 0.92 }, 15: { rx: 0.66, ry: 0.50 },
  },
};

export class FormationManager {
  private currentFormation: FormationType = FormationType.STANDARD;
  private ballOffsetX = 0;

  /** Set the active formation */
  setFormation(type: FormationType): void {
    this.currentFormation = type;
  }

  /** Update ball position for formation shifting */
  setBallPosition(ballX: number): void {
    // Shift formation horizontally based on ball position
    this.ballOffsetX = (ballX / PITCH.WIDTH_PX - 0.5) * 0.15;
  }

  /**
   * Get target position for a player.
   * @param position Player's positional number (1-15)
   * @param side 'home' or 'away'
   * @returns { x, y } in world coordinates
   */
  getTargetPosition(position: number, side: 'home' | 'away'): { x: number; y: number } {
    const f = FORMATIONS[this.currentFormation][position];
    if (!f) return { x: PITCH.WIDTH_PX / 2, y: PITCH.HEIGHT_PX / 2 };

    let rx = f.rx + this.ballOffsetX;
    rx = Math.max(0.05, Math.min(0.95, rx));

    if (side === 'home') {
      return { x: rx * PITCH.WIDTH_PX, y: f.ry * PITCH.HEIGHT_PX };
    } else {
      return { x: (1 - rx) * PITCH.WIDTH_PX, y: f.ry * PITCH.HEIGHT_PX };
    }
  }

  getFormation(): FormationType {
    return this.currentFormation;
  }
}
