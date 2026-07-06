// Optional "Sign in with Google" via Google Identity Services (GIS).
// No backend, no database: uses the OAuth token flow entirely client-side.
// Enabled only when VITE_GOOGLE_CLIENT_ID is set; otherwise callers fall back
// to the Reddit-verification gate. The Google identity is a convenience layer —
// payouts are still tied to the verified Reddit account.

export interface GoogleUser {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

export const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
export const googleEnabled = !!googleClientId;

let gisPromise: Promise<void> | null = null;

function loadGis(): Promise<void> {
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    if ((window as any).google?.accounts?.oauth2) return resolve();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(s);
  });
  return gisPromise;
}

// Triggers Google's popup from a user click and resolves the profile.
export async function signInWithGoogle(): Promise<GoogleUser> {
  if (!googleClientId) throw new Error('google_disabled');
  await loadGis();
  const google = (window as any).google;
  return new Promise<GoogleUser>((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: googleClientId,
      scope: 'openid email profile',
      callback: async (resp: any) => {
        if (resp?.error) return reject(new Error(resp.error));
        try {
          const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${resp.access_token}` },
          });
          const u = await r.json();
          const user: GoogleUser = { sub: u.sub, email: u.email, name: u.name, picture: u.picture };
          localStorage.setItem('cashpost_google_user', JSON.stringify(user));
          resolve(user);
        } catch (e) {
          reject(e as Error);
        }
      },
    });
    client.requestAccessToken();
  });
}

export function getGoogleUser(): GoogleUser | null {
  try {
    const raw = localStorage.getItem('cashpost_google_user');
    return raw ? (JSON.parse(raw) as GoogleUser) : null;
  } catch {
    return null;
  }
}
