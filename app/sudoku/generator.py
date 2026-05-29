"""Sudoku X puzzle generator (diagonals + standard constraints)."""

import random
from copy import deepcopy

from .solver import solve_one, has_unique_solution

# Fewer givens = harder. These push to the edge of unique solvability.
DIFFICULTY_REMOVALS = {
    "easy":   40,
    "medium": 52,
    "hard":   58,
}


def generate_full_grid() -> list[list[int]]:
    empty: list[list[int | None]] = [[None] * 9 for _ in range(9)]
    solution = solve_one(empty, randomize=True)
    if solution is None:
        raise RuntimeError("Failed to generate a full sudoku grid")
    return solution


def generate_puzzle(difficulty: str = "medium") -> tuple[
    list[list[int | None]], list[list[int]]
]:
    removals = DIFFICULTY_REMOVALS.get(difficulty, 52)
    solution = generate_full_grid()
    puzzle: list[list[int | None]] = deepcopy(solution)  # type: ignore

    cells = [(r, c) for r in range(9) for c in range(9)]
    random.shuffle(cells)

    removed = 0
    for r, c in cells:
        if removed >= removals:
            break
        backup = puzzle[r][c]
        puzzle[r][c] = None
        # Always enforce unique solution
        if not has_unique_solution(puzzle):
            puzzle[r][c] = backup
        else:
            removed += 1

    return puzzle, solution
