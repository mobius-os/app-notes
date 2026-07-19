// Bundle the multi-file app source (src/app.jsx + src/{lib,ui,editor}/*) into a
// single index.jsx — Möbius mini-apps are single-file: the server compiler
// writes the source string to a temp file and esbuilds it, so relative imports
// must already be inlined. React / react-dom / CodeMirror / KaTeX / marked /
// dompurify stay external in this INTERMEDIATE artifact; the platform compiler
// resolves and embeds those bare imports when it creates the installed module.
// The split source keeps the app maintainable + unit-testable; index.jsx is the
// build artifact we ship. Run: npm run build.
import { build } from 'esbuild'
import { readFileSync, writeFileSync } from 'node:fs'

const EXTERNAL = [
  'react', 'react-dom', 'react/jsx-runtime',
  'codemirror', 'katex',
  '@codemirror/state',
  '@codemirror/view',
  '@codemirror/commands',
  '@codemirror/lang-markdown',
  '@codemirror/language',
  '@lezer/highlight',
  // Keep these as bare specifiers for the platform's dependency-complete
  // compiler to resolve and embed.
  'marked', 'dompurify',
]

await build({
  entryPoints: ['src/app.jsx'],
  bundle: true,
  format: 'esm',
  jsx: 'automatic',
  platform: 'browser',
  external: EXTERNAL,
  outfile: 'index.jsx',
  logLevel: 'info',
  legalComments: 'none',
  banner: {
    js: '// GENERATED from src/ by build.mjs — do not edit by hand.\n'
      + '// Edit src/app.jsx + src/{lib,ui,editor}/*, then run `npm run build`.',
  },
})

// esbuild bundles the entry's default export as `export { App as default }`,
// but the Möbius compiler gate requires a LITERAL `export default`. The app has
// a single default export, so rewrite that one statement.
let code = readFileSync('index.jsx', 'utf8')
code = code.replace(/export\s*\{\s*([A-Za-z0-9_$]+)\s+as\s+default\s*,?\s*\};?/g, 'export default $1;')
writeFileSync('index.jsx', code)
if (!/^\s*export\s+default\b/m.test(code)) {
  console.error('build: index.jsx has no literal `export default` — the Möbius compiler will reject it.')
  process.exit(1)
}

console.log('built index.jsx')
