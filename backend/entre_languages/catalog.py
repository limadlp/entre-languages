import json
from pathlib import Path

from pydantic import TypeAdapter

from .domain import CharacterProfile


CATALOG = TypeAdapter(list[CharacterProfile]).validate_python(
    json.loads(Path(__file__).with_name("personas.json").read_text(encoding="utf-8"))
)
BY_ID = {persona.id: persona for persona in CATALOG}
