// Test-only polyfill: older Node (v18 `node --test` workers) don't expose the
// `globalThis.crypto` Web Crypto global that the browser always has. Provide it
// from node:crypto so src/ can stay browser-pure (no node:crypto import that
// would break the mini-app bundle). Loaded via `node --import` in the test
// script, and imported directly by tests that touch crypto as a belt-and-braces
// fallback in case --import doesn't propagate to a worker.
import { webcrypto } from 'node:crypto'
if (!globalThis.crypto) globalThis.crypto = webcrypto
