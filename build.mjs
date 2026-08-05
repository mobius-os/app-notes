// Bundle the multi-file app source (src/app.jsx + src/{lib,ui,editor}/*) into a
// single index.jsx — Möbius mini-apps are single-file: the server compiler
// writes the source string to a temp file and compiles it, so relative imports
// must already be inlined. React / react-dom / CodeMirror / KaTeX / marked /
// dompurify stay external in this INTERMEDIATE artifact; the platform compiler
// resolves and embeds those bare imports when it creates the installed module.
// The split source keeps the app maintainable + unit-testable; index.jsx is the
// build artifact we ship. Run: npm run build.
//
// Rolldown is the compiler Möbius itself uses, so this intermediate is produced
// by the same bundler that will consume it. It comes from the shell's frontend
// install rather than a dependency of this app.
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

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
  '@openai/apps-sdk-ui/components/Icon',
]

const frontend = process.env.MOBIUS_FRONTEND_NODE_MODULES
const { rolldown } = frontend
  ? await import(pathToFileURL(
      createRequire(join(frontend, 'package.json')).resolve('rolldown'),
    ).href)
  : await import('rolldown')

const bundle = await rolldown({
  input: 'src/app.jsx',
  platform: 'browser',
  tsconfig: false,
  transform: { jsx: 'react-jsx' },
  external: EXTERNAL,
})
await bundle.write({
  file: 'index.jsx',
  format: 'es',
  codeSplitting: false,
  comments: { legal: false },
  banner: '// GENERATED from src/ by build.mjs — do not edit by hand.\n'
    + '// Edit src/app.jsx + src/{lib,ui,editor}/*, then run `npm run build`.',
})
await bundle.close()

// A bundler emits the entry's default export as `export { App as default }`,
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
