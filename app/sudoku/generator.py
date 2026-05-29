"""
Gerador interdimensional: múltiplos grids Sudoku X independentes
conectados por células-portal na diagonal principal.
"""

import random
from copy import deepcopy

from .solver import solve_one, has_unique_solution

# Posições canônicas compartilhadas entre TODOS os grids (portais dimensionais)
PORTAL_POSITIONS: tuple[tuple[int, int], ...] = tuple((i, i) for i in range(9))

DIFFICULTY_REMOVALS = {
    "easy":   40,
    "medium": 52,
    "hard":   58,
}


def generate_full_grid() -> list[list[int]]:
    empty: list[list[int | None]] = [[None] * 9 for _ in range(9)]
    solution = solve_one(empty, randomize=True)
    if solution is None:
        raise RuntimeError("Falha ao gerar grid base")
    return solution


def generate_interdimensional(
    num_grids: int, difficulty: str
) -> list[tuple[list[list[int | None]], list[list[int]]]]:
    """
    Gera num_grids grids independentes (Sudoku X) que compartilham
    os valores nas células-portal (diagonal principal).
    Retorna lista de (puzzle, solution) por grid.
    """
    portal_set = set(PORTAL_POSITIONS)
    shared_vals: dict[tuple[int, int], int] | None = None
    results = []

    for i in range(num_grids):
        seed: list[list[int | None]] = [[None] * 9 for _ in range(9)]
        if shared_vals is not None:
            for (r, c), v in shared_vals.items():
                seed[r][c] = v

        solution = solve_one(seed, randomize=True)
        if solution is None:
            raise RuntimeError(f"Falha ao gerar grid {i} com portais")

        if shared_vals is None:
            shared_vals = {(r, c): solution[r][c] for (r, c) in PORTAL_POSITIONS}

        puzzle = _make_puzzle(solution, difficulty, portal_set)
        results.append((puzzle, solution))

    return results


def _make_puzzle(
    solution: list[list[int]],
    difficulty: str,
    always_empty: set[tuple[int, int]],
) -> list[list[int | None]]:
    """
    Cria puzzle removendo células. Células-portal são SEMPRE removidas
    (o jogador precisa deduzi-las cruzando as dimensões).
    """
    target = DIFFICULTY_REMOVALS.get(difficulty, 52)
    puzzle: list[list[int | None]] = deepcopy(solution)  # type: ignore

    for r, c in always_empty:
        puzzle[r][c] = None

    pre_removed = sum(1 for r in range(9) for c in range(9) if puzzle[r][c] is None)
    extra = max(0, target - pre_removed)

    cells = [(r, c) for r in range(9) for c in range(9) if puzzle[r][c] is not None]
    random.shuffle(cells)

    removed = 0
    for r, c in cells:
        if removed >= extra:
            break
        bk = puzzle[r][c]
        puzzle[r][c] = None
        if has_unique_solution(puzzle):
            removed += 1
        else:
            puzzle[r][c] = bk

    return puzzle
