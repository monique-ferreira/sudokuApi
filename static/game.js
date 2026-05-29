"use strict";

// ─── State ───────────────────────────────────────────────────────────────────
let gameState  = null;
let selection  = null;   // { boardPos, row, col }
let numGames   = 2;
let difficulty = "medium";
let quantumMode = false;

// Timer
let timerInterval  = null;
let elapsedSeconds = 0;

// Drift
const DRIFT_INTERVAL = 90; // seconds
let driftSecondsLeft = DRIFT_INTERVAL;
let driftInterval    = null;

// ─── DOM refs ────────────────────────────────────────────────────────────────
const setupScreen     = document.getElementById("setup-screen");
const gameScreen      = document.getElementById("game-screen");
const boardsContainer = document.getElementById("boards-container");
const victoryOverlay  = document.getElementById("victory-overlay");
const gameoverOverlay = document.getElementById("gameover-overlay");
const driftOverlay    = document.getElementById("drift-overlay");
const paradoxBanner   = document.getElementById("paradox-banner");
const diffBadge       = document.getElementById("difficulty-badge");
const timerDisplay    = document.getElementById("timer-display");
const driftBadge      = document.getElementById("drift-badge");
const hintsLeft       = document.getElementById("hints-left");
const mistakePips     = document.getElementById("mistake-pips");

// ─── Setup controls ──────────────────────────────────────────────────────────
document.querySelectorAll(".count-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".count-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    numGames = parseInt(btn.dataset.count, 10);
    updateCountLabel();
  });
});

document.querySelectorAll(".diff-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".diff-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    difficulty = btn.dataset.diff;
  });
});

function updateCountLabel() {
  document.querySelectorAll(".game-count-labels span").forEach(span => {
    span.classList.toggle("visible", parseInt(span.dataset.count, 10) === numGames);
  });
}

// ─── Navigation ──────────────────────────────────────────────────────────────
document.getElementById("start-btn").addEventListener("click", startGame);

document.getElementById("new-game-btn").addEventListener("click", () => {
  stopTimer(); stopDrift();
  gameState = null; selection = null;
  setupScreen.classList.remove("hidden");
  gameScreen.classList.add("hidden");
  victoryOverlay.classList.add("hidden");
  gameoverOverlay.classList.add("hidden");
});

document.getElementById("play-again-btn").addEventListener("click", () => {
  victoryOverlay.classList.add("hidden");
  setupScreen.classList.remove("hidden");
  gameScreen.classList.add("hidden");
});

document.getElementById("retry-btn").addEventListener("click", () => {
  gameoverOverlay.classList.add("hidden");
  setupScreen.classList.remove("hidden");
  gameScreen.classList.add("hidden");
});

document.getElementById("reveal-btn").addEventListener("click", async () => {
  if (!gameState) return;
  const result = await apiCall(`/api/games/${gameState.id}/solve`, "POST");
  if (result) {
    gameState = result;
    gameoverOverlay.classList.add("hidden");
    renderBoards();
  }
});

document.getElementById("quantum-btn").addEventListener("click", () => {
  quantumMode = !quantumMode;
  document.getElementById("quantum-btn").classList.toggle("active", quantumMode);
  renderBoards();
});

// ─── Toolbar ─────────────────────────────────────────────────────────────────
document.getElementById("hint-btn").addEventListener("click", async () => {
  if (!gameState || gameState.game_over) return;
  if (gameState.hints_used >= gameState.max_hints) return;
  const boardPos = selection ? selection.boardPos : 0;
  const data = await apiCall(`/api/games/${gameState.id}/hint?game_index=${boardPos}`);
  if (!data) return;
  const result = await apiCall(`/api/games/${gameState.id}/move`, "POST", {
    game_index: boardPos, row: data.row, col: data.col, value: data.value,
  });
  if (result) {
    gameState = result;
    flashHint(boardPos, data.row, data.col);
    updateHUD();
    renderBoards();
    checkEndState();
  }
});

document.getElementById("erase-btn").addEventListener("click", eraseSelected);

// Numpad
document.querySelectorAll(".num-btn").forEach(btn => {
  btn.addEventListener("click", () => placeValue(parseInt(btn.dataset.val, 10)));
});

// Keyboard
document.addEventListener("keydown", e => {
  if (!gameState) return;
  const key = e.key;
  if (key >= "1" && key <= "9") { placeValue(parseInt(key, 10)); return; }
  if (key === "Backspace" || key === "Delete" || key === "0") { eraseSelected(); return; }
  if (!selection) return;
  const { boardPos, row, col } = selection;
  let nr = row, nc = col;
  if (key === "ArrowUp")    nr = Math.max(0, row - 1);
  if (key === "ArrowDown")  nr = Math.min(8, row + 1);
  if (key === "ArrowLeft")  nc = Math.max(0, col - 1);
  if (key === "ArrowRight") nc = Math.min(8, col + 1);
  if (nr !== row || nc !== col) { selection = { boardPos, row: nr, col: nc }; renderBoards(); }
});

// ─── Core actions ─────────────────────────────────────────────────────────────
async function startGame() {
  showLoading();
  const result = await apiCall("/api/games", "POST", { num_games: numGames, difficulty });
  hideLoading();
  if (!result) return;
  gameState = result;
  selection = null;
  elapsedSeconds = 0;
  quantumMode = false;
  document.getElementById("quantum-btn").classList.remove("active");

  setupScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");

  const labels = { easy: "Fácil", medium: "Médio", hard: "Brutal" };
  diffBadge.className = `badge badge-${difficulty}`;
  diffBadge.textContent = labels[difficulty];

  boardsContainer.className = `games-${numGames}`;
  renderBoards();
  updateHUD();
  startTimer();
  startDrift();
}

async function placeValue(value) {
  if (!selection || !gameState || gameState.game_over) return;
  const { boardPos, row, col } = selection;
  const prev = gameState;
  const result = await apiCall(`/api/games/${gameState.id}/move`, "POST", {
    game_index: boardPos, row, col, value,
  });
  if (result) {
    const wasMistake = result.mistakes > prev.mistakes;
    const wasParadox = result.paradox;
    gameState = result;
    updateHUD();
    renderBoards();
    if (wasMistake) animateMistake(boardPos, row, col);
    if (wasParadox) showParadox();
    else paradoxBanner.classList.add("hidden");
    checkEndState();
  }
}

async function eraseSelected() {
  if (!selection || !gameState || gameState.game_over) return;
  const { boardPos, row, col } = selection;
  const result = await apiCall(`/api/games/${gameState.id}/move`, "POST", {
    game_index: boardPos, row, col, value: null,
  });
  if (result) { gameState = result; renderBoards(); }
}

function checkEndState() {
  if (!gameState) return;
  if (gameState.game_over) {
    stopTimer(); stopDrift();
    setTimeout(() => gameoverOverlay.classList.remove("hidden"), 300);
    return;
  }
  if (gameState.completed) {
    stopTimer(); stopDrift();
    document.getElementById("v-time").textContent = formatTime(elapsedSeconds);
    document.getElementById("v-mistakes").textContent = `${gameState.mistakes}/3`;
    document.getElementById("v-hints").textContent = `${gameState.hints_used}`;
    setTimeout(() => victoryOverlay.classList.remove("hidden"), 400);
  }
}

// ─── Paradox ──────────────────────────────────────────────────────────────────
function showParadox() {
  paradoxBanner.classList.remove("hidden");
  // Force re-animation
  paradoxBanner.style.animation = "none";
  paradoxBanner.offsetHeight;
  paradoxBanner.style.animation = "";
}

// ─── HUD ─────────────────────────────────────────────────────────────────────
function updateHUD() {
  if (!gameState) return;
  mistakePips.innerHTML = "";
  for (let i = 0; i < gameState.max_mistakes; i++) {
    const pip = document.createElement("span");
    pip.className = "pip" + (i < gameState.mistakes ? " used" : "");
    if (i === gameState.mistakes - 1) pip.classList.add("last");
    mistakePips.appendChild(pip);
  }
  const remaining = gameState.max_hints - gameState.hints_used;
  hintsLeft.textContent = remaining;
  hintsLeft.className = "hint-count" + (remaining === 0 ? " zero" : "");
  document.getElementById("hint-btn").disabled = remaining === 0 || gameState.game_over;
}

// ─── Timer ───────────────────────────────────────────────────────────────────
function startTimer() {
  stopTimer();
  timerDisplay.classList.add("running");
  timerInterval = setInterval(() => {
    elapsedSeconds++;
    timerDisplay.textContent = formatTime(elapsedSeconds);
  }, 1000);
}
function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  timerDisplay.classList.remove("running");
}
function formatTime(s) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

// ─── Drift ───────────────────────────────────────────────────────────────────
function startDrift() {
  stopDrift();
  driftSecondsLeft = DRIFT_INTERVAL;
  updateDriftBadge();
  driftInterval = setInterval(async () => {
    driftSecondsLeft--;
    updateDriftBadge();
    if (driftSecondsLeft <= 0) {
      await triggerDrift();
      driftSecondsLeft = DRIFT_INTERVAL;
    }
  }, 1000);
}

function stopDrift() {
  if (driftInterval) { clearInterval(driftInterval); driftInterval = null; }
}

function updateDriftBadge() {
  const m = Math.floor(driftSecondsLeft / 60).toString().padStart(1, "0");
  const s = (driftSecondsLeft % 60).toString().padStart(2, "0");
  driftBadge.textContent = `⟳ ${m}:${s}`;
  driftBadge.classList.toggle("imminent", driftSecondsLeft <= 10);
}

async function triggerDrift() {
  if (!gameState || gameState.game_over || gameState.completed) return;

  // Show overlay briefly
  driftOverlay.classList.remove("hidden");

  // Animate boards out
  document.querySelectorAll(".board-wrapper").forEach(el => el.classList.add("drifting"));

  const result = await apiCall(`/api/games/${gameState.id}/drift`, "POST");
  if (result) gameState = result;

  setTimeout(() => {
    driftOverlay.classList.add("hidden");
    renderBoards();
  }, 600);
}

// ─── Rendering ───────────────────────────────────────────────────────────────
const QUAD_ARRANGEMENT = {
  UP:    [[0,1,2],[3,4,5],[6,7,8]],
  LEFT:  [[5,8,2],[7,1,4],[0,3,6]],
  DOWN:  [[4,7,3],[8,0,6],[2,5,1]],
  RIGHT: [[3,4,8],[2,7,0],[1,6,5]],
};
const CELL_ARRANGEMENT = {
  UP:    [[0,1,2],[3,4,5],[6,7,8]],
  LEFT:  [[2,5,8],[1,4,7],[0,3,6]],
  DOWN:  [[8,7,6],[5,4,3],[2,1,0]],
  RIGHT: [[6,3,0],[7,4,1],[8,5,2]],
};

function getCanonical(vr, vc, dir) {
  const vqr = Math.floor(vr/3), vqc = Math.floor(vc/3);
  const vir = vr%3, vic = vc%3;
  const qi = QUAD_ARRANGEMENT[dir][vqr][vqc];
  const ci = CELL_ARRANGEMENT[dir][vir][vic];
  return { cr: Math.floor(qi/3)*3 + Math.floor(ci/3), cc: (qi%3)*3 + (ci%3) };
}

function renderBoards() {
  if (!gameState) return;
  boardsContainer.innerHTML = "";

  gameState.games.forEach(game => {
    const wrapper = document.createElement("div");
    wrapper.className = "board-wrapper";

    const grid = document.createElement("div");
    grid.className = "sudoku-grid";
    grid.dataset.gi = game.game_index;

    // Build portal set from server data (visual positions for this board)
    const portalSet = new Set(
      (game.portal_positions || []).map(p => `${p.row},${p.col}`)
    );

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.dataset.r = r; cell.dataset.c = c;

        const locked = game.locked[r][c];
        const value  = game.grid[r][c];
        const isPortal = portalSet.has(`${r},${c}`);

        const isSelected = selection &&
          selection.boardPos === game.game_index &&
          selection.row === r && selection.col === c;

        if (locked) cell.classList.add("locked");
        else        cell.classList.add("player");
        if (isSelected) cell.classList.add("selected");
        if (isPortal)   cell.classList.add("portal");

        if (value !== null) {
          cell.textContent = value;
        } else if (quantumMode && !locked) {
          const cands = game.candidates?.[r]?.[c] ?? [];
          if (cands.length > 0) {
            cell.classList.add("quantum");
            cell.textContent = "";
            const cgrid = document.createElement("div");
            cgrid.className = "candidates-grid";
            for (let n = 1; n <= 9; n++) {
              const span = document.createElement("span");
              span.className = "cand" + (cands.includes(n) ? " present" : "");
              span.textContent = cands.includes(n) ? n : "";
              cgrid.appendChild(span);
            }
            cell.appendChild(cgrid);
          }
        }

        cell.addEventListener("click", () => {
          selection = { boardPos: game.game_index, row: r, col: c };
          renderBoards();
        });

        grid.appendChild(cell);
      }
    }
    wrapper.appendChild(grid);
    boardsContainer.appendChild(wrapper);
  });
}

function animateMistake(boardPos, row, col) {
  const el = document.querySelector(
    `.sudoku-grid[data-gi="${boardPos}"] .cell[data-r="${row}"][data-c="${col}"]`
  );
  if (!el) return;
  el.classList.add("shake");
  el.addEventListener("animationend", () => el.classList.remove("shake"), { once: true });
}

function flashHint(boardPos, row, col) {
  const el = document.querySelector(
    `.sudoku-grid[data-gi="${boardPos}"] .cell[data-r="${row}"][data-c="${col}"]`
  );
  if (!el) return;
  el.classList.add("hint-flash");
  el.addEventListener("animationend", () => el.classList.remove("hint-flash"), { once: true });
}

// ─── API ─────────────────────────────────────────────────────────────────────
async function apiCall(path, method = "GET", body = null) {
  try {
    const opts = { method, headers: { "Content-Type": "application/json" } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(path, opts);
    const data = await res.json();
    if (!res.ok) { console.warn(data.detail); return null; }
    return data;
  } catch { return null; }
}

// ─── Loading ─────────────────────────────────────────────────────────────────
let loadingEl = null;
function showLoading() {
  loadingEl = document.createElement("div");
  loadingEl.className = "loading-overlay";
  loadingEl.innerHTML = `<div class="spinner"></div><p>Gerando puzzle interdimensional...</p>`;
  document.body.appendChild(loadingEl);
}
function hideLoading() {
  if (loadingEl) { loadingEl.remove(); loadingEl = null; }
}
