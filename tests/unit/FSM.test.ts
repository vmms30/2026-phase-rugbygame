import { describe, it, expect, vi } from 'vitest';
import { FSM } from '../../src/ai/FSM';

interface TestContext {
  value: number;
}

describe('FSM', () => {
  it('should initialize with no state', () => {
    const context: TestContext = { value: 0 };
    const fsm = new FSM(context);
    expect(fsm.getCurrentStateName()).toBe('NONE');
  });

  it('should set initial state', () => {
    const context: TestContext = { value: 0 };
    const fsm = new FSM(context);
    const enterSpy = vi.fn();

    fsm.addState({
      name: 'IDLE',
      enter: enterSpy,
    });

    fsm.setInitialState('IDLE');
    expect(fsm.getCurrentStateName()).toBe('IDLE');
    expect(enterSpy).toHaveBeenCalledWith(context);
  });

  it('should transition based on condition', () => {
    const context: TestContext = { value: 0 };
    const fsm = new FSM(context);

    fsm.addState({ name: 'STATE_A' });
    fsm.addState({ name: 'STATE_B' });

    fsm.addTransition({
      from: 'STATE_A',
      to: 'STATE_B',
      condition: (ctx) => ctx.value > 5,
    });

    fsm.setInitialState('STATE_A');
    
    // Condition not met
    fsm.update(0.1);
    expect(fsm.getCurrentStateName()).toBe('STATE_A');

    // Condition met
    context.value = 10;
    fsm.update(0.1);
    expect(fsm.getCurrentStateName()).toBe('STATE_B');
  });

  it('should execut enter, exit, and update callbacks', () => {
    const context: TestContext = { value: 0 };
    const fsm = new FSM(context);
    const enterA = vi.fn();
    const exitA = vi.fn();
    const updateA = vi.fn();
    const enterB = vi.fn();

    fsm.addState({
      name: 'STATE_A',
      enter: enterA,
      exit: exitA,
      update: updateA,
    });
    fsm.addState({
      name: 'STATE_B',
      enter: enterB,
    });

    fsm.setInitialState('STATE_A');
    expect(enterA).toHaveBeenCalled();

    fsm.update(0.5);
    expect(updateA).toHaveBeenCalledWith(context, 0.5);

    fsm.forceState('STATE_B');
    expect(exitA).toHaveBeenCalled();
    expect(enterB).toHaveBeenCalled();
  });

  it('should respect transition priority', () => {
    const context: TestContext = { value: 10 };
    const fsm = new FSM(context);

    fsm.addState({ name: 'START' });
    fsm.addState({ name: 'LOW_PRIORITY' });
    fsm.addState({ name: 'HIGH_PRIORITY' });

    // Both conditions move from START and are true
    fsm.addTransition({
      from: 'START',
      to: 'LOW_PRIORITY',
      condition: () => true,
      priority: 1,
    });

    fsm.addTransition({
      from: 'START',
      to: 'HIGH_PRIORITY',
      condition: () => true,
      priority: 10,
    });

    fsm.setInitialState('START');
    fsm.update(0.1);

    expect(fsm.getCurrentStateName()).toBe('HIGH_PRIORITY');
  });
});
