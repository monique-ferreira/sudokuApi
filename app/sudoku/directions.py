"""
Direction transformations for Sudoku Mega.

Uses proper 90°/180°/270° rotations so every visual direction
is itself a valid sudoku (rows, columns, and 3×3 boxes all intact).

  UP:    identity
  RIGHT: 90° clockwise      visual[r][c] = canonical[8-c][r]
  DOWN:  180°               visual[r][c] = canonical[8-r][8-c]
  LEFT:  270° clockwise     visual[r][c] = canonical[c][8-r]
"""

DIRECTIONS = ["UP", "RIGHT", "DOWN", "LEFT"]


def visual_to_canonical(vr: int, vc: int, direction: str) -> tuple[int, int]:
    if direction == "UP":
        return vr, vc
    if direction == "RIGHT":
        return 8 - vc, vr
    if direction == "DOWN":
        return 8 - vr, 8 - vc
    if direction == "LEFT":
        return vc, 8 - vr
    raise ValueError(f"Unknown direction: {direction}")


def canonical_to_visual(cr: int, cc: int, direction: str) -> tuple[int, int]:
    if direction == "UP":
        return cr, cc
    if direction == "RIGHT":
        return cc, 8 - cr
    if direction == "DOWN":
        return 8 - cr, 8 - cc
    if direction == "LEFT":
        return 8 - cc, cr
    raise ValueError(f"Unknown direction: {direction}")


def canonical_grid_to_visual(
    canonical: list[list], direction: str
) -> list[list]:
    visual = [[None] * 9 for _ in range(9)]
    for cr in range(9):
        for cc in range(9):
            vr, vc = canonical_to_visual(cr, cc, direction)
            visual[vr][vc] = canonical[cr][cc]
    return visual
