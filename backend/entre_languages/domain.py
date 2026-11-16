from typing import Annotated, Literal, Protocol

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator


Language = Literal["en", "pt-BR", "es", "zh-CN"]
Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)]


class Message(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: Literal["user", "assistant"]
    text: Text


class Turn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    persona_id: str = Field(min_length=1, max_length=64)
    conversation_language: Language
    feedback_language: Language
    feedback_enabled: bool = True
    history: list[Message] = Field(default_factory=list, max_length=12)
    message: Text

    @model_validator(mode="after")
    def limit_history(self):
        if sum(len(message.text) for message in self.history) > 6000:
            raise ValueError("History exceeds 6000 characters")
        return self


class Feedback(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    note: str = Field(min_length=1, max_length=380)
    rewrite: str = Field(min_length=1, max_length=1000)


class Persona(BaseModel):
    id: str
    name: str
    age: int
    city: str
    color: str
    tags: list[str]
    bio: dict[Language, str]
    avatar: str | None = None


class CharacterProfile(Persona):
    profile: str = Field(min_length=1)


class Character(Protocol):
    async def reply(self, persona: CharacterProfile, turn: Turn) -> str: ...


class LanguageCritic(Protocol):
    async def review(self, turn: Turn) -> Feedback | None: ...
