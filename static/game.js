"use strict";

// ─── State ───────────────────────────────────────────────────────────────────
let gameState  = null;
let selection  = null;   // { gameIndex, row, col }
let numGames   = 2;
let difficulty = "medium";

// Timer
let timerInterval = null;
let elapsedSeconds = 0;

// ─── DOM refs ────────────────────────────────────────────────────────────────
const setupScreen     = document.getElementById("setup-screen");
const gameScreen      = document.getElementById("game-screen");
const boardsContainer = document.getElementById("boards-container");
const victoryOverlay  = document.getElementById("victory-overlay");
const gameoverOverlay = document.getElementById("gameover-overlay");
const diffBadge       = document.getElementById("difficulty-badge");
const timerDisplay    = document.getElementById("timer-display");
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
  stopTimer();
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

// ─── Toolbar ─────────────────────────────────────────────────────────────────
document.getElementById("hint-btn").addEventListener("click", async () => {
  if (!gameState || gameState.game_over) return;
  if (gameState.hints_used >= gameState.max_hints) return;
  const gameIndex = selection ? selection.gameIndex : 0;
  const data = await apiCall(`/api/games/${gameState.id}/hint?game_index=${gameIndex}`);
  if (!data) return;
  const result = await apiCall(`/api/games/${gameState.id}/move`, "POST", {
    game_index: 0, row: data.canonical_row, col: data.canonical_col, value: data.value,
  });
  if (result) {
    gameState = result;
    flashHint(data.canonical_row, data.canonical_col);
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
  const { gameIndex, row, col } = selection;
  let nr = row, nc = col;
  if (key === "ArrowUp")    nr = Math.max(0, row - 1);
  if (key === "ArrowDown")  nr = Math.min(8, row + 1);
  if (key === "ArrowLeft")  nc = Math.max(0, col - 1);
  if (key === "ArrowRight") nc = Math.min(8, col + 1);
  if (nr !== row || nc !== col) { selection = { gameIndex, row: nr, col: nc }; renderBoards(); }
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

  setupScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");

  const labels = { easy: "Fácil", medium: "Médio", hard: "Brutal" };
  diffBadge.className = `badge badge-${difficulty}`;
  diffBadge.textContent = labels[difficulty];

  boardsContainer.className = `games-${numGames}`;
  renderBoards();
  updateHUD();
  startTimer();
}

async function placeValue(value) {
  if (!selection || !gameState || gameState.game_over) return;
  const { gameIndex, row, col } = selection;
  const prev = gameState;
  const result = await apiCall(`/api/games/${gameState.id}/move`, "POST", {
    game_index: gameIndex, row, col, value,
  });
  if (result) {
    const wasMistake = result.mistakes > prev.mistakes;
    gameState = result;
    updateHUD();
    renderBoards();
    if (wasMistake) animateMistake(gameIndex, row, col);
    checkEndState();
  }
}

async function eraseSelected() {
  if (!selection || !gameState || gameState.game_over) return;
  const { gameIndex, row, col } = selection;
  const result = await apiCall(`/api/games/${gameState.id}/move`, "POST", {
    game_index: gameIndex, row, col, value: null,
  });
  if (result) { gameState = result; renderBoards(); }
}

function checkEndState() {
  if (!gameState) return;
  if (gameState.game_over) {
    stopTimer();
    setTimeout(() => gameoverOverlay.classList.remove("hidden"), 300);
    return;
  }
  if (gameState.completed) {
    stopTimer();
    document.getElementById("v-time").textContent = formatTime(elapsedSeconds);
    document.getElementById("v-mistakes").textContent = `${gameState.mistakes}/3`;
    document.getElementById("v-hints").textContent = `${gameState.hints_used}`;
    setTimeout(() => victoryOverlay.classList.remove("hidden"), 400);
  }
}

// ─── HUD ─────────────────────────────────────────────────────────────────────
function updateHUD() {
  if (!gameState) return;
  // Mistake pips
  mistakePips.innerHTML = "";
  for (let i = 0; i < gameState.max_mistakes; i++) {
    const pip = document.createElement("span");
    pip.className = "pip" + (i < gameState.mistakes ? " used" : "");
    if (i === gameState.mistakes - 1) pip.classList.add("last");
    mistakePips.appendChild(pip);
  }
  // Hints remaining
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

function getSelectedCanonical() {
  if (!selection) return null;
  const el = document.querySelector(
    `.sudoku-grid[data-gi="${selection.gameIndex}"] .cell[data-r="${selection.row}"][data-c="${selection.col}"]`
  );
  if (!el) return null;
  return { cr: +el.dataset.cr, cc: +el.dataset.cc };
}

function renderBoards() {
  if (!gameState) return;
  const selCan = getSelectedCanonical();
  boardsContainer.innerHTML = "";

  gameState.games.forEach(game => {
    const wrapper = document.createElement("div");
    wrapper.className = "board-wrapper";

    const grid = document.createElement("div");
    grid.className = "sudoku-grid";
    grid.dataset.gi = game.game_index;

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const { cr, cc } = getCanonical(r, c, game.direction);
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.dataset.r = r; cell.dataset.c = c;
        cell.dataset.cr = cr; cell.dataset.cc = cc;

        const locked = game.locked[r][c];
        const value  = game.grid[r][c];

        const isSelected = selection &&
          selection.gameIndex === game.game_index &&
          selection.row === r && selection.col === c;

        if (locked) cell.classList.add("locked");
        else        cell.classList.add("player");

        if (isSelected) cell.classList.add("selected");

        if (value !== null) cell.textContent = value;

        cell.addEventListener("click", () => {
          selection = { gameIndex: game.game_index, row: r, col: c };
          renderBoards();
        });

        grid.appendChild(cell);
      }
    }
    wrapper.appendChild(grid);
    boardsContainer.appendChild(wrapper);
  });
}

function animateMistake(gameIndex, row, col) {
  const el = document.querySelector(
    `.sudoku-grid[data-gi="${gameIndex}"] .cell[data-r="${row}"][data-c="${col}"]`
  );
  if (!el) return;
  el.classList.add("shake");
  el.addEventListener("animationend", () => el.classList.remove("shake"), { once: true });
}

function flashHint(cr, cc) {
  document.querySelectorAll(`.cell[data-cr="${cr}"][data-cc="${cc}"]`).forEach(el => {
    el.classList.add("hint-flash");
    el.addEventListener("animationend", () => el.classList.remove("hint-flash"), { once: true });
  });
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
  loadingEl.innerHTML = `<div class="spinner"></div><p>Gerando puzzle...</p>`;
  document.body.appendChild(loadingEl);
}
function hideLoading() {
  if (loadingEl) { loadingEl.remove(); loadingEl = null; }
}
