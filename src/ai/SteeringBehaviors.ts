/**
 * SteeringBehaviors — movement behaviors for AI players.
 *
 * Returns force vectors that are blended together to form the
 * final desired velocity for each AI player.
 */

export interface Vec2 { x: number; y: number; }

function vec(x: number, y: number): Vec2 { return { x, y }; }
function sub(a: Vec2, b: Vec2): Vec2 { return vec(a.x - b.x, a.y - b.y); }
function add(a: Vec2, b: Vec2): Vec2 { return vec(a.x + b.x, a.y + b.y); }
function scale(v: Vec2, s: number): Vec2 { return vec(v.x * s, v.y * s); }
function mag(v: Vec2): number { return Math.sqrt(v.x * v.x + v.y * v.y); }
function normalize(v: Vec2): Vec2 { const m = mag(v); return m > 0 ? scale(v, 1 / m) : vec(0, 0); }
function limit(v: Vec2, max: number): Vec2 { const m = mag(v); return m > max ? scale(normalize(v), max) : v; }

/** Seek — move toward target */
export function seek(pos: Vec2, target: Vec2, maxSpeed: number): Vec2 {
  const desired = sub(target, pos);
  return limit(desired, maxSpeed);
}

/** Flee — move away from target */
export function flee(pos: Vec2, target: Vec2, maxSpeed: number): Vec2 {
  const desired = sub(pos, target);
  return limit(desired, maxSpeed);
}

/** Arrive — seek with deceleration near target */
export function arrive(pos: Vec2, target: Vec2, maxSpeed: number, slowRadius: number = 50): Vec2 {
  const offset = sub(target, pos);
  const dist = mag(offset);
  if (dist < 2) return vec(0, 0);
  const speed = dist < slowRadius ? maxSpeed * (dist / slowRadius) : maxSpeed;
  return scale(normalize(offset), speed);
}

/** Pursue — predict target's future position and seek it */
export function pursue(pos: Vec2, targetPos: Vec2, targetVel: Vec2, maxSpeed: number): Vec2 {
  const lookAhead = mag(sub(targetPos, pos)) / maxSpeed;
  const futurePos = add(targetPos, scale(targetVel, Math.min(lookAhead, 30)));
  return seek(pos, futurePos, maxSpeed);
}

/** Evade — predict target's future position and flee */
export function evade(pos: Vec2, targetPos: Vec2, targetVel: Vec2, maxSpeed: number): Vec2 {
  const lookAhead = mag(sub(targetPos, pos)) / maxSpeed;
  const futurePos = add(targetPos, scale(targetVel, Math.min(lookAhead, 30)));
  return flee(pos, futurePos, maxSpeed);
}

/** Interpose — position between two points */
export function interpose(pos: Vec2, pointA: Vec2, pointB: Vec2, maxSpeed: number): Vec2 {
  const mid = vec((pointA.x + pointB.x) / 2, (pointA.y + pointB.y) / 2);
  return arrive(pos, mid, maxSpeed);
}

/** Separation — avoid bunching with neighbors */
export function separation(pos: Vec2, neighbors: Vec2[], desiredDist: number = 30): Vec2 {
  let force = vec(0, 0);
  for (const n of neighbors) {
    const diff = sub(pos, n);
    const dist = mag(diff);
    if (dist > 0 && dist < desiredDist) {
      force = add(force, scale(normalize(diff), desiredDist / dist));
    }
  }
  return force;
}

/** Cohesion — move toward center of neighbors */
export function cohesion(pos: Vec2, neighbors: Vec2[], maxSpeed: number): Vec2 {
  if (neighbors.length === 0) return vec(0, 0);
  const center = neighbors.reduce((acc, n) => add(acc, n), vec(0, 0));
  return seek(pos, scale(center, 1 / neighbors.length), maxSpeed);
}

/** Alignment — match average direction of neighbors */
export function alignment(_currentVel: Vec2, neighborVels: Vec2[]): Vec2 {
  if (neighborVels.length === 0) return vec(0, 0);
  const avg = neighborVels.reduce((acc, v) => add(acc, v), vec(0, 0));
  return scale(avg, 1 / neighborVels.length);
}

/** PathFollow — move along a sequence of waypoints */
export function pathFollow(pos: Vec2, waypoints: Vec2[], waypointRadius: number, maxSpeed: number): { force: Vec2; nextIndex: number } {
  if (waypoints.length === 0) return { force: vec(0, 0), nextIndex: 0 };

  // Find closest waypoint ahead
  let closest = 0;
  let minDist = Infinity;
  for (let i = 0; i < waypoints.length; i++) {
    const d = mag(sub(pos, waypoints[i]));
    if (d < minDist) { minDist = d; closest = i; }
  }

  // If close to current waypoint, advance
  let target = closest;
  if (minDist < waypointRadius && closest < waypoints.length - 1) {
    target = closest + 1;
  }

  return { force: seek(pos, waypoints[target], maxSpeed), nextIndex: target };
}

/** ObstacleAvoidance — steer around stationary obstacles */
export function obstacleAvoidance(pos: Vec2, _vel: Vec2, obstacles: Vec2[], avoidRadius: number = 20): Vec2 {
  let force = vec(0, 0);
  for (const ob of obstacles) {
    const diff = sub(pos, ob);
    const dist = mag(diff);
    if (dist > 0 && dist < avoidRadius) {
      force = add(force, scale(normalize(diff), (avoidRadius - dist) / avoidRadius * 2));
    }
  }
  return force;
}

/** Blend multiple weighted forces into a single capped vector */
export function blendForces(forces: { force: Vec2; weight: number }[], maxForce: number): Vec2 {
  let result = vec(0, 0);
  for (const f of forces) {
    result = add(result, scale(f.force, f.weight));
  }
  return limit(result, maxForce);
}
