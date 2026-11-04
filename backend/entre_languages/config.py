import os
from pathlib import Path
from typing import Literal
from urllib.parse import urlsplit

from dotenv import dotenv_values
from pydantic import BaseModel, Field, SecretStr, model_validator

ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseModel):
    mode: Literal["demo", "live"] = "demo"
    api_base_url: str = "https://api.openai.com/v1"
    api_key: SecretStr = SecretStr("")
    character_model: str = Field(default="gpt-4.1-mini", min_length=1)
    critic_model: str = ""
    character_timeout: float = Field(default=20, gt=0, le=120)
    critic_timeout: float = Field(default=12, gt=0, le=120)
    max_active_turns: int = Field(default=8, ge=1, le=64)

    @model_validator(mode="after")
    def check_provider(self):
        url = urlsplit(self.api_base_url)
        if (
            url.scheme not in {"http", "https"}
            or not url.hostname
            or url.username
            or url.query
            or url.fragment
        ):
            raise ValueError("ENTRE_API_BASE_URL must be an HTTP(S) API base URL")
        if (
            self.mode == "live"
            and url.hostname == "api.openai.com"
            and not self.api_key.get_secret_value()
        ):
            raise ValueError("ENTRE_API_KEY is required for OpenAI live mode")
        return self


def load_settings() -> Settings:
    values = dotenv_values(ROOT / ".env")
    configured = {}
    for field in Settings.model_fields:
        key = f"ENTRE_{field.upper()}"
        value = os.environ.get(key, values.get(key))
        if value is not None:
            configured[field] = value
    return Settings.model_validate(configured)
