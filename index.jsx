// GENERATED from src/ by build.mjs — do not edit by hand.
// Edit src/app.jsx + src/{lib,ui,editor}/*, then run `npm run build`.

// src/app.jsx
import { useState as useState3, useEffect as useEffect4, useMemo, useCallback, useRef as useRef3 } from "react";

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
  if (!type) return "bin";
  const base = String(type).split(";")[0].trim().toLowerCase();
  return TYPE_TO_EXT[base] ?? "bin";
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
function neutralize(md) {
  return (md || "").replace(/!\[[^\]]*\]\(attachments\/[^)]+\)/g, " \u{1F5BC} ").replace(/\[([^\]]+)\]\(attachments\/[^)]+\)/g, " \u{1F4CE} $1 ");
}
async function renderPreviewHTML(md) {
  const { marked, purify } = await libs();
  const html = marked(neutralize(md), { breaks: true, gfm: true });
  return purify.sanitize(html, { USE_PROFILES: { html: true } });
}

// src/ui/ColorPicker.jsx
import { jsx } from "react/jsx-runtime";
function ColorPicker({ current, onPick }) {
  const t = T();
  return /* @__PURE__ */ jsx(
    "div",
    {
      role: "menu",
      "aria-label": "Note color",
      onClick: (e) => e.stopPropagation(),
      style: {
        position: "absolute",
        bottom: "calc(100% + 6px)",
        left: 0,
        zIndex: 20,
        display: "flex",
        gap: 6,
        padding: 8,
        background: t.surface2,
        border: `1px solid ${t.border}`,
        borderRadius: 12,
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)"
      },
      children: NOTE_COLORS.map((c) => /* @__PURE__ */ jsx(
        "button",
        {
          title: c.label,
          "aria-label": c.label,
          onClick: () => onPick(c.name),
          style: {
            width: 22,
            height: 22,
            borderRadius: "50%",
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

// src/ui/Card.jsx
import { jsx as jsx2, jsxs } from "react/jsx-runtime";
function IconBtn({ children, title, onClick, active, danger }) {
  const t = T();
  return /* @__PURE__ */ jsx2(
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
function Card({ note, onOpen, onPin, onColor, onDelete }) {
  const t = T();
  const { meta, body } = note;
  const [html, setHtml] = useState("");
  const [showColors, setShowColors] = useState(false);
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
  const bar = colorHex(meta.color);
  const empty = !meta.title && !(body || "").trim();
  return /* @__PURE__ */ jsx2("div", { style: { breakInside: "avoid", marginBottom: 14 }, children: /* @__PURE__ */ jsxs("div", { style: {
    position: "relative",
    background: t.surface,
    border: `1px solid ${t.border}`,
    borderRadius: 14,
    overflow: "hidden"
  }, children: [
    bar && /* @__PURE__ */ jsx2("div", { style: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: bar } }),
    /* @__PURE__ */ jsxs(
      "div",
      {
        onClick: () => onOpen(meta.id),
        style: { cursor: "pointer", padding: "14px 16px 10px", paddingLeft: bar ? 20 : 16 },
        children: [
          meta.title && /* @__PURE__ */ jsx2("div", { style: { fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 6 }, children: meta.title }),
          empty ? /* @__PURE__ */ jsx2("div", { style: { fontSize: 13.5, color: t.muted, opacity: 0.6, fontStyle: "italic" }, children: "Empty note" }) : /* @__PURE__ */ jsx2(
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
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 2, padding: "6px 8px", borderTop: `1px solid ${t.border}` }, children: [
      /* @__PURE__ */ jsx2(IconBtn, { title: meta.pinned ? "Unpin" : "Pin", active: meta.pinned, onClick: () => onPin(meta.id), children: "\u{1F4CC}" }),
      /* @__PURE__ */ jsxs("div", { style: { position: "relative" }, children: [
        /* @__PURE__ */ jsx2(IconBtn, { title: "Color", onClick: () => setShowColors((v) => !v), children: "\u{1F3A8}" }),
        showColors && /* @__PURE__ */ jsx2(
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
      /* @__PURE__ */ jsx2("div", { style: { flex: 1 } }),
      /* @__PURE__ */ jsx2(IconBtn, { title: "Delete", danger: true, onClick: () => onDelete(meta.id), children: "\u{1F5D1}" })
    ] })
  ] }) });
}

// src/ui/Grid.jsx
import { jsx as jsx3, jsxs as jsxs2 } from "react/jsx-runtime";
function Grid({ notes, onOpen, onPin, onColor, onDelete }) {
  const t = T();
  const pinned = notes.filter((n) => n.meta.pinned);
  const others = notes.filter((n) => !n.meta.pinned);
  const header = (txt) => /* @__PURE__ */ jsx3("h2", { style: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: t.muted,
    margin: "4px 8px 10px"
  }, children: txt });
  const cards = (list) => /* @__PURE__ */ jsx3("div", { style: { columnGap: 14, columns: "240px" }, children: list.map((n) => /* @__PURE__ */ jsx3(Card, { note: n, onOpen, onPin, onColor, onDelete }, n.meta.id)) });
  return /* @__PURE__ */ jsxs2("div", { style: { padding: "16px 14px 90px", maxWidth: 1100, margin: "0 auto" }, children: [
    pinned.length > 0 && /* @__PURE__ */ jsxs2("section", { style: { marginBottom: 18 }, children: [
      header("Pinned"),
      cards(pinned)
    ] }),
    others.length > 0 && /* @__PURE__ */ jsxs2("section", { children: [
      pinned.length > 0 && header("Others"),
      cards(others)
    ] })
  ] });
}

// src/ui/EditorPanel.jsx
import { useState as useState2, useEffect as useEffect3, useRef as useRef2 } from "react";

// src/editor/Editor.jsx
import { useRef, useEffect as useEffect2 } from "react";
import { EditorView as EditorView2, EditorState } from "codemirror";

// src/editor/extensions.js
import {
  EditorView,
  EditorSelection,
  keymap,
  history,
  historyKeymap,
  defaultKeymap,
  indentWithTab,
  markdown,
  markdownLanguage,
  syntaxHighlighting,
  HighlightStyle,
  tags,
  indentOnInput
} from "codemirror";

// src/editor/livePreview.js
import { ViewPlugin, Decoration, syntaxTree } from "codemirror";

// src/editor/widgets.js
import { WidgetType } from "codemirror";
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
                  const text = state.sliceDoc(node.from, node.to);
                  out.push({ from: node.from, to: node.to, deco: Decoration.replace({ widget: new CheckboxWidget(/x/i.test(text), node.from) }) });
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
import { jsx as jsx4 } from "react/jsx-runtime";
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
  return /* @__PURE__ */ jsx4("div", { ref: host, style: { height: "100%" } });
}

// src/ui/EditorPanel.jsx
import { jsx as jsx5, jsxs as jsxs3 } from "react/jsx-runtime";
var AUTOSAVE_MS = 600;
function EditorPanel({ note, onSave, onBack, onPin, onColor, onDelete, resolveAttachment, putAttachment: putAttachment2, status }) {
  const t = T();
  const [title, setTitle] = useState2(note.meta.title || "");
  const [body, setBody] = useState2(note.body || "");
  const [showColors, setShowColors] = useState2(false);
  const [attachErr, setAttachErr] = useState2("");
  const timer = useRef2(null);
  const viewRef = useRef2(null);
  const fileRef = useRef2(null);
  useEffect3(() => {
    setTitle(note.meta.title || "");
    setBody(note.body || "");
  }, [note.meta.id]);
  useEffect3(() => {
    if (title === (note.meta.title || "") && body === (note.body || "")) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onSave({ ...note.meta, title }, body), AUTOSAVE_MS);
    return () => clearTimeout(timer.current);
  }, [title, body]);
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
      const v = viewRef.current;
      if (v) {
        v.dispatch(v.state.replaceSelection(md));
        v.focus();
      } else {
        setBody((b) => b + md);
      }
      setAttachErr("");
    } catch (err) {
      setAttachErr(String(err && err.message || err).includes("limit") ? "File too large (max 25 MB)." : "Could not attach file.");
      setTimeout(() => setAttachErr(""), 3500);
    }
  }
  const statusColor = status === "Synced" ? t.green : status === "Resolving\u2026" ? t.accent : t.muted;
  return /* @__PURE__ */ jsxs3("div", { style: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", background: t.bg, zIndex: 10 }, children: [
    /* @__PURE__ */ jsxs3("header", { style: { display: "flex", alignItems: "center", gap: 6, padding: "10px 12px", borderBottom: `1px solid ${t.border}` }, children: [
      /* @__PURE__ */ jsx5("button", { onClick: onBack, "aria-label": "Back", style: hdrBtn(t), children: "\u2190" }),
      colorHex(note.meta.color) && /* @__PURE__ */ jsx5("span", { style: { width: 8, height: 8, borderRadius: "50%", background: colorHex(note.meta.color) } }),
      /* @__PURE__ */ jsx5(
        "input",
        {
          value: title,
          onChange: (e) => setTitle(e.target.value),
          placeholder: "Title",
          "aria-label": "Note title",
          style: { flex: 1, minWidth: 0, padding: "6px 8px", border: "none", outline: "none", background: "transparent", color: t.text, fontSize: 17, fontWeight: 600 }
        }
      ),
      status && /* @__PURE__ */ jsx5("span", { style: { fontSize: 12, color: statusColor, whiteSpace: "nowrap", marginRight: 2 }, children: status }),
      /* @__PURE__ */ jsx5("button", { onClick: () => onPin(note.meta.id), "aria-label": note.meta.pinned ? "Unpin" : "Pin", style: hdrBtn(t, note.meta.pinned), children: "\u{1F4CC}" }),
      /* @__PURE__ */ jsxs3("div", { style: { position: "relative" }, children: [
        /* @__PURE__ */ jsx5("button", { onClick: () => setShowColors((v) => !v), "aria-label": "Color", style: hdrBtn(t), children: "\u{1F3A8}" }),
        showColors && /* @__PURE__ */ jsx5(ColorPicker, { current: note.meta.color, onPick: (c) => {
          onColor(note.meta.id, c);
          setShowColors(false);
        } })
      ] }),
      /* @__PURE__ */ jsx5("button", { onClick: () => fileRef.current && fileRef.current.click(), "aria-label": "Attach image or file", style: hdrBtn(t), children: "\u{1F4CE}" }),
      /* @__PURE__ */ jsx5("input", { ref: fileRef, type: "file", onChange: handleFile, style: { display: "none" } }),
      /* @__PURE__ */ jsx5("button", { onClick: () => onDelete(note.meta.id), "aria-label": "Delete", style: hdrBtn(t, false, true), children: "\u{1F5D1}" })
    ] }),
    attachErr && /* @__PURE__ */ jsx5("div", { style: { padding: "8px 16px", background: `${t.danger}22`, color: t.danger, fontSize: 13 }, children: attachErr }),
    /* @__PURE__ */ jsx5("div", { style: { flex: 1, overflow: "hidden" }, children: /* @__PURE__ */ jsx5(Editor, { value: body, onChange: setBody, resolveAttachment, viewRef }) })
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

// src/ui/ConfirmModal.jsx
import { jsx as jsx6, jsxs as jsxs4 } from "react/jsx-runtime";
function ConfirmModal({ open, title, message, confirmLabel = "Confirm", danger, onConfirm, onCancel }) {
  if (!open) return null;
  const t = T();
  return /* @__PURE__ */ jsx6(
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
      children: /* @__PURE__ */ jsxs4(
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
            title && /* @__PURE__ */ jsx6("h2", { style: { fontSize: 16, fontWeight: 650, color: t.text, marginBottom: 8 }, children: title }),
            message && /* @__PURE__ */ jsx6("p", { style: { fontSize: 14, color: t.muted, lineHeight: 1.5, marginBottom: 18 }, children: message }),
            /* @__PURE__ */ jsxs4("div", { style: { display: "flex", gap: 10, justifyContent: "flex-end" }, children: [
              /* @__PURE__ */ jsx6(
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
              /* @__PURE__ */ jsx6(
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
import { jsx as jsx7, jsxs as jsxs5 } from "react/jsx-runtime";
function TopBar({ query, onQuery, onNew }) {
  const t = T();
  return /* @__PURE__ */ jsxs5("header", { style: {
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
    /* @__PURE__ */ jsx7("h1", { style: { fontSize: 18, fontWeight: 650, color: t.text, letterSpacing: "-0.01em" }, children: "Notes" }),
    /* @__PURE__ */ jsx7("div", { style: { flex: 1, display: "flex", justifyContent: "center" }, children: /* @__PURE__ */ jsx7(
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
    /* @__PURE__ */ jsxs5("button", { onClick: onNew, "aria-label": "New note", style: {
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
      /* @__PURE__ */ jsx7("span", { style: { fontSize: 18, lineHeight: 1 }, children: "+" }),
      " New"
    ] })
  ] });
}
function EmptyState({ filtered }) {
  const t = T();
  return /* @__PURE__ */ jsxs5("div", { style: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "18vh 24px",
    textAlign: "center",
    color: t.muted
  }, children: [
    /* @__PURE__ */ jsx7("div", { style: { fontSize: 40, opacity: 0.5 }, children: "\u270E" }),
    /* @__PURE__ */ jsx7("div", { style: { fontSize: 15 }, children: filtered ? "No matching notes" : "No notes yet" }),
    !filtered && /* @__PURE__ */ jsxs5("div", { style: { fontSize: 13, opacity: 0.8 }, children: [
      "Tap ",
      /* @__PURE__ */ jsx7("strong", { children: "+ New" }),
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
  const [confirmId, setConfirmId] = useState3(null);
  const [pending, setPending] = useState3(0);
  const online = isOnline();
  useEffect4(() => {
    let live = true;
    listNotes().then((list) => {
      if (live) {
        setNotes(list);
        setLoading(false);
      }
    }).catch(() => {
      if (live) setLoading(false);
    });
    return () => {
      live = false;
    };
  }, []);
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
  const upsert = useCallback((meta, body) => {
    setNotes((prev) => {
      const next = prev.some((n) => n.meta.id === meta.id) ? prev.map((n) => n.meta.id === meta.id ? { meta, body } : n) : [{ meta, body }, ...prev];
      writeIndex(next).catch(() => {
      });
      return next;
    });
  }, []);
  const persist = useCallback(async (meta, body) => {
    const m = { ...meta, updated: (/* @__PURE__ */ new Date()).toISOString() };
    m.content_hash = await contentHash(m, body);
    upsert(m, body);
    await saveNote(m, body);
  }, [upsert]);
  const createNote = useCallback(async () => {
    const meta = newNote({});
    meta.content_hash = await contentHash(meta, "");
    upsert(meta, "");
    saveNote(meta, "").catch(() => {
    });
    setView({ mode: "editor", id: meta.id });
  }, [upsert]);
  const togglePin = useCallback((id) => {
    const n = notes.find((x) => x.meta.id === id);
    if (n) persist({ ...n.meta, pinned: !n.meta.pinned }, n.body);
  }, [notes, persist]);
  const setColor = useCallback((id, color) => {
    const n = notes.find((x) => x.meta.id === id);
    if (n) persist({ ...n.meta, color }, n.body);
  }, [notes, persist]);
  const doDelete = useCallback((id) => {
    deleteNote(id).catch(() => {
    });
    setNotes((prev) => {
      const next = prev.filter((n) => n.meta.id !== id);
      writeIndex(next).catch(() => {
      });
      return next;
    });
    setConfirmId(null);
    setView((v) => v.mode === "editor" && v.id === id ? { mode: "grid" } : v);
  }, []);
  const back = useCallback(() => {
    const n = notes.find((x) => x.meta.id === view.id);
    if (n && !(n.meta.title || "").trim() && !(n.body || "").trim()) {
      deleteNote(n.meta.id).catch(() => {
      });
      setNotes((prev) => prev.filter((x) => x.meta.id !== n.meta.id));
    }
    setView({ mode: "grid" });
  }, [notes, view.id]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? notes.filter((n) => (n.meta.title || "").toLowerCase().includes(q) || (n.body || "").toLowerCase().includes(q) || (n.meta.tags || []).join(" ").toLowerCase().includes(q)) : notes;
    return [...list].sort((a, b) => {
      if (!!a.meta.pinned !== !!b.meta.pinned) return a.meta.pinned ? -1 : 1;
      return (b.meta.updated || "").localeCompare(a.meta.updated || "");
    });
  }, [notes, query]);
  const editing = view.mode === "editor" ? notes.find((n) => n.meta.id === view.id) : null;
  const status = !online ? "Offline" : pending > 0 ? "Saving\u2026" : "Synced";
  return /* @__PURE__ */ jsxs5("div", { style: {
    position: "relative",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    background: t.bg,
    color: t.text,
    fontFamily: t.font
  }, children: [
    /* @__PURE__ */ jsx7(TopBar, { query, onQuery: setQuery, onNew: createNote }),
    /* @__PURE__ */ jsx7("main", { style: { flex: 1, overflow: "auto" }, children: loading ? /* @__PURE__ */ jsx7("div", { style: { padding: "18vh 0", textAlign: "center", color: t.muted, fontSize: 14 }, children: "Loading\u2026" }) : visible.length === 0 ? /* @__PURE__ */ jsx7(EmptyState, { filtered: !!query.trim() }) : /* @__PURE__ */ jsx7(
      Grid,
      {
        notes: visible,
        onOpen: (id) => setView({ mode: "editor", id }),
        onPin: togglePin,
        onColor: setColor,
        onDelete: setConfirmId
      }
    ) }),
    editing && /* @__PURE__ */ jsx7(
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
        status
      }
    ),
    /* @__PURE__ */ jsx7(
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
