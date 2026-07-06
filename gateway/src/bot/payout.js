// ============================================================
// Payout methods & helpers.
// Two payout rails:
//   • USDT on Polygon  — an EVM (0x…) receive address
//   • UPI              — an Indian VPA like name@bank
// Crypto coin/network is fixed to USDT-Polygon (no selection).
// ============================================================

export const METHODS = {
  usdt_polygon: {
    id: 'usdt_polygon',
    label: 'USDT (Polygon)',
    short: 'USDT·Polygon',
    placeholder: '0x… Polygon (MATIC) address',
    hint: 'Paste your Polygon wallet address. USDT is always sent on the Polygon network — do not use another chain.',
  },
  upi: {
    id: 'upi',
    label: 'UPI',
    short: 'UPI',
    placeholder: 'yourname@bank',
    hint: 'Enter your UPI ID (VPA), e.g. name@okhdfcbank.',
  },
};

// USDT on Polygon uses standard EVM addresses.
const EVM_RE = /^0x[a-fA-F0-9]{40}$/;
// UPI VPA: handle@psp
const UPI_RE = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;

export function validateAddress(method, raw) {
  const address = String(raw || '').trim();
  if (method === 'usdt_polygon') {
    if (!EVM_RE.test(address)) {
      return { ok: false, error: 'That is not a valid Polygon (0x…) address. It must start with 0x and be 42 characters.' };
    }
    return { ok: true, address };
  }
  if (method === 'upi') {
    if (!UPI_RE.test(address)) {
      return { ok: false, error: 'That is not a valid UPI ID. Format: name@bank (e.g. john@okicici).' };
    }
    return { ok: true, address: address.toLowerCase() };
  }
  return { ok: false, error: 'Unknown payout method.' };
}

export function methodLabel(method) {
  return METHODS[method]?.label || method || '—';
}

// Mask an address for display in shared/operator views.
export function maskAddress(method, address) {
  if (!address) return '—';
  if (method === 'upi') {
    const [h, psp] = address.split('@');
    return `${h.slice(0, 2)}***@${psp || ''}`;
  }
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

// Build a CSV payout report. rows: array of objects.
export function buildReportCsv(rows) {
  const headers = [
    'discord_id',
    'reddit_username',
    'owed_available',
    'pending',
    'lifetime',
    'payout_method',
    'payout_address',
  ];
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.discordId,
        r.redditUsername,
        Number(r.owed || 0).toFixed(2),
        Number(r.pending || 0).toFixed(2),
        Number(r.lifetime || 0).toFixed(2),
        r.method || '',
        r.address || '',
      ]
        .map(esc)
        .join(',')
    );
  }
  return lines.join('\n');
}
