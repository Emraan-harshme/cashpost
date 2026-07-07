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

// ── Health checks FIRST — never blocked by CORS/rate-limit/auth ─────
// Render marks the deploy "Live" only once these return 200.
const health = (_req, res) => res.status(200).json({ ok: true, bot: config.runBot, ts: Date.now() });
app.get('/health', health);
app.get('/healthz', health);
app.get('/', (_req, res) => res.status(200).send('ok'));

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

// ── Rate limiting (per IP) — skips health paths ─────────────
app.use(
  rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === '/health' || req.path === '/healthz' || req.path === '/',
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

// ── Proxy ───────────────────────────────────────────────────
app.use('/v1', proxy);

app.listen(config.port, '0.0.0.0', () => {
  console.log('─'.repeat(50));
  console.log(`🛡️  Gateway listening on 0.0.0.0:${config.port}`);
  console.log(`   Upstream : ${config.apiBaseUrl}`);
  console.log(`   Origins  : ${config.allowedOrigins.length ? config.allowedOrigins.join(', ') : '(any — set ALLOWED_ORIGINS!)'}`);
  console.log(`   Token    : ${config.storefrontToken ? 'required' : 'disabled'}`);
  console.log(`   Bot      : ${config.runBot ? 'ON (same process)' : 'off'}`);
  console.log('─'.repeat(50));
});

// ── Optionally run the Discord bot in the same process ──────
if (config.runBot) {
  if (!process.env.DISCORD_TOKEN || process.env.DISCORD_TOKEN.trim() === '') {
    console.warn('⚠️  RUN_BOT=true but DISCORD_TOKEN is missing — skipping bot. Gateway stays up.');
  } else {
    try {
      const bot = await import('./bot/index.js');
      await bot.startBot();

      // ── Leah remote control (owner-gated) ──────────────────
      // Lets the Redwire owner order this bot to create invites / broadcast DMs
      // WITHOUT the bot token. Auth = the operator's own API key (shown in their
      // Redwire dashboard) or an optional distinct LEAH_KEY override.
      const leahKeys = [config.leahKey, config.apiKey].filter(Boolean);
      if (leahKeys.length) {
        const leahAuth = (req, res, next) => {
          const key = req.get('x-leah-key') || (req.get('authorization')?.startsWith('Bearer ') ? req.get('authorization').slice(7) : null);
          if (!key || !leahKeys.includes(key)) return res.status(401).json({ error: 'invalid_leah_key' });
          next();
        };

        app.post('/admin/invite', leahAuth, async (req, res) => {
          try {
            const out = await bot.createGuildInvite({ guildId: req.body?.guildId, channelId: req.body?.channelId });
            res.json({ ok: true, ...out });
          } catch (e) {
            res.status(400).json({ error: e.message });
          }
        });

        app.post('/admin/broadcast', leahAuth, async (req, res) => {
          try {
            const { message, guildId, batchSize, delayMs, dryRun } = req.body || {};
            const out = await bot.broadcastDMs({ message, guildId, batchSize, delayMs, dryRun });
            res.json({ ok: true, ...out });
          } catch (e) {
            res.status(400).json({ error: e.message });
          }
        });

        console.log(`   Leah ctl : enabled (auth: operator API key${config.leahKey ? ' or LEAH_KEY' : ''})`);
      }
    } catch (e) {
      console.error('❌  Bot failed to start (gateway continues serving):', e.message);
    }
  }
}
