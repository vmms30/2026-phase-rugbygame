# Rugby Phase Game V2 Architecture Plan

Based on the research and theoretical foundations of top-down sports simulations, this document outlines the roadmap for migrating our current Phase Rugby prototype into a fully-realized "V2" product. It focuses exclusively on the continuous, fluid physical contests of Rugby Union, enhanced by strategic depth and dynamic mechanics.

## 1. Visual & Spatial Perspective Upgrades
Currently, the game uses a rigid top-down visualization. 
- **¾ Isometric Perspective**: Tilt the camera angle slightly to show character faces, expressions, and kit details while maintaining the tactical overview.
- **Vertical Speed Modifiers**: Implement mathematical adjustments for Y-axis movement to simulate depth and slope traversal.
- **"Juice" & Feedback Loops**: 
  - Add bouncing animations linked to sprint cycles.
  - Integrate particle systems (dirt/grass kick-up from cleats).
  - Use shadow scaling underneath the ball and players to trick the eye into perceiving verticality (e.g., during lineouts, tackles, and kicking arcs).

## 2. Attacking Structures & Strategic Agency
Rugby's continuous flow requires strategic depth during set-pieces and structured attacks, rather than complete episodic resets.
- **Attacking Structures Integration**: Organize offensive and defensive strategies (e.g., Pod Formations, 1-3-3-1, Blitz Defense, Drift Defense) that players can select before lineouts, scrums, or tap penalties.
- **Phase Calls**: Allow the user to change the attacking shape at the base of the ruck before the scrum-half distributes the ball.
- **Adaptive AI Coach**: The opponent AI must recognize repetitive attacking patterns (e.g., constantly attacking the short side/blindside) and dynamically shift defensive coverage to counter it.

## 3. Advanced Passing & Evasion Mechanics
Evolving beyond the current pass-by-distance logic:
- **Vector-Based Lateral Passing**: Implement input gestures (joystick pulls or screen swipes) to dictate pass power and trajectory, strictly enforcing the lateral/backward pass constraints of rugby law.
- **Pass Types**: Differentiate between "Flat Passes" (fast, flat trajectory, tight windows, high knock-on risk) and "Loop/Skip Passes" (slower, looping arc, bypasses defenders but gives defense time to drift).
- **Attribute Decay**: Tie passing accuracy, speed, and catch probability dynamically to current stamina levels.
- **Evasion Input Scheme**: 
  - Swipe up/down (or flick) for lateral dodges, steps and fends.
  - Forward swipe for a dive (scoring tries or securing extra meters in contact).
  - Backward swipe for a stutter-step to freeze defenders out of tackling range.

## 4. Enhanced Breakdown Systems (Rucks, Scrums, Mauls)
- **Active Ruck Mechanics**: Replace the pure auto-commit with active user choices: Bind, Contest, or Jackal. Users must manage their commitment levels to avoid leaving the defensive line exposed.
- **Scrum Mini-Game**: Implement an isometric power-contest phase relying on the "Crouch, Bind, Set" timing, alongside a specific hooker action mechanic for the strike.
- **Lineout Jumping**: Develop a vertical contest mechanic using shadow-scaling and timing-based jumps to compete for touchline throws.

## 5. Collision & Physics Overhaul
- **Minkowski Sums & Collision Space Partitioning**: Transition from global distance checks to a Cell/Quad-Tree based grid system to handle 30+ entities efficiently without frame drops.
- **Tackle & Evasion Collisions**: Rather than players stopping dead, calculate momentum vectors to allow "fending" (sliding off tackles) and dominant tackles that drive players backward.
- **Hitbox Refinement**: Utilize circle collision for dynamic moving entities, and AABB/Minkowski models for static boundaries.

## 6. Next-Generation AI & Positioning
Move away from raw steering behaviors toward intelligent spatial awareness:
- **Voronoi Regions & Delaunay Triangulation**: AI players calculate their zone of responsibility dynamically. Defensive lines stretch and contract based on their Voronoi cells to maintain integrity.
- **Influence Maps**: AI calculates a desirability score for movement tiles based on:
  - Objective Proximity (ball carrier or try line).
  - Strategic Danger (covering unmarked runners, realigning onside).
  - Individual Aggression Stats (determines line-speed).
- **EPV (Expected Possession Value)**: Defensive AI simulates actions to minimize the opponent's EPV, choosing the smartest covering angle rather than a direct pursuit.

## 7. UX, UI & Accessibility
- **Lean-In vs Lean-Back States**: Design UI to be minimal icon-based during active play (Lean-In), and transition to richer text/stats during play-calling, injury stoppages, or halftime (Lean-Forward/Lean-Back).
- **Contextual Signals**: Ground rings and visual hierarchies to indicate eligible receivers, covered targets, and available actions (e.g. offload prompts).
- **Accessibility Modes**: High contrast jerseys/ball, passing trajectory assists, and remappable inputs.

## 8. Meta-Progression & Club Management
To ensure long-term player retention and engagement:
- **Club Mode Development**: Allow users to rise through leagues globally.
- **Kit Designer**: Customization tools for jerseys, collars, and team branding.
- **AI-Powered Analytics Drafting**: Players and AI teams use data sets to recruit athletes who fit specific Voronoi-based tactical setups (e.g., high steal stats for Jackal specialists).  
- **Dynamic Matchmaking**: Use Glicko-2 ratings for multiplayer balance.
