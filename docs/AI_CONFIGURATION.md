# 🤖 AI configuration

Ustawienia są w `.env`. Skopiuj `.env.example` do `.env` i wybierz provider.

- `fallback` - bez klucza API, działa offline jako lokalny asystent szablonowy.
- `openai` - Responses API.
- `anthropic` - Messages API.
- `gemini` - Gemini generateContent.
- `mistral`, `openrouter`, `groq`, `custom` - endpointy kompatybilne z OpenAI chat completions.
- `ollama` - lokalny model na komputerze hosta.

Asystent ma system prompt skonfigurowany pod etyczne prospect research, fundraising, budowanie relacji, eligibility, concept notes i compliance.
