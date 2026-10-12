// Origin allowlist (05 section 12). Exact match on comma-separated entries; an entry may use a
// single leading wildcard label, e.g. `https://*.vercel.app` (Vercel preview domains, 05 section 13).

export function parseAllowed(list: string | undefined): string[] {
  return (list ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function originAllowed(origin: string | null, allowedList: string | undefined): boolean {
  if (!origin) return false;
  for (const entry of parseAllowed(allowedList)) {
    if (entry === origin) return true;
    const star = entry.indexOf('*.');
    if (star > 0) {
      const scheme = entry.slice(0, star); // e.g. "https://"
      const suffix = entry.slice(star + 1); // e.g. ".vercel.app"
      if (origin.startsWith(scheme) && origin.endsWith(suffix)) {
        const label = origin.slice(scheme.length, origin.length - suffix.length);
        if (label.length > 0 && /^[a-z0-9-]+$/i.test(label)) return true;
      }
    }
  }
  return false;
}

export function corsHeaders(origin: string | null, allowedList: string | undefined): Headers {
  const h = new Headers();
  if (origin && originAllowed(origin, allowedList)) {
    h.set('Access-Control-Allow-Origin', origin);
    h.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    h.set('Access-Control-Allow-Headers', 'Content-Type');
    h.set('Access-Control-Max-Age', '600');
    h.append('Vary', 'Origin');
  }
  return h;
}
