// Test-only React + jsx-runtime shim used to render a SINGLE mini-app component
// in isolation (no DOM, no react-dom) — mirroring the hand-rolled hook driver in
// runtime-integration.test.js, extended with (a) proper dependency tracking so
// effects/memos only re-run when their deps change (React semantics — without it
// an effect that setStates on mount loops forever), and (b) a jsx-runtime that
// records the element tree so a test can locate a node by aria-label and fire
// its onClick.
//
// Both the esbuild-bundled component AND the test import THIS module by the same
// absolute path (it is marked external in the bundle), so they share one module
// instance — the component's hooks and the test's driver read the same slots.

let stateSlots = []
let hookSlots = []        // ref / memo / callback / effect bookkeeping, slot-indexed
let pendingEffects = []   // {fn, slot} to (re)run after this render commits
let hi = 0                // hook cursor (shared across ref/memo/cb/effect for stable slot ids)
let renderRoot = () => null
let lastTree = null
let rendering = false

function depsEqual(a, b) {
  if (a === undefined || b === undefined) return false
  if (a.length !== b.length) return false
  return a.every((x, i) => Object.is(x, b[i]))
}

export function useState(init) {
  const i = hi++
  if (!(i in stateSlots)) stateSlots[i] = typeof init === 'function' ? init() : init
  const setter = (next) => {
    const prev = stateSlots[i]
    stateSlots[i] = typeof next === 'function' ? next(prev) : next
    if (Object.is(prev, stateSlots[i])) return
    dirty = true              // a re-render is needed
    if (!driving && !rendering) drive()  // outside the driver loop: flush now
  }
  return [stateSlots[i], setter]
}
export function useRef(init) {
  const i = hi++
  if (!hookSlots[i]) hookSlots[i] = { ref: { current: init } }
  return hookSlots[i].ref
}
export function useMemo(fn, deps) {
  const i = hi++
  const slot = hookSlots[i] || (hookSlots[i] = {})
  if (!slot.has || !depsEqual(slot.deps, deps)) { slot.value = fn(); slot.deps = deps; slot.has = true }
  return slot.value
}
export function useCallback(fn, deps) { return useMemo(() => fn, deps) }
export function useEffect(fn, deps) {
  const i = hi++
  const slot = hookSlots[i] || (hookSlots[i] = {})
  if (!slot.hasEffect || !depsEqual(slot.deps, deps)) {
    pendingEffects.push({ slot, fn })
    slot.deps = deps
    slot.hasEffect = true
  }
}

// jsx-runtime: build a plain element record { type, props, children }.
function makeEl(type, props) {
  const { children, ...rest } = props || {}
  return { type, props: rest, children }
}
export const Fragment = Symbol('Fragment')
export function jsx(type, props) { return makeEl(type, props) }
export function jsxs(type, props) { return makeEl(type, props) }

const React = { useState, useRef, useCallback, useMemo, useEffect, Fragment }
export default React

let dirty = false
let driving = false

// One pure render pass: reset cursors, render, return the tree. No commits here.
function renderPass() {
  rendering = true
  hi = 0
  pendingEffects = []
  lastTree = renderRoot()
  rendering = false
  return lastTree
}

// Commit the effects queued by the last render pass (cleanup then run). An effect
// that setStates flips `dirty` instead of recursing — the driver loop re-renders.
function commit() {
  for (const { slot, fn } of pendingEffects) {
    if (typeof slot.cleanup === 'function') { try { slot.cleanup() } catch {} }
    const c = fn()
    slot.cleanup = typeof c === 'function' ? c : null
  }
}

// Drive render+commit to a fixed point: re-render only while `dirty` (a state
// actually changed). Bounded so a genuine setState-every-render bug throws
// instead of hanging — that is itself a real-component red flag.
function drive() {
  driving = true
  try {
    let guard = 0
    do {
      dirty = false
      renderPass()
      commit()
      if (++guard > 50) throw new Error('editor-render-shim: render loop (>50) — a setState ran every render')
    } while (dirty)
  } finally {
    driving = false
  }
  return lastTree
}

export function mount(renderFn) {
  stateSlots = []; hookSlots = []; pendingEffects = []; dirty = false
  renderRoot = renderFn
  return drive()
}
export function tree() { return lastTree }
export function unmount() {
  for (const slot of hookSlots) {
    if (slot && typeof slot.cleanup === 'function') { try { slot.cleanup() } catch {} }
  }
}

// Depth-first search of the recorded tree for the first node whose props match a
// predicate. children may be a node, an array, a string, or nested arrays.
export function find(pred, node = lastTree) {
  if (node == null || typeof node !== 'object') return null
  if (Array.isArray(node)) {
    for (const c of node) { const hit = find(pred, c); if (hit) return hit }
    return null
  }
  if (pred(node)) return node
  return find(pred, node.children)
}
