# Requirements Document

## Introduction

Flappy Appa is an arcade-style browser game built with HTML5 Canvas and JavaScript. The player controls Appa, a flying bison from Avatar: The Last Airbender, guiding him through a series of cloud obstacles by pressing the spacebar to flap and ascend. The game ends when Appa collides with a cloud or the ground. The player earns one point for each cloud pair successfully passed. All game assets (sprite, sounds) are pre-supplied in the `assets/` directory.

## Glossary

- **Game**: The Flappy Appa browser application running in an HTML5 Canvas context.
- **Appa**: The player-controlled flying bison character, rendered using `assets/ghosty.png`.
- **Canvas**: The HTML5 `<canvas>` element that serves as the game's rendering surface.
- **Gravity**: A constant downward acceleration applied to Appa each game tick.
- **Flap**: The upward velocity impulse applied to Appa when the player presses the spacebar.
- **Cloud Pair**: A pair of cloud obstacles (top and bottom) with a fixed-size gap between them, positioned at a random vertical offset.
- **Gap**: The open vertical space between the top and bottom cloud of a Cloud Pair through which Appa must pass.
- **Score**: The integer count of Cloud Pairs Appa has successfully passed through in the current session.
- **Collision**: Contact between Appa's bounding box and a cloud obstacle or the ground boundary.
- **Game Over State**: The state entered after a Collision, halting all game updates and playing the game-over sound.
- **Idle State**: The initial state before the player starts the game.
- **Playing State**: The active state during which Appa moves, obstacles scroll, and score accumulates.
- **Jump Sound**: The audio clip `assets/jump.wav` played on each Flap.
- **Game Over Sound**: The audio clip `assets/game_over.wav` played on Collision.

---

## Requirements

### Requirement 1: Game Initialization and Rendering

**User Story:** As a player, I want the game to load and display a playable canvas in my browser, so that I can start playing immediately without any setup.

#### Acceptance Criteria

1. THE Game SHALL render a full-screen HTML5 Canvas element as the primary display surface.
2. THE Game SHALL load `assets/ghosty.png` as the Appa sprite before the first frame is drawn.
3. THE Game SHALL load `assets/jump.wav` and `assets/game_over.wav` before gameplay begins.
4. WHEN the page loads, THE Game SHALL display Appa in the Idle State at a fixed starting position on the left side of the Canvas.
5. IF `assets/ghosty.png` fails to load, THEN THE Game SHALL display a fallback colored rectangle in place of the Appa sprite so that gameplay remains functional.

---

### Requirement 2: Appa Movement and Physics

**User Story:** As a player, I want Appa to fall due to gravity and rise when I press spacebar, so that I can control his flight path through obstacles.

#### Acceptance Criteria

1. WHILE in the Playing State, THE Game SHALL apply a constant downward acceleration (gravity) to Appa's vertical position on every game tick.
2. WHEN the player presses the spacebar while in the Playing State, THE Game SHALL apply an upward velocity impulse to Appa (Flap).
3. WHEN a Flap occurs, THE Game SHALL play the Jump Sound.
4. WHILE in the Playing State, THE Game SHALL move Appa horizontally to the right at a constant speed relative to the scrolling background, keeping Appa visually fixed in the left portion of the Canvas.
5. IF Appa's vertical position reaches the bottom boundary of the Canvas, THEN THE Game SHALL trigger a Collision.
6. IF Appa's vertical position reaches the top boundary of the Canvas, THEN THE Game SHALL clamp Appa's position to the top boundary and set vertical velocity to zero.

---

### Requirement 3: Cloud Obstacle Generation and Scrolling

**User Story:** As a player, I want a continuous series of cloud obstacles with gaps to navigate, so that the game presents an ongoing challenge.

#### Acceptance Criteria

1. WHILE in the Playing State, THE Game SHALL continuously generate Cloud Pairs at regular horizontal intervals as Appa progresses.
2. THE Game SHALL assign each Cloud Pair a Gap of equal fixed size, with the vertical position of the Gap chosen at random within safe bounds that keep both cloud segments fully visible on the Canvas.
3. WHILE in the Playing State, THE Game SHALL scroll all Cloud Pairs from right to left at the same constant speed as the background.
4. WHEN a Cloud Pair has scrolled fully off the left edge of the Canvas, THE Game SHALL remove it from the active obstacle list.
5. THE Game SHALL ensure at least one Cloud Pair is visible on the Canvas at all times during the Playing State.

---

### Requirement 4: Collision Detection and Game Over

**User Story:** As a player, I want the game to end when Appa hits a cloud or the ground, so that the game has clear failure conditions.

#### Acceptance Criteria

1. WHILE in the Playing State, THE Game SHALL evaluate Appa's axis-aligned bounding box against each Cloud Pair's bounding boxes on every game tick.
2. WHEN Appa's bounding box overlaps with any cloud segment's bounding box, THE Game SHALL trigger a Collision.
3. WHEN a Collision is triggered, THE Game SHALL transition to the Game Over State immediately.
4. WHEN the Game Over State is entered, THE Game SHALL play the Game Over Sound.
5. WHEN the Game Over State is entered, THE Game SHALL halt all game updates and obstacle scrolling.
6. WHEN the Game Over State is entered, THE Game SHALL display the final Score and a prompt instructing the player to restart.

---

### Requirement 5: Scoring

**User Story:** As a player, I want to earn points for each cloud pair I pass through, so that I can track my performance and try to beat my score.

#### Acceptance Criteria

1. THE Game SHALL initialize the Score to zero at the start of each Playing State session.
2. WHEN Appa's horizontal position passes the trailing edge of a Cloud Pair's gap without a Collision, THE Game SHALL increment the Score by 1.
3. WHILE in the Playing State, THE Game SHALL display the current Score on the Canvas in a position that does not obscure Appa or the Gap area.
4. THE Game SHALL award each Cloud Pair's point exactly once per pass, preventing duplicate increments for the same Cloud Pair.

---

### Requirement 6: Game Start and Restart

**User Story:** As a player, I want to start the game with a keypress and restart after a game over, so that I can play multiple sessions without reloading the page.

#### Acceptance Criteria

1. WHEN the Game is in the Idle State and the player presses the spacebar, THE Game SHALL transition to the Playing State and begin gameplay.
2. WHEN the Game is in the Game Over State and the player presses the spacebar, THE Game SHALL reset the Score to zero, remove all active Cloud Pairs, reposition Appa to the starting position, and transition to the Playing State.
3. THE Game SHALL accept only the spacebar key as the input for Flap, start, and restart actions.

---

### Requirement 7: Audio Feedback

**User Story:** As a player, I want audio cues on flap and collision, so that the game feels responsive and engaging.

#### Acceptance Criteria

1. WHEN a Flap occurs, THE Game SHALL play the Jump Sound from the beginning of the audio clip.
2. WHEN a Collision is triggered, THE Game SHALL play the Game Over Sound from the beginning of the audio clip.
3. THE Game SHALL allow the Jump Sound to restart from the beginning if it is already playing, so that rapid flapping produces audible feedback for each press.
4. IF the browser blocks audio playback due to autoplay policy, THEN THE Game SHALL silently suppress the audio error and continue gameplay without interruption.
