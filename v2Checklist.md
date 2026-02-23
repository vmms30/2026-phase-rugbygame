# Rugby Phase Game V2 Checklist

## Phase 1: Core Engine & Physics Optimizations
- [ ] Implement `SpatialHashGrid` or Quad-Tree utility in `src/utils/` for collision partitioning.
- [ ] Refactor `MatchScene.ts` physics collision loops to leverage the new Spatial Grid, reducing O(n^2) loop overhead.
- [ ] Update `Player.ts` hitbox handling to use standardized circle colliders and AABB for static boundaries.
- [ ] Implement momentum and force vectors in `Tackle.ts` for dominant tackles (driving players backward) and fending (sliding/deflecting tackles).

## Phase 2: Visual & Spatial Details
- [ ] Adjust camera projection in `MatchScene.ts` to simulate a ¾ isometric perspective (or prep for asset swaps that support it).
- [ ] Update `Player.ts` rendering and animations to include a "sprint bounce" visually altering the sprite's Y-axis slightly while running.
- [ ] Refactor `Ball.ts` to utilize shadow-scaling during passing, kicking, and lineouts to enhance Z-axis verticality perception.
- [ ] Integrate particle effects in `Player.ts` and `MatchScene.ts` (using `ObjectPool`) for dirt/mud kick-up when sprinting or sidestepping.

## Phase 3: Passing, Evasion & Input Overhaul
- [ ] Implement swipe/joystick gesture recognition in `MatchScene.ts` mapping to vector-based passing.
- [ ] Overhaul `Passing.ts` to distinguish "Flat Passes" and "Loop Passes" based on user input, strictly validating that passes never travel forward.
- [ ] Add evasion actions in `Player.ts` and `MatchScene.ts` for the controlled carrier: 
  - Up/Down swipe for sidesteps.
  - Forward swipe for diving (connecting to `ScoringSystem.ts` for diving tries).
  - Backward swipe for stutter-steps to freeze defend-tracking.
- [ ] Connect stamina decay (from `Stats.ts`) to passing accuracy, kick distance curves, and catch probabilities dynamically.

## Phase 4: Advanced Breakdown Mechanics
- [ ] Overhaul `RuckSystem.ts`:
  - Disable full auto-commit from `MatchScene.ts` and `PlayerAI.ts`.
  - Introduce an active 3-action mechanic (Bind, Contest, Jackal) requiring user input during ruck formation.
  - Create a specific UI overlay/meter in `UIScene.ts` / `MatchScene.ts` for ruck contest interactions.
- [ ] Overhaul Set Pieces (Scrums & Lineouts):
  - In `MatchScene.ts` and `PhaseManager.ts`, implement a "Crouch, Bind, Set" timing mini-game UI for scrums.
  - Add hooker strike timing mechanics for winning scrum possession.
  - Develop Lineout vertical jumping mechanics featuring target selection and throw timing constraints.

## Phase 5: Next-Generation AI & Positioning
- [ ] Implement Voronoi cell calculation and Delaunay Triangulation logic in `src/utils/`.
- [ ] Refactor `TeamAI.ts` to utilize Voronoi regions, organizing formations (e.g., 1-3-3-1 pod structures) for both attack and defensive line integrity.
- [ ] Update `PlayerAI.ts` to leverage an "Influence Map" for positional decision-making (evaluating EPV, threat coverage, and objective proximity) instead of pure seek/arrive steering.
- [ ] Introduce Attacking Structure selections in `TeamAI.ts`, allowing the user to call phase changes/shape alterations at the ruck base via `UIScene` overlays.
- [ ] Implement adaptive AI tracking in `TeamAI.ts` to track user attacking tendencies and dynamically adjust defensive alignment and line-speed.

## Phase 6: UX, UI & Accessibility
- [ ] Design and implement Lean-In (minimal) vs Lean-Forward (detailed) HUD states in `UIScene.ts`.
- [ ] Add contextual indicators in `MatchScene.ts` (e.g. glowing rings for eligible receivers, specific offload icons).
- [ ] Build an accessibility settings menu (toggling high-contrast kits, passing trajectory guides, and remappable inputs).

## Phase 7: Meta-Progression & Persistence
- [ ] Scaffold `ClubModeScene.ts` logic to handle league progression, roster state, and seasonal persistence.
- [ ] Create `KitDesignerScene.ts` and dynamic sprite tinting algorithms for team customization.
- [ ] Implement a player generation and recruitment system evaluating nuanced stat archetypes (e.g., Jackal-heavy backrows, kicking fly-halves) using AI-focused valuations.
