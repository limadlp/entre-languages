import asyncio
import json
from contextlib import aclosing

import httpx

from entre_languages.adapters.openai import ChatCompletions, OpenAICharacter, OpenAICritic
from entre_languages.api import create_app
from entre_languages.catalog import BY_ID
from entre_languages.config import Settings
from entre_languages.domain import Feedback, Turn
from entre_languages.orchestration import TurnOrchestrator

PAYLOAD = {
    "persona_id": "luna",
    "conversation_language": "en",
    "feedback_language": "pt-BR",
    "message": "i have 25 years and i like very much music",
}
HEADERS = {"x-entre-client": "1"}


def test_demo_contract_and_validation():
    async def scenario():
        app = create_app(Settings())
        transport = httpx.ASGITransport(app=app)
        async with app.router.lifespan_context(app), httpx.AsyncClient(
            transport=transport, base_url="http://test",
        ) as client:
            catalog = (await client.get("/api/catalog")).json()
            assert catalog["mode"] == "demo"
            assert len(catalog["personas"]) == 8
            assert "profile" not in catalog["personas"][0]
            assert catalog["examples"]["en"]["message"] == PAYLOAD["message"]

            response = await client.post("/api/turns", json=PAYLOAD, headers=HEADERS)
            assert response.headers["content-type"].startswith("application/x-ndjson")
            events = [json.loads(line) for line in response.text.splitlines()]
            assert events[-1] == {"type": "done"}
            assert {event["type"] for event in events[:-1]} == {"reply", "feedback"}
            feedback = next(event["feedback"] for event in events if event["type"] == "feedback")
            assert feedback["note"].startswith("Use “I'm” para")
            assert feedback["rewrite"] == "I'm 25, and I really like music."

            disabled = await client.post("/api/turns", json={**PAYLOAD, "feedback_enabled": False}, headers=HEADERS)
            assert [json.loads(line)["type"] for line in disabled.text.splitlines()] == ["reply", "done"]
            other_message = await client.post("/api/turns", json={**PAYLOAD, "message": "hello"}, headers=HEADERS)
            assert "feedback_unavailable" in other_message.text
            assert (await client.post("/api/turns", json=PAYLOAD)).status_code == 403
            assert (await client.post("/api/turns", json={**PAYLOAD, "message": " "}, headers=HEADERS)).status_code == 422
            assert (await client.post("/api/turns", json={**PAYLOAD, "persona_id": "unknown"}, headers=HEADERS)).status_code == 404

    asyncio.run(scenario())


def test_reply_is_delivered_while_critic_is_running_and_survives_failure():
    async def scenario():
        critic_started = asyncio.Event()
        finish_critic = asyncio.Event()

        class Character:
            async def reply(self, _persona, _turn):
                await critic_started.wait()
                return "Hello!"

        class Critic:
            async def review(self, _turn):
                critic_started.set()
                await finish_critic.wait()
                raise ValueError("invalid feedback")

        pipeline = TurnOrchestrator(Character(), Critic(), 1, 1)
        async with aclosing(pipeline.stream(BY_ID["luna"], Turn(**PAYLOAD))) as events:
            assert await anext(events) == {"type": "reply", "text": "Hello!"}
            finish_critic.set()
            assert await anext(events) == {"type": "error", "branch": "critic", "code": "provider_error"}
            assert await anext(events) == {"type": "done"}

    asyncio.run(scenario())


def test_closing_stream_cancels_unfinished_branch():
    async def scenario():
        critic_started = asyncio.Event()
        critic_closed = asyncio.Event()

        class Character:
            async def reply(self, _persona, _turn):
                await critic_started.wait()
                return "Hello!"

        class Critic:
            async def review(self, _turn):
                critic_started.set()
                try:
                    await asyncio.Future()
                finally:
                    critic_closed.set()

        pipeline = TurnOrchestrator(Character(), Critic(), 1, 10)
        async with aclosing(pipeline.stream(BY_ID["luna"], Turn(**PAYLOAD))) as events:
            assert (await anext(events))["type"] == "reply"
        assert critic_closed.is_set()

    asyncio.run(scenario())


def test_provider_uses_independent_context_and_validates_structured_feedback():
    async def scenario():
        calls = {}

        def respond(request):
            payload = json.loads(request.content)
            calls[payload["model"]] = payload
            content = "I like music, too."
            if payload["model"] == "critic":
                content = '{"note":"Use uma frase mais natural.","rewrite":"I like music."}'
            return httpx.Response(200, json={"choices": [{"finish_reason": "stop", "message": {"content": content}}]})

        async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as http:
            adapter = ChatCompletions(http, Settings())
            turn = Turn(**PAYLOAD, history=[{"role": "assistant", "text": "A previous reply"}] * 6)
            assert await OpenAICharacter(adapter, "character").reply(BY_ID["luna"], turn) == "I like music, too."
            assert await OpenAICritic(adapter, "critic").review(turn) == Feedback(
                note="Use uma frase mais natural.", rewrite="I like music.",
            )
        assert len(calls["character"]["messages"]) == 8
        assert "response_format" not in calls["character"]
        assert calls["critic"]["response_format"]["json_schema"]["strict"] is True
        critic_input = json.loads(calls["critic"]["messages"][-1]["content"])
        assert len(critic_input["recent_context"]) == 4
        assert critic_input["latest_message"] == PAYLOAD["message"]

    asyncio.run(scenario())


def test_critic_can_finish_when_character_times_out():
    async def scenario():
        class Character:
            async def reply(self, _persona, _turn):
                await asyncio.Future()

        class Critic:
            async def review(self, _turn):
                return Feedback(note="Natural.", rewrite="Hello!")

        pipeline = TurnOrchestrator(Character(), Critic(), 0.01, 1)
        events = [event async for event in pipeline.stream(BY_ID["luna"], Turn(**PAYLOAD))]
        assert events[0]["type"] == "feedback"
        assert events[1] == {"type": "error", "branch": "character", "code": "timeout"}
        assert events[2] == {"type": "done"}

    asyncio.run(scenario())


def test_active_slot_is_released_after_stream_finishes():
    async def scenario():
        started = asyncio.Event()
        release = asyncio.Event()

        class Character:
            async def reply(self, _persona, _turn):
                started.set()
                await release.wait()
                return "Hello!"

        app = create_app(Settings(max_active_turns=1))
        transport = httpx.ASGITransport(app=app)
        async with app.router.lifespan_context(app), httpx.AsyncClient(
            transport=transport, base_url="http://test",
        ) as client:
            app.state.orchestrator.character = Character()
            payload = {**PAYLOAD, "feedback_enabled": False}
            first = asyncio.create_task(client.post("/api/turns", json=payload, headers=HEADERS))
            try:
                await asyncio.wait_for(started.wait(), 1)
                busy = await client.post("/api/turns", json=payload, headers=HEADERS)
                assert busy.status_code == 503
            finally:
                release.set()
                assert (await first).status_code == 200
            assert (await client.post("/api/turns", json=payload, headers=HEADERS)).status_code == 200

    asyncio.run(scenario())
