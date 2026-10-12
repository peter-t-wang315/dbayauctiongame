// Web Crypto helpers. The reducer is pure; all randomness and hashing happens in the wrapper.

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomHex(nBytes: number): string {
  return hex(crypto.getRandomValues(new Uint8Array(nBytes)));
}

export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return hex(new Uint8Array(buf));
}

/** Uniform pick from an alphabet (rejection sampling, no modulo bias). */
export function randomCode(alphabet: string, length: number): string {
  const limit = 256 - (256 % alphabet.length);
  let out = '';
  while (out.length < length) {
    for (const b of crypto.getRandomValues(new Uint8Array(length * 2))) {
      if (b < limit && out.length < length) out += alphabet[b % alphabet.length];
    }
  }
  return out;
}
