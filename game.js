// Nurse Deflowerer — reverse-Pacman: chase down each level's nurses; catching
// one summons a security guard to avoid. Clear all nurses to advance a level.

// Decorative falling cherry-blossom petals behind the game (pure CSS animation,
// just randomizing each petal's position/size/timing here).
(function spawnSakura() {
  const container = document.getElementById('sakura');
  const count = 22;
  for (let i = 0; i < count; i++) {
    const petal = document.createElement('div');
    petal.className = 'petal';
    const size = 8 + Math.random() * 10;
    const left = Math.random() * 100;
    const duration = 9 + Math.random() * 10;
    const delay = -Math.random() * duration;
    const drift = (Math.random() - 0.5) * 160;
    petal.style.left = left + 'vw';
    petal.style.width = size + 'px';
    petal.style.height = size * 0.9 + 'px';
    petal.style.animationDuration = duration + 's';
    petal.style.animationDelay = delay + 's';
    petal.style.setProperty('--drift', drift + 'px');
    container.appendChild(petal);
  }
})();

const TILE = 24;

// Procedurally generate a bigger maze (recursive-backtracker + extra loop cuts
// so it reads like a Pacman board instead of a single-path perfect maze).
// tunnelRow/tunnelCol get forced fully open so they become Pacman-style
// side portals: walk off one edge and wrap out the opposite edge.
function generateMaze(cellCols, cellRows, loopChance, tunnelRow, tunnelCol) {
  const width = cellCols * 2 + 1;
  const height = cellRows * 2 + 1;
  const grid = Array.from({ length: height }, () => Array(width).fill('#'));
  const visited = Array.from({ length: cellRows }, () => Array(cellCols).fill(false));

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // iterative DFS to avoid recursion-depth issues on large grids
  function carve(startCx, startCy) {
    const stack = [[startCx, startCy]];
    visited[startCy][startCx] = true;
    grid[startCy * 2 + 1][startCx * 2 + 1] = '.';
    while (stack.length) {
      const [cx, cy] = stack[stack.length - 1];
      const dirs = shuffle([[0, -1], [0, 1], [-1, 0], [1, 0]]);
      let carved = false;
      for (const [dx, dy] of dirs) {
        const nx = cx + dx, ny = cy + dy;
        if (nx >= 0 && nx < cellCols && ny >= 0 && ny < cellRows && !visited[ny][nx]) {
          visited[ny][nx] = true;
          grid[cy * 2 + 1 + dy][cx * 2 + 1 + dx] = '.';
          grid[ny * 2 + 1][nx * 2 + 1] = '.';
          stack.push([nx, ny]);
          carved = true;
          break;
        }
      }
      if (!carved) stack.pop();
    }
  }
  carve(0, 0);

  // knock down extra interior walls to create loops/open rooms (Pacman feel)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (grid[y][x] !== '#') continue;
      const betweenCells = (x % 2 === 0 && y % 2 === 1) || (x % 2 === 1 && y % 2 === 0);
      if (betweenCells && Math.random() < loopChance) grid[y][x] = '.';
    }
  }

  // carve the two straight portal lanes all the way across
  for (let x = 0; x < width; x++) grid[tunnelRow][x] = '.';
  for (let y = 0; y < height; y++) grid[y][tunnelCol] = '.';

  return grid.map(row => row.join(''));
}

// Level 1 is a small, simple ward; the maze grows bigger and mazier
// (fewer loop-cuts = more corridor-like) up through SIZE_GROWTH_LEVELS.
const CELL_COLS_MIN = 8, CELL_ROWS_MIN = 7;
const CELL_COLS_MAX = 20, CELL_ROWS_MAX = 17;
const SIZE_GROWTH_LEVELS = 8;

function mazeDimsForLevel(lvl) {
  const t = Math.min(Math.max((lvl - 1) / (SIZE_GROWTH_LEVELS - 1), 0), 1);
  return {
    cellCols: Math.round(CELL_COLS_MIN + (CELL_COLS_MAX - CELL_COLS_MIN) * t),
    cellRows: Math.round(CELL_ROWS_MIN + (CELL_ROWS_MAX - CELL_ROWS_MIN) * t),
    loopChance: 0.28 - 0.15 * t, // more open/simple early, more maze-like later
  };
}

let level = 1;
let CELL_COLS, CELL_ROWS, ROWS, COLS, TUNNEL_ROW, TUNNEL_COL, MAZE;

function isWall(col, row) {
  if (row === TUNNEL_ROW && (col < 0 || col >= COLS)) return false; // side portal
  if (col === TUNNEL_COL && (row < 0 || row >= ROWS)) return false; // top/bottom portal
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return true; // solid border elsewhere
  return MAZE[row][col] === '#';
}

// --- Canvas sizing (the maze grows with the level, and the canvas fills the
// available browser window, staying crisp and re-fitting on window resize) ---
const canvas = document.getElementById('game');
const DPR = Math.min(window.devicePixelRatio || 1, 3);
const ctx = canvas.getContext('2d');
let logicalW, logicalH; // the maze's own coordinate space (what drawing code uses)

// Fit the canvas to whatever room is left in the browser window (minus the
// title/HUD above it), scaling the backing buffer by DPR so it stays sharp.
function layoutCanvas() {
  const h1 = document.querySelector('#wrap h1');
  const hud = document.getElementById('hud');
  const reserved = (h1 ? h1.offsetHeight : 40) + (hud ? hud.offsetHeight : 30) + 48;
  const availW = window.innerWidth * 0.97;
  const availH = Math.max(200, window.innerHeight - reserved);
  const aspect = logicalW / logicalH;

  let dispW = availW;
  let dispH = dispW / aspect;
  if (dispH > availH) {
    dispH = availH;
    dispW = dispH * aspect;
  }

  canvas.style.width = dispW + 'px';
  canvas.style.height = dispH + 'px';

  const scale = (dispW * DPR) / logicalW;
  canvas.width = Math.round(logicalW * scale);
  canvas.height = Math.round(logicalH * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
}

function resizeCanvas() {
  logicalW = COLS * TILE;
  logicalH = ROWS * TILE;
  layoutCanvas();
}

let resizeRaf = null;
window.addEventListener('resize', () => {
  if (resizeRaf || !logicalW) return;
  resizeRaf = requestAnimationFrame(() => {
    resizeRaf = null;
    layoutCanvas();
  });
});

// --- Sound (WebAudio synth, no asset files) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function beep({ freq = 440, duration = 0.08, type = 'square', gain = 0.08, slideTo = null } = {}) {
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, audioCtx.currentTime + duration);
  g.gain.setValueAtTime(gain, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.connect(g).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

const sfx = {
  catch: () => {
    beep({ freq: 300, duration: 0.12, type: 'sawtooth', gain: 0.1, slideTo: 700 });
    setTimeout(() => beep({ freq: 900, duration: 0.08, type: 'square', gain: 0.07 }), 60);
  },
  spawn: () => beep({ freq: 200, duration: 0.15, type: 'triangle', gain: 0.06, slideTo: 120 }),
  guardAlert: () => beep({ freq: 150, duration: 0.2, type: 'sawtooth', gain: 0.07, slideTo: 90 }),
  hit: () => {
    beep({ freq: 200, duration: 0.25, type: 'sawtooth', gain: 0.12, slideTo: 60 });
    setTimeout(() => beep({ freq: 140, duration: 0.2, type: 'square', gain: 0.1 }), 100);
  },
  gameOver: () => {
    [400, 350, 300, 220, 150].forEach((f, i) => setTimeout(() => beep({ freq: f, duration: 0.2, type: 'sawtooth', gain: 0.08 }), i * 140));
  },
  levelUp: () => {
    [400, 500, 600, 700, 900].forEach((f, i) => setTimeout(() => beep({ freq: f, duration: 0.12, type: 'square', gain: 0.08 }), i * 90));
  },
};

const DIRS = {
  ArrowUp: [0, -1], w: [0, -1], W: [0, -1],
  ArrowDown: [0, 1], s: [0, 1], S: [0, 1],
  ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0],
  ArrowRight: [1, 0], d: [1, 0], D: [1, 0],
};

function nearestFloorTile(targetCol, targetRow) {
  let best = null, bestDist = Infinity;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (isWall(c, r)) continue;
      const d = Math.hypot(c - targetCol, r - targetRow);
      if (d < bestDist) { bestDist = d; best = { col: c, row: r }; }
    }
  }
  return best;
}

let playerStart, nurseSpawn, guardSpawn, floorTiles;

function regenerateMaze() {
  const dims = mazeDimsForLevel(level);
  CELL_COLS = dims.cellCols;
  CELL_ROWS = dims.cellRows;
  ROWS = CELL_ROWS * 2 + 1;
  COLS = CELL_COLS * 2 + 1;
  TUNNEL_ROW = 2 * Math.floor(CELL_ROWS / 2) + 1;
  TUNNEL_COL = 2 * Math.floor(CELL_COLS / 2) + 1;
  MAZE = generateMaze(CELL_COLS, CELL_ROWS, dims.loopChance, TUNNEL_ROW, TUNNEL_COL);
  resizeCanvas();
  playerStart = nearestFloorTile(1, ROWS - 2);
  nurseSpawn = nearestFloorTile(Math.floor(COLS / 2), Math.floor(ROWS / 2));
  guardSpawn = nearestFloorTile(COLS - 2, 1);
  floorTiles = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!isWall(c, r)) floorTiles.push({ col: c, row: r });
    }
  }
}
regenerateMaze();

class Entity {
  constructor(col, row) {
    this.col = col;
    this.row = row;
    this.dir = [0, 0];
    this.nextDir = [0, 0];
    this.moveT = 0;
  }
  canMove(dx, dy) {
    const nc = this.col + dx, nr = this.row + dy;
    return !isWall(nc, nr);
  }
  wrap() {
    if (this.col < 0) this.col = COLS - 1;
    if (this.col >= COLS) this.col = 0;
    if (this.row < 0) this.row = ROWS - 1;
    if (this.row >= ROWS) this.row = 0;
  }
}

class Player extends Entity {
  step() {
    if (this.nextDir[0] || this.nextDir[1]) {
      if (this.canMove(this.nextDir[0], this.nextDir[1])) this.dir = this.nextDir;
    }
    if (this.canMove(this.dir[0], this.dir[1])) {
      this.col += this.dir[0];
      this.row += this.dir[1];
      this.wrap();
    }
  }
}

const SCRUB_COLORS = ['#ff7fb0', '#7fb0ff', '#a3e07f', '#ffd27f', '#c98fff', '#7fe0d8'];
const HAIR_COLORS = ['#3a2317', '#1a1a1a', '#8a5a2b', '#d4b483', '#b03040', '#555'];

class Nurse extends Entity {
  constructor(col, row, speed) {
    super(col, row);
    this.speed = speed; // steps skipped (higher = slower)
    this.tick = 0;
    this.dir = randomDir();
    this.scrubColor = SCRUB_COLORS[Math.floor(Math.random() * SCRUB_COLORS.length)];
    this.hairColor = HAIR_COLORS[Math.floor(Math.random() * HAIR_COLORS.length)];
    this.bob = Math.random() * Math.PI * 2; // idle animation phase
  }
  step(target) {
    this.tick++;
    if (this.tick % this.speed !== 0) return;
    const atIntersection = countOpenDirs(this.col, this.row) > 2 || (this.dir[0] === 0 && this.dir[1] === 0);
    if (atIntersection || !this.canMove(this.dir[0], this.dir[1])) {
      this.dir = chooseFleeDir(this, target);
    }
    if (this.canMove(this.dir[0], this.dir[1])) {
      this.col += this.dir[0];
      this.row += this.dir[1];
      this.wrap();
    }
  }
}

function countOpenDirs(col, row) {
  let n = 0;
  for (const k of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
    const [dx, dy] = DIRS[k];
    if (!isWall(col + dx, row + dy)) n++;
  }
  return n;
}

function randomDir() {
  const opts = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  return opts[Math.floor(Math.random() * opts.length)];
}

// Nurses flee from player: pick open direction maximizing distance from target, with randomness
function chooseFleeDir(entity, target) {
  const opts = [[0, -1], [0, 1], [-1, 0], [1, 0]].filter(([dx, dy]) => {
    if (dx === -entity.dir[0] && dy === -entity.dir[1]) return false; // avoid reversing unless forced
    return !isWall(entity.col + dx, entity.row + dy);
  });
  const candidates = opts.length ? opts : [[0, -1], [0, 1], [-1, 0], [1, 0]].filter(
    ([dx, dy]) => !isWall(entity.col + dx, entity.row + dy)
  );
  if (!candidates.length) return entity.dir;
  if (Math.random() < 0.25) return candidates[Math.floor(Math.random() * candidates.length)];
  let best = candidates[0], bestDist = -Infinity;
  for (const [dx, dy] of candidates) {
    const nc = entity.col + dx, nr = entity.row + dy;
    const dist = Math.hypot(nc - target.col, nr - target.row);
    if (dist > bestDist) { bestDist = dist; best = [dx, dy]; }
  }
  return best;
}

// Guards chase the player: pick open direction minimizing distance to target.
function chooseChaseDir(entity, target) {
  const opts = [[0, -1], [0, 1], [-1, 0], [1, 0]].filter(([dx, dy]) => {
    if (dx === -entity.dir[0] && dy === -entity.dir[1]) return false;
    return !isWall(entity.col + dx, entity.row + dy);
  });
  const candidates = opts.length ? opts : [[0, -1], [0, 1], [-1, 0], [1, 0]].filter(
    ([dx, dy]) => !isWall(entity.col + dx, entity.row + dy)
  );
  if (!candidates.length) return entity.dir;
  if (Math.random() < 0.1) return candidates[Math.floor(Math.random() * candidates.length)];
  let best = candidates[0], bestDist = Infinity;
  for (const [dx, dy] of candidates) {
    const nc = entity.col + dx, nr = entity.row + dy;
    const dist = Math.hypot(nc - target.col, nr - target.row);
    if (dist < bestDist) { bestDist = dist; best = [dx, dy]; }
  }
  return best;
}

class Guard extends Entity {
  constructor(col, row, speed) {
    super(col, row);
    this.speed = speed;
    this.tick = 0;
    this.dir = randomDir();
    this.skinTone = ['#e8b98f', '#c68a5f', '#8a5a3a'][Math.floor(Math.random() * 3)];
  }
  step(target) {
    this.tick++;
    if (this.tick % this.speed !== 0) return;
    const atIntersection = countOpenDirs(this.col, this.row) > 2 || (this.dir[0] === 0 && this.dir[1] === 0);
    if (atIntersection || !this.canMove(this.dir[0], this.dir[1])) {
      this.dir = chooseChaseDir(this, target);
    }
    if (this.canMove(this.dir[0], this.dir[1])) {
      this.col += this.dir[0];
      this.row += this.dir[1];
      this.wrap();
    }
  }
}

// --- Game state ---
let player, nurses, guards, score, caught, lives, running, gameOver, invulnTicks, shakeTicks;

function resetGame() {
  guards = [];
  score = 0;
  caught = 0;
  lives = 3;
  level = 1;
  invulnTicks = 0;
  shakeTicks = 0;
  running = true;
  gameOver = false;
  startLevel();
  updateHud();
}

const MAX_NURSES_PER_LEVEL = 20;

// Level 1 is a gentle intro (2 nurses); every level after grows the ward's
// population, with a little randomness so it's not perfectly predictable.
function nurseCountForLevel(lvl) {
  if (lvl === 1) return 2;
  const base = 2 + (lvl - 1) * 2;
  const variance = Math.floor(Math.random() * 3) - 1; // -1, 0, or +1
  return Math.max(3, Math.min(base + variance, MAX_NURSES_PER_LEVEL));
}

function startLevel() {
  regenerateMaze();

  if (!player) player = new Player(playerStart.col, playerStart.row);
  else {
    player.col = playerStart.col;
    player.row = playerStart.row;
    player.dir = [0, 0];
    player.nextDir = [0, 0];
  }

  // old guard positions may now be inside walls in the regenerated maze
  for (const g of guards) {
    const tile = pickFarTile(playerStart.col, playerStart.row);
    g.col = tile.col;
    g.row = tile.row;
    g.dir = randomDir();
  }

  // one security guard joins per level — level 1 starts with none
  const desiredGuards = level - 1;
  const guardsBefore = guards.length;
  while (guards.length < desiredGuards) {
    const tile = pickFarTile(playerStart.col, playerStart.row);
    const speed = Math.max(4, 7 - Math.floor((level - 1) / 2));
    guards.push(new Guard(tile.col, tile.row, speed));
  }
  if (guards.length > guardsBefore) sfx.guardAlert();

  const nurseTarget = nurseCountForLevel(level);
  nurses = [];
  const usedTiles = [];
  for (let i = 0; i < nurseTarget; i++) {
    let tile;
    let tries = 0;
    do {
      tile = randomFloorTile();
      tries++;
    } while (
      tries < 20 &&
      (Math.hypot(tile.col - player.col, tile.row - player.row) < MIN_SPAWN_DIST ||
        usedTiles.some(t => Math.hypot(t.col - tile.col, t.row - tile.row) < 4))
    );
    usedTiles.push(tile);
    nurses.push(new Nurse(tile.col, tile.row, Math.max(3, 8 - Math.floor((level - 1) / 2))));
  }
}

function randomFloorTile() {
  return floorTiles[Math.floor(Math.random() * floorTiles.length)];
}

const MIN_SPAWN_DIST = 10; // tiles, keeps new nurses away from the catch spot

function pickFarTile(fromCol, fromRow) {
  const far = floorTiles.filter(t => Math.hypot(t.col - fromCol, t.row - fromRow) >= MIN_SPAWN_DIST);
  const pool = far.length ? far : floorTiles;
  return pool[Math.floor(Math.random() * pool.length)];
}

function updateHud() {
  document.getElementById('score').textContent = score;
  document.getElementById('nurseCount').textContent = nurses.length;
  document.getElementById('caught').textContent = caught;
  document.getElementById('guardCount').textContent = guards.length;
  document.getElementById('lives').textContent = lives;
  document.getElementById('level').textContent = level;
}

const CATCH_PHRASES = [
  'Nice!', 'Gotcha!', 'Score!', 'Nailed it!', 'Caught ya!',
  'Yes!', 'Boom!', 'Smooth!', 'Got one!', "Can't run!",
  'Ha!', 'Too slow!', 'Bagged one!', 'Sweet!',
];

const HIT_PHRASES = [
  'Ouch!', 'Busted!', 'Caught!', 'Yikes!', 'Uh oh!',
  'Back to bed!', 'Gotcha!', 'Not so fast!', 'Ow!',
];

let catchDialogTimer = null;
function showCatchDialog() {
  const el = document.getElementById('catchDialog');
  el.classList.remove('bad');
  el.textContent = CATCH_PHRASES[Math.floor(Math.random() * CATCH_PHRASES.length)];
  el.classList.add('show');
  clearTimeout(catchDialogTimer);
  catchDialogTimer = setTimeout(() => el.classList.remove('show'), 1000);
}

function showHitDialog() {
  const el = document.getElementById('catchDialog');
  el.classList.add('bad');
  el.textContent = HIT_PHRASES[Math.floor(Math.random() * HIT_PHRASES.length)];
  el.classList.add('show');
  clearTimeout(catchDialogTimer);
  catchDialogTimer = setTimeout(() => {
    el.classList.remove('show');
    el.classList.remove('bad');
  }, 1000);
}

let hitFlashTimer = null;
function flashHit() {
  const el = document.getElementById('hitFlash');
  el.classList.remove('flash-hit');
  void el.offsetWidth; // force reflow so the animation restarts on repeat hits
  el.classList.add('flash-hit');
  clearTimeout(hitFlashTimer);
  hitFlashTimer = setTimeout(() => el.classList.remove('flash-hit'), 400);
}

function showOverlay(title, msg, btnLabel) {
  document.getElementById('overlayTitle').textContent = title;
  document.getElementById('overlayMsg').innerHTML = msg;
  document.getElementById('startBtn').textContent = btnLabel;
  document.getElementById('overlay').classList.remove('hidden');
}
function hideOverlay() {
  document.getElementById('overlay').classList.add('hidden');
}

// --- Confetti (little hearts on catch, red shards on a guard hit) ---
const CONFETTI_COLORS = ['#ff6fa3', '#ff4d7d', '#ff8fb8', '#ffb3c9', '#e63e6d', '#ff2d6f'];
const HIT_COLORS = ['#ff3b3b', '#d80000', '#8a0000', '#555', '#222'];
let confetti = [];

function spawnConfetti(col, row) {
  const x = col * TILE + TILE / 2, y = row * TILE + TILE / 2;
  for (let i = 0; i < 28; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 140;
    confetti.push({
      kind: 'heart',
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 60,
      size: 3 + Math.random() * 3.5,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 10,
      life: 0.7 + Math.random() * 0.5,
      age: 0,
    });
  }
}

function spawnHitBurst(col, row) {
  const x = col * TILE + TILE / 2, y = row * TILE + TILE / 2;
  for (let i = 0; i < 20; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 100 + Math.random() * 220;
    confetti.push({
      kind: 'shard',
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 2 + Math.random() * 3,
      color: HIT_COLORS[Math.floor(Math.random() * HIT_COLORS.length)],
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 16,
      life: 0.35 + Math.random() * 0.3,
      age: 0,
    });
  }
}

function updateConfetti(dt) {
  for (const p of confetti) {
    p.age += dt;
    p.vy += 260 * dt; // gravity
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vrot * dt;
  }
  confetti = confetti.filter(p => p.age < p.life);
}

function drawHeart(s) {
  ctx.beginPath();
  ctx.moveTo(0, s * 0.3);
  ctx.bezierCurveTo(0, 0, -s, 0, -s, s * 0.3);
  ctx.bezierCurveTo(-s, s * 0.7, 0, s * 0.85, 0, s * 1.3);
  ctx.bezierCurveTo(0, s * 0.85, s, s * 0.7, s, s * 0.3);
  ctx.bezierCurveTo(s, 0, 0, 0, 0, s * 0.3);
  ctx.closePath();
  ctx.fill();
}

function renderConfetti() {
  for (const p of confetti) {
    const t = p.age / p.life;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - t);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    if (p.kind === 'shard') {
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.6);
    } else {
      drawHeart(p.size);
    }
    ctx.restore();
  }
}

// --- Input ---
window.addEventListener('keydown', (e) => {
  if (DIRS[e.key]) {
    player.nextDir = DIRS[e.key];
    e.preventDefault();
  }
});

document.getElementById('startBtn').addEventListener('click', () => {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  resetGame();
  confetti = [];
  lastFrameTs = 0;
  hideOverlay();
  requestAnimationFrame(loop);
});

// --- Loop ---
let lastTick = 0;
let lastFrameTs = 0;
const TICK_MS = 90;

function loop(ts) {
  if (!running) return;
  const dt = lastFrameTs ? Math.min((ts - lastFrameTs) / 1000, 0.05) : 0;
  lastFrameTs = ts;
  updateConfetti(dt);
  if (shakeTicks > 0) shakeTicks--;
  if (ts - lastTick >= TICK_MS) {
    lastTick = ts;
    update();
  }
  render();
  if (running) requestAnimationFrame(loop);
}

function update() {
  player.step();
  if (invulnTicks > 0) invulnTicks--;

  for (const n of nurses) n.step(player);
  for (const g of guards) g.step(player);

  const caughtNow = [];
  for (const n of nurses) {
    if (n.col === player.col && n.row === player.row) caughtNow.push(n);
  }
  if (caughtNow.length) {
    for (const n of caughtNow) {
      nurses.splice(nurses.indexOf(n), 1);
      score += 100;
      caught += 1;
    }
    sfx.catch();
    showCatchDialog();
    spawnConfetti(player.col, player.row);
    if (nurses.length === 0) {
      level += 1;
      sfx.levelUp();
      startLevel();
    }
  }

  if (invulnTicks === 0) {
    const guardHit = guards.some(g => g.col === player.col && g.row === player.row);
    if (guardHit) {
      lives -= 1;
      sfx.hit();
      flashHit();
      showHitDialog();
      spawnHitBurst(player.col, player.row);
      shakeTicks = 14;
      invulnTicks = 20; // brief grace period after being caught
      player.col = playerStart.col;
      player.row = playerStart.row;
      player.dir = [0, 0];
      player.nextDir = [0, 0];
      if (lives <= 0) {
        running = false;
        sfx.gameOver();
        updateHud();
        showOverlay('Caught!', `Security dragged you back to bed. Score: ${score} — Nurses caught: ${caught}.`, 'Try Again');
        return;
      }
    }
  }

  updateHud();
}

function render() {
  ctx.clearRect(0, 0, logicalW, logicalH);

  ctx.save();
  if (shakeTicks > 0) {
    const mag = (shakeTicks / 14) * 6;
    ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
  }

  ctx.fillStyle = '#123';
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (MAZE[r][c] === '#') {
        ctx.fillStyle = '#1c3a5e';
        ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
      }
    }
  }

  // portal markers at the four edge openings (side tunnels)
  const portalPulse = 0.5 + 0.5 * Math.sin(performance.now() / 250);
  ctx.fillStyle = `rgba(200, 143, 255, ${0.4 + portalPulse * 0.4})`;
  for (const [pc, pr] of [
    [0, TUNNEL_ROW], [COLS - 1, TUNNEL_ROW],
    [TUNNEL_COL, 0], [TUNNEL_COL, ROWS - 1],
  ]) {
    ctx.beginPath();
    ctx.arc(pc * TILE + TILE / 2, pr * TILE + TILE / 2, TILE / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // nurses
  const bobT = performance.now() / 200;
  for (const n of nurses) {
    const bobY = Math.sin(bobT + n.bob) * 1.2;
    const x = n.col * TILE + TILE / 2;
    const y = n.row * TILE + TILE / 2 + bobY;
    const r = TILE / 2 - 2;

    // legs/shoes
    ctx.fillStyle = '#fff';
    ctx.fillRect(x - 5, y + r - 3, 4, 4);
    ctx.fillRect(x + 1, y + r - 3, 4, 4);

    // body (scrubs)
    ctx.fillStyle = n.scrubColor;
    ctx.beginPath();
    ctx.arc(x, y, r, Math.PI, 0);
    ctx.lineTo(x + r, y + r - 1);
    ctx.lineTo(x - r, y + r - 1);
    ctx.closePath();
    ctx.fill();

    // face
    ctx.fillStyle = '#ffd9b3';
    ctx.beginPath();
    ctx.arc(x, y - 1, r - 5, 0, Math.PI * 2);
    ctx.fill();

    // hair (sides, under cap)
    ctx.fillStyle = n.hairColor;
    ctx.fillRect(x - r + 2, y - 5, 3, 6);
    ctx.fillRect(x + r - 5, y - 5, 3, 6);

    // eyes (look toward movement direction)
    const eox = n.dir[0] * 2, eoy = n.dir[1] * 2;
    ctx.fillStyle = '#1a1a2a';
    ctx.beginPath();
    ctx.arc(x - 3 + eox, y - 2 + eoy, 1.4, 0, Math.PI * 2);
    ctx.arc(x + 3 + eox, y - 2 + eoy, 1.4, 0, Math.PI * 2);
    ctx.fill();

    // rosy cheeks
    ctx.fillStyle = 'rgba(255,100,130,0.5)';
    ctx.beginPath();
    ctx.arc(x - 5, y + 1, 1.3, 0, Math.PI * 2);
    ctx.arc(x + 5, y + 1, 1.3, 0, Math.PI * 2);
    ctx.fill();

    // smile
    ctx.strokeStyle = '#a03';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y + 1, 2.5, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();

    // nurse cap with cross
    ctx.fillStyle = '#fff';
    ctx.fillRect(x - 6, y - TILE / 2, 12, 5);
    ctx.fillStyle = '#ff3d6e';
    ctx.fillRect(x - 1.2, y - TILE / 2 + 0.5, 2.4, 4);
    ctx.fillRect(x - 2.4, y - TILE / 2 + 1.7, 4.8, 1.6);

    // name badge
    ctx.fillStyle = '#fff';
    ctx.fillRect(x - 3, y + 2, 6, 3);
  }

  // security guards
  for (const g of guards) {
    const x = g.col * TILE + TILE / 2, y = g.row * TILE + TILE / 2;
    const r = TILE / 2 - 2;

    // boots
    ctx.fillStyle = '#111';
    ctx.fillRect(x - 5, y + r - 3, 4, 4);
    ctx.fillRect(x + 1, y + r - 3, 4, 4);

    // uniform body (navy)
    ctx.fillStyle = '#1c2b4a';
    ctx.beginPath();
    ctx.arc(x, y, r, Math.PI, 0);
    ctx.lineTo(x + r, y + r - 1);
    ctx.lineTo(x - r, y + r - 1);
    ctx.closePath();
    ctx.fill();

    // utility belt
    ctx.fillStyle = '#333';
    ctx.fillRect(x - r + 1, y + r - 6, r * 2 - 2, 2.5);

    // badge
    ctx.fillStyle = '#ffd447';
    ctx.beginPath();
    ctx.arc(x - 4, y + 2, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // face
    ctx.fillStyle = g.skinTone;
    ctx.beginPath();
    ctx.arc(x, y - 1, r - 5, 0, Math.PI * 2);
    ctx.fill();

    // mustache
    ctx.fillStyle = '#222';
    ctx.fillRect(x - 3, y + 0.5, 6, 1.5);

    // eyes (stern, toward movement direction)
    const eox = g.dir[0] * 2, eoy = g.dir[1] * 2;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(x - 3 + eox, y - 2 + eoy, 1.3, 0, Math.PI * 2);
    ctx.arc(x + 3 + eox, y - 2 + eoy, 1.3, 0, Math.PI * 2);
    ctx.fill();

    // guard cap with brim
    ctx.fillStyle = '#111';
    ctx.fillRect(x - 6, y - TILE / 2, 12, 4);
    ctx.fillRect(x - 7, y - TILE / 2 + 3, 14, 1.5);
    ctx.fillStyle = '#ffd447';
    ctx.fillRect(x - 1.5, y - TILE / 2 + 0.5, 3, 2);

    // baton
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + r - 1, y + 1);
    ctx.lineTo(x + r + 3, y + 7);
    ctx.stroke();
  }

  // player (patient, man in a hospital gown)
  if (invulnTicks > 0 && Math.floor(invulnTicks / 3) % 2 === 0) {
    // flicker while briefly invulnerable after being caught
  } else {
  const px = player.col * TILE + TILE / 2, py = player.row * TILE + TILE / 2;
  const pr = TILE / 2 - 2;
  const walking = (player.dir[0] || player.dir[1]) ? Math.sin(performance.now() / 90) : 0;

  // red pulse ring while briefly invulnerable, signalling the guard hit
  if (invulnTicks > 0) {
    ctx.strokeStyle = 'rgba(255, 40, 40, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, pr + 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  // bare feet / legs (visible through open-back gown)
  ctx.fillStyle = '#e8b98f';
  ctx.fillRect(px - 5, py + pr - 4 + walking, 3, 5);
  ctx.fillRect(px + 2, py + pr - 4 - walking, 3, 5);

  // gown body (pale teal, tied back, open at back)
  ctx.fillStyle = '#7fe7d0';
  ctx.beginPath();
  ctx.arc(px, py, pr, Math.PI, 0);
  ctx.lineTo(px + pr, py + pr - 1);
  ctx.lineTo(px - pr, py + pr - 1);
  ctx.closePath();
  ctx.fill();

  // gown ties at the back
  ctx.strokeStyle = '#4fbfa8';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px, py - 1);
  ctx.lineTo(px, py + pr - 2);
  ctx.stroke();

  // arms
  ctx.fillStyle = '#e8b98f';
  const armSwing = player.dir[0] * 2 + player.dir[1] * 1;
  ctx.beginPath();
  ctx.arc(px - pr + 2 + armSwing, py + 2, 2, 0, Math.PI * 2);
  ctx.arc(px + pr - 2 - armSwing, py + 2, 2, 0, Math.PI * 2);
  ctx.fill();

  // head
  ctx.fillStyle = '#e8b98f';
  ctx.beginPath();
  ctx.arc(px, py - 2, pr - 5, 0, Math.PI * 2);
  ctx.fill();

  // short receding hair (male patient)
  ctx.fillStyle = '#5a4636';
  ctx.beginPath();
  ctx.arc(px, py - pr + 3, pr - 5, Math.PI, 0);
  ctx.fill();

  // stubble shadow
  ctx.fillStyle = 'rgba(90,70,54,0.25)';
  ctx.beginPath();
  ctx.arc(px, py + 1, pr - 6, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.fill();

  // eyes (look toward movement direction)
  const eyeOffX = player.dir[0] * 3, eyeOffY = player.dir[1] * 3;
  ctx.fillStyle = '#1a1a2a';
  ctx.beginPath();
  ctx.arc(px + eyeOffX - 3, py + eyeOffY - 3, 1.6, 0, Math.PI * 2);
  ctx.arc(px + eyeOffX + 3, py + eyeOffY - 3, 1.6, 0, Math.PI * 2);
  ctx.fill();

  // eyebrows
  ctx.strokeStyle = '#5a4636';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px + eyeOffX - 4.5, py + eyeOffY - 5);
  ctx.lineTo(px + eyeOffX - 1.5, py + eyeOffY - 5);
  ctx.moveTo(px + eyeOffX + 1.5, py + eyeOffY - 5);
  ctx.lineTo(px + eyeOffX + 4.5, py + eyeOffY - 5);
  ctx.stroke();

  // hospital wristband
  ctx.fillStyle = '#fff';
  ctx.fillRect(px - pr + 1 + armSwing, py + 3, 3, 1.5);
  }

  renderConfetti();
  ctx.restore();
}

showOverlay(
  'Nurse Deflowerer',
  "Go hog wild — find those nurses!<br><br>" +
  "<b>Move:</b> Arrow keys or WASD.<br>" +
  "<b>Goal:</b> Catch every nurse on the ward to advance to the next level.<br>" +
  "<b>Portals:</b> Walk off any edge to tunnel out the opposite side.<br>" +
  "<b>Danger:</b> Security guards join the patrol starting level 2, one more each level after. They send you back to bed if they catch you — you've got 3 lives.",
  'Start'
);
