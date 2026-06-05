// GENERATED from src/ by build.mjs — do not edit by hand.
// Edit src/app.jsx + src/{lib,ui,editor}/*, then run `npm run build`.

// src/app.jsx
import { useState as useState3, useEffect as useEffect4, useMemo, useCallback as useCallback2, useRef as useRef3 } from "react";

// src/ui/theme.js
function cssVar(name, fallback) {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}
var T = () => ({
  bg: cssVar("--bg", "#0d0d0d"),
  surface: cssVar("--surface", "#171717"),
  surface2: cssVar("--surface2", "#212121"),
  border: cssVar("--border", "#2a2a2a"),
  text: cssVar("--text", "#ececec"),
  muted: cssVar("--muted", "#a8a8a8"),
  accent: cssVar("--accent", "#a78bfa"),
  green: cssVar("--green", "#6ee7b7"),
  danger: cssVar("--danger", "#f87171"),
  font: cssVar("--font", "'Inter', system-ui, sans-serif"),
  mono: cssVar("--mono", "'JetBrains Mono', ui-monospace, monospace")
});

// src/lib/hash.js
var encoder = new TextEncoder();
async function sha256Hex(str) {
  const data = encoder.encode(String(str));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

// src/lib/note.js
function normalize(meta, body) {
  return {
    title: meta.title ?? "",
    body: String(body ?? ""),
    pinned: meta.pinned ?? false,
    color: meta.color ?? null,
    tags: Array.isArray(meta.tags) ? meta.tags : []
  };
}
async function contentHash(meta, body) {
  const canonical = normalize(meta, body);
  const json = JSON.stringify([
    canonical.title,
    canonical.body,
    canonical.pinned,
    canonical.color,
    canonical.tags
  ]);
  return sha256Hex(json);
}
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function newNote({ title } = {}) {
  const ts = nowIso();
  return {
    id: globalThis.crypto.randomUUID(),
    title: title ?? "",
    pinned: false,
    color: null,
    tags: [],
    created: ts,
    updated: ts,
    mobius_rev: 1,
    parent_rev: 0,
    attachments: []
  };
}
function isBlankNote(meta = {}, body = "") {
  const hasTitle = Boolean((meta.title || "").trim());
  const hasBody = Boolean(String(body || "").trim());
  const hasAttachments = Array.isArray(meta.attachments) && meta.attachments.length > 0;
  return !hasTitle && !hasBody && !hasAttachments;
}

// src/lib/frontmatter.js
var FENCE = "---";
function parseScalar(raw) {
  const s = raw.trim();
  if (s === "") return "";
  if (s === "true") return true;
  if (s === "false") return false;
  if (s === "null" || s === "~") return null;
  if (s[0] === '"' && s[s.length - 1] === '"' || s[0] === "'" && s[s.length - 1] === "'") {
    return s.slice(1, -1);
  }
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return s;
}
function parseValue(raw) {
  const s = raw.trim();
  if (s[0] === "[" && s[s.length - 1] === "]") {
    const inner = s.slice(1, -1).trim();
    if (inner === "") return [];
    return inner.split(",").map((el) => parseScalar(el));
  }
  return parseScalar(s);
}
function parseFrontmatter(md) {
  const text = String(md);
  if (!text.startsWith(FENCE + "\n") && text !== FENCE) {
    return { meta: {}, body: text };
  }
  const lines = text.split("\n");
  let close = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === FENCE) {
      close = i;
      break;
    }
  }
  if (close === -1) {
    return { meta: {}, body: text };
  }
  const meta = {};
  for (let i = 1; i < close; i++) {
    const line = lines[i];
    if (line.trim() === "") continue;
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1);
    meta[key] = parseValue(value);
  }
  const body = lines.slice(close + 1).join("\n");
  return { meta, body };
}
function serializeScalar(v) {
  if (v === null) return "null";
  if (v === true) return "true";
  if (v === false) return "false";
  if (typeof v === "number") return String(v);
  const s = String(v);
  const ambiguous = s === "" || s === "true" || s === "false" || s === "null" || s === "~" || /^-?\d+(\.\d+)?$/.test(s) || /[:,#\[\]]/.test(s) || s.trim() !== s;
  return ambiguous ? JSON.stringify(s) : s;
}
function serializeValue(v) {
  if (Array.isArray(v)) {
    return "[" + v.map((el) => serializeScalar(el)).join(", ") + "]";
  }
  return serializeScalar(v);
}
var KEY_ORDER = [
  "id",
  "title",
  "pinned",
  "color",
  "tags",
  "created",
  "updated",
  "mobius_rev",
  "parent_rev",
  "parent_revs",
  "content_hash",
  "attachments"
];
function orderedKeys(meta) {
  const known = KEY_ORDER.filter((k) => k in meta);
  const extra = Object.keys(meta).filter((k) => !KEY_ORDER.includes(k)).sort();
  return [...known, ...extra];
}
function serializeNote(meta, body) {
  const keys = orderedKeys(meta);
  const yaml = keys.map((k) => `${k}: ${serializeValue(meta[k])}`).join("\n");
  return `${FENCE}
${yaml}
${FENCE}
${String(body)}`;
}

// src/lib/index-cache.js
var SNIPPET_LEN = 140;
function stripMarkdown(body) {
  let s = String(body ?? "");
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
  s = s.replace(/`+/g, "");
  s = s.replace(/(\*\*|__|~~|\*|_)/g, "");
  s = s.replace(/^\s{0,3}(#{1,6}\s+|>\s?|[-*+]\s+|\d+\.\s+)/gm, "");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}
function snippetOf(body) {
  const text = stripMarkdown(body);
  return text.length > SNIPPET_LEN ? text.slice(0, SNIPPET_LEN) : text;
}
function toEntry({ meta, body }) {
  return {
    id: meta.id,
    title: meta.title ?? "",
    snippet: snippetOf(body),
    pinned: meta.pinned ?? false,
    color: meta.color ?? null,
    updated: meta.updated
  };
}
function byPinnedThenUpdatedDesc(a, b) {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  const ua = a.updated ?? "";
  const ub = b.updated ?? "";
  if (ua === ub) return 0;
  return ua < ub ? 1 : -1;
}
function buildIndex(notes) {
  const entries = (notes ?? []).map(toEntry);
  entries.sort(byPinnedThenUpdatedDesc);
  return { notes: entries };
}

// src/lib/attachments.js
function attachmentPath(sha, ext) {
  return `attachments/${sha}.${ext}`;
}
var TYPE_TO_EXT = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/gif": "gif",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "text/plain": "txt"
};
function extFromType(type) {
  if (!type) return null;
  const base = String(type).split(";")[0].trim().toLowerCase();
  return TYPE_TO_EXT[base] ?? null;
}

// src/lib/store.js
var S = () => window.mobius.storage;
var notePath = (id) => `notes/${id}.md`;
async function sha256Bytes(buffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function extFromName(name) {
  const m = /\.([A-Za-z0-9]+)$/.exec(name || "");
  return m ? m[1].toLowerCase() : null;
}
async function listNotes() {
  let entries;
  try {
    entries = await S().list("notes");
  } catch {
    entries = [];
  }
  const out = [];
  for (const e of entries || []) {
    if (e.type !== "file" || !e.name.endsWith(".md")) continue;
    const text = await S().getText(e.path);
    if (text == null) continue;
    const { meta, body } = parseFrontmatter(text);
    if (meta && meta.id) out.push({ meta, body });
  }
  return out;
}
async function loadNote(id) {
  const text = await S().getText(notePath(id));
  return text == null ? null : parseFrontmatter(text);
}
async function saveNote(meta, body) {
  return S().setText(notePath(meta.id), serializeNote(meta, body), {
    contentType: "text/markdown;charset=utf-8"
  });
}
async function deleteNote(id) {
  return S().remove(notePath(id));
}
async function writeIndex(notes) {
  return S().set("index.json", buildIndex(notes));
}
async function writeConflict(path, descriptor) {
  return S().set(path, descriptor);
}
async function putAttachment(file) {
  const buf = await file.arrayBuffer();
  const sha = await sha256Bytes(buf);
  const ext = extFromType(file.type) || extFromName(file.name) || "bin";
  const path = attachmentPath(sha, ext);
  await S().setBlob(path, file, { contentType: file.type || "application/octet-stream" });
  return { sha, ext, path, name: file.name || `${sha}.${ext}` };
}
async function attachmentURL(path) {
  let blob;
  try {
    blob = await S().getBlob(path);
  } catch {
    return null;
  }
  return blob ? URL.createObjectURL(blob) : null;
}
var pendingCount = () => S().pendingCount();
var isOnline = () => window.mobius ? window.mobius.online : true;

// src/lib/idb.js
var DB_NAME = "notes-local";
var STORE = "kv";
function open() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function run(mode, fn) {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      const box = {};
      fn(store, box);
      tx.oncomplete = () => resolve(box.value);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
function idbGet(key) {
  return run("readonly", (store, box) => {
    const r = store.get(key);
    r.onsuccess = () => {
      box.value = r.result;
    };
  });
}
function idbSet(key, value) {
  return run("readwrite", (store) => {
    store.put(value, key);
  });
}
function idbDel(key) {
  return run("readwrite", (store) => {
    store.delete(key);
  });
}
function idbEntries() {
  return run("readonly", (store, box) => {
    box.value = [];
    const r = store.openCursor();
    r.onsuccess = (e) => {
      const cur = e.target.result;
      if (!cur) return;
      box.value.push([cur.key, cur.value]);
      cur.continue();
    };
  });
}

// src/lib/local.js
var KEY = (id) => `note:${id}`;
async function ensureBase(id, rec) {
  if (!await idbGet(KEY(id))) await idbSet(KEY(id), { base: rec, working: rec });
}
async function recordWorking(id, working) {
  const prev = await idbGet(KEY(id)) || {};
  const base = prev.base || working;
  await idbSet(KEY(id), { base, working });
}
async function recordDeletion(id, baseHint = null) {
  const prev = await idbGet(KEY(id)) || {};
  const base = prev.base || baseHint;
  if (!base) return false;
  await idbSet(KEY(id), { base, working: null });
  return true;
}
async function promote(id, synced) {
  await idbSet(KEY(id), { base: synced, working: synced });
}
async function clearLocal(id) {
  await idbDel(KEY(id));
}
async function unsyncedLocals() {
  const entries = await idbEntries();
  const out = [];
  for (const [k, v] of entries) {
    if (!k.startsWith("note:") || !v || !v.base || !("working" in v)) continue;
    if (v.working === null) {
      out.push([k.slice(5), v]);
    } else if (v.working.hash !== v.base.hash) {
      out.push([k.slice(5), v]);
    }
  }
  return out;
}

// ../../../node_modules/node-diff3/dist/diff3.mjs
function LCS(buffer1, buffer2) {
  let equivalenceClasses = {};
  for (let j = 0; j < buffer2.length; j++) {
    const item = buffer2[j];
    if (equivalenceClasses[item]) {
      equivalenceClasses[item].push(j);
    } else {
      equivalenceClasses[item] = [j];
    }
  }
  const NULLRESULT = { buffer1index: -1, buffer2index: -1, chain: null };
  let candidates = [NULLRESULT];
  for (let i = 0; i < buffer1.length; i++) {
    const item = buffer1[i];
    const buffer2indices = equivalenceClasses[item] || [];
    let r = 0;
    let c = candidates[0];
    for (let jx = 0; jx < buffer2indices.length; jx++) {
      const j = buffer2indices[jx];
      let s;
      for (s = r; s < candidates.length; s++) {
        if (candidates[s].buffer2index < j && (s === candidates.length - 1 || candidates[s + 1].buffer2index > j)) {
          break;
        }
      }
      if (s < candidates.length) {
        const newCandidate = { buffer1index: i, buffer2index: j, chain: candidates[s] };
        if (r === candidates.length) {
          candidates.push(c);
        } else {
          candidates[r] = c;
        }
        r = s + 1;
        c = newCandidate;
        if (r === candidates.length) {
          break;
        }
      }
    }
    candidates[r] = c;
  }
  return candidates[candidates.length - 1];
}
function diffComm(buffer1, buffer2) {
  const lcs = LCS(buffer1, buffer2);
  let result = [];
  let tail1 = buffer1.length;
  let tail2 = buffer2.length;
  let common = { common: [] };
  function processCommon() {
    if (common.common.length) {
      common.common.reverse();
      result.push(common);
      common = { common: [] };
    }
  }
  for (let candidate = lcs; candidate !== null; candidate = candidate.chain) {
    let different = { buffer1: [], buffer2: [] };
    while (--tail1 > candidate.buffer1index) {
      different.buffer1.push(buffer1[tail1]);
    }
    while (--tail2 > candidate.buffer2index) {
      different.buffer2.push(buffer2[tail2]);
    }
    if (different.buffer1.length || different.buffer2.length) {
      processCommon();
      different.buffer1.reverse();
      different.buffer2.reverse();
      result.push(different);
    }
    if (tail1 >= 0) {
      common.common.push(buffer1[tail1]);
    }
  }
  processCommon();
  result.reverse();
  return result;
}
function diffIndices(buffer1, buffer2) {
  const lcs = LCS(buffer1, buffer2);
  let result = [];
  let tail1 = buffer1.length;
  let tail2 = buffer2.length;
  for (let candidate = lcs; candidate !== null; candidate = candidate.chain) {
    const mismatchLength1 = tail1 - candidate.buffer1index - 1;
    const mismatchLength2 = tail2 - candidate.buffer2index - 1;
    tail1 = candidate.buffer1index;
    tail2 = candidate.buffer2index;
    if (mismatchLength1 || mismatchLength2) {
      result.push({
        buffer1: [tail1 + 1, mismatchLength1],
        buffer1Content: buffer1.slice(tail1 + 1, tail1 + 1 + mismatchLength1),
        buffer2: [tail2 + 1, mismatchLength2],
        buffer2Content: buffer2.slice(tail2 + 1, tail2 + 1 + mismatchLength2)
      });
    }
  }
  result.reverse();
  return result;
}
function diff3MergeRegions(a, o, b) {
  let hunks = [];
  function addHunk(h, ab) {
    hunks.push({
      ab,
      oStart: h.buffer1[0],
      oLength: h.buffer1[1],
      abStart: h.buffer2[0],
      abLength: h.buffer2[1]
    });
  }
  diffIndices(o, a).forEach((item) => addHunk(item, "a"));
  diffIndices(o, b).forEach((item) => addHunk(item, "b"));
  hunks.sort((x, y) => x.oStart - y.oStart);
  let results = [];
  let currOffset = 0;
  function advanceTo(endOffset) {
    if (endOffset > currOffset) {
      results.push({
        stable: true,
        buffer: "o",
        bufferStart: currOffset,
        bufferLength: endOffset - currOffset,
        bufferContent: o.slice(currOffset, endOffset)
      });
      currOffset = endOffset;
    }
  }
  while (hunks.length) {
    let hunk = hunks.shift();
    let regionStart = hunk.oStart;
    let regionEnd = hunk.oStart + hunk.oLength;
    let regionHunks = [hunk];
    advanceTo(regionStart);
    while (hunks.length) {
      const nextHunk = hunks[0];
      const nextHunkStart = nextHunk.oStart;
      if (nextHunkStart > regionEnd)
        break;
      regionEnd = Math.max(regionEnd, nextHunkStart + nextHunk.oLength);
      regionHunks.push(hunks.shift());
    }
    if (regionHunks.length === 1) {
      if (hunk.abLength > 0) {
        const buffer = hunk.ab === "a" ? a : b;
        results.push({
          stable: true,
          buffer: hunk.ab,
          bufferStart: hunk.abStart,
          bufferLength: hunk.abLength,
          bufferContent: buffer.slice(hunk.abStart, hunk.abStart + hunk.abLength)
        });
      }
    } else {
      let bounds = {
        a: [a.length, -1, o.length, -1],
        b: [b.length, -1, o.length, -1]
      };
      while (regionHunks.length) {
        hunk = regionHunks.shift();
        const oStart = hunk.oStart;
        const oEnd = oStart + hunk.oLength;
        const abStart = hunk.abStart;
        const abEnd = abStart + hunk.abLength;
        let b2 = bounds[hunk.ab];
        b2[0] = Math.min(abStart, b2[0]);
        b2[1] = Math.max(abEnd, b2[1]);
        b2[2] = Math.min(oStart, b2[2]);
        b2[3] = Math.max(oEnd, b2[3]);
      }
      const aStart = bounds.a[0] + (regionStart - bounds.a[2]);
      const aEnd = bounds.a[1] + (regionEnd - bounds.a[3]);
      const bStart = bounds.b[0] + (regionStart - bounds.b[2]);
      const bEnd = bounds.b[1] + (regionEnd - bounds.b[3]);
      let result = {
        stable: false,
        aStart,
        aLength: aEnd - aStart,
        aContent: a.slice(aStart, aEnd),
        oStart: regionStart,
        oLength: regionEnd - regionStart,
        oContent: o.slice(regionStart, regionEnd),
        bStart,
        bLength: bEnd - bStart,
        bContent: b.slice(bStart, bEnd)
      };
      results.push(result);
    }
    currOffset = regionEnd;
  }
  advanceTo(o.length);
  return results;
}
function diff3Merge(a, o, b, options) {
  let defaults = {
    excludeFalseConflicts: true,
    stringSeparator: /\s+/
  };
  options = Object.assign(defaults, options);
  if (typeof a === "string")
    a = a.split(options.stringSeparator);
  if (typeof o === "string")
    o = o.split(options.stringSeparator);
  if (typeof b === "string")
    b = b.split(options.stringSeparator);
  let results = [];
  const regions = diff3MergeRegions(a, o, b);
  let okBuffer = [];
  function flushOk() {
    if (okBuffer.length) {
      results.push({ ok: okBuffer });
    }
    okBuffer = [];
  }
  function isFalseConflict(a2, b2) {
    if (a2.length !== b2.length)
      return false;
    for (let i = 0; i < a2.length; i++) {
      if (a2[i] !== b2[i])
        return false;
    }
    return true;
  }
  regions.forEach((region) => {
    if (region.stable) {
      okBuffer.push(...region.bufferContent);
    } else {
      if (options.excludeFalseConflicts && isFalseConflict(region.aContent, region.bContent)) {
        okBuffer.push(...region.aContent);
      } else {
        flushOk();
        results.push({
          conflict: {
            a: region.aContent,
            aIndex: region.aStart,
            o: region.oContent,
            oIndex: region.oStart,
            b: region.bContent,
            bIndex: region.bStart
          }
        });
      }
    }
  });
  flushOk();
  return results;
}
function mergeDigIn(a, o, b, options) {
  const defaults = {
    excludeFalseConflicts: true,
    stringSeparator: /\s+/,
    label: {}
  };
  options = Object.assign(defaults, options);
  const aSection = "<<<<<<<" + (options.label.a ? ` ${options.label.a}` : "");
  const xSection = "=======";
  const bSection = ">>>>>>>" + (options.label.b ? ` ${options.label.b}` : "");
  const regions = diff3Merge(a, o, b, options);
  let conflict = false;
  let result = [];
  regions.forEach((region) => {
    if (region.ok) {
      result = result.concat(region.ok);
    } else {
      const c = diffComm(region.conflict.a, region.conflict.b);
      for (let j = 0; j < c.length; j++) {
        let inner = c[j];
        if (inner.common) {
          result = result.concat(inner.common);
        } else {
          conflict = true;
          result = result.concat([aSection], inner.buffer1, [xSection], inner.buffer2, [bSection]);
        }
      }
    }
  });
  return {
    conflict,
    result
  };
}

// src/lib/merge.js
function toLines(text) {
  return text.split("\n");
}
function changedRanges(baseLines, sideLines) {
  return diffIndices(baseLines, sideLines).map((d) => ({
    start: d.buffer1[0],
    len: d.buffer1[1],
    repl: d.buffer2Content
  }));
}
function rangesOverlap(a, b) {
  if (a.len === 0 && b.len === 0) return a.start === b.start;
  const aEnd = a.start + Math.max(a.len, 0);
  const bEnd = b.start + Math.max(b.len, 0);
  return a.start < bEnd && b.start < aEnd;
}
function resolveDisjoint(baseLines, mineLines, theirsLines) {
  const mineRanges = changedRanges(baseLines, mineLines);
  const theirsRanges = changedRanges(baseLines, theirsLines);
  for (const a of mineRanges) {
    for (const b of theirsRanges) {
      if (rangesOverlap(a, b)) return null;
    }
  }
  const edits = [...mineRanges, ...theirsRanges].sort((p, q) => q.start - p.start);
  const out = baseLines.slice();
  for (const e of edits) out.splice(e.start, e.len, ...e.repl);
  return out;
}
function conflictHunks(baseLines, mineLines, theirsLines) {
  const mineRanges = changedRanges(baseLines, mineLines);
  const theirsRanges = changedRanges(baseLines, theirsLines);
  const hunks = [];
  for (const a of mineRanges) {
    for (const b of theirsRanges) {
      if (!rangesOverlap(a, b)) continue;
      const start = Math.min(a.start, b.start);
      const end = Math.max(a.start + Math.max(a.len, 0), b.start + Math.max(b.len, 0));
      hunks.push({
        conflict: true,
        base: baseLines.slice(start, end),
        mine: a.repl,
        theirs: b.repl
      });
    }
  }
  return hunks;
}
function merge3(base, mine, theirs) {
  const baseLines = toLines(base);
  const mineLines = toLines(mine);
  const theirsLines = toLines(theirs);
  const dig = mergeDigIn(mineLines, baseLines, theirsLines);
  if (!dig.conflict) {
    return { clean: true, conflict: false, text: dig.result.join("\n") };
  }
  const merged = resolveDisjoint(baseLines, mineLines, theirsLines);
  if (merged) {
    return { clean: true, conflict: false, text: merged.join("\n") };
  }
  return {
    clean: false,
    conflict: true,
    text: dig.result.join("\n"),
    hunks: conflictHunks(baseLines, mineLines, theirsLines)
  };
}
function laterSide(mine, theirs) {
  const m = mine?.updated ?? "";
  const t = theirs?.updated ?? "";
  return t > m ? theirs : mine;
}
function mergeMeta(base, mine, theirs) {
  const winner = laterSide(mine, theirs);
  const tags2 = [.../* @__PURE__ */ new Set([...mine?.tags ?? [], ...theirs?.tags ?? []])];
  const mineRev = mine?.mobius_rev ?? 0;
  const theirsRev = theirs?.mobius_rev ?? 0;
  return {
    id: base?.id,
    created: base?.created,
    title: winner?.title,
    color: winner?.color ?? null,
    pinned: winner?.pinned ?? false,
    tags: tags2,
    updated: winner?.updated,
    mobius_rev: Math.max(mineRev, theirsRev) + 1,
    parent_revs: [mineRev, theirsRev]
  };
}

// src/lib/sync.js
var hashOf = (side) => side ? side.hash : null;
var attachmentsOf = (side) => side?.meta?.attachments ?? [];
function buildConflict({ base, mine, server }) {
  const noteId = base?.meta?.id ?? mine?.meta?.id ?? server?.meta?.id;
  const baseHash = hashOf(base);
  const mineHash = hashOf(mine);
  const serverHash = hashOf(server);
  return {
    action: "conflict",
    descriptor: {
      noteId,
      baseHash,
      mineHash,
      serverHash,
      base,
      mine,
      server,
      attachmentsMine: attachmentsOf(mine),
      attachmentsServer: attachmentsOf(server),
      status: "open",
      path: `conflicts/${noteId}/${baseHash}.${mineHash}.${serverHash}.json`
    }
  };
}
function reconcile({ base, mine, server }) {
  if (mine === null && server === null) return { action: "noop" };
  if (hashOf(mine) === hashOf(server)) return { action: "noop" };
  if (mine === null) {
    if (base && server && hashOf(server) === hashOf(base)) {
      return { action: "delete" };
    }
    return buildConflict({ base, mine, server });
  }
  if (server === null) {
    return buildConflict({ base, mine, server });
  }
  if (base && hashOf(server) === hashOf(base)) {
    const baseRev = base.meta?.mobius_rev ?? 0;
    return {
      action: "fast-forward",
      note: {
        meta: { ...mine.meta, parent_rev: baseRev, mobius_rev: baseRev + 1 },
        body: mine.body
      }
    };
  }
  const baseBody = base?.body ?? "";
  const bodyMerge = merge3(baseBody, mine.body, server.body);
  if (bodyMerge.clean) {
    return {
      action: "merged",
      note: {
        meta: mergeMeta(base?.meta ?? {}, mine.meta, server.meta),
        body: bodyMerge.text
      }
    };
  }
  return buildConflict({ base, mine, server });
}

// src/lib/reconciler.js
var _running = false;
async function reconcileAll({ onApplied, onConflict, onDeleted } = {}) {
  if (_running || !isOnline()) return { ran: false };
  _running = true;
  const results = [];
  try {
    const work = await unsyncedLocals();
    for (const [id, rec] of work) {
      try {
        const loaded = await loadNote(id);
        const server = loaded ? { meta: loaded.meta, body: loaded.body, hash: await contentHash(loaded.meta, loaded.body) } : null;
        const decision = reconcile({ base: rec.base, mine: rec.working, server });
        if (decision.action === "noop") {
          if (rec.working === null) await clearLocal(id);
          else await promote(id, rec.working);
        } else if (decision.action === "delete") {
          const res = await deleteNote(id);
          if (res && res.synced) {
            await clearLocal(id);
            if (onDeleted) onDeleted(id);
          }
        } else if (decision.action === "fast-forward" || decision.action === "merged") {
          const note = decision.note;
          note.meta.content_hash = await contentHash(note.meta, note.body);
          note.meta.updated = note.meta.updated || (/* @__PURE__ */ new Date()).toISOString();
          const res = await saveNote(note.meta, note.body);
          if (res && res.synced) {
            await promote(id, { meta: note.meta, body: note.body, hash: note.meta.content_hash });
            if (onApplied) onApplied(id, note);
          }
        } else if (decision.action === "conflict") {
          const d = decision.descriptor;
          await writeConflict(d.path, d);
          if (onConflict) onConflict(id, d);
        }
        results.push([id, decision.action]);
      } catch (e) {
        results.push([id, "error"]);
      }
    }
  } finally {
    _running = false;
  }
  return { ran: true, results };
}

// src/ui/Card.jsx
import { useState, useEffect } from "react";

// src/ui/colors.js
var NOTE_COLORS = [
  { name: null, label: "Default", hex: null },
  { name: "violet", label: "Violet", hex: "#a78bfa" },
  { name: "green", label: "Green", hex: "#6ee7b7" },
  { name: "amber", label: "Amber", hex: "#fbbf24" },
  { name: "coral", label: "Coral", hex: "#f87171" },
  { name: "sky", label: "Sky", hex: "#60a5fa" },
  { name: "pink", label: "Pink", hex: "#f472b6" }
];
function colorHex(name) {
  const c = NOTE_COLORS.find((x) => x.name === name);
  return c ? c.hex : null;
}
function colorTint(name, alpha = 0.16) {
  const hex = colorHex(name);
  if (!hex) return null;
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// src/lib/preview.js
var _libs;
async function libs() {
  if (!_libs) {
    const [m, d] = await Promise.all([
      import("https://esm.sh/marked@14.1.4"),
      import("https://esm.sh/dompurify@3.1.7")
    ]);
    _libs = { marked: m.marked, purify: d.default || d };
  }
  return _libs;
}
var PREVIEW_SANITIZE_OPTIONS = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ["img", "picture", "source", "video", "audio", "iframe"],
  FORBID_ATTR: ["href", "src", "srcset", "xlink:href", "formaction"]
};
function neutralizePreviewMarkdown(md) {
  return (md || "").replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, url) => String(url).startsWith("attachments/") ? ` \u{1F5BC} ${alt || ""} ` : ` ${alt || "image"} `).replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");
}
function localImageRefs(meta = {}, body = "", limit = 4) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  const add = (path) => {
    if (out.length >= limit || seen.has(path) || !isLocalImagePath(path)) return;
    seen.add(path);
    out.push(path);
  };
  [...String(body || "").matchAll(/!\[[^\]]*\]\((attachments\/[^)\s]+)\)/g)].map((m) => m[1]).forEach(add);
  if (Array.isArray(meta.attachments)) meta.attachments.forEach(add);
  return out;
}
function isLocalImagePath(path) {
  return /^attachments\/[^/]+\.(png|jpe?g|gif|webp|avif)$/i.test(String(path || ""));
}
async function renderPreviewHTML(md) {
  const { marked, purify } = await libs();
  const html = marked(neutralizePreviewMarkdown(md), { breaks: true, gfm: true });
  return purify.sanitize(html, PREVIEW_SANITIZE_OPTIONS);
}

// src/ui/ColorPicker.jsx
import { jsx } from "react/jsx-runtime";
function ColorPicker({ current, onPick, placement = "above", align = "start" }) {
  const t = T();
  const vertical = placement === "below" ? { top: "calc(100% + 6px)" } : { bottom: "calc(100% + 6px)" };
  const horizontal = align === "end" ? { right: 0 } : { left: 0 };
  return /* @__PURE__ */ jsx(
    "div",
    {
      role: "menu",
      "aria-label": "Note color",
      onClick: (e) => e.stopPropagation(),
      style: {
        position: "absolute",
        zIndex: 20,
        ...vertical,
        ...horizontal,
        display: "grid",
        gridTemplateColumns: "repeat(4, 28px)",
        gap: 7,
        maxWidth: "calc(100vw - 24px)",
        padding: 8,
        background: t.surface2,
        border: `1px solid ${t.border}`,
        borderRadius: 8,
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)"
      },
      children: NOTE_COLORS.map((c) => /* @__PURE__ */ jsx(
        "button",
        {
          title: c.label,
          "aria-label": c.label,
          onClick: () => onPick(c.name),
          style: {
            width: 28,
            height: 28,
            borderRadius: 7,
            cursor: "pointer",
            padding: 0,
            border: current === c.name ? `2px solid ${t.text}` : `1px solid ${t.border}`,
            background: c.hex || `linear-gradient(135deg, ${t.surface} 49%, ${t.muted} 51%)`
          }
        },
        c.name || "default"
      ))
    }
  );
}

// src/ui/icons.jsx
import { jsx as jsx2, jsxs } from "react/jsx-runtime";
function Icon({ name, size = 17 }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true"
  };
  if (name === "pin") {
    return /* @__PURE__ */ jsxs("svg", { ...common, children: [
      /* @__PURE__ */ jsx2("path", { d: "M12 17v5" }),
      /* @__PURE__ */ jsx2("path", { d: "M9 3h6l1 7 3 3v2H5v-2l3-3 1-7Z" })
    ] });
  }
  if (name === "palette") {
    return /* @__PURE__ */ jsxs("svg", { ...common, children: [
      /* @__PURE__ */ jsx2("path", { d: "M12 3a9 9 0 0 0 0 18h1.5a1.8 1.8 0 0 0 1.2-3.15 1.6 1.6 0 0 1 1.05-2.85H17a4 4 0 0 0 4-4c0-4.42-4.03-8-9-8Z" }),
      /* @__PURE__ */ jsx2("circle", { cx: "7.5", cy: "10", r: ".6", fill: "currentColor", stroke: "none" }),
      /* @__PURE__ */ jsx2("circle", { cx: "10", cy: "7.5", r: ".6", fill: "currentColor", stroke: "none" }),
      /* @__PURE__ */ jsx2("circle", { cx: "14", cy: "7.5", r: ".6", fill: "currentColor", stroke: "none" })
    ] });
  }
  if (name === "paperclip") {
    return /* @__PURE__ */ jsx2("svg", { ...common, children: /* @__PURE__ */ jsx2("path", { d: "m21.4 11.6-8.5 8.5a6 6 0 0 1-8.5-8.5l8.5-8.5a4 4 0 0 1 5.7 5.7l-8.5 8.5a2 2 0 1 1-2.8-2.8l7.8-7.8" }) });
  }
  if (name === "image") {
    return /* @__PURE__ */ jsxs("svg", { ...common, children: [
      /* @__PURE__ */ jsx2("rect", { x: "3", y: "5", width: "18", height: "14", rx: "2" }),
      /* @__PURE__ */ jsx2("circle", { cx: "8.5", cy: "10", r: "1.5" }),
      /* @__PURE__ */ jsx2("path", { d: "m21 16-5-5L5 19" })
    ] });
  }
  if (name === "file") {
    return /* @__PURE__ */ jsxs("svg", { ...common, children: [
      /* @__PURE__ */ jsx2("path", { d: "M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" }),
      /* @__PURE__ */ jsx2("path", { d: "M14 3v6h6" })
    ] });
  }
  if (name === "trash") {
    return /* @__PURE__ */ jsxs("svg", { ...common, children: [
      /* @__PURE__ */ jsx2("path", { d: "M3 6h18" }),
      /* @__PURE__ */ jsx2("path", { d: "M8 6V4h8v2" }),
      /* @__PURE__ */ jsx2("path", { d: "m6 6 1 15h10l1-15" }),
      /* @__PURE__ */ jsx2("path", { d: "M10 11v6" }),
      /* @__PURE__ */ jsx2("path", { d: "M14 11v6" })
    ] });
  }
  if (name === "back") {
    return /* @__PURE__ */ jsxs("svg", { ...common, children: [
      /* @__PURE__ */ jsx2("path", { d: "M19 12H5" }),
      /* @__PURE__ */ jsx2("path", { d: "m12 19-7-7 7-7" })
    ] });
  }
  if (name === "edit") {
    return /* @__PURE__ */ jsxs("svg", { ...common, children: [
      /* @__PURE__ */ jsx2("path", { d: "M12 20h9" }),
      /* @__PURE__ */ jsx2("path", { d: "M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" })
    ] });
  }
  return null;
}

// src/ui/Card.jsx
import { jsx as jsx3, jsxs as jsxs2 } from "react/jsx-runtime";
function IconBtn({ children, title, onClick, active, danger }) {
  const t = T();
  return /* @__PURE__ */ jsx3(
    "button",
    {
      title,
      "aria-label": title,
      onClick: (e) => {
        e.stopPropagation();
        onClick();
      },
      style: {
        width: 30,
        height: 30,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        border: "none",
        borderRadius: 8,
        background: active ? `${t.accent}22` : "transparent",
        color: danger ? t.danger : t.muted,
        cursor: "pointer",
        fontSize: 14,
        opacity: active ? 1 : 0.85
      },
      children
    }
  );
}
function Card({ note, onOpen, onPin, onColor, onDelete, resolveAttachment }) {
  const t = T();
  const { meta, body } = note;
  const [html, setHtml] = useState("");
  const [showColors, setShowColors] = useState(false);
  const [thumbUrls, setThumbUrls] = useState([]);
  useEffect(() => {
    let live = true;
    renderPreviewHTML((body || "").slice(0, 700)).then((h) => {
      if (live) setHtml(h);
    }).catch(() => {
    });
    return () => {
      live = false;
    };
  }, [body]);
  useEffect(() => {
    let live = true;
    let urls = [];
    const refs = localImageRefs(meta, body, 4);
    setThumbUrls([]);
    if (!refs.length || !resolveAttachment) return () => {
    };
    Promise.all(refs.map((ref) => resolveAttachment(ref).catch(() => null))).then((resolved) => {
      const next = resolved.filter(Boolean);
      if (!live) {
        next.forEach((u) => URL.revokeObjectURL(u));
        return;
      }
      urls = next;
      setThumbUrls(next);
    }).catch(() => {
    });
    return () => {
      live = false;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [body, meta, resolveAttachment]);
  const bar = colorHex(meta.color);
  const tint = colorTint(meta.color);
  const empty = !meta.title && !(body || "").trim();
  return /* @__PURE__ */ jsx3("div", { style: { breakInside: "avoid", marginBottom: 14 }, children: /* @__PURE__ */ jsxs2("div", { style: {
    position: "relative",
    background: tint ? `linear-gradient(180deg, ${tint}, ${t.surface} 44%)` : t.surface,
    border: `1px solid ${bar ? colorTint(meta.color, 0.5) : t.border}`,
    borderRadius: 8,
    overflow: "hidden"
  }, children: [
    bar && /* @__PURE__ */ jsx3("div", { style: { height: 4, background: bar } }),
    /* @__PURE__ */ jsxs2(
      "div",
      {
        onClick: () => onOpen(meta.id),
        style: { cursor: "pointer", padding: "14px 16px 10px" },
        children: [
          thumbUrls.length > 0 && /* @__PURE__ */ jsx3("div", { style: {
            display: "grid",
            gridTemplateColumns: thumbUrls.length === 1 ? "1fr" : "repeat(2, minmax(0, 1fr))",
            gap: 6,
            marginBottom: 10
          }, children: thumbUrls.map((url, index) => /* @__PURE__ */ jsx3(
            "img",
            {
              src: url,
              alt: "",
              style: {
                width: "100%",
                aspectRatio: thumbUrls.length === 1 ? "16 / 10" : "1 / 1",
                objectFit: "cover",
                display: "block",
                borderRadius: 6,
                border: `1px solid ${bar ? colorTint(meta.color, 0.28) : t.border}`,
                background: t.surface2,
                gridColumn: thumbUrls.length === 3 && index === 0 ? "span 2" : void 0
              }
            },
            url
          )) }),
          meta.title && /* @__PURE__ */ jsx3("div", { style: { fontSize: 15, fontWeight: 650, color: t.text, marginBottom: 6, overflowWrap: "anywhere" }, children: meta.title }),
          empty ? /* @__PURE__ */ jsx3("div", { style: { fontSize: 13.5, color: t.muted, opacity: 0.6, fontStyle: "italic" }, children: "Empty note" }) : /* @__PURE__ */ jsx3(
            "div",
            {
              className: "note-preview",
              style: { fontSize: 13.5, color: t.muted, lineHeight: 1.5, maxHeight: 220, overflow: "hidden" },
              dangerouslySetInnerHTML: { __html: html }
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ jsxs2("div", { style: { display: "flex", alignItems: "center", gap: 2, padding: "6px 8px", borderTop: `1px solid ${bar ? colorTint(meta.color, 0.32) : t.border}`, background: bar ? colorTint(meta.color, 0.08) : "transparent" }, children: [
      /* @__PURE__ */ jsx3(IconBtn, { title: meta.pinned ? "Unpin" : "Pin", active: meta.pinned, onClick: () => onPin(meta.id), children: /* @__PURE__ */ jsx3(Icon, { name: "pin", size: 15 }) }),
      /* @__PURE__ */ jsxs2("div", { style: { position: "relative" }, children: [
        /* @__PURE__ */ jsx3(IconBtn, { title: "Color", onClick: () => setShowColors((v) => !v), children: /* @__PURE__ */ jsx3(Icon, { name: "palette", size: 16 }) }),
        showColors && /* @__PURE__ */ jsx3(
          ColorPicker,
          {
            current: meta.color,
            onPick: (c) => {
              onColor(meta.id, c);
              setShowColors(false);
            }
          }
        )
      ] }),
      /* @__PURE__ */ jsx3("div", { style: { flex: 1 } }),
      /* @__PURE__ */ jsx3(IconBtn, { title: "Delete", danger: true, onClick: () => onDelete(meta.id), children: /* @__PURE__ */ jsx3(Icon, { name: "trash", size: 15 }) })
    ] })
  ] }) });
}

// src/ui/Grid.jsx
import { jsx as jsx4, jsxs as jsxs3 } from "react/jsx-runtime";
function Grid({ notes, onOpen, onPin, onColor, onDelete, resolveAttachment }) {
  const t = T();
  const pinned = notes.filter((n) => n.meta.pinned);
  const others = notes.filter((n) => !n.meta.pinned);
  const header = (txt) => /* @__PURE__ */ jsx4("h2", { style: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: t.muted,
    margin: "4px 8px 10px"
  }, children: txt });
  const cards = (list) => /* @__PURE__ */ jsx4("div", { style: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 180px), 1fr))",
    gap: 12,
    alignItems: "start"
  }, children: list.map((n) => /* @__PURE__ */ jsx4(
    Card,
    {
      note: n,
      onOpen,
      onPin,
      onColor,
      onDelete,
      resolveAttachment
    },
    n.meta.id
  )) });
  return /* @__PURE__ */ jsxs3("div", { style: { padding: "16px 8px 90px", maxWidth: 1120, margin: "0 auto" }, children: [
    pinned.length > 0 && /* @__PURE__ */ jsxs3("section", { style: { marginBottom: 18 }, children: [
      header("Pinned"),
      cards(pinned)
    ] }),
    others.length > 0 && /* @__PURE__ */ jsxs3("section", { children: [
      pinned.length > 0 && header("Others"),
      cards(others)
    ] })
  ] });
}

// src/ui/EditorPanel.jsx
import { useState as useState2, useEffect as useEffect3, useRef as useRef2, useCallback } from "react";

// src/editor/Editor.jsx
import { useRef, useEffect as useEffect2 } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView as EditorView2 } from "@codemirror/view";

// src/editor/extensions.js
import {
  EditorSelection
} from "@codemirror/state";
import {
  history,
  historyKeymap,
  defaultKeymap,
  indentWithTab
} from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import {
  syntaxHighlighting,
  HighlightStyle,
  indentOnInput
} from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { EditorView, keymap } from "@codemirror/view";

// src/editor/livePreview.js
import { syntaxTree } from "@codemirror/language";
import { ViewPlugin, Decoration } from "@codemirror/view";

// src/editor/widgets.js
import { WidgetType } from "@codemirror/view";
import katex from "katex";
var CheckboxWidget = class extends WidgetType {
  constructor(checked, pos) {
    super();
    this.checked = checked;
    this.pos = pos;
  }
  eq(o) {
    return o.checked === this.checked && o.pos === this.pos;
  }
  toDOM(view) {
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = this.checked;
    box.style.cssText = "margin:0 6px 0 0; cursor:pointer; vertical-align:middle; accent-color:var(--accent)";
    box.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const insert = this.checked ? "[ ]" : "[x]";
      view.dispatch({ changes: { from: this.pos, to: this.pos + 3, insert } });
    });
    return box;
  }
  ignoreEvent() {
    return false;
  }
};
var ImageWidget = class extends WidgetType {
  constructor(src, alt, resolve) {
    super();
    this.src = src;
    this.alt = alt || "";
    this.resolve = resolve;
    this.url = null;
  }
  eq(o) {
    return o.src === this.src && o.alt === this.alt;
  }
  toDOM() {
    const wrap2 = document.createElement("div");
    wrap2.style.cssText = "margin:8px 0; max-width:100%;";
    const img = document.createElement("img");
    img.alt = this.alt;
    img.style.cssText = "max-width:100%; max-height:360px; border-radius:10px; display:block; border:1px solid var(--border);";
    wrap2.appendChild(img);
    if (this.resolve && this.src.startsWith("attachments/")) {
      this.resolve(this.src).then((u) => {
        if (u) {
          this.url = u;
          img.src = u;
        }
      }).catch(() => {
      });
    } else {
      img.src = this.src;
    }
    return wrap2;
  }
  destroy() {
    if (this.url) URL.revokeObjectURL(this.url);
  }
  get estimatedHeight() {
    return 220;
  }
  ignoreEvent() {
    return true;
  }
};
var FileChipWidget = class extends WidgetType {
  constructor(name, src, resolve) {
    super();
    this.name = name;
    this.src = src;
    this.resolve = resolve;
  }
  eq(o) {
    return o.src === this.src && o.name === this.name;
  }
  toDOM() {
    const a = document.createElement("span");
    a.textContent = `\u{1F4CE} ${this.name}`;
    a.title = this.name;
    a.style.cssText = "display:inline-flex; align-items:center; gap:4px; padding:2px 8px; margin:0 2px; border-radius:8px; border:1px solid var(--border); background:var(--surface2); color:var(--text); font-size:13px; cursor:pointer;";
    a.addEventListener("mousedown", async (e) => {
      e.preventDefault();
      if (this.resolve && this.src.startsWith("attachments/")) {
        const u = await this.resolve(this.src).catch(() => null);
        if (u) {
          const link = document.createElement("a");
          link.href = u;
          link.download = this.name;
          link.click();
          setTimeout(() => URL.revokeObjectURL(u), 0);
        }
      }
    });
    return a;
  }
  ignoreEvent() {
    return false;
  }
};
var MathWidget = class extends WidgetType {
  constructor(src, block) {
    super();
    this.src = src;
    this.block = !!block;
  }
  eq(o) {
    return o.src === this.src && o.block === this.block;
  }
  toDOM() {
    const el = document.createElement(this.block ? "div" : "span");
    try {
      el.innerHTML = katex.renderToString(this.src, { throwOnError: false, displayMode: this.block });
    } catch {
      el.textContent = this.block ? `$$${this.src}$$` : `$${this.src}$`;
    }
    if (this.block) el.style.cssText = "text-align:center; margin:8px 0; overflow-x:auto;";
    return el;
  }
  ignoreEvent() {
    return true;
  }
};

// src/editor/livePreview.js
var HIDE_MARKS = /* @__PURE__ */ new Set(["HeaderMark", "EmphasisMark", "StrikethroughMark"]);
var INLINE_MATH = /(?<!\$)\$([^$\n]+?)\$(?!\$)/g;
var BLOCK_MATH = /\$\$([^\n]+?)\$\$/g;
function scanMath(state, ranges, onActive, out) {
  for (const { from, to } of ranges) {
    let startLine = state.doc.lineAt(from).number;
    const endLine = state.doc.lineAt(to).number;
    for (let n = startLine; n <= endLine; n++) {
      const line = state.doc.line(n);
      const text = line.text;
      let m;
      BLOCK_MATH.lastIndex = 0;
      const blocked = [];
      while (m = BLOCK_MATH.exec(text)) {
        const f = line.from + m.index;
        const t = f + m[0].length;
        blocked.push([m.index, m.index + m[0].length]);
        if (!onActive(f, t)) out.push({ from: f, to: t, deco: Decoration.replace({ widget: new MathWidget(m[1].trim(), true) }) });
      }
      INLINE_MATH.lastIndex = 0;
      while (m = INLINE_MATH.exec(text)) {
        const insideBlock = blocked.some(([a, b]) => m.index >= a && m.index < b);
        if (insideBlock) continue;
        const f = line.from + m.index;
        const t = f + m[0].length;
        if (!onActive(f, t)) out.push({ from: f, to: t, deco: Decoration.replace({ widget: new MathWidget(m[1].trim(), false) }) });
      }
    }
  }
}
function livePreview({ resolveAttachment } = {}) {
  return ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.decorations = this.build(view);
      }
      update(u) {
        if (u.docChanged || u.viewportChanged || u.selectionSet) this.decorations = this.build(u.view);
      }
      build(view) {
        try {
          const { state } = view;
          const sel = state.selection.main;
          const aFrom = state.doc.lineAt(sel.from).from;
          const aTo = state.doc.lineAt(sel.to).to;
          const onActive = (from, to) => to >= aFrom && from <= aTo;
          const out = [];
          const tree = syntaxTree(state);
          for (const { from, to } of view.visibleRanges) {
            tree.iterate({
              from,
              to,
              enter: (node) => {
                const name = node.name;
                if (name === "TaskMarker") {
                  if (!onActive(node.from, node.to)) {
                    const text = state.sliceDoc(node.from, node.to);
                    out.push({ from: node.from, to: node.to, deco: Decoration.replace({ widget: new CheckboxWidget(/x/i.test(text), node.from) }) });
                  }
                } else if (name === "Image") {
                  if (!onActive(node.from, node.to)) {
                    const md = state.sliceDoc(node.from, node.to);
                    const mm = /!\[([^\]]*)\]\(([^)\s]+)/.exec(md);
                    if (mm) out.push({ from: node.from, to: node.to, deco: Decoration.replace({ widget: new ImageWidget(mm[2], mm[1], resolveAttachment) }) });
                  }
                } else if (name === "Link") {
                  if (!onActive(node.from, node.to)) {
                    const md = state.sliceDoc(node.from, node.to);
                    const mm = /^\[([^\]]*)\]\(([^)\s]+)/.exec(md);
                    if (mm && mm[2].startsWith("attachments/")) {
                      out.push({ from: node.from, to: node.to, deco: Decoration.replace({ widget: new FileChipWidget(mm[1] || "file", mm[2], resolveAttachment) }) });
                    }
                  }
                } else if (HIDE_MARKS.has(name)) {
                  if (!onActive(node.from, node.to)) out.push({ from: node.from, to: node.to, deco: Decoration.replace({}) });
                }
              }
            });
          }
          scanMath(state, view.visibleRanges, onActive, out);
          out.sort((a, b) => a.from - b.from || a.to - b.to);
          const ranges = [];
          let lastTo = -1;
          for (const w of out) {
            if (w.from < lastTo) continue;
            ranges.push(w.deco.range(w.from, w.to));
            lastTo = w.to;
          }
          return Decoration.set(ranges, true);
        } catch (e) {
          return Decoration.none;
        }
      }
    },
    { decorations: (v) => v.decorations }
  );
}

// src/editor/extensions.js
var heading = (size, weight) => ({ fontSize: size, fontWeight: weight, lineHeight: "1.3" });
var highlightStyle = HighlightStyle.define([
  { tag: tags.heading1, ...heading("1.6em", "700") },
  { tag: tags.heading2, ...heading("1.36em", "700") },
  { tag: tags.heading3, ...heading("1.18em", "650") },
  { tag: [tags.heading4, tags.heading5, tags.heading6], ...heading("1.06em", "650") },
  { tag: tags.strong, fontWeight: "700" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: tags.link, color: "var(--accent)", textDecoration: "underline" },
  { tag: tags.url, color: "var(--muted)" },
  { tag: [tags.monospace], fontFamily: "var(--mono)", fontSize: "0.92em", background: "var(--surface2)", borderRadius: "4px", padding: "0 3px" },
  { tag: tags.quote, color: "var(--muted)", fontStyle: "italic" },
  { tag: tags.list, color: "var(--text)" },
  { tag: tags.processingInstruction, color: "var(--muted)", opacity: 0.6 },
  { tag: tags.contentSeparator, color: "var(--border)" }
]);
var theme = EditorView.theme({
  "&": { height: "100%", backgroundColor: "transparent", color: "var(--text)" },
  ".cm-scroller": { overflow: "auto", fontFamily: "var(--font)", lineHeight: "1.65", fontSize: "15px" },
  ".cm-content": { padding: "16px 18px 40vh", caretColor: "var(--accent)", maxWidth: "760px", margin: "0 auto", width: "100%" },
  "&.cm-focused": { outline: "none" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--accent)", borderLeftWidth: "2px" },
  ".cm-selectionBackground": { backgroundColor: "rgba(167,139,250,0.22)" },
  "&.cm-focused .cm-selectionBackground": { backgroundColor: "rgba(167,139,250,0.30)" },
  ".cm-line": { padding: "0" }
}, { dark: true });
function wrap(mark, markEnd = mark) {
  return (view) => {
    const tr = view.state.changeByRange((range) => {
      const text = view.state.sliceDoc(range.from, range.to);
      return {
        changes: { from: range.from, to: range.to, insert: mark + text + markEnd },
        range: EditorSelection.range(range.from + mark.length, range.to + mark.length)
      };
    });
    view.dispatch(view.state.update(tr, { userEvent: "input.format", scrollIntoView: true }));
    return true;
  };
}
var mdKeymap = [
  { key: "Mod-b", run: wrap("**") },
  { key: "Mod-i", run: wrap("*") },
  { key: "Mod-e", run: wrap("`") },
  { key: "Mod-Shift-x", run: wrap("~~") }
];
function buildExtensions({ onDocChange, resolveAttachment }) {
  return [
    history(),
    markdown({ base: markdownLanguage }),
    syntaxHighlighting(highlightStyle),
    indentOnInput(),
    EditorView.lineWrapping,
    livePreview({ resolveAttachment }),
    keymap.of([...mdKeymap, indentWithTab, ...historyKeymap, ...defaultKeymap]),
    theme,
    EditorView.updateListener.of((u) => {
      if (u.docChanged) onDocChange(u.state.doc.toString());
    })
  ];
}

// src/editor/Editor.jsx
import { jsx as jsx5 } from "react/jsx-runtime";
function Editor({ value, onChange, resolveAttachment, viewRef }) {
  const host = useRef(null);
  const view = useRef(null);
  const onChangeRef = useRef(onChange);
  const resolveRef = useRef(resolveAttachment);
  onChangeRef.current = onChange;
  resolveRef.current = resolveAttachment;
  useEffect2(() => {
    const state = EditorState.create({
      doc: value || "",
      extensions: buildExtensions({
        onDocChange: (t) => {
          if (onChangeRef.current) onChangeRef.current(t);
        },
        resolveAttachment: (p) => resolveRef.current ? resolveRef.current(p) : Promise.resolve(null)
      })
    });
    const v = new EditorView2({ state, parent: host.current });
    view.current = v;
    if (viewRef) viewRef.current = v;
    return () => {
      v.destroy();
      view.current = null;
      if (viewRef) viewRef.current = null;
    };
  }, []);
  useEffect2(() => {
    const v = view.current;
    if (!v) return;
    const cur = v.state.doc.toString();
    if (value != null && value !== cur) {
      v.dispatch({ changes: { from: 0, to: cur.length, insert: value } });
    }
  }, [value]);
  return /* @__PURE__ */ jsx5("div", { ref: host, style: { height: "100%" } });
}

// src/ui/EditorPanel.jsx
import { jsx as jsx6, jsxs as jsxs4 } from "react/jsx-runtime";
var AUTOSAVE_MS = 600;
function resolveNow(note) {
  try {
    window.parent.postMessage({
      type: "moebius:new-chat",
      draft: `Resolve the Notes merge conflict for note ${note.meta.id}: read the descriptor under /data/apps/notes/conflicts/${note.meta.id}/, 3-way-merge mine + server against base (preserve attachment refs), write the result to /data/apps/notes/notes/${note.meta.id}.md, then mark the descriptor resolved.`
    }, window.location.origin);
  } catch (e) {
  }
}
function EditorPanel({ note, onSave, onBack, onPin, onColor, onDelete, resolveAttachment, putAttachment: putAttachment2, conflict, status }) {
  const t = T();
  const [title, setTitle] = useState2(note.meta.title || "");
  const [body, setBody] = useState2(note.body || "");
  const [showColors, setShowColors] = useState2(false);
  const [attachErr, setAttachErr] = useState2("");
  const timer = useRef2(null);
  const viewRef = useRef2(null);
  const imageRef = useRef2(null);
  const fileRef = useRef2(null);
  const latest = useRef2({ note, title: note.meta.title || "", body: note.body || "" });
  useEffect3(() => {
    latest.current = { note, title, body };
  }, [note, title, body]);
  const flushSave = useCallback(() => {
    const cur = latest.current;
    if (!cur?.note) return Promise.resolve();
    if (cur.title === (cur.note.meta.title || "") && cur.body === (cur.note.body || "")) {
      return Promise.resolve();
    }
    if (timer.current) clearTimeout(timer.current);
    return Promise.resolve(onSave({ ...cur.note.meta, title: cur.title }, cur.body));
  }, [onSave]);
  useEffect3(() => {
    setTitle(note.meta.title || "");
    setBody(note.body || "");
  }, [note.meta.id]);
  useEffect3(() => {
    if (title === (note.meta.title || "") && body === (note.body || "")) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      flushSave();
    }, AUTOSAVE_MS);
    return () => clearTimeout(timer.current);
  }, [title, body, flushSave]);
  useEffect3(() => {
    const flushOnHide = () => {
      if (document.visibilityState === "hidden") flushSave();
    };
    const flushOnUnload = () => {
      flushSave();
    };
    document.addEventListener("visibilitychange", flushOnHide);
    window.addEventListener("beforeunload", flushOnUnload);
    return () => {
      document.removeEventListener("visibilitychange", flushOnHide);
      window.removeEventListener("beforeunload", flushOnUnload);
    };
  }, [flushSave]);
  function insertMarkdown(md) {
    const v = viewRef.current;
    if (v) {
      v.dispatch(v.state.replaceSelection(md));
      v.focus();
      return v.state.doc.toString();
    }
    const next = body + md;
    setBody(next);
    return next;
  }
  async function handleFile(e) {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f || !putAttachment2) return;
    try {
      const res = await putAttachment2(f);
      const isImage = (f.type || "").startsWith("image/");
      const md = isImage ? `
![${res.name}](${res.path})
` : `[${res.name}](${res.path})`;
      const nextBody = insertMarkdown(md);
      const attachments = Array.from(/* @__PURE__ */ new Set([...note.meta.attachments || [], res.path]));
      await onSave({ ...note.meta, title, attachments }, nextBody);
      setAttachErr("");
    } catch (err) {
      setAttachErr(String(err && err.message || err).includes("limit") ? "File too large (max 25 MB)." : "Could not attach file.");
      setTimeout(() => setAttachErr(""), 3500);
    }
  }
  const statusColor = status === "Synced" ? t.green : status === "Resolving\u2026" ? t.accent : t.muted;
  return /* @__PURE__ */ jsxs4("div", { style: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", background: t.bg, zIndex: 10 }, children: [
    /* @__PURE__ */ jsxs4("header", { style: { padding: "8px 10px 9px", borderBottom: `1px solid ${t.border}`, display: "flex", flexDirection: "column", gap: 7 }, children: [
      /* @__PURE__ */ jsxs4("div", { style: { display: "flex", alignItems: "center", gap: 6, minWidth: 0 }, children: [
        /* @__PURE__ */ jsx6("button", { onClick: async () => {
          await flushSave();
          onBack();
        }, "aria-label": "Back", style: hdrBtn(t), children: /* @__PURE__ */ jsx6(Icon, { name: "back", size: 18 }) }),
        colorHex(note.meta.color) && /* @__PURE__ */ jsx6("span", { style: { width: 9, height: 9, borderRadius: 3, background: colorHex(note.meta.color), flexShrink: 0 } }),
        /* @__PURE__ */ jsx6(
          "input",
          {
            value: title,
            onChange: (e) => setTitle(e.target.value),
            placeholder: "Title",
            "aria-label": "Note title",
            style: { flex: 1, minWidth: 0, padding: "7px 6px", border: "none", outline: "none", background: "transparent", color: t.text, fontSize: 17, fontWeight: 650 }
          }
        ),
        status && /* @__PURE__ */ jsx6("span", { style: { fontSize: 12, color: statusColor, whiteSpace: "nowrap", marginRight: 2, flexShrink: 0 }, children: status })
      ] }),
      /* @__PURE__ */ jsxs4("div", { style: { display: "flex", alignItems: "center", gap: 6, overflowX: "auto", paddingBottom: 1 }, children: [
        /* @__PURE__ */ jsx6("button", { onClick: () => onPin(note.meta.id), "aria-label": note.meta.pinned ? "Unpin" : "Pin", title: note.meta.pinned ? "Unpin" : "Pin", style: hdrBtn(t, note.meta.pinned), children: /* @__PURE__ */ jsx6(Icon, { name: "pin", size: 16 }) }),
        /* @__PURE__ */ jsxs4("div", { style: { position: "relative", flexShrink: 0 }, children: [
          /* @__PURE__ */ jsx6("button", { onClick: () => setShowColors((v) => !v), "aria-label": "Color", title: "Color", style: hdrBtn(t), children: /* @__PURE__ */ jsx6(Icon, { name: "palette", size: 17 }) }),
          showColors && /* @__PURE__ */ jsx6(ColorPicker, { placement: "below", align: "start", current: note.meta.color, onPick: (c) => {
            onColor(note.meta.id, c);
            setShowColors(false);
          } })
        ] }),
        /* @__PURE__ */ jsxs4("button", { onClick: () => imageRef.current && imageRef.current.click(), "aria-label": "Insert image", title: "Insert image", style: labelBtn(t), children: [
          /* @__PURE__ */ jsx6(Icon, { name: "image", size: 16 }),
          "Image"
        ] }),
        /* @__PURE__ */ jsxs4("button", { onClick: () => fileRef.current && fileRef.current.click(), "aria-label": "Attach file", title: "Attach file", style: labelBtn(t), children: [
          /* @__PURE__ */ jsx6(Icon, { name: "file", size: 16 }),
          "File"
        ] }),
        /* @__PURE__ */ jsx6("div", { style: { flex: 1, minWidth: 4 } }),
        /* @__PURE__ */ jsx6("button", { onClick: () => onDelete(note.meta.id), "aria-label": "Delete", title: "Delete", style: hdrBtn(t, false, true), children: /* @__PURE__ */ jsx6(Icon, { name: "trash", size: 16 }) })
      ] }),
      /* @__PURE__ */ jsx6("input", { ref: imageRef, type: "file", accept: "image/*", onChange: handleFile, style: { display: "none" } }),
      /* @__PURE__ */ jsx6("input", { ref: fileRef, type: "file", onChange: handleFile, style: { display: "none" } })
    ] }),
    conflict && /* @__PURE__ */ jsxs4("div", { style: { display: "flex", alignItems: "center", gap: 10, padding: "9px 16px", background: `${t.accent}1f`, color: t.text, fontSize: 13 }, children: [
      /* @__PURE__ */ jsx6("span", { style: { flex: 1 }, children: "Edited in two places \u2014 merging\u2026" }),
      /* @__PURE__ */ jsx6("button", { onClick: () => resolveNow(note), style: { border: `1px solid ${t.accent}`, background: "transparent", color: t.accent, borderRadius: 8, padding: "4px 10px", fontSize: 12, cursor: "pointer" }, children: "Resolve now" })
    ] }),
    attachErr && /* @__PURE__ */ jsx6("div", { style: { padding: "8px 16px", background: `${t.danger}22`, color: t.danger, fontSize: 13 }, children: attachErr }),
    /* @__PURE__ */ jsx6("div", { style: { flex: 1, overflow: "hidden" }, children: /* @__PURE__ */ jsx6(Editor, { value: body, onChange: setBody, resolveAttachment, viewRef }) })
  ] });
}
function hdrBtn(t, active, danger) {
  return {
    width: 34,
    height: 34,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "none",
    borderRadius: 9,
    background: active ? `${t.accent}22` : "transparent",
    color: danger ? t.danger : t.text,
    cursor: "pointer",
    fontSize: 16,
    flexShrink: 0
  };
}
function labelBtn(t) {
  return {
    height: 34,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    border: `1px solid ${t.border}`,
    borderRadius: 8,
    padding: "0 10px",
    background: t.surface2,
    color: t.text,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    whiteSpace: "nowrap",
    flexShrink: 0
  };
}

// src/ui/ConfirmModal.jsx
import { jsx as jsx7, jsxs as jsxs5 } from "react/jsx-runtime";
function ConfirmModal({ open: open2, title, message, confirmLabel = "Confirm", danger, onConfirm, onCancel }) {
  if (!open2) return null;
  const t = T();
  return /* @__PURE__ */ jsx7(
    "div",
    {
      role: "dialog",
      "aria-modal": "true",
      onClick: onCancel,
      style: {
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(2px)"
      },
      children: /* @__PURE__ */ jsxs5(
        "div",
        {
          onClick: (e) => e.stopPropagation(),
          style: {
            width: "100%",
            maxWidth: 360,
            background: t.surface,
            border: `1px solid ${t.border}`,
            borderRadius: 16,
            padding: 20,
            boxShadow: "0 12px 40px rgba(0,0,0,0.5)"
          },
          children: [
            title && /* @__PURE__ */ jsx7("h2", { style: { fontSize: 16, fontWeight: 650, color: t.text, marginBottom: 8 }, children: title }),
            message && /* @__PURE__ */ jsx7("p", { style: { fontSize: 14, color: t.muted, lineHeight: 1.5, marginBottom: 18 }, children: message }),
            /* @__PURE__ */ jsxs5("div", { style: { display: "flex", gap: 10, justifyContent: "flex-end" }, children: [
              /* @__PURE__ */ jsx7(
                "button",
                {
                  onClick: onCancel,
                  style: {
                    padding: "9px 16px",
                    borderRadius: 10,
                    border: `1px solid ${t.border}`,
                    background: "transparent",
                    color: t.text,
                    fontSize: 14,
                    cursor: "pointer"
                  },
                  children: "Cancel"
                }
              ),
              /* @__PURE__ */ jsx7(
                "button",
                {
                  onClick: onConfirm,
                  style: {
                    padding: "9px 16px",
                    borderRadius: 10,
                    border: "none",
                    background: danger ? t.danger : t.accent,
                    color: "#0d0d0d",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer"
                  },
                  children: confirmLabel
                }
              )
            ] })
          ]
        }
      )
    }
  );
}

// src/app.jsx
import { jsx as jsx8, jsxs as jsxs6 } from "react/jsx-runtime";
function TopBar({ query, onQuery, onNew }) {
  const t = T();
  return /* @__PURE__ */ jsxs6("header", { style: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 16px",
    borderBottom: `1px solid ${t.border}`,
    position: "sticky",
    top: 0,
    background: t.bg,
    zIndex: 5
  }, children: [
    /* @__PURE__ */ jsx8("h1", { style: { fontSize: 18, fontWeight: 650, color: t.text, letterSpacing: "-0.01em" }, children: "Notes" }),
    /* @__PURE__ */ jsx8("div", { style: { flex: 1, display: "flex", justifyContent: "center" }, children: /* @__PURE__ */ jsx8(
      "input",
      {
        value: query,
        onChange: (e) => onQuery(e.target.value),
        placeholder: "Search notes\u2026",
        "aria-label": "Search notes",
        style: {
          width: "100%",
          maxWidth: 520,
          padding: "8px 12px",
          borderRadius: 10,
          border: `1px solid ${t.border}`,
          background: t.surface2,
          color: t.text,
          fontSize: 14,
          outline: "none"
        }
      }
    ) }),
    /* @__PURE__ */ jsxs6("button", { onClick: onNew, "aria-label": "New note", style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "8px 14px",
      borderRadius: 10,
      border: "none",
      background: t.accent,
      color: "#0d0d0d",
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer",
      flexShrink: 0
    }, children: [
      /* @__PURE__ */ jsx8("span", { style: { fontSize: 18, lineHeight: 1 }, children: "+" }),
      " New"
    ] })
  ] });
}
function EmptyState({ filtered }) {
  const t = T();
  return /* @__PURE__ */ jsxs6("div", { style: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "18vh 24px",
    textAlign: "center",
    color: t.muted
  }, children: [
    /* @__PURE__ */ jsx8("div", { style: { color: t.muted, opacity: 0.5 }, children: /* @__PURE__ */ jsx8(Icon, { name: "edit", size: 40 }) }),
    /* @__PURE__ */ jsx8("div", { style: { fontSize: 15 }, children: filtered ? "No matching notes" : "No notes yet" }),
    !filtered && /* @__PURE__ */ jsxs6("div", { style: { fontSize: 13, opacity: 0.8 }, children: [
      "Tap ",
      /* @__PURE__ */ jsx8("strong", { children: "+ New" }),
      " to write your first note."
    ] })
  ] });
}
function App({ appId, token }) {
  const t = T();
  const [notes, setNotes] = useState3([]);
  const [loading, setLoading] = useState3(true);
  const [query, setQuery] = useState3("");
  const [view, setView] = useState3({ mode: "grid", id: null });
  const [draft, setDraft] = useState3(null);
  const [confirmId, setConfirmId] = useState3(null);
  const [pending, setPending] = useState3(0);
  const [conflicts, setConflicts] = useState3(() => /* @__PURE__ */ new Set());
  const reconTimer = useRef3(null);
  const editorNavOwned = useRef3(false);
  const online = isOnline();
  const upsert = useCallback2((meta, body) => {
    setNotes((prev) => {
      const next = prev.some((n) => n.meta.id === meta.id) ? prev.map((n) => n.meta.id === meta.id ? { meta, body } : n) : [{ meta, body }, ...prev];
      writeIndex(next).catch(() => {
      });
      return next;
    });
  }, []);
  const onApplied = useCallback2((id, note) => {
    setConflicts((prev) => {
      if (!prev.has(id)) return prev;
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
    setNotes((prev) => prev.map((n) => n.meta.id === id ? { meta: note.meta, body: note.body } : n));
  }, []);
  const onDeleted = useCallback2((id) => {
    setConflicts((prev) => {
      if (!prev.has(id)) return prev;
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
    setNotes((prev) => prev.filter((n) => n.meta.id !== id));
  }, []);
  const onConflict = useCallback2((id) => {
    setConflicts((prev) => {
      const n = new Set(prev);
      n.add(id);
      return n;
    });
  }, []);
  const runReconcile = useCallback2(() => {
    reconcileAll({ onApplied, onDeleted, onConflict }).catch(() => {
    });
  }, [onApplied, onDeleted, onConflict]);
  const scheduleReconcile = useCallback2(() => {
    if (reconTimer.current) clearTimeout(reconTimer.current);
    reconTimer.current = setTimeout(runReconcile, 400);
  }, [runReconcile]);
  useEffect4(() => {
    let live = true;
    (async () => {
      const canonical = await listNotes().catch(() => []);
      let merged = canonical;
      try {
        const unsynced = await unsyncedLocals();
        if (unsynced.length) {
          const map = new Map(canonical.map((n) => [n.meta.id, n]));
          for (const [id, rec] of unsynced) map.set(id, { meta: rec.working.meta, body: rec.working.body });
          merged = [...map.values()];
        }
      } catch (e) {
      }
      if (!live) return;
      setNotes(merged);
      setLoading(false);
      for (const n of canonical) {
        contentHash(n.meta, n.body).then((hash) => ensureBase(n.meta.id, { meta: n.meta, body: n.body, hash })).catch(() => {
        });
      }
      runReconcile();
    })();
    return () => {
      live = false;
    };
  }, [runReconcile]);
  useEffect4(() => {
    const h = () => runReconcile();
    for (const ev of ["online", "focus"]) window.addEventListener(ev, h);
    const vis = () => {
      if (document.visibilityState === "visible") runReconcile();
    };
    document.addEventListener("visibilitychange", vis);
    return () => {
      for (const ev of ["online", "focus"]) window.removeEventListener(ev, h);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [runReconcile]);
  useEffect4(() => {
    let live = true;
    const tick = () => pendingCount().then((n) => {
      if (live) setPending(n);
    }).catch(() => {
    });
    tick();
    const h = setInterval(tick, 1500);
    return () => {
      live = false;
      clearInterval(h);
    };
  }, []);
  const pushEditorNav = useCallback2(() => {
    if (typeof window === "undefined" || !window.parent) return Promise.resolve(false);
    const requestId = `notes-editor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return new Promise((resolve) => {
      const done = (owned) => {
        clearTimeout(timer);
        window.removeEventListener("message", onMessage);
        resolve(owned);
      };
      const timer = setTimeout(() => done(false), 1200);
      const onMessage = (event) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.requestId !== requestId) return;
        if (event.data.type === "moebius:nav-push-ack") done(true);
        else if (event.data.type === "moebius:nav-push-rejected") done(false);
      };
      window.addEventListener("message", onMessage);
      try {
        window.parent.postMessage(
          { type: "moebius:nav-push", label: "notes-editor", requestId },
          window.location.origin
        );
      } catch {
        done(false);
      }
    });
  }, []);
  const popEditorNav = useCallback2(() => {
    if (!editorNavOwned.current || typeof window === "undefined" || !window.parent) return;
    editorNavOwned.current = false;
    try {
      window.parent.postMessage({ type: "moebius:nav-pop" }, window.location.origin);
    } catch {
    }
  }, []);
  const openEditor = useCallback2(async (id) => {
    if (view.mode === "editor") {
      setView({ mode: "editor", id });
      return;
    }
    editorNavOwned.current = await pushEditorNav();
    setView({ mode: "editor", id });
  }, [pushEditorNav, view.mode]);
  const createNote = useCallback2(() => {
    const meta = newNote({});
    setDraft({ meta, body: "" });
    openEditor(meta.id).catch(() => setView({ mode: "editor", id: meta.id }));
  }, [openEditor]);
  const commitDraft = useCallback2(async (meta, body) => {
    const m = { ...meta, updated: meta.updated || (/* @__PURE__ */ new Date()).toISOString() };
    m.content_hash = await contentHash(m, body);
    upsert(m, body);
    setDraft(null);
    await saveNote(m, body).catch(() => {
    });
    await promote(m.id, { meta: m, body, hash: m.content_hash }).catch(() => {
    });
    scheduleReconcile();
    return m;
  }, [scheduleReconcile, upsert]);
  const persist = useCallback2(async (meta, body) => {
    if (draft && draft.meta.id === meta.id) {
      const next = { meta: { ...draft.meta, ...meta }, body };
      setDraft(next);
      if (isBlankNote(next.meta, next.body)) return;
      await commitDraft(next.meta, next.body);
      return;
    }
    const m = { ...meta, updated: (/* @__PURE__ */ new Date()).toISOString() };
    m.content_hash = await contentHash(m, body);
    upsert(m, body);
    await recordWorking(m.id, { meta: m, body, hash: m.content_hash }).catch(() => {
    });
    scheduleReconcile();
  }, [commitDraft, draft, upsert, scheduleReconcile]);
  const togglePin = useCallback2((id) => {
    const n = notes.find((x) => x.meta.id === id);
    if (n) persist({ ...n.meta, pinned: !n.meta.pinned }, n.body);
    else if (draft && draft.meta.id === id) setDraft((d) => ({ ...d, meta: { ...d.meta, pinned: !d.meta.pinned } }));
  }, [draft, notes, persist]);
  const setColor = useCallback2((id, color) => {
    const n = notes.find((x) => x.meta.id === id);
    if (n) persist({ ...n.meta, color }, n.body);
    else if (draft && draft.meta.id === id) setDraft((d) => ({ ...d, meta: { ...d.meta, color } }));
  }, [draft, notes, persist]);
  const queueDelete = useCallback2(async (note) => {
    const hash = await contentHash(note.meta, note.body);
    await recordDeletion(note.meta.id, { meta: note.meta, body: note.body, hash }).catch(() => {
    });
    scheduleReconcile();
  }, [scheduleReconcile]);
  const doDelete = useCallback2((id) => {
    if (draft && draft.meta.id === id) {
      if (view.mode === "editor" && view.id === id) popEditorNav();
      setDraft(null);
      setConfirmId(null);
      setView({ mode: "grid" });
      return;
    }
    const n = notes.find((x) => x.meta.id === id);
    if (n) queueDelete(n).catch(() => {
    });
    setNotes((prev) => {
      const next = prev.filter((note) => note.meta.id !== id);
      writeIndex(next).catch(() => {
      });
      return next;
    });
    setConfirmId(null);
    setView((v) => {
      if (v.mode === "editor" && v.id === id) {
        popEditorNav();
        return { mode: "grid" };
      }
      return v;
    });
  }, [draft, notes, popEditorNav, queueDelete, view.id, view.mode]);
  const back = useCallback2((fromShell = false) => {
    if (!fromShell) popEditorNav();
    else editorNavOwned.current = false;
    if (draft && draft.meta.id === view.id) {
      setDraft(null);
      setView({ mode: "grid" });
      return;
    }
    const n = notes.find((x) => x.meta.id === view.id);
    if (n && isBlankNote(n.meta, n.body)) {
      queueDelete(n).catch(() => {
      });
      setNotes((prev) => {
        const next = prev.filter((x) => x.meta.id !== n.meta.id);
        writeIndex(next).catch(() => {
        });
        return next;
      });
    }
    setView({ mode: "grid" });
  }, [draft, notes, popEditorNav, view.id, queueDelete]);
  useEffect4(() => {
    const onMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "moebius:nav-back") back(true);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [back]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? notes.filter((n) => (n.meta.title || "").toLowerCase().includes(q) || (n.body || "").toLowerCase().includes(q) || (n.meta.tags || []).join(" ").toLowerCase().includes(q)) : notes;
    return [...list].sort((a, b) => {
      if (!!a.meta.pinned !== !!b.meta.pinned) return a.meta.pinned ? -1 : 1;
      return (b.meta.updated || "").localeCompare(a.meta.updated || "");
    });
  }, [notes, query]);
  const editing = view.mode === "editor" ? notes.find((n) => n.meta.id === view.id) || (draft && draft.meta.id === view.id ? draft : null) : null;
  const status = !online ? "Offline" : editing && conflicts.has(editing.meta.id) ? "Resolving\u2026" : pending > 0 ? "Saving\u2026" : "Synced";
  return /* @__PURE__ */ jsxs6("div", { style: { position: "relative", height: "100%", display: "flex", flexDirection: "column", background: t.bg, color: t.text, fontFamily: t.font }, children: [
    /* @__PURE__ */ jsx8(TopBar, { query, onQuery: setQuery, onNew: createNote }),
    /* @__PURE__ */ jsx8("main", { style: { flex: 1, overflow: "auto" }, children: loading ? /* @__PURE__ */ jsx8("div", { style: { padding: "18vh 0", textAlign: "center", color: t.muted, fontSize: 14 }, children: "Loading\u2026" }) : visible.length === 0 ? /* @__PURE__ */ jsx8(EmptyState, { filtered: !!query.trim() }) : /* @__PURE__ */ jsx8(Grid, { notes: visible, onOpen: (id) => {
      openEditor(id).catch(() => setView({ mode: "editor", id }));
    }, onPin: togglePin, onColor: setColor, onDelete: setConfirmId, resolveAttachment: attachmentURL }) }),
    editing && /* @__PURE__ */ jsx8(
      EditorPanel,
      {
        note: editing,
        onSave: persist,
        onBack: back,
        onPin: togglePin,
        onColor: setColor,
        onDelete: setConfirmId,
        resolveAttachment: attachmentURL,
        putAttachment,
        conflict: conflicts.has(editing.meta.id),
        status
      }
    ),
    /* @__PURE__ */ jsx8(
      ConfirmModal,
      {
        open: !!confirmId,
        title: "Delete note?",
        message: "This note will be permanently deleted.",
        confirmLabel: "Delete",
        danger: true,
        onConfirm: () => doDelete(confirmId),
        onCancel: () => setConfirmId(null)
      }
    )
  ] });
}
export default App;
