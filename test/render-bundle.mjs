// Shared bundler for the render tests.
//
// Möbius compiles mini-apps with Rolldown, so the tests that mount a real
// component bundle it the same way — one helper instead of eight copies of the
// compiler's command line. CI points MOBIUS_FRONTEND_NODE_MODULES at the
// shell's installed frontend, which is where Rolldown lives; outside CI a local
// install resolves it normally.
//
// The render tests all want the same three things:
//   * `react` / `react/jsx-runtime` aliased to editor-render-shim.mjs and kept
//     EXTERNAL, so the bundle and the test share ONE shim module instance (the
//     component's hooks and the test's driver read the same slots);
//   * a handful of heavy children (CodeMirror, react-dom portals, KaTeX, …)
//     replaced by inert stub modules;
//   * optionally, every OTHER bare library specifier stubbed too, for
//     render-only tests that care about nothing but the component's own tree.
//
// `stubs` entries are matched against the import specifier exactly as written
// (`./ColorPicker.jsx`, `@codemirror/state`, …), first match wins, mirroring the
// resolve rules these tests used before.

import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))

// The shared hook + jsx-runtime shim the bundled component imports at runtime.
export const RENDER_SHIM = resolve(HERE, 'editor-render-shim.mjs')

const frontendModules = process.env.MOBIUS_FRONTEND_NODE_MODULES
const REACT = /^react(\/jsx-runtime)?$/
const STUB_PREFIX = '\0mobius-test-stub:'

async function loadRolldown() {
  if (!frontendModules) return import('rolldown')
  const requireFromFrontend = createRequire(resolve(frontendModules, 'package.json'))
  return import(pathToFileURL(requireFromFrontend.resolve('rolldown')).href)
}

function isBare(source) {
  return !source.startsWith('.') && !source.startsWith('/') && !source.startsWith('node:')
}

// Bundles `entry` to `outfile` and returns the path, so the caller decides WHEN
// to import it (some tests must install window.mobius globals first).
export async function bundleForRender({ entry, outfile, stubs = [], stubBareImports = null }) {
  const shimPlugin = {
    name: 'mobius-render-shim',
    resolveId(source, importer) {
      if (REACT.test(source)) return { id: RENDER_SHIM, external: true }
      const hit = stubs.findIndex(({ match }) => match.test(source))
      if (hit >= 0) return `${STUB_PREFIX}${hit}`
      // Anything else bare is a library this render-only test does not need.
      // Entry points and the bundler's own runtime are never stubbed.
      if (stubBareImports && importer && !importer.startsWith('\0') && isBare(source)) {
        return `${STUB_PREFIX}bare`
      }
      return null
    },
    load(id) {
      if (!id.startsWith(STUB_PREFIX)) return null
      const key = id.slice(STUB_PREFIX.length)
      const code = key === 'bare' ? stubBareImports : stubs[Number(key)].code
      return { code, moduleType: 'js' }
    },
  }

  const { rolldown } = await loadRolldown()
  const build = await rolldown({
    input: entry,
    platform: 'node',
    tsconfig: false,
    transform: { jsx: 'react-jsx' },
    resolve: {
      modules: frontendModules ? [frontendModules, 'node_modules'] : ['node_modules'],
    },
    plugins: [shimPlugin],
  })
  await build.write({ file: outfile, format: 'es' })
  await build.close()
  return outfile
}
