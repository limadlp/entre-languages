from ..domain import CharacterProfile, Feedback, Language, Turn

EXAMPLES: dict[Language, tuple[str, str]] = {
    "en": ("i have 25 years and i like very much music", "I'm 25, and I really like music."),
    "pt-BR": ("fazem dois anos que eu moro aqui e eu gosto muito daqui", "Faz dois anos que eu moro aqui e eu gosto muito daqui."),
    "es": ("me gusta mucho las películas de terror", "Me gustan mucho las películas de terror."),
    "zh-CN": ("我昨天去商店买了一个裤子", "我昨天去商店买了一条裤子。"),
}
NOTES: dict[Language, dict[Language, str]] = {
    "en": {
        "en": "Use “I'm” for age and put “really” before “like.”",
        "pt-BR": "Use “I'm” para falar da idade e coloque “really” antes de “like”.",
        "es": "Usa “I'm” para decir tu edad y pon “really” antes de “like”.",
        "zh-CN": "说年龄时用“I’m”，并把“really”放在“like”前面。",
    },
    "pt-BR": {
        "en": "Use singular “faz” when talking about elapsed time.",
        "pt-BR": "Quando indica tempo decorrido, o verbo “fazer” fica no singular.",
        "es": "Usa “faz” en singular para hablar del tiempo transcurrido.",
        "zh-CN": "表示过去了多长时间时，用单数形式“faz”。",
    },
    "es": {
        "en": "“Películas” is plural, so use “gustan.”",
        "pt-BR": "“Películas” está no plural, então use “gustan”.",
        "es": "“Películas” está en plural, así que usa “gustan”.",
        "zh-CN": "“Películas”是复数，所以要用“gustan”。",
    },
    "zh-CN": {
        "en": "Use the measure word “条” for a pair of pants.",
        "pt-BR": "Use a palavra de medida “条” para contar calças.",
        "es": "Usa el clasificador “条” para contar pantalones.",
        "zh-CN": "数裤子时，量词一般用“条”，说“一条裤子”。",
    },
}
QUESTIONS: dict[Language, tuple[str, str]] = {
    "en": ("So, what have you been into lately?", "What got you into it?"),
    "pt-BR": ("E você, o que anda curtindo ultimamente?", "Como você começou a gostar disso?"),
    "es": ("Y tú, ¿qué te interesa últimamente?", "¿Cómo empezó ese interés?"),
    "zh-CN": ("你最近有什么新爱好吗？", "你是怎么开始喜欢这个的？"),
}


class DemoCharacter:
    async def reply(self, persona: CharacterProfile, turn: Turn) -> str:
        language = turn.conversation_language
        first, follow_up = QUESTIONS[language]
        return follow_up if turn.history else f"{persona.bio[language]} {first}"


class DemoCritic:
    async def review(self, turn: Turn) -> Feedback | None:
        text = turn.message.casefold().rstrip(".!?。！？")
        for language, (example, rewrite) in EXAMPLES.items():
            if text == example:
                return Feedback(note=NOTES[language][turn.feedback_language], rewrite=rewrite)
        return None
