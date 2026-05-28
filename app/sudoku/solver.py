"""Sudoku solver using backtracking with constraint propagation."""

import random
from copy import deepcopy


def is_valid_move(grid: list[list[int | None]], row: int, col: int, num: int) -> bool:
    """Check if placing num at (row, col) is valid in the given grid."""
    if num in grid[row]:
        return False
    if num in [grid[r][col] for r in range(9)]:
        return False
    qr, qc = (row // 3) * 3, (col // 3) * 3
    for r in range(qr, qr + 3):
        for c in range(qc, qc + 3):
            if grid[r][c] == num:
                return False
    return True


def get_candidates(grid: list[list[int | None]], row: int, col: int) -> set[int]:
    """Return the set of valid values for an empty cell."""
    if grid[row][col] is not None:
        return set()
    used = set()
    used.update(v for v in grid[row] if v is not None)
    used.update(grid[r][col] for r in range(9) if grid[r][col] is not None)
    qr, qc = (row // 3) * 3, (col // 3) * 3
    for r in range(qr, qr + 3):
        for c in range(qc, qc + 3):
            if grid[r][c] is not None:
                used.add(grid[r][c])
    return set(range(1, 10)) - used


def _find_mrv_cell(grid: list[list[int | None]]) -> tuple[int, int] | None:
    """Find the empty cell with the fewest candidates (MRV heuristic)."""
    best = None
    best_count = 10
    for r in range(9):
        for c in range(9):
            if grid[r][c] is None:
                cands = get_candidates(grid, r, c)
                if not cands:
                    return None  # contradiction
                if len(cands) < best_count:
                    best_count = len(cands)
                    best = (r, c)
    return best


def solve(
    grid: list[list[int | None]],
    randomize: bool = False,
    limit: int = 2,
) -> list[list[list[int]]]:
    """
    Find up to `limit` solutions for the given grid using backtracking.
    Returns a list of complete 9x9 grids.
    """
    solutions: list[list[list[int]]] = []
    work = deepcopy(grid)

    def backtrack() -> None:
        if len(solutions) >= limit:
            return
        cell = _find_mrv_cell(work)
        if cell is None:
            # Check if fully filled
            if all(work[r][c] is not None for r in range(9) for c in range(9)):
                solutions.append(deepcopy(work))
            return
        r, c = cell
        cands = list(get_candidates(work, r, c))
        if randomize:
            random.shuffle(cands)
        for num in cands:
            work[r][c] = num
            backtrack()
            if len(solutions) >= limit:
                return
            work[r][c] = None

    backtrack()
    return solutions


def has_unique_solution(grid: list[list[int | None]]) -> bool:
    return len(solve(grid, limit=2)) == 1


def solve_one(
    grid: list[list[int | None]], randomize: bool = False
) -> list[list[int]] | None:
    results = solve(grid, randomize=randomize, limit=1)
    return results[0] if results else None


def validate_grid(grid: list[list[int | None]]) -> list[tuple[int, int]]:
    """
    Return list of (row, col) positions that violate sudoku rules
    (duplicates in rows, columns, or boxes). Only checks filled cells.
    """
    errors: set[tuple[int, int]] = set()

    for r in range(9):
        seen: dict[int, int] = {}
        for c in range(9):
            v = grid[r][c]
            if v is not None:
                if v in seen:
                    errors.add((r, c))
                    errors.add((r, seen[v]))
                else:
                    seen[v] = c

    for c in range(9):
        seen = {}
        for r in range(9):
            v = grid[r][c]
            if v is not None:
                if v in seen:
                    errors.add((r, c))
                    errors.add((seen[v], c))
                else:
                    seen[v] = r

    for br in range(3):
        for bc in range(3):
            seen = {}
            for r in range(br * 3, br * 3 + 3):
                for c in range(bc * 3, bc * 3 + 3):
                    v = grid[r][c]
                    if v is not None:
                        if v in seen:
                            errors.add((r, c))
                            errors.add(seen[v])
                        else:
                            seen[v] = (r, c)

    return list(errors)
