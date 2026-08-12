import { test } from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/app.jsx', 'utf8')
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))

test('KaTeX styling uses the platform asset without a CDN or proxy hop', () => {
  assert.match(source, /\/vendor\/katex@0\.17\.0\/katex\.min\.css/)
  assert.doesNotMatch(source, /cdn\.jsdelivr\.net/)
  assert.doesNotMatch(source, /\/api\/proxy\?url/)
  assert.equal(packageJson.devDependencies.katex, '0.17.0')
})
