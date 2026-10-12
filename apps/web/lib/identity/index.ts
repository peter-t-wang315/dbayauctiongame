// Per-room identity (05 section 5): {playerId, secret} in localStorage keyed by room code.
// The secret is never put in a URL. All storage access is guarded; it can throw or be empty.

export interface Identity {
  playerId: string;
  secret: string;
}

const key = (code: string) => `dbay:id:${code.toUpperCase()}`;
const NAME_KEY = 'dbay:name';

function store(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadIdentity(code: string): Identity | null {
  try {
    const raw = store()?.getItem(key(code));
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Identity>;
    return typeof v.playerId === 'string' && typeof v.secret === 'string'
      ? { playerId: v.playerId, secret: v.secret }
      : null;
  } catch {
    return null;
  }
}

export function saveIdentity(code: string, id: Identity): void {
  try {
    store()?.setItem(key(code), JSON.stringify(id));
  } catch {
    /* storage unavailable: the player simply cannot resume after a refresh */
  }
}

export function clearIdentity(code: string): void {
  try {
    store()?.removeItem(key(code));
  } catch {
    /* ignore */
  }
}

export function loadName(): string {
  try {
    return store()?.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveName(name: string): void {
  try {
    store()?.setItem(NAME_KEY, name);
  } catch {
    /* ignore */
  }
}
