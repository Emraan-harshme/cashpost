// ============================================================
// Gateway config (loaded from .env)
// ============================================================

import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT ?? '8080', 10),

  // The SECRET operator key — server-side only, never sent to the browser.
  apiKey: process.env.REDWIRE_API_KEY || '',
  apiBaseUrl: (process.env.REDWIRE_API_BASE_URL || 'https://api.redwire.work/v1').replace(/\/$/, ''),

  // Frontend origins allowed to call this gateway.
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean),

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX ?? '60', 10),
  },

  // Optional shared token the frontend sends in X-Storefront-Token.
  storefrontToken: process.env.STOREFRONT_TOKEN || '',

  runBot: String(process.env.RUN_BOT || 'false').toLowerCase() === 'true',
};

export function assertGatewayConfig() {
  // Warn (don't crash) so the service still goes "Live" on Render and the logs
  // show the problem, instead of crash-looping forever in "Deploying".
  if (!config.apiKey) {
    console.error('❌  REDWIRE_API_KEY is not set — proxy calls will fail until you add it in the service env.');
  }
  if (config.allowedOrigins.length === 0) {
    console.warn('⚠️  ALLOWED_ORIGINS is empty — the gateway will accept any origin. Set it in production.');
  }
}
