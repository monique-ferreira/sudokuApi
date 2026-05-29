"""Game session state management for Sudoku Mega — interdimensional edition."""

import uuid
from copy import deepcopy

from app.sudoku.directions import (
    DIRECTIONS,
    canonical_grid_to_visual,
    canonical_to_visual,
    visual_to_canonical,
)
from app.sudoku.generator import generate_interdimensional
from app.sudoku.solver import get_candidates, validate_grid

MAX_MISTAKES = 3
MAX_HINTS = 3
PORTAL_POSITIONS: tuple[tuple[int, int], ...] = tuple((i, i) for i in range(9))


class DimGrid:
    def __init__(self, direction: str, puzzle: list[list[int | None]], solution: list[list[int]]):
        self.direction = direction
        self.solution: list[list[int]] = solution
        self.locked: list[list[bool]] = [
            [puzzle[r][c] is not None for c in range(9)] for r in range(9)
        ]
        self.canonical: list[list[int | None]] = deepcopy(puzzle)


class MegaSession:
    def __init__(self, num_games: int, difficulty: str):
        if not 2 <= num_games <= 4:
            raise ValueError("num_games must be between 2 and 4")

        self.id = str(uuid.uuid4())
        self.num_games = num_games
        self.difficulty = difficulty
        self.portal_set = set(PORTAL_POSITIONS)

        results = generate_interdimensional(num_games, difficulty)
        self.grids: list[DimGrid] = [
            DimGrid(DIRECTIONS[i], puzzle, solution)
            for i, (puzzle, solution) in enumerate(results)
        ]

        # Each board position has an independent view direction that rotates on drift
        self.board_directions: list[str] = list(DIRECTIONS[:num_games])
        self.mistakes = 0
        self.hints_used = 0
        self.game_over = False
        self.paradox = False  # True when portal conflict detected

    # ------------------------------------------------------------------
    # Place
    # ------------------------------------------------------------------

    def place(self, board_pos: int, vr: int, vc: int, value: int | None) -> dict:
        if self.game_over:
            return {"ok": False, "error": "Game over"}
        if board_pos >= self.num_games:
            return {"ok": False, "error": "Invalid game index"}

        grid = self.grids[board_pos]
        direction = self.board_directions[board_pos]
        cr, cc = visual_to_canonical(vr, vc, direction)

        if grid.locked[cr][cc]:
            return {"ok": False, "error": "Cell is locked"}
        if value is not None and not (1 <= value <= 9):
            return {"ok": False, "error": "Value must be 1–9"}

        is_portal = (cr, cc) in self.portal_set

        # Portal propagation: apply same canonical position across all grids
        paradox_detected = False
        if is_portal and value is not None:
            for g in self.grids:
                expected = g.solution[cr][cc]
                if value != expected:
                    paradox_detected = True
                    break

        mistake_made = value is not None and value != grid.solution[cr][cc]
        if mistake_made:
            self.mistakes += 1
            if self.mistakes >= MAX_MISTAKES:
                self.game_over = True

        grid.canonical[cr][cc] = value

        # Propagate to other grids if portal cell
        if is_portal and value is not None and not paradox_detected:
            for i, g in enumerate(self.grids):
                if i != grid_idx:
                    if not g.locked[cr][cc]:
                        g.canonical[cr][cc] = value

        if paradox_detected:
            self.paradox = True
        else:
            self.paradox = False

        return {"ok": True, "mistake": mistake_made, "paradox": paradox_detected}

    # ------------------------------------------------------------------
    # Drift
    # ------------------------------------------------------------------

    def apply_drift(self) -> None:
        for i in range(self.num_games):
            current_idx = DIRECTIONS.index(self.board_directions[i])
            self.board_directions[i] = DIRECTIONS[(current_idx + 1) % 4]

    # ------------------------------------------------------------------
    # Views
    # ------------------------------------------------------------------

    def _get_view(self, board_pos: int) -> dict:
        grid = self.grids[board_pos]
        direction = self.board_directions[board_pos]

        vis_grid = canonical_grid_to_visual(grid.canonical, direction)
        vis_locked = canonical_grid_to_visual(grid.locked, direction)  # type: ignore

        # Compute candidates for unlocked empty cells
        candidates: list[list[list[int]]] = [
            [[] for _ in range(9)] for _ in range(9)
        ]
        for vr in range(9):
            for vc in range(9):
                if vis_grid[vr][vc] is None and not vis_locked[vr][vc]:
                    cr, cc = visual_to_canonical(vr, vc, direction)
                    cands = sorted(get_candidates(grid.canonical, cr, cc))
                    candidates[vr][vc] = cands

        # Portal positions in visual space
        portal_visual: list[dict] = []
        for (cr, cc) in PORTAL_POSITIONS:
            vr, vc = canonical_to_visual(cr, cc, direction)
            portal_visual.append({"row": vr, "col": vc})

        return {
            "game_index": board_pos,
            "grid_index": grid_idx,
            "direction": direction,
            "grid": vis_grid,
            "locked": vis_locked,
            "candidates": candidates,
            "portal_positions": portal_visual,
        }

    def is_complete(self) -> bool:
        if self.game_over:
            return False
        for grid in self.grids:
            for r in range(9):
                for c in range(9):
                    if grid.canonical[r][c] is None:
                        return False
            if len(validate_grid(grid.canonical)) != 0:
                return False
        return True

    # ------------------------------------------------------------------
    # Hint
    # ------------------------------------------------------------------

    def get_hint(self, board_pos: int = 0) -> dict | None:
        if self.hints_used >= MAX_HINTS or self.game_over:
            return None

        grid = self.grids[board_pos]
        direction = self.board_directions[board_pos]

        best_cell = None
        best_count = 10
        for vr in range(9):
            for vc in range(9):
                cr, cc = visual_to_canonical(vr, vc, direction)
                if grid.canonical[cr][cc] is not None or grid.locked[cr][cc]:
                    continue
                cands = get_candidates(grid.canonical, cr, cc)
                if 1 <= len(cands) < best_count:
                    best_count = len(cands)
                    best_cell = (vr, vc, cr, cc)

        if best_cell is None:
            return None

        self.hints_used += 1
        vr, vc, cr, cc = best_cell
        return {
            "game_index": board_pos,
            "row": vr,
            "col": vc,
            "value": grid.solution[cr][cc],
            "canonical_row": cr,
            "canonical_col": cc,
            "hints_remaining": MAX_HINTS - self.hints_used,
        }

    # ------------------------------------------------------------------
    # Reveal
    # ------------------------------------------------------------------

    def reveal_solution(self) -> None:
        for grid in self.grids:
            for r in range(9):
                for c in range(9):
                    grid.canonical[r][c] = grid.solution[r][c]
        self.game_over = False

    # ------------------------------------------------------------------
    # Serialise
    # ------------------------------------------------------------------

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "num_games": self.num_games,
            "difficulty": self.difficulty,
            "completed": self.is_complete(),
            "game_over": self.game_over,
            "paradox": self.paradox,
            "board_directions": self.board_directions,
            "mistakes": self.mistakes,
            "max_mistakes": MAX_MISTAKES,
            "hints_used": self.hints_used,
            "max_hints": MAX_HINTS,
            "games": [self._get_view(i) for i in range(self.num_games)],
        }


_sessions: dict[str, MegaSession] = {}


def create_session(num_games: int, difficulty: str) -> MegaSession:
    session = MegaSession(num_games, difficulty)
    _sessions[session.id] = session
    return session


def get_session(game_id: str) -> MegaSession | None:
    return _sessions.get(game_id)
