# Backend

Task management backend for the Anantkaal assignment.

## Features

- Username + email registration and login
- Google OAuth sign-in via Google `idToken`
- JWT-protected task APIs
- Task CRUD for the logged-in user
- Task filtering by status: `To Do`, `In Progress`, `Completed`
- Gemini AI guidance generation for each task with model fallback on rate limits
- Built-in rate limiting on auth and AI guidance routes
- Prisma schema for users, OAuth accounts, tasks, and guidance history

## Environment

Create a `.env` file in `backend/` with:

```env
DATABASE_URL="postgresql://postgres.your-project-ref:your-db-password@aws-0-region.pooler.supabase.com:6543/postgres"
DIRECT_URL="postgresql://postgres.your-project-ref:your-db-password@db.your-project-ref.supabase.co:5432/postgres"
JWT_SECRET="replace-this-in-real-use"
JWT_EXPIRES_IN="7d"
PORT=4000
CLIENT_URL="http://localhost:3000"
SUPABASE_URL="https://your-project-ref.supabase.co"
SUPABASE_PUBLISHABLE_DEFAULT_KEY="sb_publishable_..."
GOOGLE_CLIENT_ID=""
GEMINI_API_KEY=""
GEMINI_PRIMARY_MODEL="gemini-2.5-flash"
GEMINI_FALLBACK_MODELS="gemini-2.5-flash-lite,gemini-2.0-flash"
AUTH_RATE_LIMIT_WINDOW_MS="900000"
AUTH_RATE_LIMIT_MAX="20"
AI_RATE_LIMIT_WINDOW_MS="60000"
AI_RATE_LIMIT_MAX="5"
```

## Scripts

```bash
npx prisma generate
npm run build
npm run dev
```

## API

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/oauth/google`
- `GET /api/auth/me`

### Tasks

- `GET /api/tasks`
- `POST /api/tasks`
- `PUT /api/tasks/:taskId`
- `PATCH /api/tasks/:taskId`
- `DELETE /api/tasks/:taskId`
- `POST /api/tasks/:taskId/guidance`

## Notes

- `POST /api/auth/register` expects at least `{ "username", "email", "password" }`
- `POST /api/auth/login` accepts `{ "identifier", "password" }` where identifier can be email or username
- `POST /api/auth/oauth/google` expects `{ "idToken": "..." }`
- `GET /api/tasks?status=To Do`, `GET /api/tasks?status=In Progress`, and `GET /api/tasks?status=Completed` are supported
- If `GEMINI_API_KEY` is missing or Gemini models hit rate limits, task guidance falls back to lower-tier Gemini models and finally to the local strategy generator
- Auth and AI guidance routes now return `429` when their local request limits are exceeded
- If you are using Supabase, `DATABASE_URL` must be the Postgres connection string, not the `https://...supabase.co` project URL
