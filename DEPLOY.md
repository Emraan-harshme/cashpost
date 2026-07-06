# Deploy CashPost to Render

You'll create **two** free services on [render.com](https://render.com) from this one repo:

1. **Gateway** (backend) — safely holds your Redwire API key.
2. **Storefront** (frontend) — the site your posters visit.

You need: a Render account, and your **Redwire operator API key** (from your Redwire operator dashboard).

---

## Step 1 — Deploy the Gateway (backend)

1. Render dashboard → **New +** → **Web Service** → **Build and deploy from a Git repository** → connect this repo.
2. Settings:
   - **Root Directory:** `gateway`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
3. Under **Environment**, add:
   - `REDWIRE_API_KEY` = *your secret Redwire operator key*
   - (leave `ALLOWED_ORIGINS` empty for now)
4. Click **Create Web Service**. When it's live, copy its URL, e.g.
   `https://cashpost-gateway.onrender.com`

---

## Step 2 — Deploy the Storefront (frontend)

1. **New +** → **Static Site** → same repo.
2. Settings:
   - **Root Directory:** *(leave blank)*
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`
3. Under **Environment**, add:
   - `VITE_GATEWAY_URL` = your gateway URL from Step 1 **with `/v1` on the end**, e.g.
     `https://cashpost-gateway.onrender.com/v1`
   - `VITE_OPERATOR_NAME` = `CashPost`
4. Click **Create Static Site**. Copy its URL, e.g. `https://cashpost-storefront.onrender.com`

---

## Step 3 — Lock it down (1 minute)

1. Go back to the **Gateway** service → **Environment**.
2. Set `ALLOWED_ORIGINS` = your storefront URL from Step 2 (no trailing slash), e.g.
   `https://cashpost-storefront.onrender.com`
3. Save → it redeploys. Done.

Your posters use the **storefront** URL. Your secret key lives only in the gateway.

---

## Keep it awake (recommended)

Render's free backend sleeps after ~15 min idle (first request then takes ~30–60s).
Add a free uptime ping so it stays warm:

- Go to [cron-job.org](https://cron-job.org) (or UptimeRobot) → new job →
  URL `https://cashpost-gateway.onrender.com/health` → every 10 minutes.

---

## Optional — run the Discord bot too

If you want posters to use a Discord bot instead of (or alongside) the site, on the
**Gateway** service set these env vars and redeploy:

- `RUN_BOT` = `true`
- `DISCORD_TOKEN` = your bot token
- `DISCORD_CLIENT_ID` = your app's client ID
- `DISCORD_GUILD_ID` = your server ID
- `OPERATOR_LOG_CHANNEL_ID`, `STAFF_ROLE_ID` = optional

Then register the bot's commands once (locally, from the `gateway` folder):
`npm install && npm run register`

The uptime ping from the step above also keeps the bot online.

---

### Tips
- Free tier allows ~750 hours/month ≈ one always-on service — fine for the gateway.
- Never put the Redwire key in the storefront/frontend — only in the gateway.
- Changing env vars requires a redeploy (Render does this automatically on save).
