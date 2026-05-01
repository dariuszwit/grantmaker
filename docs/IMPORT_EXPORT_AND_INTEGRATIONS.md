# Import/export and integration roadmap

## Import/export

The app includes:

- `GET /api/export/grantmakers.json`
- `GET /api/export/grantmakers.csv`
- `GET /api/export/full.json`
- `POST /api/import/grantmakers` with `multipart/form-data`, fields:
  - `format`: `json` or `csv`
  - `file`: uploaded file

JSON import can be either an array of grantmaker objects or `{ "grantmakers": [...] }`.

Recommended import columns:

```csv
id,segment,name,country,region,fit,eligibility,grant_route,public_contact,apply_url,source_url,ai_strategy,contact_type,privacy_note,last_checked
```

## Integration scaffolding

This version adds database tables and API endpoints for:

- Google Gmail + Google Calendar OAuth
- Microsoft Graph Outlook Mail + Calendar
- Twilio SMS / Voice / WhatsApp
- Meta WhatsApp Cloud API
- Telegram Bot API
- manual phone/SMS/call-history imports

The shipped project deliberately does not include private OAuth credentials or API secrets.

Configure `.env` from `.env.example`.

## Current status

Implemented now:

- integration configuration catalog: `GET /api/integrations/catalog`
- integration account registry: `GET/POST /api/integrations/accounts`
- outbound message drafts/logs: `POST /api/grantmakers/:id/outbound-messages`
- inbound message logs: `POST /api/grantmakers/:id/inbound-messages`
- calendar event logs: `POST /api/grantmakers/:id/calendar-events`
- communication entries are also mirrored into the interaction timeline

Not enabled by default:

- live Gmail sending
- live Microsoft Graph sending
- live Twilio sending/calling
- live WhatsApp/Telegram delivery
- continuous sync of replies

These should be added as connector modules after OAuth/API keys are configured and tested.

## Phone/SMS/call history

For personal phone call/SMS history, prefer manual exports from the phone or carrier portal where legally available. Import only data you are allowed to process. Orange or another operator may provide billing/call records, but availability depends on country, plan and privacy rules. The system is prepared to store such interactions as `inbound_messages`, `outbound_messages` or `interactions`.
