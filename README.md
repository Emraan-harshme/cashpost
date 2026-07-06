# CashPost — Redwire Operator Frontend

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Emraan-harshme/cashpost)

> **Quick deploy:** click the button (creates both services from `render.yaml`), or follow the step-by-step in [`DEPLOY.md`](./DEPLOY.md). Never put your Redwire key in this frontend — it goes in the gateway.

Neon cyberpunk terminal aesthetic — near-black canvas, lime/cyan accents, monospace type, bottom dock navigation.

This is one of five visually distinct operator storefronts. All five share the **exact same backend
API integration, business logic, verification flow, task/claim/submit lifecycle, stops, and settings** —
only the look, layout, and navigation differ. Each is meant to look like a separate platform while
running on the same Redwire franchise API.

## Setup

1. Copy `.env.example` to `.env`
2. Fill in your API key and operator name
3. Run `npm install && npm run dev` to test locally
4. Deploy to Vercel: connect repo, add env vars in the Vercel dashboard, deploy

## Environment variables

```
VITE_API_BASE_URL=https://api.redwire.work/v1
VITE_API_KEY=           # Your Redwire operator API key (from your operator dashboard)
VITE_OPERATOR_NAME=     # Your brand name shown to posters
```

## How it works

Posters visit your hosted URL, enter their Reddit username, and verify by placing a token in their
profile bio. They then see available tasks, claim one, complete it on Reddit, and submit the post URL.
Payout tracking is visible in the Earnings tab. All task data comes from the Redwire API — no backend
setup required.

## Scripts

- `npm run dev` — start dev server on port 3000
- `npm run build` — production build to `dist/`
- `npm run preview` — preview the production build
- `npm run lint` — TypeScript type-check (`tsc --noEmit`)

## Shared API surface (identical across all five versions)

- `POST /accounts/verify` — username + bio-token verification
- `GET  /campaigns` — available tasks
- `POST /claim` — claim a task slot
- `POST /submit` — submit completed post URL
- `POST /reject` — reject an assigned task (reason required)
- `GET  /submissions` — paginated submission history
- `GET  /balance` — earnings (available / pending / lifetime)

## Backend gateway (required)

This frontend is **static and holds no API key**. It talks only to your own
**gateway** backend, which holds the secret Redwire key server-side.

1. Deploy the gateway first (see the `gateway/` project). Copy its URL.
2. Set `VITE_GATEWAY_URL=https://your-gateway.onrender.com/v1` here and deploy.
3. (Optional) If your gateway sets `STOREFRONT_TOKEN`, set the same value as
   `VITE_STOREFRONT_TOKEN` here.

Never put a Redwire API key in this project — it would ship in the JS bundle.
