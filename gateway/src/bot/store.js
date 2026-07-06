// ============================================================
// Tiny JSON-file state store.
// Keyed by Discord user ID. Each worker record holds:
//   redditUsername  — the verified Reddit account
//   activeClaim     — the single task they currently hold (or null)
//   lastTaskAt      — ms timestamp of when their last task was handed out
//   ticketChannelId — their private ticket channel (ticket delivery mode)
//   pendingVerify   — { username, token } during the verify handshake
// ============================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, '..', 'bot_state.json');

const emptyStats = () => ({ claimed: 0, submitted: 0, rejected: 0, byType: { post: 0, comment: 0 } });

let state = { users: {}, stats: emptyStats() };

function load() {
  try {
    if (fs.existsSync(FILE)) {
      state = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
      if (!state.users) state.users = {};
      if (!state.stats) state.stats = emptyStats();
      if (!state.stats.byType) state.stats.byType = { post: 0, comment: 0 };
    }
  } catch (e) {
    console.error('⚠️  Could not read bot_state.json, starting fresh.', e.message);
    state = { users: {}, stats: emptyStats() };
  }
}

function save() {
  try {
    fs.writeFileSync(FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('⚠️  Could not write bot_state.json:', e.message);
  }
}

load();

export function getUser(discordId) {
  return state.users[discordId] || null;
}

export function upsertUser(discordId, patch) {
  const existing = state.users[discordId] || {};
  state.users[discordId] = { ...existing, ...patch };
  save();
  return state.users[discordId];
}

export function clearUser(discordId) {
  delete state.users[discordId];
  save();
}

export function setActiveClaim(discordId, claim) {
  upsertUser(discordId, { activeClaim: claim, lastTaskAt: Date.now() });
  state.stats.claimed += 1;
  const t = claim?.interaction_type === 'comment' ? 'comment' : 'post';
  state.stats.byType[t] = (state.stats.byType[t] || 0) + 1;
  save();
}

export function clearActiveClaim(discordId) {
  const u = state.users[discordId];
  if (u) {
    u.activeClaim = null;
    save();
  }
}

export function recordSubmit() {
  state.stats.submitted += 1;
  save();
}

// ── Reject spam protection (rolling 24h window) ──────────────

const DAY_MS = 24 * 60 * 60 * 1000;

// How many rejects has this user done in the last 24h?
export function rejectCountLast24h(discordId) {
  const u = state.users[discordId];
  if (!u?.rejects?.length) return 0;
  const cutoff = Date.now() - DAY_MS;
  return u.rejects.filter((t) => t >= cutoff).length;
}

// Returns { ok } if under the limit, else { ok:false, resetAt } (ms) when the
// oldest reject in the window ages out and a slot frees up.
export function rejectLimitStatus(discordId, limit) {
  const u = state.users[discordId];
  const cutoff = Date.now() - DAY_MS;
  const recent = (u?.rejects || []).filter((t) => t >= cutoff);
  if (recent.length < limit) return { ok: true, used: recent.length };
  const oldest = Math.min(...recent);
  return { ok: false, used: recent.length, resetAt: oldest + DAY_MS };
}

// Record a reject now (and prune old entries).
export function recordReject(discordId) {
  const u = state.users[discordId] || {};
  const cutoff = Date.now() - DAY_MS;
  const rejects = (u.rejects || []).filter((t) => t >= cutoff);
  rejects.push(Date.now());
  u.rejects = rejects;
  state.users[discordId] = u;
  state.stats.rejected += 1;
  save();
}

// ── Aggregate stats for operators ────────────────────────────

export function getStats() {
  const users = Object.values(state.users);
  const linked = users.filter((u) => u.redditUsername).length;
  const active = users.filter((u) => {
    const c = u.activeClaim;
    if (!c) return false;
    const exp = c.expiresAt || new Date(c.expires_at).getTime();
    return exp > Date.now();
  }).length;
  const cutoff = Date.now() - DAY_MS;
  const rejects24h = users.reduce((n, u) => n + (u.rejects || []).filter((t) => t >= cutoff).length, 0);
  return {
    linkedWorkers: linked,
    activeTasks: active,
    totalClaimed: state.stats.claimed,
    totalSubmitted: state.stats.submitted,
    totalRejected: state.stats.rejected,
    byType: state.stats.byType,
    rejects24h,
  };
}

// Returns { ok } if allowed, or { ok:false, remainingMs } if still cooling down.
export function cooldownStatus(discordId, cooldownMs) {
  const u = state.users[discordId];
  if (!u || !u.lastTaskAt) return { ok: true };
  const elapsed = Date.now() - u.lastTaskAt;
  if (elapsed >= cooldownMs) return { ok: true };
  return { ok: false, remainingMs: cooldownMs - elapsed };
}

// Find a discord user by their linked reddit username (for lookups).
export function findByReddit(username) {
  const lower = String(username).toLowerCase();
  for (const [id, u] of Object.entries(state.users)) {
    if (u.redditUsername && u.redditUsername.toLowerCase() === lower) {
      return { discordId: id, ...u };
    }
  }
  return null;
}

// ── Payout wallet + settlement records ───────────────────────

export function setWallet(discordId, method, address) {
  upsertUser(discordId, { wallet: { method, address, setAt: Date.now() } });
}

export function getWallet(discordId) {
  return state.users[discordId]?.wallet || null;
}

// Record a manual payout the operator made to a worker (bot-side bookkeeping).
export function recordPayout(discordId, entry) {
  const u = state.users[discordId] || {};
  u.payouts = u.payouts || [];
  u.payouts.push({ ...entry, at: Date.now() });
  state.users[discordId] = u;
  save();
}

export function totalPaid(discordId) {
  const u = state.users[discordId];
  if (!u?.payouts?.length) return 0;
  return u.payouts.reduce((n, p) => n + (Number(p.amount) || 0), 0);
}

// All users with a linked Reddit account: [{ discordId, ...record }]
export function listLinkedUsers() {
  return Object.entries(state.users)
    .filter(([, u]) => u.redditUsername)
    .map(([discordId, u]) => ({ discordId, ...u }));
}
