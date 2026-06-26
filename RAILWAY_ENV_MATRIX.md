# Railway Environment Variable Matrix

Use this as the single source of truth for Railway variables across both services.

## 1) Fill These Once

- `<RAILWAY_FRONTEND_PUBLIC_URL>`: your frontend Railway public URL (example: `https://noble-savage-frontend.up.railway.app`)
- `<RAILWAY_BACKEND_PUBLIC_URL>`: your backend Railway public URL (example: `https://noble-savage-backend.up.railway.app`)
- `<DATABASE_URL>`: Postgres/Supabase connection string
- `<JWT_SECRET_32_PLUS_CHARS>`: strong random secret
- `<OPENROUTER_API_KEY>`: OpenRouter key

## 2) Backend Service Variables (service root: `backend/`)

Copy/paste into Railway backend service variables:

```env
APP_ENV=production
DATABASE_URL=<DATABASE_URL>
JWT_SECRET=<JWT_SECRET_32_PLUS_CHARS>
TOKEN_TTL_MINUTES=720
FRONTEND_ORIGINS=<RAILWAY_FRONTEND_PUBLIC_URL>
CORS_ALLOW_ORIGIN_REGEX=
OPENROUTER_API_KEY=<OPENROUTER_API_KEY>
OPENROUTER_MODEL=openai/gpt-4o-mini
OPENROUTER_EMBEDDING_MODEL=openai/text-embedding-3-small
OPENROUTER_SITE_URL=<RAILWAY_FRONTEND_PUBLIC_URL>
OPENROUTER_SITE_NAME=Noble Savage OS
```

Notes:
- `FRONTEND_ORIGINS` accepts multiple origins as comma-separated values.
- Leave `CORS_ALLOW_ORIGIN_REGEX` empty unless you need wildcard host patterns.

## 3) Frontend Service Variables (service root: `frontend/`)

Copy/paste into Railway frontend service variables:

```env
NEXT_PUBLIC_API_URL=<RAILWAY_BACKEND_PUBLIC_URL>
```

## 4) Cross-Service Sync Rules (must all be true)

1. `NEXT_PUBLIC_API_URL` equals backend public URL.
2. `FRONTEND_ORIGINS` contains frontend public URL.
3. `OPENROUTER_SITE_URL` equals frontend public URL.
4. Backend and frontend are deployed from correct roots (`backend/` and `frontend/`).

## 5) Smoke Test After Deploy

1. Open `<RAILWAY_FRONTEND_PUBLIC_URL>` and verify login page renders.
2. Register/login and confirm onboarding, assistant, and task board load.
3. Open `<RAILWAY_BACKEND_PUBLIC_URL>/health` and verify `{"message":"ok"}`.
4. Create a task and verify it appears immediately.
5. Change task status and verify live update without refresh.

## 6) Common Failure Map

- Symptom: login/API calls fail from frontend.
  - Check: `NEXT_PUBLIC_API_URL` is set, has `https://`, no trailing slash required.

- Symptom: browser CORS error.
  - Check: backend `FRONTEND_ORIGINS` includes exact frontend URL.

- Symptom: backend boots locally but crashes on Railway.
  - Check: `APP_ENV=production` and `JWT_SECRET` is 32+ characters.

- Symptom: assistant returns provider/config errors.
  - Check: `OPENROUTER_API_KEY` exists and backend can reach OpenRouter.