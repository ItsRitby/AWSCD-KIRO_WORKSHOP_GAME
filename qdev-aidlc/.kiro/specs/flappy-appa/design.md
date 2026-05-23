# Design Document — Flappy Appa

## Overview

Flappy Appa is a single-page, browser-based arcade game implemented with HTML5 Canvas and vanilla JavaScript. The entire game runs in two files: `index.html` (markup and canvas setup) and `game.js` (all game logic). No build tools, frameworks, or external dependencies are required.

The design follows a simple **state-machine + game-loop** pattern. A central `requestAnimationFrame` loop drives physics, collision detection, rendering, and scoring. Game state is represented as a plain JavaScript object, making the logic easy to reason about and test.

---

## Architecture

```
index.html
  └── <canvas id="gameCanvas">          ← full-viewport rendering surface
  └── <script src="game.js">

game.js
  ├── Constants                          ← physics, layout, timing values
  ├── Asset Loader                       ← image + audio loading with fallbacks
  ├── State Machine                      ← IDLE | PLAYING | GAME_OVER
  ├── Game State Object                  ← appa, clouds, score, frame counter
  ├── Input Handler                      ← spacebar listener → state transitions
  ├── Physics Engine                     ← gravity, flap impulse, boundary clamp
  ├── Cloud Manager                      ← spawn, scroll, cull cloud pairs
  ├── Collision Detector                 ← AABB overlap tests
  ├── Score Tracker                      ← pass detection, dedup guard
  ├── Audio Manager                      ← play/restart sounds, suppress errors
  ├── Renderer                           ← canvas draw calls per frame
  └── Game Loop                          ← requestAnimationFrame driver
```

---

## File Structure

```
index.html          ← canvas element, loads game.js
game.js             ← all game logic
assets/
  ghosty.png        ← Appa sprite (player character)
  jump.wav          ← flap sound effect
  game_over.wav     ← collision sound effect
```

---

## Constants

All tunable values are declared as named constants at the top of `game.js` so they are easy to adjust without hunting through logic code.

```javascript
// Physics
const GRAVITY        = 0.5;   // px/tick² downward acceleration
const FLAP_VELOCITY  = -9;    // px/tick upward impulse on spacebar

// Appa
const APPA_X         = 80;    // fixed canvas x position (world scrolls, Appa stays)
const APPA_WIDTH     = 60;    // sprite render width (px)
const APPA_HEIGHT    = 45;    // sprite render height (px)
const APPA_START_Y   = 250;   // initial vertical position (px from top)

// Clouds
const CLOUD_WIDTH    = 70;    // width of each cloud segment (px)
const GAP_SIZE       = 160;   // fixed vertical gap between top/bottom cloud (px)
const CLOUD_SPEED    = 3;     // px/tick scroll speed (left)
const CLOUD_INTERVAL = 280;   // horizontal distance between cloud pair spawns (px)
const GAP_MIN_Y      = 60;    // minimum gap top edge (keeps top cloud visible)
const GAP_MAX_Y      = 320;   // maximum gap top edge (keeps bottom cloud visible)

// Scoring
const SCORE_X        = 20;    // score display x (top-left, away from gap area)
const SCORE_Y        = 40;    // score display y

// ATLA Visual Theme
const SKY_TOP        = '#4A90D9';   // deep sky blue (top of gradient)
const SKY_BOTTOM     = '#B8E4F7';   // horizon light blue (bottom of gradient)
const CLOUD_FILL     = '#FFFFFF';   // obstacle cloud white
const CLOUD_SHADOW   = '#D0E8F0';   // subtle cloud shadow (non-gap side)
const APPA_BODY      = '#F5F0E8';   // cream white bison body
const APPA_DETAIL    = '#8B6914';   // brown for horns, saddle
const APPA_ARROW     = '#C8860A';   // orange-brown forehead arrow marking
const UI_TEXT        = '#4A2C0A';   // dark brown UI text
const UI_SHADOW      = '#F5E6C8';   // cream text shadow
```

---

## Data Models

### GameState

The single source of truth for all mutable game data.

```javascript
const gameState = {
  phase: 'IDLE',          // 'IDLE' | 'PLAYING' | 'GAME_OVER'
  appa: {
    x: APPA_X,
    y: APPA_START_Y,
    vy: 0,                // vertical velocity (px/tick); positive = downward
  },
  clouds: [],             // array of CloudPair objects (see below)
  score: 0,
  nextCloudX: 0,          // canvas x at which the next cloud pair spawns
  frameCount: 0,          // incremented each tick during PLAYING
};
```

### CloudPair

```javascript
{
  x: Number,        // left edge of the cloud columns (px, decreases each tick)
  gapTop: Number,   // y coordinate of the top of the gap (px from canvas top)
  scored: Boolean,  // true once Appa has passed this pair (dedup guard)
}
```

Derived geometry (computed on the fly, not stored):

| Value | Expression |
|---|---|
| Top cloud rect | `{ x, y: 0, w: CLOUD_WIDTH, h: gapTop }` |
| Bottom cloud rect | `{ x, y: gapTop + GAP_SIZE, w: CLOUD_WIDTH, h: canvas.height - (gapTop + GAP_SIZE) }` |
| Gap trailing edge | `x + CLOUD_WIDTH` |

### Appa Bounding Box

```javascript
// Computed each tick from gameState.appa
{ x: appa.x, y: appa.y, w: APPA_WIDTH, h: APPA_HEIGHT }
```

---

## State Machine

```
         spacebar
  IDLE ──────────────► PLAYING
                          │
                    collision / ground
                          │
                          ▼
                      GAME_OVER
                          │
                       spacebar
                          │
                          ▼
                       PLAYING  (reset)
```

| Phase | Physics | Clouds | Input |
|---|---|---|---|
| IDLE | frozen | none | spacebar → PLAYING |
| PLAYING | active | scroll + spawn | spacebar → flap |
| GAME_OVER | frozen | frozen | spacebar → reset + PLAYING |

---

## Game Loop

```javascript
function gameLoop() {
  update();   // physics, clouds, collision, scoring
  render();   // canvas draw calls
  requestAnimationFrame(gameLoop);
}
```

`update()` is a no-op when `phase !== 'PLAYING'`, so the loop always runs (keeping the canvas alive) but only advances game state during active play.

### Update Sequence (per tick, PLAYING only)

1. Apply gravity: `appa.vy += GRAVITY`
2. Move Appa: `appa.y += appa.vy`
3. Top boundary clamp: if `appa.y <= 0` → `appa.y = 0; appa.vy = 0`
4. Bottom boundary check: if `appa.y + APPA_HEIGHT >= canvas.height` → triggerCollision()
5. Scroll clouds: each cloud `x -= CLOUD_SPEED`
6. Cull off-screen clouds: remove pairs where `x + CLOUD_WIDTH < 0`
7. Spawn new clouds: if `nextCloudX <= canvas.width` → spawnCloudPair(); advance `nextCloudX`
8. Collision detection: AABB test Appa vs every cloud segment
9. Score update: for each unscored cloud where `appa.x > cloud.x + CLOUD_WIDTH` → score++; cloud.scored = true
10. Increment `frameCount`

---

## Component Designs

### Asset Loader

Loads the sprite and both audio clips before the first frame. Uses `Promise.all` so the game only starts the loop after all assets resolve. The sprite load failure is caught and a fallback flag is set.

```javascript
async function loadAssets() {
  const img = new Image();
  const imgPromise = new Promise((resolve) => {
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);   // null → use fallback rect
    img.src = 'assets/ghosty.png';
  });

  const jumpAudio    = new Audio('assets/jump.wav');
  const gameOverAudio = new Audio('assets/game_over.wav');

  assets.sprite   = await imgPromise;   // null if load failed
  assets.jump     = jumpAudio;
  assets.gameOver = gameOverAudio;
}
```

### Audio Manager

Wraps sound playback with error suppression and restart-from-beginning support.

```javascript
function playSound(audio) {
  try {
    audio.currentTime = 0;
    audio.play().catch(() => {});   // suppress autoplay policy errors
  } catch (_) {}
}
```

### Physics Engine

Pure functions operating on the `appa` object — no side effects beyond mutating the passed state.

```javascript
function applyGravity(appa) {
  appa.vy += GRAVITY;
  appa.y  += appa.vy;
}

function applyFlap(appa) {
  appa.vy = FLAP_VELOCITY;
}

function clampTop(appa) {
  if (appa.y <= 0) {
    appa.y  = 0;
    appa.vy = 0;
  }
}
```

### Cloud Manager

```javascript
function spawnCloudPair(state, canvasWidth) {
  const gapTop = randomInt(GAP_MIN_Y, GAP_MAX_Y);
  state.clouds.push({ x: canvasWidth, gapTop, scored: false });
  state.nextCloudX = canvasWidth + CLOUD_INTERVAL;
}

function scrollClouds(state) {
  for (const c of state.clouds) c.x -= CLOUD_SPEED;
}

function cullClouds(state) {
  state.clouds = state.clouds.filter(c => c.x + CLOUD_WIDTH >= 0);
}
```

### Collision Detector

AABB (axis-aligned bounding box) overlap test — returns `true` if two rectangles intersect.

```javascript
function aabbOverlap(a, b) {
  return a.x < b.x + b.w &&
         a.x + a.w > b.x &&
         a.y < b.y + b.h &&
         a.y + a.h > b.y;
}

function checkCollisions(state) {
  const appaBox = { x: state.appa.x, y: state.appa.y, w: APPA_WIDTH, h: APPA_HEIGHT };
  for (const cloud of state.clouds) {
    const topBox    = { x: cloud.x, y: 0,                        w: CLOUD_WIDTH, h: cloud.gapTop };
    const bottomBox = { x: cloud.x, y: cloud.gapTop + GAP_SIZE,  w: CLOUD_WIDTH, h: Infinity };
    if (aabbOverlap(appaBox, topBox) || aabbOverlap(appaBox, bottomBox)) {
      return true;
    }
  }
  return false;
}
```

### Score Tracker

```javascript
function updateScore(state) {
  for (const cloud of state.clouds) {
    if (!cloud.scored && state.appa.x > cloud.x + CLOUD_WIDTH) {
      state.score++;
      cloud.scored = true;
    }
  }
}
```

### Renderer

All draw calls happen inside `render()`. The canvas is cleared each frame before drawing.

The renderer is split into focused helper functions for each visual element, all using the HTML5 Canvas 2D API exclusively. No external image files are required for the background or Appa — `assets/ghosty.png` is still attempted but `drawAppa()` is the primary render path regardless.

#### Background — ATLA Sky

A vertical linear gradient from deep sky blue at the top to a warm horizon blue at the bottom, evoking the ATLA world. A small set of static decorative clouds (non-obstacle) are drawn as overlapping arcs to suggest altitude.

```javascript
function drawBackground(ctx, canvas) {
  // Vertical sky gradient
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, SKY_TOP);
  grad.addColorStop(1, SKY_BOTTOM);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Static decorative background clouds (non-obstacle, purely visual)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  const bgClouds = [
    { x: 120, y: 80,  r: 22 },
    { x: 160, y: 72,  r: 18 },
    { x: 95,  y: 90,  r: 16 },
    { x: 420, y: 55,  r: 26 },
    { x: 460, y: 48,  r: 20 },
    { x: 395, y: 65,  r: 17 },
    { x: 700, y: 100, r: 24 },
    { x: 740, y: 92,  r: 19 },
  ];
  for (const c of bgClouds) {
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    ctx.fill();
  }
}
```

#### Appa — Canvas-Drawn Flying Bison

`drawAppa(ctx, x, y)` renders Appa entirely with canvas primitives in ATLA style. This is the primary draw path; the sprite loader still attempts `assets/ghosty.png` but `drawAppa()` is always called.

```javascript
function drawAppa(ctx, x, y) {
  const w = APPA_WIDTH;   // 60
  const h = APPA_HEIGHT;  // 45

  // --- Body: large cream rounded rectangle ---
  ctx.fillStyle = APPA_BODY;
  ctx.beginPath();
  ctx.roundRect(x, y + h * 0.25, w * 0.85, h * 0.55, 10);
  ctx.fill();

  // --- Tail: thick rounded shape extending behind the body ---
  ctx.fillStyle = APPA_BODY;
  ctx.beginPath();
  ctx.ellipse(x + w * 0.88, y + h * 0.48, w * 0.18, h * 0.22, 0.3, 0, Math.PI * 2);
  ctx.fill();

  // --- Head: slightly darker cream rounded shape at front-left ---
  ctx.fillStyle = '#EDE8D8';
  ctx.beginPath();
  ctx.ellipse(x + w * 0.12, y + h * 0.32, w * 0.18, h * 0.28, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // --- Horns: two small brown rectangles on top of head ---
  ctx.fillStyle = APPA_DETAIL;
  ctx.fillRect(x + w * 0.06, y + h * 0.04, 5, 10);  // left horn
  ctx.fillRect(x + w * 0.16, y + h * 0.02, 5, 10);  // right horn

  // --- Forehead arrow: orange-brown triangle pointing forward ---
  ctx.fillStyle = APPA_ARROW;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.12, y + h * 0.14);  // tip (pointing down toward nose)
  ctx.lineTo(x + w * 0.05, y + h * 0.26);
  ctx.lineTo(x + w * 0.19, y + h * 0.26);
  ctx.closePath();
  ctx.fill();

  // --- Eyes: two small dark circles ---
  ctx.fillStyle = '#1A1A1A';
  ctx.beginPath();
  ctx.arc(x + w * 0.08, y + h * 0.36, 3, 0, Math.PI * 2);
  ctx.fill();

  // --- Six legs: short stubby rectangles below the body (3 pairs) ---
  ctx.fillStyle = APPA_BODY;
  const legY = y + h * 0.75;
  const legW = 8, legH = 12;
  const legPositions = [0.18, 0.32, 0.46, 0.58, 0.68, 0.78];
  for (const lx of legPositions) {
    ctx.fillRect(x + w * lx - legW / 2, legY, legW, legH);
  }

  // --- Saddle: small brown/tan rectangle on Appa's back ---
  ctx.fillStyle = APPA_DETAIL;
  ctx.beginPath();
  ctx.roundRect(x + w * 0.32, y + h * 0.18, w * 0.28, h * 0.16, 4);
  ctx.fill();
}
```

#### Cloud Obstacles — ATLA-Style Fluffy Clouds

Each cloud segment (top and bottom) is drawn as a column of overlapping circles to create a bumpy, fluffy cloud wall. The flat edge faces the gap; the outer edge is rounded. A subtle shadow fill (`CLOUD_SHADOW`) is drawn on the non-gap side before the white fill to give slight depth.

```javascript
function drawCloudSegment(ctx, x, y, width, height, facingDown) {
  // Shadow layer (slightly offset, non-gap side)
  ctx.fillStyle = CLOUD_SHADOW;
  ctx.fillRect(x, y, width, height);

  // Fluffy white cloud column using overlapping arcs
  ctx.fillStyle = CLOUD_FILL;
  const blobRadius = width * 0.55;
  const blobSpacing = blobRadius * 1.1;
  const blobX = x + width / 2;

  if (facingDown) {
    // Top cloud segment: flat top, bumpy bottom edge facing the gap
    ctx.fillRect(x, y, width, height - blobRadius * 0.6);
    let blobY = y + height - blobRadius * 0.5;
    while (blobY > y) {
      ctx.beginPath();
      ctx.arc(blobX, blobY, blobRadius, 0, Math.PI * 2);
      ctx.fill();
      blobY -= blobSpacing;
    }
  } else {
    // Bottom cloud segment: bumpy top edge facing the gap, flat bottom
    ctx.fillRect(x, y + blobRadius * 0.6, width, height - blobRadius * 0.6);
    let blobY = y + blobRadius * 0.5;
    while (blobY < y + height) {
      ctx.beginPath();
      ctx.arc(blobX, blobY, blobRadius, 0, Math.PI * 2);
      ctx.fill();
      blobY += blobSpacing;
    }
  }
}

function drawCloud(ctx, cloud, canvasHeight) {
  const topH    = cloud.gapTop;
  const bottomY = cloud.gapTop + GAP_SIZE;
  const bottomH = canvasHeight - bottomY;

  if (topH > 0) {
    drawCloudSegment(ctx, cloud.x, 0, CLOUD_WIDTH, topH, true);
  }
  if (bottomH > 0) {
    drawCloudSegment(ctx, cloud.x, bottomY, CLOUD_WIDTH, bottomH, false);
  }
}
```

#### UI Text — ATLA Style

Score and overlay messages use `bold 28px 'Georgia', serif` in dark brown (`UI_TEXT`) with a cream shadow (`UI_SHADOW`), evoking ATLA's hand-painted title cards.

```javascript
function drawATLAText(ctx, text, x, y, size = 28, align = 'left') {
  ctx.font      = `bold ${size}px 'Georgia', serif`;
  ctx.textAlign = align;
  // Cream shadow offset
  ctx.fillStyle = UI_SHADOW;
  ctx.fillText(text, x + 2, y + 2);
  // Dark brown main text
  ctx.fillStyle = UI_TEXT;
  ctx.fillText(text, x, y);
}

function drawCenteredText(ctx, canvas, text, y, size = 28) {
  drawATLAText(ctx, text, canvas.width / 2, y, size, 'center');
}
```

#### Main Render Function

```javascript
function render(ctx, canvas, state, assets) {
  // 1. ATLA sky background with decorative clouds
  drawBackground(ctx, canvas);

  // 2. Fluffy ATLA cloud obstacles
  for (const cloud of state.clouds) {
    drawCloud(ctx, cloud, canvas.height);
  }

  // 3. Appa — canvas-drawn flying bison (primary path)
  //    assets.sprite load is still attempted but drawAppa() is always used
  drawAppa(ctx, state.appa.x, state.appa.y);

  // 4. Score — ATLA-style dark brown text with cream shadow
  drawATLAText(ctx, `Score: ${state.score}`, SCORE_X, SCORE_Y, 28, 'left');

  // 5. Overlay messages
  if (state.phase === 'IDLE') {
    drawCenteredText(ctx, canvas, 'Flappy Appa', canvas.height / 2 - 60, 48);
    drawCenteredText(ctx, canvas, 'Press SPACE to start', canvas.height / 2, 28);
  } else if (state.phase === 'GAME_OVER') {
    drawCenteredText(ctx, canvas, 'The Air Nomads weep...', canvas.height / 2 - 40, 32);
    drawCenteredText(ctx, canvas, `Final Score: ${state.score}`, canvas.height / 2, 28);
    drawCenteredText(ctx, canvas, 'Press SPACE to try again', canvas.height / 2 + 40, 24);
  }
}
```

### Input Handler

A single `keydown` listener on `window` dispatches to the correct action based on current phase.

```javascript
window.addEventListener('keydown', (e) => {
  if (e.code !== 'Space') return;
  e.preventDefault();   // prevent page scroll

  if (gameState.phase === 'IDLE') {
    startGame();
  } else if (gameState.phase === 'PLAYING') {
    applyFlap(gameState.appa);
    playSound(assets.jump);
  } else if (gameState.phase === 'GAME_OVER') {
    resetGame();
    startGame();
  }
});
```

### Reset Logic

```javascript
function resetGame() {
  gameState.phase      = 'IDLE';
  gameState.appa       = { x: APPA_X, y: APPA_START_Y, vy: 0 };
  gameState.clouds     = [];
  gameState.score      = 0;
  gameState.nextCloudX = CANVAS_WIDTH + CLOUD_INTERVAL;
  gameState.frameCount = 0;
}
```

---

## Canvas Sizing

The canvas is sized to fill the browser viewport on load and on resize:

```javascript
function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();
```

`GAP_MAX_Y` is computed relative to `canvas.height` at spawn time so gaps remain within safe bounds regardless of viewport size.

---

## Error Handling

| Scenario | Handling |
|---|---|
| `ghosty.png` fails to load | `assets.sprite = null`; renderer calls `drawAppa()` (canvas-drawn Appa) as primary path |
| Audio autoplay blocked | `audio.play()` returns a rejected Promise; `.catch(() => {})` silences it |
| `audio.currentTime` throws | Wrapped in `try/catch`; gameplay continues unaffected |
| Canvas context unavailable | Not expected in modern browsers; no special handling needed |

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

**Property Reflection:** After reviewing all prework items, the following consolidations were made:
- 2.5 (bottom boundary → collision) and 4.2 (AABB overlap → collision) are both collision triggers; they are kept separate because they test different detection paths (boundary vs. AABB).
- 3.1 (spawn interval) and 3.5 (at least one visible) are related but test different invariants; kept separate.
- 5.2 (score increment) and 5.4 (dedup) are combined into a single idempotence property (Property 8).
- 2.1 (gravity accumulation) and 2.4 (Appa x fixed) are independent physics invariants; kept separate.

---

### Property 1: Gravity accumulates velocity each tick

*For any* Appa state with an initial vertical velocity `vy₀`, after `N` physics ticks without a flap, Appa's vertical velocity SHALL equal `vy₀ + N × GRAVITY`.

**Validates: Requirements 2.1**

---

### Property 2: Flap sets velocity to the impulse constant

*For any* Appa state, immediately after a Flap action is applied, Appa's vertical velocity SHALL equal `FLAP_VELOCITY` regardless of the prior velocity value.

**Validates: Requirements 2.2**

---

### Property 3: Appa's canvas x position is invariant during play

*For any* number of game ticks elapsed in the Playing State, Appa's canvas x coordinate SHALL remain equal to `APPA_X`.

**Validates: Requirements 2.4**

---

### Property 4: Bottom boundary triggers collision

*For any* Appa state where `appa.y + APPA_HEIGHT >= canvas.height`, the collision detection step SHALL return true.

**Validates: Requirements 2.5**

---

### Property 5: Top boundary clamps position and zeroes velocity

*For any* Appa state where `appa.y < 0` after applying gravity, the physics step SHALL set `appa.y = 0` and `appa.vy = 0`.

**Validates: Requirements 2.6**

---

### Property 6: Cloud gap size is always the fixed constant

*For any* generated CloudPair, the vertical distance between the bottom of the top cloud segment and the top of the bottom cloud segment SHALL equal `GAP_SIZE`.

**Validates: Requirements 3.2**

---

### Property 7: Cloud gap position is within safe bounds

*For any* generated CloudPair, `gapTop` SHALL satisfy `GAP_MIN_Y <= gapTop <= GAP_MAX_Y`, ensuring both cloud segments are fully visible on the canvas.

**Validates: Requirements 3.2**

---

### Property 8: Score increments exactly once per cloud pair passed

*For any* CloudPair that Appa passes without collision, the `scored` flag SHALL be set to `true` after the first pass, and the score SHALL have been incremented by exactly 1. Subsequent ticks SHALL not increment the score for the same pair.

**Validates: Requirements 5.2, 5.4**

---

### Property 9: AABB overlap correctly identifies collision

*For any* Appa bounding box and cloud segment bounding box, `aabbOverlap` SHALL return `true` if and only if the two rectangles geometrically intersect (i.e., overlap on both axes simultaneously).

**Validates: Requirements 4.2**

---

### Property 10: Game Over state freezes all positions

*For any* game state in the `GAME_OVER` phase, after any number of `update()` calls, all cloud x positions and Appa's y position SHALL remain unchanged.

**Validates: Requirements 4.5**

---

### Property 11: Restart produces a clean Playing State

*For any* `GAME_OVER` state (with any score value and any number of active cloud pairs), pressing spacebar SHALL produce a state where `score === 0`, `clouds` is empty, `appa.y === APPA_START_Y`, `appa.vy === 0`, and `phase === 'PLAYING'`.

**Validates: Requirements 6.2**

---

### Property 12: Only spacebar triggers state transitions

*For any* keyboard key code that is not `'Space'`, pressing that key SHALL leave `gameState.phase`, `gameState.appa`, `gameState.clouds`, and `gameState.score` entirely unchanged.

**Validates: Requirements 6.3**

---

### Property 13: Jump sound always restarts from the beginning

*For any* state of the jump audio clip (playing, paused, or ended), calling `playSound(assets.jump)` SHALL set `audio.currentTime` to `0` before calling `play()`.

**Validates: Requirements 7.3**
