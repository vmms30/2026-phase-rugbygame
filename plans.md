# 🏉 Rugby Phase Game — Development Checklist

> **Legend**: `[ ]` = not started · `[/]` = in progress · `[x]` = complete

---

## M1 — Project Foundation (Week 1–2)

### 1.1 Scaffolding
- [x] Initialize project with Vite + Phaser 3 + TypeScript (`npx create-vite`)
- [x] Install dependencies: `phaser`, `typescript`, `vitest`, `easystarjs`
- [x] Configure `tsconfig.json` (strict, ES2020, DOM types)
- [ ] Configure `vite.config.ts` (static asset serving, dev server port)
- [x] Create directory structure (`src/`, `public/assets/`, `tests/`)
- [x] Create `src/main.ts` — Phaser.Game bootstrap with config
- [x] Create `src/config.ts` — centralized game constants
- [x] Create `src/utils/Constants.ts` — pitch dimensions, player speeds, timing values
- [x] Create `src/utils/EventBus.ts` — typed event emitter
- [x] Create `src/utils/MathHelpers.ts` — vector math, angle clamping, lerp
- [x] Verify `npm run dev` launches Phaser splash in browser

### 1.2 Scene Skeleton
- [x] Create `src/scenes/BootScene.ts` — preload all assets, show loading bar
- [x] Create `src/scenes/MenuScene.ts` — placeholder title screen
- [x] Create `src/scenes/MatchScene.ts` — empty game scene, registers physics
- [x] Register all scenes in `main.ts` Phaser config
- [x] Verify scene transitions: Boot → Menu → Match

### 1.3 Pitch Rendering
- [x] ~~Design pitch tilemap in Tiled~~ → Rendered procedurally via Phaser Graphics
- [x] Create grass tile variants (2–3 shades for mowed stripe effect)
- [x] Add **Ground layer** — grass fill
- [x] Add **Lines layer** — try lines, 22 m, 10 m, halfway, touchlines, dead-ball, 5 m dashes
- [x] Add **Zones layer** — tinted in-goal areas, 22 m zones
- [x] Add **Posts layer** — goal post sprites at each end
- [x] Add **Collision layer** — physics world bounds set to pitch dimensions
- [x] ~~Export tilemap as JSON~~ → N/A (procedural rendering)
- [x] ~~Load and render tilemap in `MatchScene`~~ → Procedural `drawPitch()` in MatchScene
- [x] Verify all lines, zones, and posts display correctly

### 1.4 Camera System
- [x] Implement follow-cam attached to ball carrier with smooth lerp (0.08)
- [ ] Add directional lead (camera slightly ahead of movement direction)
- [x] Create 3 zoom presets: close (ruck), default (open play), wide (kick chase) — defined in Constants.ts
- [ ] Implement zoom transitions with easing
- [x] Set camera bounds to pitch dimensions (prevent scrolling beyond dead-ball)
- [x] Verify camera stops at pitch edges and follows smoothly

### 1.5 Minimap
- [x] Create secondary `Phaser.Cameras.Scene2D.Camera` for minimap
- [x] Position minimap viewport in bottom-right corner
- [x] Render all players as colored dots on minimap
- [x] Render ball position on minimap
- [x] Add semi-transparent background overlay to minimap
- [x] Verify minimap updates in real-time during movement

### 1.6 Basic Player & Ball
- [x] Create placeholder player sprite (or generate with image tool) — procedural circle textures
- [x] Create `src/entities/Player.ts` — Phaser sprite, physics body, facing direction
- [x] Implement 8-directional movement (N, NE, E, SE, S, SW, W, NW)
- [x] Add WASD/Arrow key input for controlled player movement
- [x] Create `src/entities/Ball.ts` — sprite, physics body, attach/detach from player
- [x] Implement ball pickup (player overlaps loose ball)
- [x] Implement basic pass between 2 test players (press Q/E, ball arcs to teammate)
- [x] Verify: move player, pick up ball, pass to teammate, teammate catches

### 1.7 Initial Test Infrastructure
- [x] Set up Vitest with TypeScript config — vitest installed
- [x] Create `tests/unit/` directory
- [ ] Write a smoke test (import a module, verify no crash)
- [ ] Verify `npx vitest run` passes

---

## M2 — Core Mechanics (Week 3–4)

### 2.1 Team Entity
- [x] Create `src/entities/Team.ts` — manages array of 15 Player instances
- [x] Define all 15 positional roles (1–8 forwards, 9–15 backs)
- [x] Assign stat profiles per position (speed, strength, handling, kicking, stamina, tackling, awareness, workRate)
- [x] Implement default attack formation coordinates
- [x] Implement default defense formation coordinates
- [x] Render 2 full teams (30 players) on pitch with correct positions
- [x] Kit color differentiation via `setTint()` per team
- [x] Verify all 30 players render at correct positions, no overlaps

### 2.2 Player Stats & Attributes
- [x] Create `src/components/Stats.ts` — stat container (0–100 scale per stat)
- [x] Define stat ranges per position (forwards vs backs)
- [x] Implement stamina drain on sprint (Shift key)
- [x] Implement stamina recovery when walking/idle
- [x] Display stamina bar on HUD for controlled player
- [x] Verify stamina drains during sprint, recovers when stopped

### 2.3 Sprint & Fatigue
- [x] Implement Shift-to-sprint: increases velocity by 1.5×
- [x] Sprint drains stamina at rate proportional to `stamina` stat
- [x] Below 20% stamina: sprint unavailable, base speed reduced by 15%
- [x] Visual indicator: player sprite tint slightly red when stamina < 20%
- [x] Verify sprint toggle, drain, recovery, and low-stamina penalty

### 2.4 Player Switching
- [x] Implement **F key** to cycle controlled player to nearest teammate to ball
- [x] On defense: auto-switch to closest player to ball carrier every 1 s
- [x] On attack: stay with ball carrier, no auto-switch
- [x] Visual indicator: highlight ring under controlled player
- [x] Arrow above currently controlled player
- [x] Verify switching on both attack and defense

### 2.5 Passing System
- [x] Create `src/components/Passing.ts` — pass logic component
- [x] **Q key** = pass left, **E key** = pass right
- [x] Find nearest eligible teammate in chosen direction
- [x] Enforce onside rule — receiver must be behind or level with ball carrier
- [x] Calculate max pass range based on `handling` stat
- [x] Implement ball arc via quadratic Bezier curve
  - [x] Pop pass: short range, flat arc, nearly instant
  - [x] Spin pass: medium range, slight arc, moderate speed
  - [x] Skip pass: hold pass button briefly, longer range, higher arc
- [x] Receiver enters "catch" state on ball arrival
- [x] Catch success probability based on `handling` stat
- [x] Failed catch → knock-on event → ball loose on ground
- [x] Handle "no eligible receiver" case (queue play call or short dump)
- [x] Verify each pass type, catch success/failure, knock-on trigger

### 2.6 Offload System
- [x] Detect if ball carrier is being tackled AND `handling > 75`
- [x] Check for nearby teammate within offload range
- [x] Probability-based offload execution (logic in Passing.ts canOffload)
- [x] Successful offload → ball passed mid-tackle, play continues
- [x] Failed offload → knock-on
- [x] Verify offloads trigger during tackle, succeed/fail correctly

### 2.7 Kicking System
- [x] Create `src/components/Kicking.ts` — kick logic component
- [x] **R key**: hold to charge power bar (fills over 1.5 s), release to kick
- [x] Power bar UI element (bottom of screen, fills green → yellow → red)
- [x] Ball kicked in player's facing direction
- [x] Implement parabolic arc trajectory:
  - [x] Manual z-axis (`altitudeZ`) for height simulation
  - [x] Shadow sprite on ground tracks x,y position
  - [x] Ball sprite offset vertically by `altitudeZ`
- [x] **Punt kick**: high, long, for territory
- [x] **Grubber kick**: low, bounces on ground, random angle deviation ±15°
- [x] **Box kick**: scrum-half only, high & short behind defense
- [x] **Drop goal**: requires near-stationary, drop-kick through posts
- [x] **Touch finder**: aimed at touchline for lineout
- [x] **Restart kicks**: kickoff, 22 dropout
- [x] **T key** opens kick type selector menu (overlay)
- [x] Verify each kick type, power bar, trajectory, and landing

### 2.8 Tackling System
- [x] Create `src/components/Tackle.ts` — tackle logic component
- [x] **Space key** on defense: initiate tackle when within 40 px of ball carrier
- [x] Tackle animation: lunge in facing direction
- [x] Hit detection: circle overlap between tackler hitbox and ball carrier
- [x] Success probability calculation:
  - [x] `(tackler.tackling + tackler.strength)` vs `(carrier.strength + carrier.speed × momentum_factor)`
  - [x] Random roll 0–100 against threshold
- [x] Outcome: **Dominant tackle** — ball dislodged, loose ball or turnover chance
- [x] Outcome: **Normal tackle** — carrier grounded, ball presented, ruck trigger
- [x] Outcome: **Missed tackle** — tackler stumbles, 0.5 s recovery
- [x] Outcome: **Fend-off** — carrier presses Space (fend), reverse probability check
- [x] Post-tackle: both players enter "grounded" state (immobile 1 s)
- [x] Post-tackle: ball placed on ground at tackle point
- [x] Post-tackle: ruck trigger zone (60 px radius) activates
- [x] Verify all 4 outcomes, fend-off mechanic, ruck zone activation

### 2.9 Ruck System
- [x] Create ruck zone circle (60 px radius) at tackle point
- [x] Auto-bind nearest players from both teams to ruck (AI-controlled)
- [x] Attacking team: cleanout behavior (push defenders)
- [x] Defending team: contest or jackal behavior
- [x] Ruck contest resolution tick every 0.3 s:
  - [x] Sum `(strength + workRate)` for each team's committed players
  - [x] Team with higher total pushes ruck in their direction
  - [x] Ball available when attack dominance > threshold
- [x] Scrum-half auto-positions at ruck edge
- [x] Ball available → scrum-half passes → transition to OPEN_PLAY
- [x] Infringement detection:
  - [x] Hands in ruck → penalty (random, weighted by awareness)
  - [x] Not releasing → penalty
  - [x] Offside at ruck → penalty
- [x] Players in ruck are unavailable for defensive line (creates gaps)
- [x] Verify ruck forms, resolves, recycles ball, and penalties trigger

### 2.10 Phase Manager (v1)
- [x] Create `src/systems/PhaseManager.ts` — FSM for game phases
- [x] Implement states: `OPEN_PLAY`, `TACKLE`, `RUCK`
- [x] Implement transitions: `OPEN_PLAY → TACKLE → RUCK → OPEN_PLAY`
- [x] Emit events on each transition (via EventBus)
- [x] Track phase count (increments on each ruck recycle)
- [x] Display current phase count on HUD
- [x] Write unit test: `PhaseManager.test.ts` — state transitions
- [x] Verify phase cycling works during gameplay

---

## M3 — Set Pieces (Week 5–6)

### 3.1 Scrum System
- [x] Create `src/scenes/SetPieceScene.ts` — overlay scene for set pieces
- [x] Create scrum formation: 8 forwards per team in 3-4-1 shape
- [x] Camera auto-zoom into scrum area
- [x] Engagement sequence: referee calls "crouch, bind, set"
- [x] Timing mini-game: press Space on "set" (±0.2 s window)
  - [x] Good timing → stability bonus
  - [x] Bad timing → scrum penalty risk (Early Engagement implemented)
- [x] Contest phase: rapid-tap Space to generate push force
- [x] Push force = combined pack strength + tap speed
- [x] Hooker strike for ball (automated, weighted by hooker's stats)
- [x] Ball won → scrum-half picks up → OPEN_PLAY
- [ ] Option to go blindside or openside after scrum
- [x] Scrum penalties: collapsing, wheeling, early push (Early Push implemented)
- [x] Verify scrum mini-game from start to ball exit

### 3.2 Lineout System
- [x] Throwing team arranges 4–7 forwards in line
- [x] Receiver selection: arrow keys choose front/middle/back target
- [x] Throw timing: hold Space for power, release at accuracy window
- [x] Lifting animation: two lifters auto-engage
- [x] Jumping: timing-based Space press for jumper
- [x] Catch success = timing accuracy + `handling` stat
- [x] Opposition contest: AI selects matching target or reads throw (Random chance + Timing)
- [x] Ball won → option: quick pass to backs OR driving maul
- [x] Lineout steal possibility for defending team
- [x] Verify lineout from throw to ball distribution

### 3.3 Kickoff & Restarts
- [x] Implement kickoff at start of each half
- [x] Implement kickoff after a try + conversion
- [x] Receiving team positions players in kick-receipt formation
- [x] Kicking team positions for chase
- [x] Ball must travel 10 m and land in-field
- [x] Short kickoff option (supported by kick strength/angle)
- [x] 22 m dropout: kick from behind 22 m line after dead ball in-goal
- [x] Verify all restart scenarios

### 3.4 Penalty System
- [x] Create `src/systems/PenaltySystem.ts`
- [x] Detect infringements: offside, hands in ruck, not releasing, high tackle, obstruction
- [x] Implement advantage law: play continues if non-offending team gains territory/scores
- [x] Advantage over → play called back to penalty location if no gain
- [x] Penalty awarded → team choice:
  - [x] Kick at goal (→ conversion mini-game)
  - [x] Kick to touch (→ lineout)
  - [x] Scrum
  - [x] Tap and go (→ quick tap, OPEN_PLAY)
- [x] Free kick option for minor infringements (no kick at goal)
- [ ] Verify penalty detection, advantage, and all choice outcomes

### 3.5 Scoring System
- [x] Create `src/systems/ScoringSystem.ts`
- [x] **Try (5 pts)**: detect ball grounded in opponent's in-goal area
- [ ] Try scoring animation: player dots ball down, celebration
- [x] **Conversion (2 pts)** — triggered after try:
  - [x] Kicking position in line with where try was scored
  - [x] Aiming reticle oscillates; Space to lock aim
  - [x] Power bar fills; Space again at desired power
  - [ ] Wind factor shifts flight
  - [x] Success based on `kicking` stat + distance + aim + power accuracy
- [x] **Penalty goal (3 pts)**: same mini-game as conversion from penalty mark
- [x] **Drop goal (3 pts)**: ball drop-kicked through posts in open play
  - [x] Detect: player near-stationary, kicks at posts, ball goes through
- [x] Update scoreboard HUD on every score
- [x] Verify each scoring method awards correct points

### 3.6 Phase Manager (v2) — Full State Graph
- [x] Add states: `MAUL`, `SCRUM`, `LINEOUT`, `KICK_OFF`, `PENALTY`, `TAP_AND_GO`, `TRY_SCORED`, `CONVERSION`, `DROP_GOAL`, `KNOCK_ON`, `TOUCH`, `HALF_TIME`, `FULL_TIME`
- [x] Implement all transitions per state diagram in implementation plan
- [x] Handle edge cases: penalty during ruck, knock-on during maul, etc.
- [x] Update unit tests for all new states and transitions
- [x] Verify complete phase flow across multiple scenarios

---

## M4 — AI Version 1 (Week 7–8)

### 4.1 Finite State Machine Framework
### 4.1 FSM
- [x] Create `src/ai/FSM.ts` — generic reusable FSM class
- [x] Support: addState, addTransition, update, getCurrentState
- [x] Enter/exit callbacks per state
- [x] Condition-based automatic transitions
- [x] Write unit test: `FSM.test.ts` — add states, trigger transitions, verify callbacks
- [x] Verify FSM drives correct behavior sequence

### 4.2 Player AI States
- [x] Create `src/ai/PlayerAI.ts` — FSM instance per AI player
- [x] Implement state: **IDLE** — stand at position, scan for events
- [x] Implement state: **SUPPORT_ATTACK** — run support line, offer as pass option
- [x] Implement state: **CARRY_BALL** — run with ball, decide pass/kick/contact
- [x] Implement state: **PASSING** — execute pass to best option
- [x] Implement state: **KICKING** — execute kick decision
- [x] Implement state: **DEFEND** — hold defensive line position
- [x] Implement state: **CHASE_BALL** — pursue loose ball
- [x] Implement state: **TACKLE** — close on ball carrier and attempt tackle
- [x] Implement state: **RUCK_BIND** — commit to ruck
- [x] Implement state: **MAUL_BIND** — commit to maul
- [x] Implement state: **RETURN_POSITION** — jog back to formation position
- [x] Implement state: **SET_PIECE** — take set-piece position
- [x] Implement state: **CELEBRATE** — try scored celebration
- [x] Wire transitions between all states based on game phase and events
- [x] Verify AI players transition correctly during gameplay

### 4.3 Steering Behaviors
- [x] Create `src/ai/SteeringBehaviors.ts`
- [x] Implement **Seek** — move toward target position
- [x] Implement **Flee** — move away from target
- [x] Implement **Arrive** — seek + decelerate smoothly at target
- [x] Implement **Pursue** — intercept moving target by predicting future position
- [x] Implement **Evade** — flee from predicted future position of pursuer
- [x] Implement **Interpose** — position between two points (defender between carrier and try line)
- [x] Implement **Separation** — avoid bunching with nearby teammates
- [x] Implement **Cohesion** — stay connected with group (defensive line)
- [x] Implement **Alignment** — match direction of group
- [x] Implement **Path Follow** — follow a sequence of waypoints
- [x] Implement **Obstacle Avoidance** — steer around grounded/rucking players
- [x] Implement weighted blending: combine multiple behaviors, truncate to max acceleration
- [ ] Per-state weight profiles (e.g., DEFEND: pursue=0.8, cohesion=0.5, separation=0.3)
- [x] Write unit test: `SteeringBehaviors.test.ts` — verify force vectors for each behavior
- [x] Verify behaviors produce natural-looking movement in-game

### 4.4 Formation Manager
- [x] Create `src/ai/FormationManager.ts`
- [x] Define attack formations:
  - [x] `WIDE_ATTACK` — backs spread, forwards in pods
  - [x] `NARROW_CRASH` — tight, forward-dominated carries
  - [x] `STANDARD` — balanced 1-3-3-1 back line shape
- [x] Define defense formations:
  - [x] `DRIFT` — slide outward, force to touchline
  - [x] `BLITZ` — rush up fast, pressure passer
  - [x] `STANDARD_DEFENSE` — flat line, man markers
- [x] Calculate target positions for all 15 players per formation
- [x] Positions adjust relative to ball position (shift left/right)
- [x] Smooth transition between formations (players glide to new positions)
- [x] Verify formation shapes visually on pitch

### 4.5 Team AI (Basic)
- [x] Create `src/ai/TeamAI.ts` — coach brain, runs every 0.5 s
- [x] Decision: select formation shape based on possession + field zone
- [x] Decision: simple play calling (`CRASH_BALL`, `SKIP_PASS`, `KICK`)
- [ ] Decision: ruck commitment (how many players to send, 2–4)
- [x] Decision: kicking — kick for territory if in own 22 or after 8+ phases
- [x] Wire TeamAI decisions to FormationManager and PlayerAI
- [x] Verify AI team moves cohesively, makes basic tactical decisions

### 4.6 Defensive AI (Basic)
- [x] Implement **drift defense**: slide outward, maintain spacing
- [x] Implement **blitz defense**: rush up on ball carrier aggressively
- [x] Designated tackler: closest defender pursues ball carrier
- [x] Other defenders hold line and track assigned channels
- [x] Post-tackle: defenders retreat behind ruck offside line
- [x] Fullback/sweeper: hangs back, covers kick threats
- [x] Verify defensive line holds shape and makes tackles

---

## M5 — AI Version 2 & Advanced Mechanics (Week 9–10)

### 5.1 Advanced Team AI
- [x] Score-aware decisions: trailing team takes more risks, leading team plays conservative
- [x] Time-aware: final 10 min → urgency modifier on play calling
- [x] Fatigue-aware: sub fatigued players, reduce sprint calls
- [x] Adaptive: track what attack patterns work, repeat successful ones
- [x] Adaptive: track opponent attack patterns, adjust defense
- [x] Increase play variety: `SWITCH`, `LOOP`, `INSIDE_BALL`, `BOX_KICK`, `GRUBBER`, `DROP_GOAL_ATTEMPT`
- [x] Risk appetite float (0–1): drives aggressive vs conservative balance
- [x] Verify AI adapts behavior based on score, time, and fatigue

### 5.2 Off-Ball Player Intelligence
- [x] Support runners: forwards offer crash option at correct depth
- [x] Backs run designated lines at staggered depths
- [x] Decoy runners: players run lines without receiving to draw defenders
- [x] Post-contact support: 2 nearest forwards auto-seek ruck cleanup
- [x] Remaining players realign for next phase (return to formation)
- [x] Fullback insert line: fullback joins backline in attack contextually
- [x] Width and depth maintenance: players keep proper spacing
- [x] Verify off-ball movement looks intelligent and purposeful

### 5.3 Maul System
- [x] Ball carrier contacted but stays on feet (strength comparison)
- [x] Supporting teammate arrives within 1 s → MAUL forms
- [x] Maul entity: attack + defense player groups
- [x] Maul moves forward at crawl speed × (atk_strength / def_strength)
- [x] Ball transfer backward through maul
- [x] Maul collapse: defense overpowers for 3 s or stalled
- [x] Maul collapse → SCRUM awarded
- [x] Driving maul from lineout (common near try line)
- [x] Verify maul forms, moves, ball emerges or collapses

### 5.4 Offside System
- [x] Create `src/systems/OffsidesSystem.ts`
- [x] Track offside line at rucks (hindmost foot of last player)
- [x] Track offside line at scrums/lineouts
- [x] Track offside line in general play (behind last player who played ball)
- [x] Visual indicator: dotted line on pitch showing offside line (optional debug mode)
- [x] AI players respect offside line (return behind before engaging)
- [x] Penalize players ahead of offside line who interfere with play
- [x] Verify offside detection and enforcement

### 5.5 Drop Goal Mechanic
- [x] Fly-half or designated kicker can attempt drop goal in open play
- [x] Requires near-stationary position
- [x] Drop ball, kick on bounce toward posts
- [x] Trajectory check: did ball pass between posts and over crossbar?
- [x] 3 points awarded if successful
- [x] AI: TeamAI triggers drop goal attempt when close + score is tight
- [x] Verify drop goal attempt, success, and scoring

### 5.6 Difficulty Scaling
- [x] Create difficulty configuration: Easy, Medium, Hard — defined in Constants.ts
- [x] AI reaction delay: 400 ms / 200 ms / 50 ms
- [x] Tackle success bonus: −15% / 0% / +10%
- [x] Pass accuracy bonus: −10% / 0% / +15%
- [x] TeamAI play variety: 3 / 6 / 12+ plays
- [x] Defensive read speed: slow / standard / near-instant
- [x] Ruck contest strength: weakened / balanced / boosted
- [x] Kicking accuracy: low / medium / high
- [x] Strategic adaptation: none / partial / full
- [x] Selectable from team select menu
- [ ] Verify each difficulty feels distinctly different

---

## M6 — UI, HUD & Audio (Week 11)

### 6.1 In-Match HUD
- [x] Create `src/ui/HUD.ts`
- [x] Scoreboard: team names + scores, centered top
- [x] Match clock: `MM:SS` format, centered
- [x] Phase counter: "Phase X" display
- [x] Possession indicator: colored meter or dots per team
- [x] Controlled player stamina bar (bottom-left)
- [x] Sprint meter (bottom-left, below stamina)
- [x] Context action prompts (bottom-center): show current available actions
- [x] Player name label under controlled player
- [x] Clock flashes when in added time
- [x] All HUD elements update in real-time
- [ ] Verify HUD accuracy throughout a full match

### 6.2 Minimap (Final)
- [x] Minimap renders full pitch in corner
- [x] All 30 players shown as team-colored dots
- [x] Ball shown as white dot
- [x] Camera viewport rectangle shown on minimap
- [x] Semi-transparent background
- [ ] Verify minimap reflects game state accurately

### 6.3 Play Selector
- [x] Create `src/ui/PlaySelector.ts`
- [x] **Tab key** opens tactical play overlay
- [x] Display 4–8 play options with icons and names
- [x] **1–4 keys** quick-select common plays (crash, skip, switch, loop)
- [x] Selecting play sends command to TeamAI
- [x] Overlay closes after selection or timeout (3 s)
- [ ] Verify play selection triggers correct AI behavior

### 6.4 Kick Type Selector
- [x] **T key** opens kick type menu overlay
- [x] Display kick options: punt, grubber, box kick, drop goal, touch finder
- [x] Select with arrow keys + enter, or number keys
- [x] Selected kick type used on next R press
- [ ] Verify kick type selector UI and function

### 6.5 Title / Menu Screen
- [x] Create `src/scenes/MenuScene.ts` (full implementation)
- [x] Game logo / title art
- [x] "Play Match" button → team select
- [x] "Settings" button → settings panel
- [x] "Credits" button → credits overlay
- [x] Smooth transitions between menu items
- [x] Aesthetically polished design (gradients, animations)
- [ ] Verify all menu navigation works

### 6.6 Team Select Screen
- [x] Choose home team and away team
- [x] Team list with names and kit preview (tinted sprites)
- [x] Difficulty selector (Easy / Medium / Hard)
- [x] "Start Match" button
- [x] Verify selections carry through to match

### 6.7 Pause Menu
- [x] Create `src/ui/PauseMenu.ts`
- [x] **Esc key** toggles pause menu overlay
- [x] Resume button
- [x] Restart match button
- [x] Settings button (volume, controls)
- [x] Quit to menu button
- [x] Game world pauses (physics, clock, AI)
- [ ] Verify pause/resume does not break game state

### 6.8 Half-Time Screen
- [x] Create `src/scenes/HalfTimeScene.ts`
- [x] Display first-half stats:
  - [x] Possession %
  - [x] Tackles made / missed
  - [x] Passes completed / errors
  - [x] Territory %
  - [x] Carries / meters gained
  - [x] Penalties conceded
- [x] "Continue" button to start second half
- [ ] Verify stats accuracy

### 6.9 Full-Time / Results Screen
- [x] Create `src/scenes/ResultScene.ts`
- [x] Final score display (large, prominent)
- [x] Man of the Match selection (highest combined actions)
- [x] Detailed match stats (both teams, side-by-side)
- [x] "Play Again" and "Back to Menu" buttons
- [ ] Verify results screen with correct data

### 6.10 Match Clock System
- [x] Create `src/systems/ClockSystem.ts`
- [x] Accelerated time: 1 real second = ~4 game seconds (configurable)
- [x] 80-minute match = ~20 min real time
- [x] Clock pauses during set pieces and stoppages
- [x] Half-time trigger at 40 min
- [x] Full-time trigger at 80 min
- [x] Injury time: random 1–5 extra minutes at each half
- [x] HUD clock updates every frame
- [ ] Verify match runs correct duration with stoppages

### 6.11 Audio — Ambient
- [x] Source or create crowd hum loop
- [x] Crowd volume scales with excitement:
  - [x] Near try line → louder
  - [x] Try scored → roar
  - [x] Penalty goal → moderate cheer
  - [x] Boring play → quiet
- [x] Positional audio: sounds softer for off-screen events

### 6.12 Audio — SFX
- [x] Tackle thud sound effect
- [x] Ball pass whoosh
- [x] Ball kick thump
- [x] Referee whistle (short for penalty, long for try/half/full-time)
- [x] Ball bounce on ground
- [x] Boot on ball (kick)
- [x] Crowd roar on try
- [x] Crowd gasp on big tackle
- [x] Conversion/penalty kick post hit (clang)

### 6.13 Audio — UI
- [x] Menu button hover sound
- [x] Menu button select sound
- [x] Clock tick in final 5 minutes
- [x] Play selector open/close sound
- [x] Score change chime

### 6.14 Audio — Infrastructure
- [x] Set up Phaser `SoundManager` in `BootScene`
- [x] Load all audio files during boot
- [x] Volume controls in settings (master, SFX, crowd)
- [x] Mute toggle
- [ ] Verify all sounds play at correct moments

---

## M7 — Testing & Balance (Week 12)

### 7.1 Unit Tests
- [x] `FSM.test.ts` — all state transitions, invalid transitions rejected
- [x] `PhaseManager.test.ts` — all phase sequences, edge cases
- [x] `SteeringBehaviors.test.ts` — correct force vectors for all behaviors
- [x] `ScoringSystem.test.ts` — correct points for try/conversion/penalty/drop goal
- [x] `ClockSystem.test.ts` — correct tick rate, half-time, full-time triggers
- [x] `PenaltySystem.test.ts` — infringement detection accuracy
- [x] `OffsidesSystem.test.ts` — offside line calculation and enforcement
- [x] All unit tests pass: `npx vitest run`

### 7.2 Integration / E2E Tests
- [x] Set up Playwright for browser testing
- [x] `match-flow.spec.ts`:
  - [x] Boot game → menu renders
  - [x] Start match → HUD renders with 0-0 score and 00:00 clock
  - [x] Kick off occurs → players move
  - [x] Clock ticks forward
- [x] Additional scenario: tackle → ruck → recycle flow
- [x] All E2E tests pass: `npx playwright test`

### 7.3 Playtesting & Balance
- [x] Play 5+ full matches on each difficulty
- [x] Tune player stat ranges for realism
- [x] Tune tackle success probabilities — not too easy, not too hard
- [ ] Tune pass accuracy — occasional knock-ons, not constant
- [ ] Tune ruck contest — balanced, not always won by one team
- [ ] Tune AI decision speed — responsive but not superhuman
- [ ] Tune kicking distances and accuracy curves
- [ ] Tune stamina drain/recovery rates
- [ ] Tune match pacing (time acceleration feel)
- [ ] Document all balance changes made

### 7.4 Performance Optimization
- [ ] Implement object pooling for frequently created/destroyed objects (e.g., pass indicators, particles)
- [ ] Pack all sprites into texture atlases
- [ ] Profile rendering: ensure 60 FPS on mid-range hardware
- [ ] Profile update loop: identify and fix any > 16 ms frames
- [ ] Reduce draw calls with batch rendering where possible
- [ ] Verify no memory leaks over extended play sessions

### 7.5 Edge Case Handling
- [ ] Ball stuck in corner — force resolution after 5 s
- [ ] Players overlapping / stuck in each other — separation force
- [ ] Ruck never resolves — timeout after 10 s → scrum
- [ ] All players in ruck — force some to stay out
- [ ] Ball kicked out on full (not from penalty) — scrum at kick location
- [ ] Ball dead in-goal (no try) — 22 dropout or scrum 5 m
- [ ] Multiple simultaneous events — priority queue resolution
- [ ] Verify each edge case handled gracefully

---

## M8 — Stretch Goals (Week 13+)

### 8.1 Weather System
- [x] Create `src/systems/WeatherSystem.ts`
- [x] Rain mode: increased knock-on probability, reduced friction on ball
- [x] Wind mode: lateral force applied to kicked balls
- [x] Wind direction indicator on HUD
- [x] Visual effects: rain particles, wet pitch tint
- [ ] Selectable in pre-match settings or random
- [ ] Verify weather effects on gameplay

### 8.2 Tournament / Season Mode
- [x] Create tournament bracket (4/8/16 teams)
- [x] Win/loss tracking
- [x] League table with points (4 try-bonus, 1 losing-bonus)
- [x] Progress through rounds
- [ ] Trophy / celebration screen on tournament win
- [x] Save/load tournament progress (localStorage)
- [ ] Verify tournament flow from start to final

### 8.3 Team / Player Editor
- [x] Custom team name and kit colors
- [x] Custom player names
- [x] Editable player stats (slider 0–100 per stat)
- [x] Save custom teams (localStorage)
- [ ] Load custom teams in team select
- [ ] Verify custom teams play correctly in match

### 8.4 Multiplayer (Local)
- [ ] Second player controls via gamepad or split keyboard
- [ ] Split responsibilities: each player controls one team
- [ ] HUD adjustments for 2-player
- [ ] Verify 2-player match works without conflicts

### 8.5 Multiplayer (Online)
- [ ] WebSocket server for match state sync
- [ ] Lobby system: create/join match
- [ ] Input-based sync (send inputs, simulate locally)
- [ ] Latency compensation
- [ ] Disconnect handling
- [ ] Verify online matches remain in sync

### 8.6 Replay System
- [ ] Record all game events per frame (positions, actions)
- [ ] Replay viewer: play/pause/rewind/fast-forward
- [ ] Auto-highlight: tries, big tackles, turnovers
- [ ] Export replay as data file
- [ ] Verify replay matches original match

### 8.7 Commentary System
- [ ] Procedural text commentary overlay
- [ ] Event-triggered lines: "Great tackle!", "Try scored!", "Penalty awarded"
- [ ] Variety: 3–5 variants per event type
- [ ] Commentary box in HUD or overlay
- [ ] Verify commentary triggers at correct moments

### 8.8 Advanced Animations & Visual Polish
- [ ] Proper 8-direction × 4-frame run cycle per player
- [ ] Idle, pass, kick, tackle, tackled, ruck-bind, celebrate animations
- [ ] Ball spin animation during passes
- [ ] Grass particle effects on tackle
- [ ] Try line flash on try scored
- [ ] Screen shake on big tackles
- [ ] Confetti / celebration particles on try
- [ ] Smooth scene transition effects (fade, slide)
- [ ] Verify animations play correctly for all actions

---

## Cross-Cutting Concerns (Ongoing)

### Code Quality
- [x] All files have clear JSDoc/TSDoc comments
- [x] No `any` types in TypeScript (strict mode)
- [x] Consistent naming conventions (PascalCase classes, camelCase methods)
- [x] No magic numbers — all values in `Constants.ts`
- [x] EventBus events strongly typed
- [x] Entity-component architecture maintained (no god classes)

### Documentation
- [ ] `README.md` — project overview, setup instructions, controls, architecture
- [ ] Controls reference document
- [ ] Architecture diagram (Mermaid in README)
- [ ] Changelog maintained per milestone

### Version Control
- [x] Git initialized with `.gitignore` (node_modules, dist, .DS_Store)
- [ ] Meaningful commit messages per feature
- [ ] Branch per milestone (optional)
- [ ] Tag each milestone completion

---

> **Total items: ~300+** — Check off each item as you complete it. Items are ordered by dependency; complete each milestone before proceeding to the next.
