/**
 * Vector math and angle utilities used throughout the game.
 */

export interface Vec2 {
  x: number;
  y: number;
}

/** Create a new vector */
export function vec2(x: number, y: number): Vec2 {
  return { x, y };
}

/** Add two vectors */
export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

/** Subtract b from a */
export function subtract(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

/** Scale a vector by a scalar */
export function scale(v: Vec2, s: number): Vec2 {
  return { x: v.x * s, y: v.y * s };
}

/** Magnitude (length) of a vector */
export function magnitude(v: Vec2): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

/** Normalized vector (unit length). Returns zero vector if magnitude is 0. */
export function normalize(v: Vec2): Vec2 {
  const mag = magnitude(v);
  if (mag === 0) return { x: 0, y: 0 };
  return { x: v.x / mag, y: v.y / mag };
}

/** Distance between two points */
export function distance(a: Vec2, b: Vec2): number {
  return magnitude(subtract(a, b));
}

/** Dot product */
export function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

/** Truncate a vector to a max length */
export function truncate(v: Vec2, maxLength: number): Vec2 {
  const mag = magnitude(v);
  if (mag <= maxLength) return v;
  return scale(normalize(v), maxLength);
}

/** Linear interpolation between two values */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Linear interpolation between two vectors */
export function lerpVec2(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

/** Angle from one point to another (radians) */
export function angleBetween(from: Vec2, to: Vec2): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

/** Convert radians to degrees */
export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** Convert degrees to radians */
export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Clamp value between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Random float between min (inclusive) and max (exclusive) */
export function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Random int between min and max (inclusive) */
export function randomInt(min: number, max: number): number {
  return Math.floor(randomRange(min, max + 1));
}

/**
 * Evaluate a quadratic Bezier curve at parameter t (0–1).
 * p0 = start, p1 = control point, p2 = end.
 */
export function quadraticBezier(p0: Vec2, p1: Vec2, p2: Vec2, t: number): Vec2 {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  };
}

/**
 * Parabolic height at parameter t (0–1), peaking at 0.5.
 * Returns value between 0 and maxHeight.
 */
export function parabolicArc(t: number, maxHeight: number): number {
  return 4 * maxHeight * t * (1 - t);
}

/** Rotate a vector by angle (radians) */
export function rotate(v: Vec2, angle: number): Vec2 {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: v.x * cos - v.y * sin,
    y: v.x * sin + v.y * cos,
  };
}
