"""Game session state management for Sudoku Mega."""

import uuid
from copy import deepcopy

from app.sudoku.directions import (
    DIRECTIONS,
    canonical_grid_to_visual,
    canonical_to_visual,
    visual_to_canonical,
)
from app.sudoku.generator import generate_puzzle
from app.sudoku.solver import get_candidates, solve_one, validate_grid


class GameSession:
    def __init__(self, num_games: int, difficulty: str):
        if not 1 <= num_games <= 4:
            raise ValueError("num_games must be between 1 and 4")

        self.id = str(uuid.uuid4())
        self.num_games = num_games
        self.difficulty = difficulty
        self.directions = DIRECTIONS[:num_games]

        puzzle, solution = generate_puzzle(difficulty)
        self.solution: list[list[int]] = solution
        self.locked: list[list[bool]] = [
            [puzzle[r][c] is not None for c in range(9)] for r in range(9)
        ]
        # Player's current canonical grid (None = empty, int = filled)
        self.canonical: list[list[int | None]] = deepcopy(puzzle)

    # ------------------------------------------------------------------
    # Moves
    # ------------------------------------------------------------------

    def place(self, game_index: int, vr: int, vc: int, value: int | None) -> dict:
        """Place or erase a value at a visual position in a specific game view."""
        if game_index >= self.num_games:
            return {"ok": False, "error": "Invalid game index"}
        direction = self.directions[game_index]
        cr, cc = visual_to_canonical(vr, vc, direction)
        if self.locked[cr][cc]:
            return {"ok": False, "error": "Cell is locked (part of the original puzzle)"}
        if value is not None and not (1 <= value <= 9):
            return {"ok": False, "error": "Value must be between 1 and 9"}
        self.canonical[cr][cc] = value
        return {"ok": True}

    # ------------------------------------------------------------------
    # Views
    # ------------------------------------------------------------------

    def get_game_view(self, game_index: int) -> dict:
        direction = self.directions[game_index]
        grid = canonical_grid_to_visual(self.canonical, direction)
        locked = canonical_grid_to_visual(self.locked, direction)  # type: ignore
        errors_can = validate_grid(self.canonical)
        errors_vis = []
        for cr, cc in errors_can:
            vr, vc = canonical_to_visual(cr, cc, direction)
            errors_vis.append({"row": vr, "col": vc})
        return {
            "game_index": game_index,
            "direction": direction,
            "grid": grid,
            "locked": locked,
            "errors": errors_vis,
        }

    def get_all_views(self) -> list[dict]:
        return [self.get_game_view(i) for i in range(self.num_games)]

    def is_complete(self) -> bool:
        for r in range(9):
            for c in range(9):
                if self.canonical[r][c] is None:
                    return False
        return len(validate_grid(self.canonical)) == 0

    # ------------------------------------------------------------------
    # Hint
    # ------------------------------------------------------------------

    def get_hint(self, game_index: int = 0) -> dict | None:
        """Return a hint: the best candidate cell (with least options) in the given game view."""
        direction = self.directions[game_index]
        best_cell = None
        best_val = None
        best_count = 10

        for vr in range(9):
            for vc in range(9):
                cr, cc = visual_to_canonical(vr, vc, direction)
                if self.canonical[cr][cc] is not None or self.locked[cr][cc]:
                    continue
                cands = get_candidates(self.canonical, cr, cc)
                if 1 <= len(cands) < best_count:
                    best_count = len(cands)
                    best_cell = (vr, vc, cr, cc)
                    best_val = min(cands)

        if best_cell is None:
            return None

        vr, vc, cr, cc = best_cell
        return {
            "game_index": game_index,
            "row": vr,
            "col": vc,
            "value": self.solution[cr][cc],
            "canonical_row": cr,
            "canonical_col": cc,
        }

    # ------------------------------------------------------------------
    # Solve / reveal
    # ------------------------------------------------------------------

    def reveal_solution(self) -> None:
        for r in range(9):
            for c in range(9):
                self.canonical[r][c] = self.solution[r][c]

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "num_games": self.num_games,
            "difficulty": self.difficulty,
            "directions": self.directions,
            "completed": self.is_complete(),
            "games": self.get_all_views(),
        }


# In-memory store (replaces with a DB in production)
_sessions: dict[str, GameSession] = {}


def create_session(num_games: int, difficulty: str) -> GameSession:
    session = GameSession(num_games, difficulty)
    _sessions[session.id] = session
    return session


def get_session(game_id: str) -> GameSession | None:
    return _sessions.get(game_id)
