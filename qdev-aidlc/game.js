// ============================================================
// Constants
// ============================================================

// Physics
const GRAVITY       = 0.5;   // px/tick² downward acceleration
const FLAP_VELOCITY = -9;    // px/tick upward impulse on spacebar

// Appa
const APPA_X       = 80;    // fixed canvas x position (world scrolls, Appa stays)
const APPA_WIDTH   = 60;    // sprite render width (px)
const APPA_HEIGHT  = 45;    // sprite render height (px)
const APPA_START_Y = 250;   // initial vertical position (px from top)

// Clouds
const CLOUD_WIDTH    = 70;   // width of each cloud segment (px)
const GAP_SIZE       = 160;  // fixed vertical gap between top/bottom cloud (px)
const CLOUD_SPEED    = 3;    // px/tick scroll speed (left)
const CLOUD_INTERVAL = 280;  // horizontal distance between cloud pair spawns (px)
const GAP_MIN_Y      = 60;   // minimum gap top edge (keeps top cloud visible)
const GAP_MAX_Y      = 320;  // maximum gap top edge (keeps bottom cloud visible)

// Scoring
const SCORE_X = 20;  // score display x (top-left, away from gap area)
const SCORE_Y = 40;  // score display y

// ATLA Visual Theme
const SKY_TOP      = '#4A90D9';  // deep sky blue (top of gradient)
const SKY_BOTTOM   = '#B8E4F7';  // horizon light blue (bottom of gradient)
const CLOUD_FILL   = '#FFFFFF';  // obstacle cloud white
const CLOUD_SHADOW = '#D0E8F0';  // subtle cloud shadow (non-gap side)
const APPA_BODY    = '#F5F0E8';  // cream white bison body
const APPA_DETAIL  = '#8B6914';  // brown for horns, saddle
const APPA_ARROW   = '#C8860A';  // orange-brown forehead arrow marking
const UI_TEXT      = '#4A2C0A';  // dark brown UI text
const UI_SHADOW    = '#F5E6C8';  // cream text shadow

// ============================================================
// Helper Functions
// ============================================================

/**
 * Returns a random integer between min and max, inclusive.
 */
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ============================================================
// Canvas Setup
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);

// ============================================================
// Game State
// ============================================================

const gameState = {
  phase:      'IDLE',       // 'IDLE' | 'PLAYING' | 'GAME_OVER'
  appa: {
    x:  APPA_X,
    y:  APPA_START_Y,
    vy: 0,                  // vertical velocity; positive = downward
  },
  clouds:     [],           // array of CloudPair objects
  score:      0,
  nextCloudX: 0,            // x at which the next cloud pair spawns
  frameCount: 0,
};

// ============================================================
// Asset Loader
// ============================================================

const assets = { sprite: null, jump: null, gameOver: null };

async function loadAssets() {
  const img = new Image();
  const imgPromise = new Promise((resolve) => {
    img.onload  = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = 'assets/ghosty.png';
  });

  const jumpAudio     = new Audio('assets/jump.wav');
  const gameOverAudio = new Audio('assets/game_over.wav');

  const [loadedSprite] = await Promise.all([imgPromise]);
  assets.sprite   = loadedSprite;
  assets.jump     = jumpAudio;
  assets.gameOver = gameOverAudio;
}

// ============================================================
// Audio Manager
// ============================================================

function playSound(audio) {
  try {
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } catch (_) {}
}

// ============================================================
// Physics Engine
// ============================================================

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

// ============================================================
// Cloud Manager
// ============================================================

function spawnCloudPair(state) {
  const gapTop = randomInt(GAP_MIN_Y, Math.min(GAP_MAX_Y, canvas.height - GAP_SIZE - 40));
  state.clouds.push({ x: canvas.width, gapTop, scored: false });
  state.nextCloudX = canvas.width + CLOUD_INTERVAL;
}

function scrollClouds(state) {
  for (const c of state.clouds) c.x -= CLOUD_SPEED;
}

function cullClouds(state) {
  state.clouds = state.clouds.filter(c => c.x + CLOUD_WIDTH >= 0);
}

// ============================================================
// Collision Detector
// ============================================================

function aabbOverlap(a, b) {
  return a.x < b.x + b.w &&
         a.x + a.w > b.x &&
         a.y < b.y + b.h &&
         a.y + a.h > b.y;
}

function checkCollisions(state) {
  // Bottom boundary
  if (state.appa.y + APPA_HEIGHT >= canvas.height) return true;

  const appaBox = { x: state.appa.x, y: state.appa.y, w: APPA_WIDTH, h: APPA_HEIGHT };
  for (const cloud of state.clouds) {
    const topBox    = { x: cloud.x, y: 0,                       w: CLOUD_WIDTH, h: cloud.gapTop };
    const bottomBox = { x: cloud.x, y: cloud.gapTop + GAP_SIZE, w: CLOUD_WIDTH, h: canvas.height - (cloud.gapTop + GAP_SIZE) };
    if (aabbOverlap(appaBox, topBox) || aabbOverlap(appaBox, bottomBox)) return true;
  }
  return false;
}

// ============================================================
// Score Tracker
// ============================================================

function updateScore(state) {
  for (const cloud of state.clouds) {
    if (!cloud.scored && state.appa.x > cloud.x + CLOUD_WIDTH) {
      state.score++;
      cloud.scored = true;
    }
  }
}

// ============================================================
// State Machine
// ============================================================

function resetGame() {
  gameState.phase      = 'IDLE';
  gameState.appa       = { x: APPA_X, y: APPA_START_Y, vy: 0 };
  gameState.clouds     = [];
  gameState.score      = 0;
  gameState.nextCloudX = canvas.width + CLOUD_INTERVAL;
  gameState.frameCount = 0;
}

function startGame() {
  gameState.phase      = 'PLAYING';
  gameState.nextCloudX = canvas.width + CLOUD_INTERVAL;
}

function triggerCollision() {
  gameState.phase = 'GAME_OVER';
  playSound(assets.gameOver);
}

// ============================================================
// Input Handler
// ============================================================

window.addEventListener('keydown', (e) => {
  if (e.code !== 'Space') return;
  e.preventDefault();

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

// ============================================================
// Renderer — ATLA Visual Theme
// ============================================================

function drawBackground(ctx, canvas) {
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, SKY_TOP);
  grad.addColorStop(1, SKY_BOTTOM);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Static decorative background clouds (non-obstacle)
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

function drawAppa(ctx, x, y) {
  const w = APPA_WIDTH;
  const h = APPA_HEIGHT;

  // Body
  ctx.fillStyle = APPA_BODY;
  ctx.beginPath();
  ctx.roundRect(x, y + h * 0.25, w * 0.85, h * 0.55, 10);
  ctx.fill();

  // Tail
  ctx.fillStyle = APPA_BODY;
  ctx.beginPath();
  ctx.ellipse(x + w * 0.88, y + h * 0.48, w * 0.18, h * 0.22, 0.3, 0, Math.PI * 2);
  ctx.fill();

  // Head
  ctx.fillStyle = '#EDE8D8';
  ctx.beginPath();
  ctx.ellipse(x + w * 0.12, y + h * 0.32, w * 0.18, h * 0.28, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // Horns
  ctx.fillStyle = APPA_DETAIL;
  ctx.fillRect(x + w * 0.06, y + h * 0.04, 5, 10);
  ctx.fillRect(x + w * 0.16, y + h * 0.02, 5, 10);

  // Forehead arrow
  ctx.fillStyle = APPA_ARROW;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.12, y + h * 0.14);
  ctx.lineTo(x + w * 0.05, y + h * 0.26);
  ctx.lineTo(x + w * 0.19, y + h * 0.26);
  ctx.closePath();
  ctx.fill();

  // Eyes
  ctx.fillStyle = '#1A1A1A';
  ctx.beginPath();
  ctx.arc(x + w * 0.08, y + h * 0.36, 3, 0, Math.PI * 2);
  ctx.fill();

  // Six legs
  ctx.fillStyle = APPA_BODY;
  const legY = y + h * 0.75;
  const legW = 8, legH = 12;
  for (const lx of [0.18, 0.32, 0.46, 0.58, 0.68, 0.78]) {
    ctx.fillRect(x + w * lx - legW / 2, legY, legW, legH);
  }

  // Saddle
  ctx.fillStyle = APPA_DETAIL;
  ctx.beginPath();
  ctx.roundRect(x + w * 0.32, y + h * 0.18, w * 0.28, h * 0.16, 4);
  ctx.fill();
}

function drawCloudSegment(ctx, x, y, width, height, facingDown) {
  if (height <= 0) return;

  // Shadow underlay
  ctx.fillStyle = CLOUD_SHADOW;
  ctx.fillRect(x, y, width, height);

  ctx.fillStyle = CLOUD_FILL;
  const blobRadius  = width * 0.55;
  const blobSpacing = blobRadius * 1.1;
  const blobX       = x + width / 2;

  if (facingDown) {
    // Top segment: flat top, bumpy bottom toward gap
    ctx.fillRect(x, y, width, height - blobRadius * 0.6);
    let blobY = y + height - blobRadius * 0.5;
    while (blobY > y) {
      ctx.beginPath();
      ctx.arc(blobX, blobY, blobRadius, 0, Math.PI * 2);
      ctx.fill();
      blobY -= blobSpacing;
    }
  } else {
    // Bottom segment: bumpy top toward gap, flat bottom
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

  if (topH > 0)    drawCloudSegment(ctx, cloud.x, 0,       CLOUD_WIDTH, topH,    true);
  if (bottomH > 0) drawCloudSegment(ctx, cloud.x, bottomY, CLOUD_WIDTH, bottomH, false);
}

function drawATLAText(ctx, text, x, y, size, align) {
  size  = size  || 28;
  align = align || 'left';
  ctx.font      = `bold ${size}px 'Georgia', serif`;
  ctx.textAlign = align;
  ctx.fillStyle = UI_SHADOW;
  ctx.fillText(text, x + 2, y + 2);
  ctx.fillStyle = UI_TEXT;
  ctx.fillText(text, x, y);
}

function drawCenteredText(ctx, canvas, text, y, size) {
  drawATLAText(ctx, text, canvas.width / 2, y, size || 28, 'center');
}

function render() {
  drawBackground(ctx, canvas);

  for (const cloud of gameState.clouds) {
    drawCloud(ctx, cloud, canvas.height);
  }

  drawAppa(ctx, gameState.appa.x, gameState.appa.y);

  drawATLAText(ctx, 'Score: ' + gameState.score, SCORE_X, SCORE_Y, 28, 'left');

  if (gameState.phase === 'IDLE') {
    drawCenteredText(ctx, canvas, 'Flappy Appa', canvas.height / 2 - 60, 48);
    drawCenteredText(ctx, canvas, 'Press SPACE to start', canvas.height / 2, 28);
  } else if (gameState.phase === 'GAME_OVER') {
    drawCenteredText(ctx, canvas, 'The Air Nomads weep...', canvas.height / 2 - 40, 32);
    drawCenteredText(ctx, canvas, 'Final Score: ' + gameState.score, canvas.height / 2, 28);
    drawCenteredText(ctx, canvas, 'Press SPACE to try again', canvas.height / 2 + 40, 24);
  }
}

// ============================================================
// Update Loop
// ============================================================

function update() {
  if (gameState.phase !== 'PLAYING') return;

  // 1. Physics
  applyGravity(gameState.appa);
  clampTop(gameState.appa);

  // 2. Bottom boundary → collision
  if (gameState.appa.y + APPA_HEIGHT >= canvas.height) {
    triggerCollision();
    return;
  }

  // 3. Scroll & manage clouds
  scrollClouds(gameState);
  cullClouds(gameState);

  // 4. Spawn new cloud pair when needed
  if (gameState.nextCloudX <= canvas.width) {
    spawnCloudPair(gameState);
  } else {
    gameState.nextCloudX -= CLOUD_SPEED;
  }

  // 5. AABB collision detection
  if (checkCollisions(gameState)) {
    triggerCollision();
    return;
  }

  // 6. Score
  updateScore(gameState);

  // 7. Frame counter
  gameState.frameCount++;
}

// ============================================================
// Game Loop
// ============================================================

function gameLoop() {
  update();
  render();
  requestAnimationFrame(gameLoop);
}

// ============================================================
// Init
// ============================================================

async function init() {
  resizeCanvas();
  await loadAssets();
  resetGame();
  gameLoop();
}

init();
