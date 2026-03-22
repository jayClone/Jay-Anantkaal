# TaskFlow

A full-stack task management system built for the Anantkaal full-stack assignment. The project includes secure authentication, task CRUD operations, status-based filtering, Google OAuth, AI-assisted task guidance, and PostgreSQL persistence through Prisma.

## Overview

TaskFlow is designed to cover the assignment requirements while adding a few production-style enhancements:

- JWT-based authentication
- Username/email registration and login
- Google OAuth sign-in
- Protected task APIs
- Task CRUD operations
- Task filtering by status
- PostgreSQL database integration with Prisma ORM
- AI-generated task guidance with Gemini and deterministic fallback
- Guidance persistence to avoid unnecessary repeat AI calls
- Password creation/update support for both local and Google-based accounts

## Tech Stack

### Frontend

- React 19
- TypeScript
- Vite
- Axios
- React Router
- Tailwind CSS v4

### Backend

- Node.js
- Express
- TypeScript
- Prisma ORM
- PostgreSQL
- JWT authentication

### External Services

- Supabase PostgreSQL
- Google Identity Services
- Gemini API

## Repository Structure

```text
.
|-- backend
|   |-- prisma
|   |-- src
|   |-- tests
|   `-- package.json
|-- frontend
|   |-- src
|   `-- package.json
`-- README.md
```

## Features

### Authentication

- Register with username, name, email, and password
- Login with either username or email
- Google OAuth sign-in
- JWT-protected API routes
- Profile-based session restoration on frontend refresh
- Change password flow
- Google users can create a password later without needing an existing one

### Task Management

- Create tasks
- View all tasks for the authenticated user
- Update task details
- Delete tasks
- Filter tasks by:
  - To Do
  - In Progress
  - Completed

### AI Guidance

- Generate task-specific execution guidance
- Guidance is stored in the database
- Clicking AI Assist reuses the latest saved guidance instead of generating again
- Regenerate is available when a fresh AI response is needed
- Gemini is used as the primary provider
- If Gemini fails or is unavailable, the backend falls back to a deterministic local strategy

## Application Flow

1. User signs up, logs in, or signs in with Google.
2. Frontend stores the JWT and fetches the authenticated profile.
3. User creates and manages tasks from the dashboard.
4. User can open AI Assist for a task to view the latest stored guidance.
5. If no guidance exists yet, the backend generates and stores one.
6. User can regenerate guidance explicitly if needed.

## Prerequisites

Before running the project, make sure you have:

- Node.js 18 or newer
- npm
- A PostgreSQL database
- A Google OAuth Web Client ID
- A Gemini API key if AI guidance should use Gemini

## Environment Configuration

Use the provided example files as the starting point:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

On Windows PowerShell:

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

Then replace the placeholder values with your real credentials and URLs.

## Backend Environment

`backend/.env.example` includes the full backend environment surface. The final `backend/.env` should look like this:

```env
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:3000

DATABASE_URL="postgresql://postgres.your-project-ref:your-db-password@aws-1-region.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.your-project-ref:your-db-password@aws-1-region.pooler.supabase.com:5432/postgres"

JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=7d

GOOGLE_CLIENT_ID=your_google_client_id

GEMINI_API_KEY=your_gemini_api_key
GEMINI_PRIMARY_MODEL=gemini-2.5-flash
GEMINI_FALLBACK_MODELS=gemini-2.5-flash-lite,gemini-2.0-flash

AUTH_RATE_LIMIT_WINDOW_MS=900000
AUTH_RATE_LIMIT_MAX=20
AI_RATE_LIMIT_WINDOW_MS=60000
AI_RATE_LIMIT_MAX=5
```

Notes:

- `DATABASE_URL` is the runtime PostgreSQL connection string.
- `DIRECT_URL` is used by Prisma CLI operations.
- For Supabase, do not use the project `https://...supabase.co` URL as `DATABASE_URL`.

## Frontend Environment

`frontend/.env.example` includes the frontend environment variables used by the app. The final `frontend/.env` should look like this:

```env
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

## Google OAuth Setup

Create a Google OAuth Web Client in Google Cloud Console and add the following authorized JavaScript origin during local development:

```text
http://localhost:3000
```

If you deploy the frontend, add the production frontend origin as well.

## Installation

### 1. Clone the repository

```bash
git clone <your-repository-url>
cd Jay-Anantkaal
```

### 2. Install backend dependencies

```bash
cd backend
npm install
```

### 3. Install frontend dependencies

```bash
cd ../frontend
npm install
```

## Database Setup

From the `backend` directory:

```bash
npx prisma generate
npx prisma db push
```

If Prisma asks for confirmation during schema sync:

```bash
npx prisma db push --accept-data-loss
```

## Running the Project

Open two terminals.

### Terminal 1: Backend

```bash
cd backend
npm run dev
```

The backend runs on:

```text
http://localhost:5000
```

### Terminal 2: Frontend

```bash
cd frontend
npm run dev
```

The frontend runs on:

```text
http://localhost:3000
```

## Deployment

### Live Applications

- Frontend: `https://jay-anantkaal.vercel.app`
- Backend: `https://jay-anantkaal.onrender.com`

### Frontend Deployment

The frontend is deployed on Vercel.

- Root directory: `frontend`
- Build command: `npm run build`
- Output directory: `dist`

The Vercel deployment rewrites `/api/*` requests to the Render backend:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "https://jay-anantkaal.onrender.com/api/$1"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### Backend Deployment

The backend is deployed on Render.

- Root directory: `backend`
- Build command: `npm install && npm run build`
- Start command: `npm start`

Render environment notes:

- `CLIENT_URL` should point to the Vercel frontend origin
- `PORT` should be provided by Render and does not need to be hardcoded
- Prisma Client is generated during install/build for clean deploy environments
- Set `VITE_GOOGLE_CLIENT_ID` in Vercel, not `GOOGLE_CLIENT_ID`

## Build Commands

### Backend

```bash
cd backend
npm run build
```

### Frontend

```bash
cd frontend
npm run build
```

## Test Commands

### Backend tests

```bash
cd backend
npm test
```

Current backend tests validate route contracts for auth and task APIs without writing to the real database.

## API Reference

Base URL:

```text
http://localhost:5000/api
```

### Auth Endpoints

#### Register

`POST /auth/register`

Request body:

```json
{
  "username": "stepn1",
  "name": "Stepn1",
  "email": "stepn1@example.com",
  "password": "StrongPass123"
}
```

#### Login

`POST /auth/login`

Request body:

```json
{
  "identifier": "stepn1",
  "password": "StrongPass123"
}
```

`identifier` can be either username or email.

#### Google OAuth

`POST /auth/oauth/google`

Request body:

```json
{
  "idToken": "google_id_token"
}
```

#### Get Current User

`GET /auth/me`

Headers:

```text
Authorization: Bearer <jwt_token>
```

#### Change Password

`POST /auth/change-password`

Headers:

```text
Authorization: Bearer <jwt_token>
```

For local accounts:

```json
{
  "currentPassword": "OldPassword123",
  "newPassword": "NewPassword123"
}
```

For Google users who do not have a password yet:

```json
{
  "newPassword": "NewPassword123"
}
```

### Task Endpoints

All task routes require:

```text
Authorization: Bearer <jwt_token>
```

#### Get Tasks

`GET /tasks`

Optional query:

```text
?status=To Do
?status=In Progress
?status=Completed
```

#### Create Task

`POST /tasks`

Request body:

```json
{
  "title": "React learning",
  "description": "Need to learn React basics in 2 days",
  "status": "TODO",
  "priority": "HIGH",
  "dueDate": "2026-03-24"
}
```

#### Update Task

`PUT /tasks/:taskId`

or

`PATCH /tasks/:taskId`

#### Delete Task

`DELETE /tasks/:taskId`

#### Generate Guidance

`POST /tasks/:taskId/guidance`

This creates and stores a new guidance record. The frontend now reuses the most recent saved guidance by default and only regenerates when explicitly requested.

## Frontend Notes

- API requests are sent to `/api` and proxied by Vite to `http://localhost:5000`
- In production, `/api` is rewritten by Vercel to the Render backend
- JWT is attached automatically through the Axios interceptor
- Protected routes redirect unauthenticated users to `/login`
- Google sign-in is rendered using Google Identity Services on the auth page

## Backend Notes

- CORS is enabled for `CLIENT_URL`
- Prisma is configured for PostgreSQL
- AI guidance uses Gemini first, then fallback models, then a local fallback strategy
- Guidance entries are stored in the `task_guidances` table
- Auth and AI routes include rate limiting

## Project Status

Implemented and working:

- Authentication
- Google OAuth
- Task CRUD
- Status filtering
- JWT-protected APIs
- Password setup and update
- AI task guidance
- Guidance persistence
- Backend tests

## Known Development Notes

- Backend `npm run dev` currently builds and runs the compiled server directly for reliability
- If you change backend code, rerun the backend command to pick up the latest build
- If AI guidance falls back, check the backend console logs for Gemini-specific warnings

## Submission-Oriented Summary

This project satisfies the assignment requirements for:

- user management
- authentication
- task CRUD
- status filtering
- SQL database storage

It also adds:

- Google OAuth
- AI guidance generation
- stored guidance reuse
- password creation for OAuth users
- route protection and rate limiting

## License

This project was created for assignment and portfolio purposes.
