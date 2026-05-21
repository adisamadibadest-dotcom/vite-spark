# ApexGold AI

A Gold XAUUSD trading intelligence SPA with AI chart analysis, price alerts, and trade journal — migrated from Lovable/Vercel to Replit.

## Run & Operate

- `pnpm --filter @workspace/apexgold run dev` — run the frontend (Vite, port assigned by workflow)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- Required secrets: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `GEMINI_API_KEY`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite (`artifacts/apexgold`)
- API: Express 5 (`artifacts/api-server`)
- Auth & DB: Supabase (auth, PostgreSQL)
- AI: Google Gemini via `@ai-sdk/google`
- Routing: React Router v7 with `BrowserRouter` + `basename={import.meta.env.BASE_URL}`
- Styling: Tailwind CSS + oklch dark gold theme

## Where things live

- `artifacts/apexgold/src/` — all frontend source (pages, components, hooks, integrations)
- `artifacts/apexgold/src/index.css` — ApexGold theme (CSS vars for gold/bullish/bearish colors)
- `artifacts/apexgold/src/App.tsx` — React Router routes
- `artifacts/apexgold/src/integrations/supabase/client.ts` — Supabase client (gracefully handles missing env vars)
- `artifacts/api-server/src/routes/apex.ts` — gold price, AI chat, chart analysis Express routes
- `artifacts/api-server/src/routes/index.ts` — route registrations

## Architecture decisions

- Vite SSR API handlers from the original were replaced with Express routes in `api-server`; frontend calls `/api/*` which routes through the shared proxy.
- Supabase client is initialized with a null-safe stub so the app doesn't crash if secrets are missing — auth pages show graceful errors instead.
- `@lovable.dev/cloud-auth-js` is stubbed out — not needed on Replit; auth goes directly through Supabase OAuth.
- `BrowserRouter` uses `basename={import.meta.env.BASE_URL}` so routing works correctly under the Replit proxy path prefix.
- Gold price is fetched live from gold-api.com via the api-server to keep the API key server-side.

## Product

- Landing page with live XAUUSD gold price ticker
- AI chart analysis: upload a chart image and get a structured trading playbook (bias, key levels, confluence, setup)
- AI chat assistant for XAUUSD trading questions
- Price alerts and trade journal (auth-gated via Supabase)

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Do NOT run `pnpm dev` at the workspace root — it has no dev script. Use `pnpm --filter @workspace/<name> run dev`.
- Replit apps run via named workflows, not root-level scripts.
- Frontend env vars must be prefixed `VITE_` and accessed via `import.meta.env.VITE_*`.
- The api-server builds before starting (`pnpm run build && pnpm run start`) — code changes require workflow restart.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
