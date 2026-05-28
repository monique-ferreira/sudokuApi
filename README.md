# Sudoku Mega

Multi-directional Sudoku with up to 4 simultaneous game views.

## Concept

Each game view is a different directional transformation of the same underlying 9×9 canonical grid:

| Game | Direction | Transformation |
|------|-----------|----------------|
| 1    | UP        | Standard (identity) |
| 2    | LEFT      | 90° counter-clockwise |
| 3    | DOWN      | 180° rotation |
| 4    | RIGHT     | 90° clockwise |

Placing a number in any view simultaneously updates the corresponding cell in all other views, since they all share the same underlying canonical grid.

### Direction matrices

Within each 3×3 quadrant, cell values follow this visual pattern per direction:

```
UP:    [[1,2,3],[4,5,6],[7,8,9]]
LEFT:  [[3,6,9],[2,5,8],[1,4,7]]
DOWN:  [[9,8,7],[6,5,4],[3,2,1]]
RIGHT: [[7,4,1],[8,5,2],[9,6,3]]
```

The 9×9 grid's quadrant arrangement also changes per direction:

```
UP:    A B C / D E F / G H I
LEFT:  F I C / H B E / A D G
DOWN:  E H D / I A G / C F B
RIGHT: D E I / C H A / B G F
```

## Running

```bash
pip install -r requirements.txt
uvicorn main:app --reload
```

Open http://localhost:8000

## API

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/games` | Create game (`num_games`: 1–4, `difficulty`: easy/medium/hard) |
| `GET`  | `/api/games/{id}` | Get current state |
| `POST` | `/api/games/{id}/move` | Place/erase a value |
| `GET`  | `/api/games/{id}/hint` | Get a hint cell |
| `POST` | `/api/games/{id}/solve` | Reveal full solution |
| `GET`  | `/api/games/{id}/validate` | Validate current state |

## Stack

- **Backend**: Python 3.11 + FastAPI + Uvicorn
- **Frontend**: Vanilla HTML/CSS/JS (no framework)
- **Solver**: Backtracking with MRV heuristic
