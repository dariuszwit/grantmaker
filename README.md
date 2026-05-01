# Grant CRM 360 AI ✨

Lokalny system CRM do prospect research, pozyskiwania grantów i budowania relacji.

## Co zawiera wersja v8

- PostgreSQL jako trwała lokalna baza danych.
- Klikalne profile organizacji z widokiem 360°.
- Zakładki: Overview, Profil, Kontakty, Granty, Dokumenty, Komunikacja, Zadania, Relacja, AI.
- Upload dokumentów do lokalnego folderu `storage/documents`.
- Rejestrowanie komunikacji, zadań follow-up i szans grantowych.
- AI Grant Partner w całym systemie: strategia, email, concept note, eligibility, compliance, następne kroki.
- Wbudowany fallback AI bez klucza API oraz konfiguracja dla OpenAI, Anthropic, Gemini, Mistral, OpenRouter, Groq, Ollama i custom endpointów.
- Dodatkowa kategoria high-profile philanthropies / family foundations, w tym m.in. Musk Foundation, Kulczyk Foundation, Fondation des Hôpitaux, Azim Premji Foundation, ACT Grants, Ananya Birla Foundation, Reliance Foundation.

## Uruchomienie

Najprościej:

```powershell
py .\run.py --detach
```

albo kliknij:

```text
uruchom_grant_crm.bat
```

Następnie otwórz:

```text
http://localhost:8080
```

## Konfiguracja AI

Skopiuj `.env.example` do `.env`:

```powershell
copy .env.example .env
```

Przykład dla OpenAI:

```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.5
AI_TEMPERATURE=0.3
AI_MAX_TOKENS=1400
```

Bez klucza API system działa w trybie `fallback`, czyli lokalnych szablonów.

## Dokumenty

Uploadowane pliki trafiają do:

```text
storage/documents/<grantmaker_id>/
```

Baza PostgreSQL zapisuje metadane dokumentu i link do pliku.

## Bezpieczeństwo danych

System jest lokalny. Nie zbiera prywatnych danych darczyńców. Do CRM wpisuj wyłącznie dane pozyskane legalnie: publiczne kontakty instytucjonalne, formularze, role zawodowe i własną historię komunikacji.

## Reset projektu

Bezpieczny reset bieżącego projektu:

```powershell
docker compose down -v --remove-orphans
```

To usuwa lokalną bazę PostgreSQL dla tego projektu.


## v10 additions

### Medical / psychological funders
Added a medical and mental-health funding layer for digital wellbeing, behavioral health, addiction prevention, digital therapeutics and youth mental health.

### Import/export
Use the sidebar buttons:
- 📦 Export full JSON
- 📊 Export CSV
- ⬆️ Import

### Communication and calendar integration scaffolding
The app now stores:
- outbound messages/drafts,
- inbound replies,
- calendar events,
- integration accounts,
- import/export jobs.

Configure provider credentials in `.env` based on `.env.example`.

Live sending is intentionally disabled until you add and test connector modules and set `ENABLE_LIVE_SEND=true`.

See:
- `docs/IMPORT_EXPORT_AND_INTEGRATIONS.md`
- `docs/MEDICAL_PSYCHOLOGICAL_FUNDER_NOTES.md`


## v11 country expansion

This regenerated package includes additional country expansion records for Spain, Switzerland, Italy, Belgium, Netherlands, France, Denmark/Nordics, Australia, Japan and New Zealand. See docs/COUNTRY_EXPANSION_NOTES.md.
