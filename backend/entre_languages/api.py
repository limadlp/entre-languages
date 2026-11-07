import json
from contextlib import asynccontextmanager, aclosing
from typing import Literal

import httpx
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .adapters.demo import DemoCharacter, DemoCritic, EXAMPLES, NOTES
from .adapters.openai import ChatCompletions, OpenAICharacter, OpenAICritic
from .catalog import BY_ID, CATALOG
from .config import ROOT, Settings, load_settings
from .domain import Language, Persona, Turn
from .orchestration import TurnOrchestrator


class Example(BaseModel):
    message: str
    rewrite: str
    notes: dict[Language, str]


class CatalogResponse(BaseModel):
    mode: Literal["demo", "live"]
    personas: list[Persona]
    examples: dict[Language, Example]


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or load_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        key = settings.api_key.get_secret_value()
        headers = {"Authorization": f"Bearer {key}"} if key else {}
        limits = httpx.Limits(max_connections=2 * settings.max_active_turns)
        async with httpx.AsyncClient(headers=headers, timeout=None, limits=limits) as http:
            client = ChatCompletions(http, settings)
            if settings.mode == "demo":
                character, critic = DemoCharacter(), DemoCritic()
            else:
                character = OpenAICharacter(client, settings.character_model)
                critic = OpenAICritic(client, settings.critic_model or settings.character_model)
            app.state.orchestrator = TurnOrchestrator(
                character, critic, settings.character_timeout, settings.critic_timeout,
            )
            app.state.active_turns = 0
            yield

    app = FastAPI(title="Entre Languages", lifespan=lifespan)

    @app.exception_handler(RequestValidationError)
    async def invalid_input(_request: Request, _error: RequestValidationError):
        return JSONResponse({"detail": "invalid_turn"}, status_code=422)

    @app.get("/api/health")
    async def health():
        return {"status": "ok", "mode": settings.mode}

    @app.get("/api/catalog", response_model=CatalogResponse)
    async def catalog():
        return CatalogResponse(
            mode=settings.mode,
            personas=CATALOG,
            examples={
                language: Example(message=example, rewrite=rewrite, notes=NOTES[language])
                for language, (example, rewrite) in EXAMPLES.items()
            },
        )

    async def reserve_turn(request: Request):
        if request.headers.get("x-entre-client") != "1":
            raise HTTPException(403, "client_header_required")
        if app.state.active_turns >= settings.max_active_turns:
            raise HTTPException(503, "busy")
        app.state.active_turns += 1
        try:
            yield
        finally:
            app.state.active_turns -= 1

    @app.post("/api/turns", responses={200: {"content": {"application/x-ndjson": {}}}})
    async def send_turn(turn: Turn, _slot=Depends(reserve_turn, scope="request")):
        persona = BY_ID.get(turn.persona_id)
        if persona is None:
            raise HTTPException(404, "unknown_persona")

        async def body():
            async with aclosing(app.state.orchestrator.stream(persona, turn)) as events:
                async for event in events:
                    yield json.dumps(event, ensure_ascii=False) + "\n"

        return StreamingResponse(body(), media_type="application/x-ndjson", headers={
            "Cache-Control": "no-store, no-transform",
            "X-Accel-Buffering": "no",
        })

    dist = ROOT / "frontend" / "dist"
    if (dist / "index.html").is_file():
        app.mount("/", StaticFiles(directory=dist, html=True), name="frontend")
    return app


app = create_app()
