@AGENTS.md

# Running this project locally

Everything (Node, Docker, this repo, `.env.local`) is already set up on this machine. When asked to run/launch the project, just do this — no need to re-derive or check status first:

1. `start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"` if Docker isn't already up (check with `docker info`), then poll `docker info` until it responds (usually ~10-30s).
2. From the repo root: `npx supabase@latest start` — boots local Postgres/Auth/Studio and applies migrations. Safe to run even if already running (idempotent).
3. Check if a dev server is already listening on port 3000 (`netstat -ano | grep ":3000" | grep LISTENING`) before starting a new one — `next dev` refuses to double-bind and just idles on 3001 if one's already up, which is wasted work. If none is running: `npm run dev` (run in background).
4. Poll `http://localhost:3000` until it responds, then open it: `start "" "http://localhost:3000"`.

To stop: `npx supabase stop`, and kill whatever PID `netstat` shows listening on port 3000.

Local Supabase Studio: http://127.0.0.1:54323

