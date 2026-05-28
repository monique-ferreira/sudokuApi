"""Sudoku Mega — FastAPI application entry point."""

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.api.routes import router

app = FastAPI(
    title="Sudoku Mega API",
    description="Multi-directional Sudoku with up to 4 simultaneous game views.",
    version="1.0.0",
)

app.include_router(router)

app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
def root():
    return FileResponse("static/index.html")
