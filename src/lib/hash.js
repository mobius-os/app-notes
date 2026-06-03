// SHA-256 hex digest via the Web Crypto API.
//
// Uses `globalThis.crypto.subtle` directly — always present in the browser (the
// mini-app's real home) and in modern Node. We deliberately do NOT import
// `node:crypto`: a static node-builtin import breaks the browser bundle esbuild
// produces for the mini-app. The test runner polyfills the global on older Node
// (see test/setup.mjs), so `src/` stays browser-pure.

const encoder = new TextEncoder()

export async function sha256Hex(str) {
  const data = encoder.encode(String(str))
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data)
  const bytes = new Uint8Array(digest)
  let hex = ''
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0')
  }
  return hex
}
