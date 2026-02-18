/**
 * Generic Finite State Machine — reusable by PlayerAI, TeamAI, etc.
 *
 * Each state has enter/exit/update callbacks.
 * Transitions are condition-based and evaluated each update.
 */

export interface FSMState<C> {
  name: string;
  enter?: (context: C) => void;
  exit?: (context: C) => void;
  update?: (context: C, delta: number) => void;
}

export interface FSMTransition<C> {
  from: string;
  to: string;
  condition: (context: C) => boolean;
  priority?: number;
}

export class FSM<C> {
  private states: Map<string, FSMState<C>> = new Map();
  private transitions: FSMTransition<C>[] = [];
  private currentState: FSMState<C> | null = null;
  private context: C;

  constructor(context: C) {
    this.context = context;
  }

  addState(state: FSMState<C>): void {
    this.states.set(state.name, state);
  }

  addTransition(transition: FSMTransition<C>): void {
    this.transitions.push(transition);
    // Sort by priority (higher = checked first)
    this.transitions.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }

  /**
   * Set initial state (no enter callback on first set).
   */
  setInitialState(name: string): void {
    this.currentState = this.states.get(name) ?? null;
    this.currentState?.enter?.(this.context);
  }

  /**
   * Force transition to a named state.
   */
  forceState(name: string): void {
    const nextState = this.states.get(name);
    if (!nextState) return;

    this.currentState?.exit?.(this.context);
    this.currentState = nextState;
    this.currentState.enter?.(this.context);
  }

  /**
   * Update: runs current state's update and checks transitions.
   */
  update(delta: number): void {
    if (!this.currentState) return;

    // Check transitions
    for (const t of this.transitions) {
      if (t.from === this.currentState.name && t.condition(this.context)) {
        const nextState = this.states.get(t.to);
        if (nextState) {
          this.currentState.exit?.(this.context);
          this.currentState = nextState;
          this.currentState.enter?.(this.context);
          break; // Only one transition per frame
        }
      }
    }

    // Update current state
    this.currentState.update?.(this.context, delta);
  }

  getCurrentStateName(): string {
    return this.currentState?.name ?? 'NONE';
  }
}
