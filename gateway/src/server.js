// ============================================================
// Redwire Operator Gateway — server entry.
// Serves a poster-safe proxy for the static storefront, holding the
// secret Redwire API key server-side. Optionally runs the Discord bot
// in the same process (RUN_BOT=true).
// ============================================================

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import { config, assertGatewayConfig } from './config.js';
import proxy from './proxy.js';

assertGatewayConfig();

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // behind Render's proxy
app.use(express.json({ limit: '64kb' }));

// ── CORS: only the operator's own frontend origins ──────────
app.use(
  cors({
    origin(origin, cb) {
      // Allow same-origin / server-to-server (no Origin header).
      if (!origin) return cb(null, true);
      const clean = origin.replace(/\/$/, '');
      if (config.allowedOrigins.length === 0 || config.allowedOrigins.includes(clean)) {
        return cb(null, true);
      }
      return cb(null, false);
    },
  })
);

// ── Rate limiting (per IP) ──────────────────────────────────
app.use(
  rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'rate_limited', message: 'Too many requests. Slow down.' },
  })
);

// ── Optional shared storefront token ────────────────────────
if (config.storefrontToken) {
  app.use('/v1', (req, res, next) => {
    if (req.get('x-storefront-token') !== config.storefrontToken) {
      return res.status(401).json({ error: 'invalid_storefront_token' });
    }
    next();
  });
}

// ── Health check (for uptime pings / keep-alive) ────────────
app.get('/health', (_req, res) => res.json({ ok: true, bot: config.runBot, ts: Date.now() }));

// ── Proxy ───────────────────────────────────────────────────
app.use('/v1', proxy);

app.listen(config.port, () => {
  console.log('─'.repeat(50));
  console.log(`🛡️  Redwire gateway listening on :${config.port}`);
  console.log(`   Upstream : ${config.apiBaseUrl}`);
  console.log(`   Origins  : ${config.allowedOrigins.length ? config.allowedOrigins.join(', ') : '(any — set ALLOWED_ORIGINS!)'}`);
  console.log(`   Token    : ${config.storefrontToken ? 'required' : 'disabled'}`);
  console.log(`   Bot      : ${config.runBot ? 'ON (same process)' : 'off'}`);
  console.log('─'.repeat(50));
});

// ── Optionally run the Discord bot in the same process ──────
if (config.runBot) {
  if (!process.env.DISCORD_TOKEN) {
    console.warn('⚠️  RUN_BOT=true but DISCORD_TOKEN is missing — skipping bot. Gateway stays up.');
  } else {
    try {
      const { startBot } = await import('./bot/index.js');
      await startBot();
    } catch (e) {
      console.error('❌  Bot failed to start (gateway continues serving):', e.message);
    }
  }
}
