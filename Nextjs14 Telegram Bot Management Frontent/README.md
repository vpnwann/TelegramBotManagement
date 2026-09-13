# Telegram Bot Admin Panel (Next.js frontend)

A Next.js (App Router, TypeScript, Tailwind) admin panel for the
Telegram Bot Admin API backend described in its README. No auth, no extra
state libraries — just server-driven CRUD screens talking to the
Express/Postgres API over `fetch`.

## Pages

| Route              | What it does                                                            |
| ------------------- | ------------------------------------------------------------------------ |
| `/`                 | Dashboard: stats + recent messages / upcoming scheduled messages        |
| `/bot`              | Register a bot token, see status, set the active bot, remove bots       |
| `/groups`           | Search/filter/paginate groups, add (or pull from Telegram), test, delete|
| `/groups/[id]`      | Edit a group, test its connection                                       |
| `/messages`         | Filter/paginate messages, create from scratch or a template             |
| `/messages/[id]`    | Edit text/buttons, send, resend, send a photo or document               |
| `/templates`        | CRUD for reusable message templates                                     |
| `/scheduled`        | Create/edit/cancel/send-now scheduled messages                          |

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Point it at your backend**

   ```bash
   cp .env.local.example .env.local
   ```

   Edit `.env.local`:

   ```env
   NEXT_PUBLIC_API_URL=http://localhost:4000/api
   ```

   This must match wherever your Express backend from the README is running,
   including the `/api` suffix.

3. **Run it**

   ```bash
   npm run dev
   ```

   Open `http://localhost:3000`. If `FRONTEND_URL` in the backend's `.env` is
   set to something other than `http://localhost:3000`, update it (and CORS)
   so the browser can call the API.

## Notes on how it talks to the backend

- `lib/api.ts` wraps `fetch`, unwraps the backend's `{ success, data }` /
  `{ success, error }` envelope, and throws an `ApiError` with the backend's
  error message on failure — every page catches this and shows a toast.
- `lib/types.ts` mirrors the shapes implied by the README (`Group`,
  `Message`, `Template`, `ScheduledMessage`, `TelegramBot`). If your actual
  column/response names differ slightly, adjust the field names there and in
  the handful of places each page reads `.group_name`, `.bot_token_preview`,
  etc. — everything else keeps working.
- List endpoints (`/groups`, `/messages`, `/scheduled`, `/telegram`) are read
  through `normalizeList()`, which accepts either a bare array or a
  `{ items, total, page, totalPages }` shape, since the README doesn't pin
  down the exact pagination envelope.
- File uploads (`send-photo` / `send-document`) post a `FormData` body and
  skip the JSON `Content-Type` header so the browser sets the multipart
  boundary itself.

## Tech

Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · lucide-react icons ·
date-fns. No backend framework, ORM, or auth library included by design —
this only talks to the REST API in the README.
