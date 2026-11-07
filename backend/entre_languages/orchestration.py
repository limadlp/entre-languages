import asyncio
import logging
from collections.abc import AsyncIterator, Awaitable, Callable
from typing import Any, Literal

from .domain import CharacterProfile, Character, Feedback, LanguageCritic, Turn

logger = logging.getLogger(__name__)
Branch = Literal["character", "critic"]


async def run_branch(
    branch: Branch,
    call: Callable[[], Awaitable[str | Feedback | None]],
    timeout: float,
) -> dict[str, Any]:
    try:
        result = await asyncio.wait_for(call(), timeout)
    except Exception as exc:
        logger.warning("%s branch failed (%s)", branch, type(exc).__name__)
        code = "timeout" if isinstance(exc, TimeoutError) else "provider_error"
        return {"type": "error", "branch": branch, "code": code}
    if isinstance(result, Feedback):
        return {"type": "feedback", "feedback": result.model_dump()}
    if result is None:
        return {"type": "feedback_unavailable"}
    return {"type": "reply", "text": result}


class TurnOrchestrator:
    def __init__(
        self,
        character: Character,
        critic: LanguageCritic,
        character_timeout: float,
        critic_timeout: float,
    ):
        self.character = character
        self.critic = critic
        self.character_timeout = character_timeout
        self.critic_timeout = critic_timeout

    async def stream(self, persona: CharacterProfile, turn: Turn) -> AsyncIterator[dict[str, Any]]:
        tasks = [
            asyncio.create_task(
                run_branch(
                    "character", lambda: self.character.reply(persona, turn), self.character_timeout,
                )
            )
        ]
        if turn.feedback_enabled:
            tasks.append(
                asyncio.create_task(
                    run_branch("critic", lambda: self.critic.review(turn), self.critic_timeout)
                )
            )
        try:
            for completion in asyncio.as_completed(tasks):
                yield await completion
            yield {"type": "done"}
        finally:
            for task in tasks:
                task.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)
