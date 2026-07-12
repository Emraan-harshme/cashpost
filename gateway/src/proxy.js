// ============================================================
// Poster-safe proxy. ONLY these endpoints exist here. The secret
// operator key is injected server-side; the browser never sees it.
// Sensitive operator routes (register, bulk-register, /accounts/:username,
// operator-wide reads) are intentionally NOT proxied.
// ============================================================

import { Router } from 'express';
import { config } from './config.js';

const router = Router();

// Forward the current request to the real Redwire API with the key attached.
async function forward(req, res) {
  if (!config.apiKey) {
    return res.status(500).json({ error: 'gateway_not_configured', message: 'REDWIRE_API_KEY is not set on the gateway.' });
  }
  const qs = req.originalUrl.includes('?') ? '?' + req.originalUrl.split('?')[1] : '';
  const target = `${config.apiBaseUrl}${req.path}${qs}`;

  const init = {
    method: req.method,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
    },
  };
  for (const h of ['x-discord-id', 'x-reddit-username', 'x-device-fingerprint']) {
    const v = req.headers[h];
    if (v) init.headers[h] = v;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = JSON.stringify(req.body ?? {});
  }

  try {
    const upstream = await fetch(target, init);
    const text = await upstream.text();
    res.status(upstream.status);
    // Pass JSON through untouched; fall back to raw text.
    try {
      res.json(JSON.parse(text));
    } catch {
      res.type('application/json').send(text || '{}');
    }
  } catch (e) {
    console.error('[GATEWAY_FORWARD]', req.method, req.path, e.message);
    res.status(502).json({ error: 'gateway_upstream_error', message: 'Could not reach the Redwire API.' });
  }
}

// ── Poster-safe surface (mirrors what the storefront templates call) ──
router.post('/accounts/verify', forward);
router.get('/me', forward);
router.get('/campaigns', forward);
router.post('/claim', forward);
router.post('/submit', forward);
router.post('/reject', forward);
router.post('/release', forward);
router.get('/submissions', forward);
router.get('/balance', forward);
router.get('/tasks/stats', forward);
router.get('/operator/config', forward);
router.post('/accounts/:username/suspend', forward);
router.post('/accounts/:username/unsuspend', forward);

export default router;
