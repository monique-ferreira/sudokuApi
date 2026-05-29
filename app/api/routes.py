"""API routes for Sudoku Mega."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.game.state import create_session, get_session

router = APIRouter(prefix="/api")


class CreateGameRequest(BaseModel):
    num_games: int = Field(default=2, ge=2, le=4)
    difficulty: str = Field(default="medium", pattern="^(easy|medium|hard)$")


class MoveRequest(BaseModel):
    game_index: int = Field(ge=0, le=3)
    row: int = Field(ge=0, le=8)
    col: int = Field(ge=0, le=8)
    value: int | None = Field(default=None, ge=1, le=9)


@router.post("/games")
def create_game(body: CreateGameRequest):
    session = create_session(body.num_games, body.difficulty)
    return session.to_dict()


@router.get("/games/{game_id}")
def get_game(game_id: str):
    session = get_session(game_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Game not found")
    return session.to_dict()


@router.post("/games/{game_id}/move")
def make_move(game_id: str, body: MoveRequest):
    session = get_session(game_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Game not found")
    result = session.place(body.game_index, body.row, body.col, body.value)
    if not result["ok"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return session.to_dict()


@router.get("/games/{game_id}/hint")
def get_hint(game_id: str, game_index: int = 0):
    session = get_session(game_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Game not found")
    hint = session.get_hint(game_index)
    if hint is None:
        raise HTTPException(status_code=404, detail="No hints remaining")
    return hint


@router.post("/games/{game_id}/solve")
def solve_game(game_id: str):
    session = get_session(game_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Game not found")
    session.reveal_solution()
    return session.to_dict()


@router.post("/games/{game_id}/drift")
def apply_drift(game_id: str):
    session = get_session(game_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Game not found")
    session.apply_drift()
    return session.to_dict()
