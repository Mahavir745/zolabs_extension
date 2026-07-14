# ZoLabs for Zoho Creator — React Widget

This is a Vite + React frontend for an externally hosted Zoho Creator widget.

## Current frontend flow

1. Detect the current Creator application.
2. List available Creator forms.
3. Retrieve the selected form schema.
4. Ask the backend to reuse or create a matching ZoLabs form.
5. Capture the phone number and optional call objective.
6. Start the call.
7. Poll live call status.
8. Review transcript and parsed answers.
9. Ask the backend to create a new Creator record.

The project starts in mock mode so the complete UI can be tested before the backend is connected.

## Local setup

```bash
npm install
cp .env.example .env
npm run dev
```

Open the local URL shown by Vite.

## Render deployment

Create a Render **Static Site**.

Use:

```text
Build Command:
npm install && npm run build

Publish Directory:
dist
```

Or deploy using the included `render.yaml`.

## Environment variables

```text
VITE_API_BASE_URL=https://your-backend.onrender.com
VITE_ENABLE_MOCK=true
```

Keep `VITE_ENABLE_MOCK=true` until the real backend endpoints are ready.

Then change it to:

```text
VITE_ENABLE_MOCK=false
```

Never place ZoLabs credentials, Zoho refresh tokens, AI keys, Plivo credentials, or other secrets in this React project.

## Add to Zoho Creator

After Render deploys the site, use the Render URL as the external widget URL, for example:

```text
https://zolabs-creator-extension.onrender.com/
```

The page includes the Zoho Creator Widget JS SDK.

## Backend API contract expected by this frontend

### Session

```http
GET /api/auth/session
```

Response:

```json
{
  "authenticated": true,
  "organisation": {
    "id": "org_42",
    "name": "ABC Foundation"
  },
  "user": {
    "id": "user_19",
    "email": "admin@example.org"
  }
}
```

### Zoho OAuth start

```http
GET /api/auth/zoho/start
```

### Reuse or create the matching ZoLabs form

```http
POST /api/forms/sync
```

Request:

```json
{
  "organisationId": "org_42",
  "accountOwnerName": "zylkercorp",
  "creatorEnvironment": "production",
  "creatorApp": {
    "linkName": "scholarship_management",
    "displayName": "Scholarship Management"
  },
  "creatorForm": {
    "linkName": "Scholarship_Follow_Up",
    "displayName": "Scholarship Follow-up"
  },
  "fields": []
}
```

Response:

```json
{
  "mappingId": "map_101",
  "action": "created",
  "zolabsForm": {
    "id": 328,
    "name": "Scholarship Follow-up",
    "status": "active"
  }
}
```

### Create call

```http
POST /api/calls
```

### Call status

```http
GET /api/calls/:callLogId/status
```

### Call result

```http
GET /api/calls/:callLogId/result
```

### Create Creator record

```http
POST /api/calls/:callLogId/create-record
```

The request has no body. The backend uses `callLogId` to load both the saved
answers and the exact Creator owner/application/form mapping from PostgreSQL.

## Important production decisions

- Keep the central ZoLabs account credentials only in the backend.
- Use `source_id` to route every call to the correct organisation and Creator form.
- Store Creator–ZoLabs form mappings in the backend database.
- Use idempotency to prevent duplicate Creator records.
- Validate Creator field types and dropdown options before creating records.
- Match extracted answer keys to exact Creator field link names and omit
  uncaptured placeholder values before creating records.
- Do not automatically reuse a similar ZoLabs form without a saved mapping or explicit confirmation.
