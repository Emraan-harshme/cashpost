# Redwire Operator Gateway

The **backend** half of an operator storefront. It holds your **secret** Redwire
operator API key server-side and exposes only the **poster-safe** endpoints the
static frontend needs. The key is **never** shipped to the browser.

Optionally, it can run the **Discord bot** in the same process (`RUN_BOT=true`).

```
Static storefront (no key)  ──►  THIS gateway (holds key)  ──►  api.redwire.work/v1
                                   • injects x-api-key
                                   • poster-safe routes only
                                   • CORS-locked + rate-limited
                                   • optional Discord bot
```

## Why this exists

A static site (Vite build) **cannot keep a secret** — anything in the bundle is
readable by anyone. So the operator API key lives here, on the server, and the
frontend only knows this gateway's public URL.

## What it exposes (and what it deliberately doesn't)

Proxied (poster-safe), mounted under `/v1`:
`POST /accounts/verify`, `GET /campaigns`, `POST /claim`, `POST /submit`,
`POST /reject`, `GET /submissions`, `GET /balance`, plus `GET /health`.

**Not** exposed (sensitive operator ops): `accounts/register`,
`accounts/bulk-register`, `/accounts/:username`, and operator-wide reads. These
simply don't exist on the gateway, so a leaked gateway URL can't reach them.

## Setup (Render, free tier)

1. Deploy this folder as a **Web Service** (Node). Use the included `render.yaml`
   or set build `npm install`, start `npm start`.
2. Set env vars in the Render dashboard:
   - `REDWIRE_API_KEY` — your **secret** operator key
   - `ALLOWED_ORIGINS` — your frontend URL(s), comma-separated
   - (optional) `STOREFRONT_TOKEN` — a shared token your frontend also sends
   - (optional) `RUN_BOT=true` + the Discord vars to run the bot here too
3. Copy the service URL (e.g. `https://your-gateway.onrender.com`).
4. In each **frontend**, set `VITE_GATEWAY_URL=https://your-gateway.onrender.com/v1`
   and redeploy.
5. **Keep-alive:** Render's free web service sleeps after ~15 min idle. Add a cron
   ping (cron-job.org / UptimeRobot) to `https://your-gateway.onrender.com/health`
   every ~10 min. This also keeps the Discord bot online when `RUN_BOT=true`.
   Note: free tier is ~750 instance-hrs/month ≈ one always-on service.

## Env vars

See `.env.example`. Essentials: `REDWIRE_API_KEY`, `ALLOWED_ORIGINS`.
Bot vars are only needed when `RUN_BOT=true` (see `src/bot` / the bot README).

## Running the bot

- In-process with the gateway: set `RUN_BOT=true` and the Discord vars, then the
  gateway boots the bot after the HTTP server. A bot misconfig will **not** take
  the gateway down (it logs and keeps serving).
- Register slash commands once: `npm run register`.
- Standalone (no gateway): `node src/bot/index.js`.

## Local dev

```
cp .env.example .env      # fill REDWIRE_API_KEY, ALLOWED_ORIGINS
npm install
npm start                 # gateway on :8080
```
Point a template's `VITE_GATEWAY_URL` at `http://localhost:8080/v1`.

## Security notes

- Secret key stays server-side; the frontend bundle contains no key (verify with
  `grep -r x-api-key dist/` on a built template — you'll find nothing).
- CORS is locked to `ALLOWED_ORIGINS`; requests from other origins get no CORS
  headers. Rate limiting is per-IP (`RATE_LIMIT_*`).
- A found gateway URL only grants poster-safe, rate-limited actions against this
  one operator — and meaningful abuse still requires verified Reddit accounts.
