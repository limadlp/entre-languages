from ..domain import CharacterProfile, Feedback, Language, Turn

EXAMPLES = {
    "en": ("i have 25 years and i like very much music", "I'm 25, and I really like music."),
    "pt-BR": ("fazem dois anos que eu moro aqui e eu gosto muito daqui", "Faz dois anos que eu moro aqui e eu gosto muito daqui."),
    "es": ("me gusta mucho las películas de terror", "Me gustan mucho las películas de terror."),
}
NOTES = {
    "en": {
        "en": "Use “I'm” for age and put “really” before “like.”",
        "pt-BR": "Use “I'm” para falar da idade e coloque “really” antes de “like”.",
        "es": "Usa “I'm” para decir tu edad y pon “really” antes de “like”.",
    },
    "pt-BR": {
        "en": "Use singular “faz” when talking about elapsed time.",
        "pt-BR": "Quando indica tempo decorrido, o verbo “fazer” fica no singular.",
        "es": "Usa “faz” en singular para hablar del tiempo transcurrido.",
    },
    "es": {
        "en": "“Películas” is plural, so use “gustan.”",
        "pt-BR": "“Películas” está no plural, então use “gustan”.",
        "es": "“Películas” está en plural, así que usa “gustan”.",
    },
}
QUESTIONS: dict[Language, tuple[str, str]] = {
    "en": ("So, what have you been into lately?", "What got you into it?"),
    "pt-BR": ("E você, o que anda curtindo ultimamente?", "Como você começou a gostar disso?"),
    "es": ("Y tú, ¿qué te interesa últimamente?", "¿Cómo empezó ese interés?"),
}


class DemoCharacter:
    async def reply(self, persona: CharacterProfile, turn: Turn) -> str:
        language = turn.conversation_language
        first, follow_up = QUESTIONS[language]
        return follow_up if turn.history else f"{persona.bio[language]} {first}"


class DemoCritic:
    async def review(self, turn: Turn) -> Feedback | None:
        text = turn.message.casefold().rstrip(".!?")
        for language, (example, rewrite) in EXAMPLES.items():
            if text == example:
                return Feedback(note=NOTES[language][turn.feedback_language], rewrite=rewrite)
        return None
