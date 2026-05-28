/**
 * Sudoku Mega — client-side game logic
 *
 * State model:
 *   gameState: the full response from the API (id, num_games, directions, games[])
 *   selection: { gameIndex, row, col } | null  — currently selected visual cell
 */

"use strict";

// ─── State ──────────────────────────────────────────────────────────────────

let gameState = null;    // current API state
let selection = null;    // { gameIndex, row, col }
let numGames  = 1;
let difficulty = "medium";

// ─── DOM refs ────────────────────────────────────────────────────────────────

const setupScreen    = document.getElementById("setup-screen");
const gameScreen     = document.getElementById("game-screen");
const boardsContainer = document.getElementById("boards-container");
const statusBar      = document.getElementById("status-bar");
const victoryOverlay = document.getElementById("victory-overlay");
const diffBadge      = document.getElementById("difficulty-badge");
const gamesBadge     = document.getElementById("games-badge");

// ─── Setup controls ──────────────────────────────────────────────────────────

document.querySelectorAll(".count-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".count-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    numGames = parseInt(btn.dataset.count, 10);
    updateDirectionPreview();
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

function updateDirectionPreview() {
  const dirs = ["UP", "LEFT", "DOWN", "RIGHT"];
  document.querySelectorAll(".dir-card").forEach((card, i) => {
    card.classList.toggle("active", i < numGames);
  });
}

function updateCountLabel() {
  document.querySelectorAll(".game-count-labels span").forEach(span => {
    span.classList.toggle("visible", parseInt(span.dataset.count, 10) === numGames);
  });
}

updateCountLabel();

// ─── Start / navigation ──────────────────────────────────────────────────────

document.getElementById("start-btn").addEventListener("click", startGame);
document.getElementById("new-game-btn").addEventListener("click", () => {
  gameState = null;
  selection = null;
  setupScreen.classList.remove("hidden");
  gameScreen.classList.add("hidden");
  victoryOverlay.classList.add("hidden");
});
document.getElementById("play-again-btn").addEventListener("click", () => {
  victoryOverlay.classList.add("hidden");
  setupScreen.classList.remove("hidden");
  gameScreen.classList.add("hidden");
});

// ─── Toolbar actions ─────────────────────────────────────────────────────────

document.getElementById("hint-btn").addEventListener("click", async () => {
  if (!gameState) return;
  const gameIndex = selection ? selection.gameIndex : 0;
  const data = await apiCall(`/api/games/${gameState.id}/hint?game_index=${gameIndex}`);
  if (!data) return;
  // Flash the hinted cell in all games
  flashHint(data.canonical_row, data.canonical_col);
  // Apply the hint value via move
  const result = await apiCall(`/api/games/${gameState.id}/move`, "POST", {
    game_index: 0,   // always use canonical UP coords to identify cell
    row: data.canonical_row,
    col: data.canonical_col,
    value: data.value,
  });
  if (result) {
    gameState = result;
    renderBoards();
    setStatus(`Dica: valor ${data.value} adicionado`, "info");
    checkCompletion();
  }
});

document.getElementById("erase-btn").addEventListener("click", async () => {
  if (!selection || !gameState) return;
  const { gameIndex, row, col } = selection;
  const result = await apiCall(`/api/games/${gameState.id}/move`, "POST", {
    game_index: gameIndex, row, col, value: null,
  });
  if (result) {
    gameState = result;
    renderBoards();
  }
});

document.getElementById("solve-btn").addEventListener("click", async () => {
  if (!gameState) return;
  if (!confirm("Revelar a solução completa?")) return;
  const result = await apiCall(`/api/games/${gameState.id}/solve`, "POST");
  if (result) {
    gameState = result;
    selection = null;
    renderBoards();
    setStatus("Solução revelada!", "success");
  }
});

// Numpad
document.querySelectorAll(".num-btn").forEach(btn => {
  btn.addEventListener("click", () => placeValue(parseInt(btn.dataset.val, 10)));
});

// Keyboard
document.addEventListener("keydown", e => {
  if (!gameState) return;
  const key = e.key;
  if (key >= "1" && key <= "9") { placeValue(parseInt(key, 10)); return; }
  if (key === "Backspace" || key === "Delete" || key === "0") {
    eraseSelected(); return;
  }
  // Arrow navigation
  if (!selection) return;
  const { gameIndex, row, col } = selection;
  let nr = row, nc = col;
  if (key === "ArrowUp")    nr = Math.max(0, row - 1);
  if (key === "ArrowDown")  nr = Math.min(8, row + 1);
  if (key === "ArrowLeft")  nc = Math.max(0, col - 1);
  if (key === "ArrowRight") nc = Math.min(8, col + 1);
  if (nr !== row || nc !== col) {
    selection = { gameIndex, row: nr, col: nc };
    renderBoards();
  }
});

// ─── Core actions ────────────────────────────────────────────────────────────

async function startGame() {
  showLoading();
  const result = await apiCall("/api/games", "POST", { num_games: numGames, difficulty });
  hideLoading();
  if (!result) return;
  gameState = result;
  selection = null;
  setupScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");
  diffBadge.className = `badge badge-${difficulty}`;
  diffBadge.textContent = { easy: "Fácil", medium: "Médio", hard: "Difícil" }[difficulty];
  gamesBadge.className = "badge badge-games";
  gamesBadge.textContent = `${numGames} jogo${numGames > 1 ? "s" : ""}`;
  boardsContainer.className = `games-${numGames}`;
  renderBoards();
}

async function placeValue(value) {
  if (!selection || !gameState) return;
  const { gameIndex, row, col } = selection;
  const result = await apiCall(`/api/games/${gameState.id}/move`, "POST", {
    game_index: gameIndex, row, col, value,
  });
  if (result) {
    gameState = result;
    renderBoards();
    checkCompletion();
  }
}

async function eraseSelected() {
  if (!selection || !gameState) return;
  const { gameIndex, row, col } = selection;
  const result = await apiCall(`/api/games/${gameState.id}/move`, "POST", {
    game_index: gameIndex, row, col, value: null,
  });
  if (result) {
    gameState = result;
    renderBoards();
  }
}

function checkCompletion() {
  if (gameState && gameState.completed) {
    setTimeout(() => victoryOverlay.classList.remove("hidden"), 400);
  }
}

// ─── Rendering ───────────────────────────────────────────────────────────────

/**
 * Given the currently selected visual cell, figure out which canonical cell
 * it corresponds to by looking at the UP (game 0) view mapping.
 * We do this via the pre-built grid structure: each cell stores data-cr data-cc.
 */
function getSelectedCanonical() {
  if (!selection) return null;
  // Find the cell element in the selected game
  const el = document.querySelector(
    `.sudoku-grid[data-game-index="${selection.gameIndex}"] .cell[data-row="${selection.row}"][data-col="${selection.col}"]`
  );
  if (!el) return null;
  return { cr: parseInt(el.dataset.cr, 10), cc: parseInt(el.dataset.cc, 10) };
}

function renderBoards() {
  if (!gameState) return;

  // Compute error canonical set for highlighting
  const errorSet = buildErrorCanonicalSet();
  // Compute canonical position of selected cell
  const selCan = getSelectedCanonical();

  boardsContainer.innerHTML = "";

  gameState.games.forEach(game => {
    const wrapper = document.createElement("div");
    wrapper.className = "board-wrapper";

    // Header
    const header = document.createElement("div");
    header.className = "board-header";
    const badge = document.createElement("span");
    badge.className = `dir-badge dir-badge-${game.direction}`;
    badge.textContent = game.direction;
    const title = document.createElement("span");
    title.className = "board-title";
    const dirTitles = { UP: "Padrão", LEFT: "Anti-horário", DOWN: "Invertido", RIGHT: "Horário" };
    title.textContent = dirTitles[game.direction] || "";
    header.appendChild(badge);
    header.appendChild(title);
    wrapper.appendChild(header);

    // Grid
    const grid = document.createElement("div");
    grid.className = `sudoku-grid dir-${game.direction}`;
    grid.dataset.gameIndex = game.game_index;

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.dataset.row = r;
        cell.dataset.col = c;

        // Store canonical coords as data attributes (we need from game view)
        // We derive canonical from the server's grid structure:
        // The cell's canonical position is determined by direction transform.
        // We already know the direction, so let's compute it client-side.
        const { cr, cc } = getCanonicalFromVisual(r, c, game.direction);
        cell.dataset.cr = cr;
        cell.dataset.cc = cc;

        const locked = game.locked[r][c];
        const value  = game.grid[r][c];
        const isError = errorSet.has(`${cr},${cc}`);
        const isSelected = selection &&
          selection.gameIndex === game.game_index &&
          selection.row === r && selection.col === c;
        const isRelated = selCan &&
          (cr === selCan.cr || cc === selCan.cc ||
           (Math.floor(cr / 3) === Math.floor(selCan.cr / 3) &&
            Math.floor(cc / 3) === Math.floor(selCan.cc / 3)));

        if (locked)      cell.classList.add("locked");
        else             cell.classList.add("player", `dir-${game.direction}`);
        if (isError)     cell.classList.add("error");
        if (isSelected)  cell.classList.add("selected");
        else if (isRelated && selCan) cell.classList.add("related");

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

function buildErrorCanonicalSet() {
  const set = new Set();
  if (!gameState) return set;
  // Use errors from game 0 (UP = canonical, no transformation)
  const upGame = gameState.games[0];
  if (!upGame) return set;
  for (const err of upGame.errors) {
    set.add(`${err.row},${err.col}`);
  }
  return set;
}

/**
 * Client-side direction transform: visual (vr, vc) → canonical (cr, cc).
 * Mirrors the Python logic in directions.py.
 */
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

function getCanonicalFromVisual(vr, vc, direction) {
  const vqr = Math.floor(vr / 3), vqc = Math.floor(vc / 3);
  const vir = vr % 3, vic = vc % 3;
  const quadIdx = QUAD_ARRANGEMENT[direction][vqr][vqc];
  const cellIdx = CELL_ARRANGEMENT[direction][vir][vic];
  const qgr = Math.floor(quadIdx / 3), qgc = quadIdx % 3;
  const cir = Math.floor(cellIdx / 3), cic = cellIdx % 3;
  return { cr: qgr * 3 + cir, cc: qgc * 3 + cic };
}

function flashHint(cr, cc) {
  // Flash the cell corresponding to canonical (cr, cc) in all game boards
  document.querySelectorAll(`.cell[data-cr="${cr}"][data-cc="${cc}"]`).forEach(el => {
    el.classList.add("hint-flash");
    el.addEventListener("animationend", () => el.classList.remove("hint-flash"), { once: true });
  });
}

// ─── API ─────────────────────────────────────────────────────────────────────

async function apiCall(path, method = "GET", body = null) {
  try {
    const opts = {
      method,
      headers: { "Content-Type": "application/json" },
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(path, opts);
    const data = await res.json();
    if (!res.ok) {
      setStatus(data.detail || "Erro desconhecido", "error");
      return null;
    }
    clearStatus();
    return data;
  } catch (err) {
    setStatus("Erro de conexão com o servidor", "error");
    return null;
  }
}

// ─── UI helpers ──────────────────────────────────────────────────────────────

function setStatus(msg, type = "") {
  statusBar.textContent = msg;
  statusBar.className = type;
}
function clearStatus() { statusBar.textContent = ""; statusBar.className = ""; }

let loadingEl = null;
function showLoading() {
  loadingEl = document.createElement("div");
  loadingEl.className = "loading-overlay";
  loadingEl.innerHTML = `<div class="spinner"></div>`;
  document.body.appendChild(loadingEl);
}
function hideLoading() {
  if (loadingEl) { loadingEl.remove(); loadingEl = null; }
}
