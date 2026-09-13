# Telegram Bot Admin API

A plain **Node.js + Express.js** REST API backend for a Telegram Bot Admin Panel.
No authentication, no frontend, no extra databases — just Express, PostgreSQL (Neon),
and the real Telegram Bot API. Designed to be consumed later by a separate Next.js
admin panel.

## Tech stack

- Node.js + Express.js (ES modules)
- PostgreSQL via `pg` (Neon-hosted), parameterized queries only
- Telegram Bot API (via `node-fetch` / `form-data`, no third-party Telegram SDK)
- `multer` for photo/document uploads
- `node-cron` for the scheduled-message dispatcher
- `dotenv`, `cors`

## Project structure

```text
src/
  config/db.js               -> pg Pool + query helper
  controllers/                -> one file per resource
  routes/                      -> one file per resource, mounted under /api
  services/telegramService.js -> all Telegram Bot API calls live here
  jobs/scheduler.js           -> node-cron job, runs every minute
  middleware/                  -> response helpers, error handler, multer config
  app.js                       -> Express app (middleware + route mounting)
  server.js                    -> entrypoint, starts server + scheduler
sql/schema.sql                 -> full PostgreSQL schema
uploads/                       -> local storage for uploaded photos/documents
```

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment**

   Copy `.env.example` to `.env` and fill in the values:

   ```bash
   cp .env.example .env
   ```

   ```env
   DATABASE_URL=postgresql://user:password@ep-xxxx.neon.tech/dbname?sslmode=require
   TELEGRAM_BOT_TOKEN=
   PORT=4000
   FRONTEND_URL=http://localhost:3000
   ```

   `TELEGRAM_BOT_TOKEN` is optional in `.env` — you can instead register a bot
   through `POST /api/telegram` once the server is running. Whichever bot has
   `status = 'active'` (most recently created/updated) is the one used for
   sending messages and running the scheduler.

3. **Create the database schema**

   Run the SQL in `sql/schema.sql` against your Neon database, e.g.:

   ```bash
   sql/schema.sql
   ```

4. **Run the server**

   ```bash
   npm run dev
   ```

   The API is now available at `http://localhost:4000/api`.

## Response format

All endpoints return a consistent envelope.

Success:

```json
{ "success": true, "data": { } }
```

Error:

```json
{ "success": false, "error": "Group not found" }
```

## Routes overview

### Health

```http
GET /api/health
```

### Admin dashboard

```http
GET /api/admin/dashboard
GET /api/admin/recent-messages
GET /api/admin/recent-scheduled
```

### Telegram bot

```http
POST   /api/telegram
GET    /api/telegram
PUT    /api/telegram/:id
DELETE /api/telegram/:id
GET    /api/telegram/status
```

### Groups

```http
GET    /api/groups
POST   /api/groups
GET    /api/groups/:id
PUT    /api/groups/:id
DELETE /api/groups/:id
POST   /api/groups/:id/test
GET    /api/groups/telegram/chats
```

### Messages

```http
GET    /api/messages
POST   /api/messages
GET    /api/messages/:id
PUT    /api/messages/:id
DELETE /api/messages/:id
POST   /api/messages/:id/send
POST   /api/messages/:id/resend
POST   /api/messages/:id/send-photo
POST   /api/messages/:id/send-document
```

### Templates

```http
GET    /api/templates
POST   /api/templates
GET    /api/templates/:id
PUT    /api/templates/:id
DELETE /api/templates/:id
```

### Scheduled messages

```http
GET    /api/scheduled
POST   /api/scheduled
GET    /api/scheduled/:id
PUT    /api/scheduled/:id
DELETE /api/scheduled/:id
POST   /api/scheduled/:id/cancel
POST   /api/scheduled/:id/send-now
```

The `node-cron` job in `src/jobs/scheduler.js` checks every minute for rows in
`scheduled_messages` where `status = 'scheduled'` and `scheduled_at <= now()`,
then walks them through `scheduled -> sending -> sent`, or `-> failed` with the
Telegram error stored in `error_message`.

## Example requests

### Register a bot

```bash
curl -X POST http://localhost:4000/api/telegram \
  -H "Content-Type: application/json" \
  -d '{ "botToken": "123456:ABC-DEF..." }'
```

### Create a group

```bash
curl -X POST http://localhost:4000/api/groups \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "-100123456789",
    "name": "Marketing Group",
    "type": "supergroup"
  }'
```

### Test the group connection

```bash
curl -X POST http://localhost:4000/api/groups/1/test
```

Sends the text `Telegram bot connection is working!` to that group via
`sendMessage`.

### Create and send a message with an inline button

```bash
curl -X POST http://localhost:4000/api/messages \
  -H "Content-Type: application/json" \
  -d '{
    "groupId": 1,
    "text": "<b>Hello everyone!</b>",
    "parseMode": "HTML",
    "buttons": [
      { "text": "Visit Website", "url": "https://example.com" }
    ]
  }'

curl -X POST http://localhost:4000/api/messages/1/send
```

### Send a photo

```bash
curl -X POST http://localhost:4000/api/messages/1/send-photo \
  -F "photo=@/path/to/image.jpg" \
  -F "caption=Check this out!"
```

### Send a document

```bash
curl -X POST http://localhost:4000/api/messages/1/send-document \
  -F "document=@/path/to/file.pdf"
```

### Create a template

```bash
curl -X POST http://localhost:4000/api/templates \
  -H "Content-Type: application/json" \
  -d '{ "name": "Welcome", "text": "Welcome to the group!", "parseMode": "HTML" }'
```

### Schedule a message

```bash
curl -X POST http://localhost:4000/api/scheduled \
  -H "Content-Type: application/json" \
  -d '{
    "groupId": 1,
    "text": "Good morning!",
    "parseMode": "HTML",
    "scheduledAt": "2026-09-20T10:30:00+05:30"
  }'
```

### Pagination and filtering

```bash
curl "http://localhost:4000/api/groups?page=1&limit=20&search=marketing&status=active"
curl "http://localhost:4000/api/messages?page=1&limit=20&status=sent&groupId=1"
curl "http://localhost:4000/api/templates?search=welcome"
```

## Notes

- There is **no authentication** in this version by design — it's an internal
  prototype meant to sit behind the future Next.js admin panel.
- Bot tokens are never returned in full by the API; responses include a masked
  `bot_token_preview` instead.
- Uploaded files are stored locally under `uploads/` and referenced by path in
  `messages.media_url`.
