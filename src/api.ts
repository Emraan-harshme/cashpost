import { getDiscordAccessToken, getDiscordUser } from './discord';
import { getFingerprintHash } from './fingerprint';

export const apiFetch = async (path: string, options?: RequestInit) => {
  const baseUrl = import.meta.env.VITE_GATEWAY_URL;
  if (!baseUrl) throw new Error('VITE_GATEWAY_URL is not configured — set it in your Render env.');

  const storefrontToken = import.meta.env.VITE_STOREFRONT_TOKEN;
  const sessionToken = localStorage.getItem('session_token') || '';
  const discordUser = getDiscordUser();
  const fp = getFingerprintHash();

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(storefrontToken ? { 'x-storefront-token': storefrontToken } : {}),
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      ...(discordUser?.id ? { 'x-discord-id': discordUser.id } : {}),
      'x-device-fingerprint': fp,
      ...options?.headers,
    },
  });

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch (e) {
      errorData = { message: response.statusText };
    }
    // If session is invalid, clear it so the user re-auths.
    if (errorData?.reauth) {
      localStorage.removeItem('session_token');
    }
    throw { status: response.status, data: errorData };
  }

  return response.json();
};

// After Discord OAuth or Reddit verify, call this to get a session JWT.
export async function establishSession(discordId: string, accessToken: string, redditUsername: string) {
  const baseUrl = import.meta.env.VITE_GATEWAY_URL;
  if (!baseUrl) return;
  const fp = getFingerprintHash();
  try {
    const res = await fetch(`${baseUrl}/v1/auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discordId, discordAccessToken: accessToken, redditUsername, fingerprint: fp }),
    });
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem('session_token', data.token);
    }
  } catch { /* gateway may not support sessions yet — non-fatal */ }
}

// Check if the Discord user is in the operator's server.
export async function checkServerMembership(): Promise<{ inServer: boolean; inviteUrl: string | null }> {
  const baseUrl = import.meta.env.VITE_GATEWAY_URL;
  if (!baseUrl) return { inServer: false, inviteUrl: null };
  const du = getDiscordUser();
  if (!du?.id) return { inServer: false, inviteUrl: null };
  try {
    const res = await fetch(`${baseUrl}/v1/auth/server-check`, {
      headers: { 'x-discord-id': du.id },
    });
    return res.ok ? res.json() : { inServer: false, inviteUrl: null };
  } catch { return { inServer: false, inviteUrl: null }; }
}
