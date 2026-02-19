import { describe, it, expect } from 'vitest';
import {
  seek,
  flee,
  arrive,
  limit,
  pursue,
  evade,
  separation,
  cohesion,
} from '../../src/ai/SteeringBehaviors';

// Helper for approximate vector equality
const expectVecClose = (v: { x: number; y: number }, target: { x: number; y: number }, tolerance = 0.001) => {
  expect(Math.abs(v.x - target.x)).toBeLessThan(tolerance);
  expect(Math.abs(v.y - target.y)).toBeLessThan(tolerance);
};

describe('SteeringBehaviors', () => {
  it('seek should return vector pointing to target limited to maxSpeed', () => {
    const pos = { x: 0, y: 0 };
    const target = { x: 100, y: 0 }; // Straight right
    const maxSpeed = 10;
    
    const force = seek(pos, target, maxSpeed);
    
    expectVecClose(force, { x: 10, y: 0 }); // Scaled to maxSpeed
  });

  it('flee should return vector pointing away from target', () => {
    const pos = { x: 0, y: 0 };
    const target = { x: 100, y: 0 };
    const maxSpeed = 10;
    
    const force = flee(pos, target, maxSpeed);
    
    expectVecClose(force, { x: -10, y: 0 }); // Scaled to maxSpeed away
  });

  it('arrive should decelerate when inside slowRadius', () => {
    const pos = { x: 0, y: 0 };
    const target = { x: 25, y: 0 };
    const maxSpeed = 10;
    const slowRadius = 50;
    
    const force = arrive(pos, target, maxSpeed, slowRadius);
    
    // Distance is 25, slowRadius is 50. Speed should be 50% of maxSpeed = 5
    expectVecClose(force, { x: 5, y: 0 });
  });

  it('separation should push away from nearby neighbors', () => {
    const pos = { x: 0, y: 0 };
    const neighbors = [
      { x: 5, y: 0 }, // Right
      { x: 0, y: 5 }, // Down
    ];
    const desiredDist = 10;
    
    const force = separation(pos, neighbors, desiredDist);
    
    // Should be pushing Left (-x) and Up (-y)
    expect(force.x).toBeLessThan(0);
    expect(force.y).toBeLessThan(0);
  });
  
  it('cohesion should pull towards center of neighbors', () => {
    const pos = { x: 0, y: 0 };
    const neighbors = [
      { x: 10, y: 0 },
      { x: 20, y: 0 },
    ]; // Center is at x=15
    const maxSpeed = 5;

    const force = cohesion(pos, neighbors, maxSpeed);
    
    // Should pull towards x=15
    expect(force.x).toBeGreaterThan(0);
    expect(force.y).toBeCloseTo(0);
  });
});
