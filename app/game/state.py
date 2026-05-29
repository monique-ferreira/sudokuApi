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
from app.sudoku.solver import get_candidates, validate_grid

MAX_MISTAKES = 3
MAX_HINTS = 3


class GameSession:
    def __init__(self, num_games: int, difficulty: str):
        if not 2 <= num_games <= 4:
            raise ValueError("num_games must be between 2 and 4")

        self.id = str(uuid.uuid4())
        self.num_games = num_games
        self.difficulty = difficulty
        self.directions = DIRECTIONS[:num_games]

        puzzle, solution = generate_puzzle(difficulty)
        self.solution: list[list[int]] = solution
        self.locked: list[list[bool]] = [
            [puzzle[r][c] is not None for c in range(9)] for r in range(9)
        ]
        self.canonical: list[list[int | None]] = deepcopy(puzzle)

        self.mistakes = 0
        self.hints_used = 0
        self.game_over = False

    # ------------------------------------------------------------------
    # Moves
    # ------------------------------------------------------------------

    def place(self, game_index: int, vr: int, vc: int, value: int | None) -> dict:
        if self.game_over:
            return {"ok": False, "error": "Game over"}
        if game_index >= self.num_games:
            return {"ok": False, "error": "Invalid game index"}
        direction = self.directions[game_index]
        cr, cc = visual_to_canonical(vr, vc, direction)
        if self.locked[cr][cc]:
            return {"ok": False, "error": "Cell is locked"}
        if value is not None and not (1 <= value <= 9):
            return {"ok": False, "error": "Value must be 1–9"}

        mistake_made = False
        if value is not None and value != self.solution[cr][cc]:
            self.mistakes += 1
            mistake_made = True
            if self.mistakes >= MAX_MISTAKES:
                self.game_over = True
            # Still place the wrong value so the player can see the board jam up

        self.canonical[cr][cc] = value
        return {"ok": True, "mistake": mistake_made}

    # ------------------------------------------------------------------
    # Views
    # ------------------------------------------------------------------

    def get_game_view(self, game_index: int) -> dict:
        direction = self.directions[game_index]
        grid = canonical_grid_to_visual(self.canonical, direction)
        locked = canonical_grid_to_visual(self.locked, direction)  # type: ignore
        return {
            "game_index": game_index,
            "direction": direction,
            "grid": grid,
            "locked": locked,
        }

    def get_all_views(self) -> list[dict]:
        return [self.get_game_view(i) for i in range(self.num_games)]

    def is_complete(self) -> bool:
        if self.game_over:
            return False
        for r in range(9):
            for c in range(9):
                if self.canonical[r][c] is None:
                    return False
        return len(validate_grid(self.canonical)) == 0

    # ------------------------------------------------------------------
    # Hint
    # ------------------------------------------------------------------

    def get_hint(self, game_index: int = 0) -> dict | None:
        if self.hints_used >= MAX_HINTS or self.game_over:
            return None
        direction = self.directions[game_index]
        best_cell = None
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

        if best_cell is None:
            return None

        self.hints_used += 1
        vr, vc, cr, cc = best_cell
        return {
            "game_index": game_index,
            "row": vr,
            "col": vc,
            "value": self.solution[cr][cc],
            "canonical_row": cr,
            "canonical_col": cc,
            "hints_remaining": MAX_HINTS - self.hints_used,
        }

    # ------------------------------------------------------------------
    # Solve / reveal
    # ------------------------------------------------------------------

    def reveal_solution(self) -> None:
        for r in range(9):
            for c in range(9):
                self.canonical[r][c] = self.solution[r][c]
        self.game_over = False  # let them see the solution

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "num_games": self.num_games,
            "difficulty": self.difficulty,
            "directions": self.directions,
            "completed": self.is_complete(),
            "game_over": self.game_over,
            "mistakes": self.mistakes,
            "max_mistakes": MAX_MISTAKES,
            "hints_used": self.hints_used,
            "max_hints": MAX_HINTS,
            "games": self.get_all_views(),
        }


_sessions: dict[str, GameSession] = {}


def create_session(num_games: int, difficulty: str) -> GameSession:
    session = GameSession(num_games, difficulty)
    _sessions[session.id] = session
    return session


def get_session(game_id: str) -> GameSession | None:
    return _sessions.get(game_id)
