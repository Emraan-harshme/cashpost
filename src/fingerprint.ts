// Lightweight browser fingerprint — hashed and sent to the gateway for
// session binding. No PII, just device/hardware signals.

export function getDeviceFingerprint(): string {
  const parts = [
    navigator.userAgent,
    navigator.language,
    navigator.platform,
    navigator.hardwareConcurrency || '',
    screen.colorDepth + 'x' + screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    navigator.maxTouchPoints || '',
  ];
  return parts.join('|');
}

// Short hash of the fingerprint for transmission.
export function getFingerprintHash(): string {
  let hash = 0;
  const fp = getDeviceFingerprint();
  for (let i = 0; i < fp.length; i++) {
    const ch = fp.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
