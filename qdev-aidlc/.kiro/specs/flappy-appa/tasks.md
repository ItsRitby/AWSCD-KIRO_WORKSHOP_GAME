# Implementation Plan: Flappy Appa

## Overview

Implement a Flappy Bird-style browser game using HTML5 Canvas and vanilla JavaScript across two files: `index.html` and `game.js`. The implementation follows a state-machine + game-loop pattern with pure-function components for physics, collision, scoring, and rendering. All game assets are pre-supplied in `assets/`.

---

## Tasks

- [x] 1. Create `index.html` and scaffold `game.js` with constants and asset loader
  - [x] 1.1 Create `index.html` with a full-viewport `<canvas id="gameCanvas">` and a `<script src="game.js">` tag
    - Set `margin: 0`, `overflow: hidden` on `body` so the canvas fills the viewport
    - _Requirements: 1.1_

  - [x] 1.2 Create `game.js` with all named constants at the top of the file
    - Declare `GRAVITY`, `FLAP_VELOCITY`, `APPA_X`, `APPA_WIDTH`, `APPA_HEIGHT`, `APPA_START_Y`, `CLOUD_WIDTH`, `GAP_SIZE`, `CLOUD_SPEED`, `CLOUD_INTERVAL`, `GAP_MIN_Y`, `GAP_MAX_Y`, `SCORE_X`, `SCORE_Y`
    - Declare ATLA palette constants: `SKY_TOP`, `SKY_BOTTOM`, `CLOUD_FILL`, `CLOUD_SHADOW`, `APPA_BODY`, `APPA_DETAIL`, `APPA_ARROW`, `UI_TEXT`, `UI_SHADOW`
    - _Requirements: 1.1_

  - [x] 1.3 Implement `loadAssets()` using `Promise.all` to load `assets/ghosty.png`, `assets/jump.wav`, and `assets/game_over.wav`
    - On sprite load failure set `assets.sprite = null` (fallback flag)
    - Store results in a module-level `assets` object
    - _Requirements: 1.2, 1.3, 1.5_

- [ ] 2. Implement canvas sizing, game state, and the core game loop
  - [x] 2.1 Implement `resizeCanvas()` and attach it to `window.addEventListener('resize', ...)`, calling it once on load
    - _Requirements: 1.1_

  - [x] 2.2 Define the `gameState` object with `phase`, `appa`, `clouds`, `score`, `nextCloudX`, and `frameCount` fields
    - _Requirements: 1.4, 5.1_

  - [-] 2.3 Implement the `gameLoop()` function using `requestAnimationFrame`; call `update()` then `render()` each frame
    - `update()` must be a no-op when `phase !== 'PLAYING'`
    - _Requirements: 1.1_

- [ ] 3. Implement physics engine (gravity, flap, boundary clamp)
  - [-] 3.1 Implement `applyGravity(appa)`, `applyFlap(appa)`, and `clampTop(appa)` as pure functions
    - `applyGravity`: `appa.vy += GRAVITY; appa.y += appa.vy`
    - `applyFlap`: `appa.vy = FLAP_VELOCITY`
    - `clampTop`: if `appa.y <= 0` set `appa.y = 0; appa.vy = 0`
    - _Requirements: 2.1, 2.2, 2.6_

  - [ ]* 3.2 Write property test for gravity accumulation
    - **Property 1: Gravity accumulates velocity each tick**
    - After N ticks without a flap, `appa.vy` must equal `vy₀ + N × GRAVITY`
    - **Validates: Requirements 2.1**

  - [ ]* 3.3 Write property test for flap impulse
    - **Property 2: Flap sets velocity to the impulse constant**
    - For any prior `vy`, after `applyFlap`, `appa.vy === FLAP_VELOCITY`
    - **Validates: Requirements 2.2**

  - [ ]* 3.4 Write property test for top boundary clamp
    - **Property 5: Top boundary clamps position and zeroes velocity**
    - For any `appa.y < 0` after gravity, `clampTop` must set `appa.y = 0` and `appa.vy = 0`
    - **Validates: Requirements 2.6**

- [ ] 4. Implement cloud manager (spawn, scroll, cull)
  - [-] 4.1 Implement `spawnCloudPair(state, canvasWidth)`, `scrollClouds(state)`, and `cullClouds(state)`
    - `spawnCloudPair`: pick `gapTop = randomInt(GAP_MIN_Y, GAP_MAX_Y)`, push `{ x: canvasWidth, gapTop, scored: false }`, advance `nextCloudX`
    - `scrollClouds`: decrement each cloud's `x` by `CLOUD_SPEED`
    - `cullClouds`: filter out pairs where `x + CLOUD_WIDTH < 0`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 4.2 Write property test for cloud gap size invariant
    - **Property 6: Cloud gap size is always the fixed constant**
    - For any spawned CloudPair, `(gapTop + GAP_SIZE) - gapTop === GAP_SIZE`
    - **Validates: Requirements 3.2**

  - [ ]* 4.3 Write property test for cloud gap bounds
    - **Property 7: Cloud gap position is within safe bounds**
    - For any spawned CloudPair, `GAP_MIN_Y <= gapTop <= GAP_MAX_Y`
    - **Validates: Requirements 3.2**

- [ ] 5. Implement collision detector and bottom boundary check
  - [-] 5.1 Implement `aabbOverlap(a, b)` returning `true` iff the two AABB rectangles intersect on both axes
    - _Requirements: 4.1, 4.2_

  - [~] 5.2 Implement `checkCollisions(state, canvasHeight)` that tests Appa's bounding box against every cloud segment's top and bottom boxes, and also triggers collision when `appa.y + APPA_HEIGHT >= canvasHeight`
    - _Requirements: 2.5, 4.1, 4.2_

  - [ ]* 5.3 Write property test for AABB overlap correctness
    - **Property 9: AABB overlap correctly identifies collision**
    - `aabbOverlap` must return `true` iff rectangles geometrically intersect on both axes simultaneously
    - **Validates: Requirements 4.2**

  - [ ]* 5.4 Write property test for bottom boundary collision
    - **Property 4: Bottom boundary triggers collision**
    - For any state where `appa.y + APPA_HEIGHT >= canvas.height`, `checkCollisions` must return `true`
    - **Validates: Requirements 2.5**

- [ ] 6. Implement score tracker
  - [-] 6.1 Implement `updateScore(state)` that increments `state.score` by 1 for each unscored cloud where `appa.x > cloud.x + CLOUD_WIDTH`, then sets `cloud.scored = true`
    - _Requirements: 5.2, 5.4_

  - [ ]* 6.2 Write property test for score deduplication
    - **Property 8: Score increments exactly once per cloud pair passed**
    - After the first pass, `cloud.scored === true` and subsequent ticks must not increment score again
    - **Validates: Requirements 5.2, 5.4**

- [ ] 7. Implement audio manager
  - [-] 7.1 Implement `playSound(audio)` that sets `audio.currentTime = 0`, calls `audio.play()`, and suppresses both Promise rejections and synchronous exceptions
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ]* 7.2 Write property test for jump sound restart behavior
    - **Property 13: Jump sound always restarts from the beginning**
    - For any audio state, `playSound` must set `currentTime = 0` before calling `play()`
    - **Validates: Requirements 7.3**

- [ ] 8. Implement state machine: input handler, start, reset, and game-over transition
  - [-] 8.1 Implement `resetGame()` that restores `gameState` to its initial values (`score = 0`, `clouds = []`, `appa` at start position, `phase = 'IDLE'`)
    - _Requirements: 6.2_

  - [-] 8.2 Implement `startGame()` that sets `phase = 'PLAYING'` and initializes `nextCloudX`
    - _Requirements: 6.1_

  - [-] 8.3 Implement `triggerCollision()` that sets `phase = 'GAME_OVER'`, plays the game-over sound
    - _Requirements: 4.3, 4.4, 4.5_

  - [~] 8.4 Implement the `keydown` listener on `window` that dispatches spacebar presses to `startGame()`, `applyFlap()` + `playSound`, or `resetGame()` + `startGame()` based on current phase; call `e.preventDefault()` to suppress page scroll; ignore all non-Space keys
    - _Requirements: 6.1, 6.2, 6.3, 2.2, 2.3_

  - [ ]* 8.5 Write property test for Game Over state freeze
    - **Property 10: Game Over state freezes all positions**
    - After any number of `update()` calls in `GAME_OVER` phase, cloud x positions and `appa.y` must remain unchanged
    - **Validates: Requirements 4.5**

  - [ ]* 8.6 Write property test for restart producing clean Playing State
    - **Property 11: Restart produces a clean Playing State**
    - For any `GAME_OVER` state, pressing spacebar must yield `score === 0`, `clouds` empty, `appa.y === APPA_START_Y`, `appa.vy === 0`, `phase === 'PLAYING'`
    - **Validates: Requirements 6.2**

  - [ ]* 8.7 Write property test for non-Space key no-op
    - **Property 12: Only spacebar triggers state transitions**
    - For any non-Space key code, `gameState.phase`, `appa`, `clouds`, and `score` must remain unchanged
    - **Validates: Requirements 6.3**

- [ ] 9. Implement renderer
  - [-] 9.1 Implement `drawBackground(ctx, canvas)` — ATLA sky gradient and decorative background clouds
    - Draw a vertical linear gradient from `SKY_TOP` (top) to `SKY_BOTTOM` (bottom) using `createLinearGradient`
    - Draw a set of static decorative background clouds as overlapping `arc()` blobs with semi-transparent white fill; these are purely visual and are not obstacles
    - _Requirements: 1.4_

  - [~] 9.2 Implement `drawAppa(ctx, x, y)` — canvas-primitive flying bison in ATLA style
    - Render cream body (`APPA_BODY`) as a rounded rectangle, plus an ellipse tail and a slightly darker head ellipse
    - Add two brown horn rectangles (`APPA_DETAIL`), an orange-brown forehead arrow triangle (`APPA_ARROW`), two small dark eye circles, six stubby leg rectangles, and a brown rounded-rect saddle (`APPA_DETAIL`)
    - This is the PRIMARY draw path — `drawAppa()` is always called instead of `ctx.drawImage`
    - _Requirements: 1.4, 1.5_

  - [~] 9.3 Implement `drawCloudSegment(ctx, x, y, width, height, facingDown)` and `drawCloud(ctx, cloud, canvasHeight)` — fluffy ATLA-style cloud obstacle columns
    - `drawCloudSegment`: draw a `CLOUD_SHADOW` underlay rect for depth, then a `CLOUD_FILL` column with overlapping `arc()` blobs; bumpy edge faces the gap (`facingDown` controls which edge is bumpy)
    - `drawCloud`: call `drawCloudSegment` for the top segment (height = `gapTop`, `facingDown = true`) and the bottom segment (y = `gapTop + GAP_SIZE`, `facingDown = false`)
    - _Requirements: 3.1, 3.2_

  - [ ] 9.4 Implement `drawATLAText(ctx, text, x, y, size, align)` and `drawCenteredText(ctx, canvas, text, y, size)` — ATLA-style UI text
    - Use `bold Npx 'Georgia', serif` font; draw a `UI_SHADOW` cream fill offset by (2, 2) first, then the `UI_TEXT` dark brown main text on top
    - `drawCenteredText` calls `drawATLAText` with `x = canvas.width / 2` and `align = 'center'`
    - _Requirements: 4.6, 5.3_

  - [~] 9.5 Implement the main `render(ctx, canvas, state, assets)` function calling helpers in order
    - Call: `drawBackground` → `drawCloud` (all pairs) → `drawAppa` → score text → overlay messages
    - IDLE phase: show `'Flappy Appa'` title at 48px and `'Press SPACE to start'` prompt via `drawCenteredText`
    - GAME_OVER phase: show `'The Air Nomads weep...'` at 32px, `'Final Score: N'` at 28px, and `'Press SPACE to try again'` at 24px via `drawCenteredText`
    - _Requirements: 1.4, 1.5, 4.6, 5.3_

- [ ] 10. Wire everything together and validate Appa x invariant
  - [~] 10.1 Wire `loadAssets()` → `resizeCanvas()` → `resetGame()` → `gameLoop()` in the top-level async init function; ensure the game loop starts only after assets resolve
    - _Requirements: 1.2, 1.3_

  - [~] 10.2 Integrate all update-sequence steps into `update()`: gravity, move, clamp, bottom check, scroll clouds, cull clouds, spawn clouds, collision detection, score update, frame count increment
    - _Requirements: 2.1, 2.4, 3.1, 3.3, 3.4, 3.5, 4.1, 5.1, 5.2_

  - [ ]* 10.3 Write property test for Appa x position invariance
    - **Property 3: Appa's canvas x position is invariant during play**
    - For any number of ticks in PLAYING state, `appa.x` must remain equal to `APPA_X`
    - **Validates: Requirements 2.4**

- [~] 11. Final checkpoint — Ensure all tests pass
  - Open `index.html` in a browser and verify: idle screen shows, spacebar starts the game, Appa falls and flaps, clouds scroll and spawn, collision ends the game with sound, score increments, restart works.
  - Ensure all automated property tests pass. Ask the user if any questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties defined in the design document
- Unit tests validate specific examples and edge cases
- The game runs entirely in the browser — no build step or server required; open `index.html` directly

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "2.1", "2.2"] },
    { "id": 2, "tasks": ["2.3", "3.1", "4.1", "5.1", "6.1", "7.1", "8.1", "8.2", "8.3", "9.1", "9.4"] },
    { "id": 3, "tasks": ["3.2", "3.3", "3.4", "4.2", "4.3", "5.3", "5.4", "6.2", "7.2", "8.4", "9.2", "9.3"] },
    { "id": 4, "tasks": ["8.5", "8.6", "8.7", "5.2", "9.5"] },
    { "id": 5, "tasks": ["10.1", "10.2"] },
    { "id": 6, "tasks": ["10.3"] }
  ]
}
```
