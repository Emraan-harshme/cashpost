// ============================================================
// Redwire API client — byte-for-byte the same surface the
// operator website uses (src/api.ts). Same base URL, same
// x-api-key header, same error shape { status, data }.
// ============================================================

import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = process.env.REDWIRE_API_BASE_URL || 'https://api.redwire.work/v1';
const API_KEY = process.env.REDWIRE_API_KEY || 'dummy_key';

export async function apiFetch(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch (e) {
      errorData = { message: response.statusText };
    }
    throw { status: response.status, data: errorData };
  }

  return response.json();
}

// ── High-level calls mirroring each website action ───────────

export const verifyAccount = (username, discordId) =>
  apiFetch('/accounts/verify', {
    method: 'POST',
    body: JSON.stringify({ username }),
    headers: discordId ? { 'x-discord-id': discordId } : {},
  });

// Bot recovery — check if a Discord ID is linked to a Reddit username.
export const getMe = (discordId) =>
  apiFetch('/me', { headers: discordId ? { 'x-discord-id': discordId } : {} });

// Operator config — cooldown, markup.
export const getOperatorConfig = () => apiFetch('/operator/config');

// Suspend / unsuspend a poster.
export const suspendPoster = (username) =>
  apiFetch(`/accounts/${encodeURIComponent(username)}/suspend`, { method: 'POST' });
export const unsuspendPoster = (username) =>
  apiFetch(`/accounts/${encodeURIComponent(username)}/unsuspend`, { method: 'POST' });

export const getCampaigns = async (username) => {
  const params = new URLSearchParams();
  if (username) params.set('username', username);
  const qs = params.toString();
  const data = await apiFetch(`/campaigns${qs ? `?${qs}` : ''}`);
  return Array.isArray(data) ? data : data.campaigns || [];
};

// Normalise a campaign's interaction type into 'post' | 'comment'.
export function campaignType(campaign) {
  const t = String(campaign?.interaction_type || 'post').toLowerCase();
  return t.includes('comment') ? 'comment' : 'post';
}

export const claimTask = (campaign_id, username, subreddit) =>
  apiFetch('/claim', { method: 'POST', body: JSON.stringify({ campaign_id, username, subreddit }) });

export const submitPost = (claim_id, post_url) =>
  apiFetch('/submit', { method: 'POST', body: JSON.stringify({ claim_id, post_url }) });

export const rejectTask = (claim_id, reason) =>
  apiFetch('/reject', { method: 'POST', body: JSON.stringify({ claim_id, reason }) });

export const releaseTask = (claim_id) =>
  apiFetch('/release', { method: 'POST', body: JSON.stringify({ claim_id }) });

export const getSubmissions = async (username, cursor) => {
  const params = new URLSearchParams({ limit: '50' });
  if (cursor) params.set('cursor', cursor);
  if (username) params.set('username', username);
  const data = await apiFetch(`/submissions?${params.toString()}`);
  return {
    submissions: Array.isArray(data) ? data : data.submissions || [],
    next_cursor: data.next_cursor || null,
  };
};

export const getBalance = (username) => apiFetch(`/balance${username ? `?username=${encodeURIComponent(username)}` : ''}`);

// ── Shared business rules (identical to the website) ─────────

// Submit URL must be a direct Reddit post link.
export function isValidRedditUrl(url) {
  return url.startsWith('https://reddit.com/') || url.startsWith('https://www.reddit.com/');
}

// Reject reason must be at least 10 chars.
export const MIN_REJECT_REASON = 10;

// Eligibility copy (same as the website).
export const ELIGIBILITY_TEXT =
  'Account not eligible. Requirements: 100+ Post/Comment Karma & 10+ days old.';

// Maps a verify error to the same human message the website shows.
export function verifyErrorMessage(err) {
  const error = err?.data?.error || err?.data?.message || '';
  if (err?.status === 409 || String(error).includes('already_registered')) {
    return 'This username is registered with another operator.';
  }
  if (err?.status === 404 || error === 'reddit_account_not_found') {
    return 'Reddit account not found. Please check your spelling.';
  }
  if (error === 'not_eligible') {
    return ELIGIBILITY_TEXT;
  }
  return error || 'Failed to connect to verification server.';
}

// Builds the same enriched claim object the website stores locally.
export function enrichClaim(res, campaign, subreddit) {
  return {
    claim_id: res.claim_id,
    expires_at: res.expires_at,
    expiresAt: new Date(res.expires_at).getTime(),
    campaign_id: campaign?.id,
    subreddit,
    payout: campaign?.payout ?? 0,
    post_content: campaign?.post_content ?? null,
    tier: campaign?.tier ?? null,
    interaction_type: campaign?.interaction_type ?? 'post',
    verificationPeriodDays: campaign?.verificationPeriodDays ?? 0,
    flair: campaign?.flair ?? null,
    image_url: campaign?.image_url ?? null,
    nsfw: campaign?.nsfw ?? false,
    first_comment: campaign?.first_comment ?? null,
    targetPostUrl: campaign?.targetPostUrl ?? null,
    // Server-assigned comment (comment campaigns) — reserved atomically at claim time.
    assigned_comment: res?.assigned_comment ?? null,
    assigned_comment_index: res?.assigned_comment_index ?? null,
  };
}
