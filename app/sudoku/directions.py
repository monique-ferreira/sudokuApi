"""
Direction transformations for Sudoku Mega.

Each direction defines how the canonical 9x9 grid is viewed in that game.

Quadrant arrangement: which of the 9 canonical quadrants (A=0..I=8) appears
at each visual quadrant position (vqr, vqc).

Cell arrangement: within a quadrant, which canonical cell index (0-8) appears
at each visual internal position (vir, vic). Cell index follows reading order
(0=top-left, 8=bottom-right) in the canonical/UP layout.

Canonical quadrant layout (UP):
  A(0) B(1) C(2)
  D(3) E(4) F(5)
  G(6) H(7) I(8)

Value/cell pattern per direction (1-9 → 0-8):
  UP:    [[0,1,2],[3,4,5],[6,7,8]]  (identity)
  LEFT:  [[2,5,8],[1,4,7],[0,3,6]]  (90° CCW)
  DOWN:  [[8,7,6],[5,4,3],[2,1,0]]  (180°)
  RIGHT: [[6,3,0],[7,4,1],[8,5,2]]  (90° CW)
"""

DIRECTIONS = ["UP", "LEFT", "DOWN", "RIGHT"]

# QUAD_ARRANGEMENT[direction][vqr][vqc] = canonical quadrant index shown there
QUAD_ARRANGEMENT = {
    "UP":    [[0, 1, 2], [3, 4, 5], [6, 7, 8]],
    "LEFT":  [[5, 8, 2], [7, 1, 4], [0, 3, 6]],
    "DOWN":  [[4, 7, 3], [8, 0, 6], [2, 5, 1]],
    "RIGHT": [[3, 4, 8], [2, 7, 0], [1, 6, 5]],
}

# CELL_ARRANGEMENT[direction][vir][vic] = canonical cell index shown at that visual sub-position
CELL_ARRANGEMENT = {
    "UP":    [[0, 1, 2], [3, 4, 5], [6, 7, 8]],
    "LEFT":  [[2, 5, 8], [1, 4, 7], [0, 3, 6]],
    "DOWN":  [[8, 7, 6], [5, 4, 3], [2, 1, 0]],
    "RIGHT": [[6, 3, 0], [7, 4, 1], [8, 5, 2]],
}

# Precomputed: (direction) -> 9x9 map of visual position -> canonical position
_VIS_TO_CAN: dict[str, list[list[tuple[int, int]]]] = {}
# Precomputed: (direction) -> 9x9 map of canonical position -> visual position
_CAN_TO_VIS: dict[str, list[list[tuple[int, int]]]] = {}


def _build_maps() -> None:
    for direction in DIRECTIONS:
        quad_arr = QUAD_ARRANGEMENT[direction]
        cell_arr = CELL_ARRANGEMENT[direction]

        v2c = [[None] * 9 for _ in range(9)]
        c2v = [[None] * 9 for _ in range(9)]

        for vr in range(9):
            for vc in range(9):
                vqr, vqc = vr // 3, vc // 3
                vir, vic = vr % 3, vc % 3

                quad_idx = quad_arr[vqr][vqc]
                cell_idx = cell_arr[vir][vic]

                qgr, qgc = quad_idx // 3, quad_idx % 3
                cir, cic = cell_idx // 3, cell_idx % 3

                cr = qgr * 3 + cir
                cc = qgc * 3 + cic

                v2c[vr][vc] = (cr, cc)
                c2v[cr][cc] = (vr, vc)

        _VIS_TO_CAN[direction] = v2c
        _CAN_TO_VIS[direction] = c2v


_build_maps()


def visual_to_canonical(vr: int, vc: int, direction: str) -> tuple[int, int]:
    """Map a visual grid position in the given direction to the canonical position."""
    return _VIS_TO_CAN[direction][vr][vc]


def canonical_to_visual(cr: int, cc: int, direction: str) -> tuple[int, int]:
    """Map a canonical position to the visual position in the given direction."""
    return _CAN_TO_VIS[direction][cr][cc]


def canonical_grid_to_visual(
    canonical: list[list[int | None]], direction: str
) -> list[list[int | None]]:
    """Project the canonical 9x9 grid into the visual grid for the given direction."""
    visual = [[None] * 9 for _ in range(9)]
    for vr in range(9):
        for vc in range(9):
            cr, cc = visual_to_canonical(vr, vc, direction)
            visual[vr][vc] = canonical[cr][cc]
    return visual
