// Discord OAuth2 implicit grant — client-side only, no backend.
// Enabled when VITE_DISCORD_CLIENT_ID is set.

export const discordClientId = import.meta.env.VITE_DISCORD_CLIENT_ID as string | undefined;
export const discordEnabled = !!discordClientId;

export async function signInWithDiscord(): Promise<{ discordId: string; discordAccessToken: string; discordUser: any }> {
  if (!discordClientId) throw new Error('discord_disabled');

  const redirectUri = window.location.origin;
  const state = crypto.randomUUID();
  const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${discordClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=identify&state=${state}`;

  return new Promise((resolve, reject) => {
    const popup = window.open(authUrl, 'discord-auth', 'width=500,height=700');
    if (!popup) return reject(new Error('Popup blocked — allow popups for this site.'));

    const timer = setInterval(() => {
      try {
        if (popup.closed) { clearInterval(timer); reject(new Error('Login window closed.')); return; }
        let hash;
        try { hash = popup.location.hash; } catch { return; }
        if (!hash) return;
        clearInterval(timer);
        popup.close();

        const params = new URLSearchParams(hash.slice(1));
        const accessToken = params.get('access_token');
        if (!accessToken) return reject(new Error('No access token returned from Discord.'));

        fetch('https://discord.com/api/users/@me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Discord API rejected token'))))
          .then((user) => {
            const du = { id: user.id, username: user.username, avatar: user.avatar };
            localStorage.setItem('discord_user', JSON.stringify(du));
            localStorage.setItem('discord_access_token', accessToken);
            resolve({ discordId: user.id, discordAccessToken: accessToken, discordUser: du });
          })
          .catch(reject);
      } catch { /* popup still loading */ }
    }, 300);
    setTimeout(() => { clearInterval(timer); reject(new Error('Discord login timed out.')); }, 120_000);
  });
}

export function getDiscordUser(): any {
  try { const raw = localStorage.getItem('discord_user'); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export function getDiscordAccessToken(): string | null {
  return localStorage.getItem('discord_access_token') || null;
}
