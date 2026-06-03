// SHA-256 hex digest via the Web Crypto API.
//
// In the browser (the mini-app's real home) `globalThis.crypto.subtle` is
// always present. Under Node it is a global from v20 on, but the `node --test`
// worker on v18 does not expose the experimental global — so we fall back to
// `node:crypto`'s `webcrypto`, which is the same WebCrypto interface. Resolving
// the provider once, here, lets every other module call `subtle`/`randomUUID`
// without knowing which host it runs in.

import {webcrypto} from 'node:crypto'

// Prefer the platform global (browser, modern Node); fall back to node:crypto.
// `globalThis.crypto` is guarded because it can be undefined in a Node test
// worker, and reading `.subtle` off undefined would throw at import time.
export const cryptoProvider =
  (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle)
    ? globalThis.crypto
    : webcrypto

const encoder = new TextEncoder()

export async function sha256Hex(str) {
  const data = encoder.encode(String(str))
  const digest = await cryptoProvider.subtle.digest('SHA-256', data)
  const bytes = new Uint8Array(digest)
  let hex = ''
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0')
  }
  return hex
}
