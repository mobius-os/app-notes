// GENERATED from src/ by build.mjs — do not edit by hand.
// Edit src/app.jsx + src/{lib,ui,editor}/*, then run `npm run build`.
import React, { memo, useCallback, useDeferredValue, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { ArrowLeft, Check, ColorTheme, Edit, File as File$1, FileDocument, FileImage, Lock, Paperclip, Pin, Plus, Search, SquareCheckCheckboxChecked, Trash } from "@openai/apps-sdk-ui/components/Icon";
import { Compartment, EditorSelection, EditorState, StateField } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, WidgetType, keymap } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { HighlightStyle, indentOnInput, syntaxHighlighting, syntaxTree } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import katex from "katex";
//#region src/ui/colors.js
const NOTE_COLORS = [
	{
		name: null,
		label: "Default",
		hex: null
	},
	{
		name: "slate",
		label: "Slate",
		hex: "#7d96b4"
	},
	{
		name: "moss",
		label: "Moss",
		hex: "#84a583"
	},
	{
		name: "sand",
		label: "Sand",
		hex: "#c2ab82"
	},
	{
		name: "clay",
		label: "Clay",
		hex: "#bd8d7c"
	},
	{
		name: "plum",
		label: "Plum",
		hex: "#a98ab4"
	}
];
const LEGACY_TONES = {
	violet: "plum",
	pink: "plum",
	green: "moss",
	amber: "sand",
	coral: "clay",
	sky: "slate"
};
function normalizeColorName(name) {
	if (!name) return null;
	if (NOTE_COLORS.some((c) => c.name === name)) return name;
	return LEGACY_TONES[name] ?? null;
}
const CSS = `
/* mobius-ui:Root v1 — keep in sync; library candidate. Diverge below the marker only. */
.nt-root {
  --nt-measure: 704px;
  --nt-safe-top: var(--mobius-safe-top, env(safe-area-inset-top, 0px));
  --nt-safe-right: var(--mobius-safe-right, env(safe-area-inset-right, 0px));
  --nt-safe-bottom: var(--mobius-safe-bottom, env(safe-area-inset-bottom, 0px));
  --nt-safe-left: var(--mobius-safe-left, env(safe-area-inset-left, 0px));
  --nt-accent-ink: color-mix(in srgb, var(--accent) 72%, var(--text));
  --nt-danger-ink: color-mix(in srgb, var(--danger) 68%, var(--text));
  position: relative;
  display: flex; flex-direction: column;
  height: 100%; width: 100%; max-width: 100%;
  overflow: hidden;
  background: var(--bg); color: var(--text); font-family: var(--font);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
.nt-home {
  display: flex; flex-direction: column;
  flex: 1; min-width: 0; min-height: 0;
}
.nt-scroll {
  flex: 1; min-height: 0;
  overflow-y: auto; overflow-x: hidden;
  overscroll-behavior: contain;
  word-break: break-word; overflow-wrap: anywhere;
}
/* /mobius-ui:Root */

/* mobius-ui:Scrollskin v2 — keep in sync; library candidate. */
.nt-scroll,
.nt-attach-strip {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.nt-scroll::-webkit-scrollbar,
.nt-attach-strip::-webkit-scrollbar {
  display: none;
  width: 0; height: 0;
}
/* /mobius-ui:Scrollskin */

/* mobius-ui:Focus v1 — shared keyboard focus ring (WCAG 2.4.7); never bare outline:none */
:where(button,a,input,textarea,select,summary,[role="button"],[tabindex]:not([tabindex="-1"])):focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
/* /mobius-ui:Focus */

/* ── TopBar ─────────────────────────────────────────────────────────────── */
/* mobius-ui:Header v1 — keep in sync; library candidate. Diverge below the marker only. */
.nt-topbar {
  /* top-pinned bar: pad past the notch/status bar on notched phones */
  padding: max(14px, var(--nt-safe-top)) 0 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
  position: sticky; top: 0;
  background: color-mix(in srgb, var(--bg) 86%, transparent); z-index: 5;
  backdrop-filter: saturate(1.35) blur(14px);
  -webkit-backdrop-filter: saturate(1.35) blur(14px);
  flex: 0 0 auto;
}
.nt-topbar-inner {
  box-sizing: border-box;
  width: 100%; max-width: 1040px; margin: 0 auto;
  padding: 0 max(18px, var(--nt-safe-right)) 0 max(18px, var(--nt-safe-left));
  display: flex; flex-direction: column; gap: 12px;
}
.nt-topbar-row {
  display: flex; align-items: center; gap: 11px; min-width: 0;
}
/* Brand mark — the app's real icon, rounded and sized to the search row */
.nt-brand-icon {
  width: 32px; height: 32px; flex-shrink: 0;
  border-radius: 8px; object-fit: cover; display: block;
}
/* Accent-dot fallback when the install has no custom icon (route 404s) */
.nt-brand-fallback {
  width: 32px; height: 32px; flex-shrink: 0;
  display: inline-flex;
  align-items: center; justify-content: center;
  font-size: 32px; font-weight: 700; line-height: 1;
  color: var(--accent); user-select: none;
}
.nt-app-title {
  flex: 1; margin: 0; min-width: 0;
  color: var(--text);
  font-size: 22px; line-height: 1; font-weight: 700; letter-spacing: 0;
}
/* Search field — full-width quiet inset */
.nt-search-wrap {
  width: 100%; min-height: 44px;
  display: flex; align-items: center; gap: 9px;
  padding: 0 12px; border-radius: 11px;
  border: 1px solid transparent;
  background: var(--surface2, var(--surface)); color: var(--muted);
  transition: border-color 0.15s ease, background 0.15s ease;
}
.nt-search {
  flex: 1; min-width: 0;
  min-height: 44px;
  padding: 0; border: 0; border-radius: 0;
  background: transparent; color: var(--text);
  /* 16px stops iOS Safari zoom-on-focus (don't drop below on a focusable field) */
  font-size: 16px; font-family: var(--font); line-height: 1;
}
.nt-search:focus, .nt-search:focus-visible { outline: none; }
.nt-search-wrap:focus-within {
  border-color: var(--accent);
  background: var(--surface);
}
.nt-search::placeholder { color: color-mix(in srgb, var(--text) 14%, var(--muted)); }
.nt-new-note-btn {
  width: 44px; height: 44px; flex: 0 0 auto;
  border-radius: 11px;
  border: none; background: var(--accent-hover, var(--accent)); color: var(--accent-fg);
  display: inline-flex; align-items: center; justify-content: center;
  cursor: pointer; font-family: var(--font);
  box-shadow: 0 2px 6px color-mix(in srgb, var(--accent) 18%, transparent);
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation; user-select: none;
  transition: filter 0.14s ease, transform 0.12s ease;
}
@media (hover: hover) { .nt-new-note-btn:hover { filter: brightness(0.94); } }
.nt-new-note-btn:active { transform: scale(0.94); }
/* /mobius-ui:Header */

/* ── Loading / Empty ────────────────────────────────────────────────────── */
.nt-spinner {
  width: 22px; height: 22px; border-radius: 50%;
  border: 2px solid color-mix(in srgb, var(--accent) 22%, transparent);
  border-top-color: var(--accent);
  animation: nt-spin 0.7s linear infinite;
}
@keyframes nt-spin { to { transform: rotate(360deg); } }
.nt-loading-grid {
  box-sizing: border-box;
  padding: 18px max(18px, var(--nt-safe-right)) max(72px, calc(52px + var(--nt-safe-bottom))) max(18px, var(--nt-safe-left));
  max-width: 1040px; margin: 0 auto;
}
.nt-loading-label {
  display: inline-flex; align-items: center; gap: 9px;
  margin: 4px 4px 12px;
  color: var(--muted); font-size: 13px; font-weight: 600;
}
.nt-skeleton-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 190px), 1fr));
  gap: 12px; align-items: start;
}
.nt-skeleton-card {
  min-height: 128px; border-radius: 16px;
  border: 1px solid var(--border);
  background: var(--surface);
  box-shadow: 0 1px 2px color-mix(in srgb, var(--text) 5%, transparent),
              0 4px 8px color-mix(in srgb, var(--text) 6%, transparent);
  padding: 16px;
}
.nt-skeleton-line {
  display: block; height: 10px; border-radius: 999px;
  background: color-mix(in srgb, var(--muted) 18%, transparent);
  margin-bottom: 10px;
}
.nt-skeleton-line.is-title {
  width: 72%; height: 13px;
  background: color-mix(in srgb, var(--text) 18%, transparent);
}
.nt-skeleton-line.is-short { width: 44%; }
/* mobius-ui:Empty v1 — keep in sync; library candidate. Diverge below the marker only. */
.nt-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 0; padding: 18vh 24px; text-align: center; color: var(--muted);
}
.nt-empty-icon {
  width: 56px; height: 56px; border-radius: 16px;
  display: grid; place-items: center;
  margin-bottom: 16px;
  background: var(--surface2, var(--surface));
  color: color-mix(in srgb, var(--muted) 74%, transparent);
}
.nt-empty-msg {
  margin: 0 0 6px;
  font-size: 17px; line-height: 1.2; font-weight: 650; color: var(--text);
}
.nt-empty-hint {
  max-width: 270px;
  font-size: 13.5px; line-height: 1.5; color: var(--muted);
}
.nt-empty-action {
  min-height: 44px; margin-top: 18px; padding: 9px 16px;
  display: inline-flex; align-items: center; justify-content: center;
  border: none; border-radius: 10px;
  background: var(--accent-hover, var(--accent)); color: var(--accent-fg);
  font: 650 14px/1 var(--font); cursor: pointer;
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
  transition: filter 0.14s ease, transform 0.12s ease;
}
@media (hover: hover) { .nt-empty-action:hover { filter: brightness(0.94); } }
.nt-empty-action:active { transform: scale(0.97); }
/* /mobius-ui:Empty */

/* ── Grid ───────────────────────────────────────────────────────────────── */
.nt-grid-wrap {
  box-sizing: border-box;
  padding: 18px max(18px, var(--nt-safe-right)) max(72px, calc(52px + var(--nt-safe-bottom))) max(18px, var(--nt-safe-left));
  max-width: 1040px; margin: 0 auto;
}
.nt-section { margin-bottom: 26px; }
/* mobius-ui:SectionHead v1 — keep in sync; library candidate. */
.nt-section-head {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; line-height: 1; font-weight: 650; letter-spacing: 0;
  color: color-mix(in srgb, var(--text) 66%, var(--muted));
  margin: 4px 4px 12px; user-select: none;
}
.nt-section-count {
  letter-spacing: 0; font-weight: 500;
  color: color-mix(in srgb, var(--text) 50%, var(--muted));
}
/* /mobius-ui:SectionHead */
.nt-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 190px), 1fr));
  grid-auto-rows: min-content;
  gap: 12px; align-items: start;
}

/* ── Card ───────────────────────────────────────────────────────────────── */
/* mobius-ui:Card v1 — keep in sync; library candidate. Diverge below the marker only. */
.nt-card-wrap {
  min-width: 0; /* grid item — no extra margin needed with gap */
  content-visibility: auto;
  contain-intrinsic-size: auto 180px;
}
.nt-card {
  position: relative;
  border-radius: 16px; overflow: hidden;
  background: var(--surface); border: 1px solid var(--border);
  min-height: 118px;
  box-shadow: 0 1px 2px color-mix(in srgb, var(--text) 5%, transparent),
              0 4px 8px color-mix(in srgb, var(--text) 6%, transparent);
  transition: box-shadow 0.16s ease, transform 0.16s ease, border-color 0.16s ease;
}
.nt-card.is-locked {
  box-shadow: 0 1px 2px color-mix(in srgb, var(--text) 4%, transparent),
              0 4px 8px color-mix(in srgb, var(--text) 5%, transparent);
}
@media (hover: hover) {
  .nt-card:hover {
    box-shadow: 0 2px 4px color-mix(in srgb, var(--text) 7%, transparent),
                0 6px 8px color-mix(in srgb, var(--text) 10%, transparent);
    transform: translateY(-2px);
  }
}
.nt-card:active { transform: scale(0.985); }
.nt-card-body {
  min-height: 118px;
  cursor: pointer; padding: 14px 14px 12px 16px;
  display: flex; flex-direction: column; gap: 8px;
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
}
.nt-card-body:active { opacity: 0.85; }
.nt-card-main {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column; gap: 8px;
}
.nt-card-title {
  display: block;
  font-size: 15px; line-height: 1.28; font-weight: 650; color: var(--text);
  overflow-wrap: anywhere;
}
.nt-card-title span {
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden;
}
.nt-card-empty {
  font-size: 13px; color: color-mix(in srgb, var(--text) 58%, var(--muted)); font-style: italic;
}
.nt-card-preview {
  font-size: 13px;
  color: color-mix(in srgb, var(--text) 72%, var(--muted));
  font-weight: 450;
  line-height: 1.45;
  display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical;
  overflow: hidden;
}
.nt-card-kicker {
  color: color-mix(in srgb, var(--text) 64%, var(--muted)); font-size: 12px;
}
.nt-card-meta {
  display: flex; align-items: center; gap: 8px; min-height: 12px;
}
.nt-card-tone-dot {
  width: 8px; height: 8px; border-radius: 3px; flex: 0 0 auto;
}
.nt-card-date {
  color: color-mix(in srgb, var(--text) 58%, var(--muted));
  font: 500 11.5px/1 var(--mono); letter-spacing: 0;
}
.nt-card-thumbs {
  display: grid; gap: 6px; margin-bottom: 8px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.nt-card-thumbs--1 {
  grid-template-columns: minmax(0, 1fr);
}
.nt-card-thumb {
  width: 100%; aspect-ratio: 1 / 1; object-fit: cover; display: block; border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--surface2, var(--surface));
  /* Render an already-stored Ultra HDR image (gain-map JPEG) as SDR. Without
     this, Chrome on Android promotes the display surface to HDR while the image
     is painted and tone-shifts the whole shell+app background — visible to the
     eye, invisible to screenshots. Supported Chrome 136+/Android; ignored
     elsewhere. New uploads are already flattened to SDR at attach time; this
     covers images stored before that fix. */
  dynamic-range-limit: standard;
}
.nt-card-thumbs--1 .nt-card-thumb {
  aspect-ratio: 16 / 10;
}
.nt-card-thumb.is-wide {
  grid-column: span 2;
}
/* /mobius-ui:Card */

/* ── Card toolbar — shown on hover/focus; toggled via .nt-card--tools ────── */
.nt-card-footer {
  display: flex; align-items: center; gap: 0;
  padding: 4px 6px 5px;
  border-top: 1px solid var(--border); background: transparent;
  /* hidden by default; revealed on hover/focus or long-press (.nt-card--tools) */
  opacity: 0;
  transition: opacity 0.14s ease;
  pointer-events: none;
}
@media (hover: hover) {
  .nt-card:hover .nt-card-footer { opacity: 1; pointer-events: auto; }
}
/* focus-within: keyboard navigation reveals the toolbar */
.nt-card:focus-within .nt-card-footer { opacity: 1; pointer-events: auto; }
/* long-press (touch) toggle class */
.nt-card--tools .nt-card-footer { opacity: 1; pointer-events: auto; }
@media (hover: none) {
  .nt-card-footer { opacity: 1; pointer-events: auto; }
}

/* note-preview: prose styles for rendered markdown in card previews */
.note-preview p { margin: 0 0 6px; }
.note-preview p:last-child { margin-bottom: 0; }
.note-preview h1, .note-preview h2, .note-preview h3 { font-size: 13.5px; font-weight: 700; margin: 0 0 4px; }
.note-preview code { font-family: var(--mono); font-size: 12px; background: color-mix(in srgb, var(--muted) 15%, transparent); border-radius: 3px; padding: 0 3px; }
.note-preview pre { margin: 0 0 6px; font-size: 12px; overflow: hidden; }
.note-preview ul, .note-preview ol { margin: 0 0 6px; padding-left: 18px; }
.note-preview li { margin-bottom: 2px; }
.note-preview li:has(> input[type="checkbox"]) {
  list-style: none;
  margin-left: -18px;
  display: flex;
  align-items: flex-start;
  gap: 6px;
}
.note-preview li:has(> input[type="checkbox"])::marker { content: ""; }
.note-preview input[type="checkbox"] {
  flex: 0 0 auto;
  width: 13px; height: 13px;
  margin: 2px 0 0;
  accent-color: var(--accent);
  opacity: 1;
  filter: saturate(1.2) contrast(1.12);
}

/* ── Card toolbar buttons ─────────────────────────────────────────────── */
/* mobius-ui:Button v1 — keep in sync; library candidate. Diverge below the marker only. */
.nt-icon-btn {
  width: 44px; height: 44px;
  display: inline-flex; align-items: center; justify-content: center;
  border: none; border-radius: 8px;
  background: transparent; color: color-mix(in srgb, var(--text) 64%, var(--muted));
  cursor: pointer; font-size: 14px;
  opacity: 1; font-family: var(--font);
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
  transition: background 0.12s ease, transform 0.1s ease;
}
.nt-icon-btn.is-active { background: color-mix(in srgb, var(--accent) 14%, transparent); color: var(--nt-accent-ink); opacity: 1; }
.nt-icon-btn.is-danger { color: var(--nt-danger-ink); }
.nt-icon-btn:disabled,
.nt-icon-btn:disabled:hover {
  background: transparent;
  cursor: default;
  color: color-mix(in srgb, var(--text) 40%, var(--muted));
  opacity: 0.68;
  transform: none;
}
@media (hover: hover) {
  .nt-icon-btn:hover { background: color-mix(in srgb, var(--accent) 10%, transparent); }
}
.nt-icon-btn:active { transform: scale(0.93); }
.nt-icon-btn:disabled:active { transform: none; }
/* keyboard focus ring comes from the shared mobius-ui:Focus block above */
/* /mobius-ui:Button */
.nt-color-anchor { position: relative; flex-shrink: 0; }
.nt-spacer { flex: 1; }

/* ── ColorPicker ────────────────────────────────────────────────────────── */
.nt-color-picker {
  position: fixed; z-index: 60;
  display: grid; grid-template-columns: repeat(4, 44px); gap: 8px;
  max-width: calc(100vw - 24px); padding: 8px;
  background: var(--surface2, var(--surface));
  border: 1px solid var(--border); border-radius: 12px;
  box-shadow: 0 4px 8px color-mix(in srgb, var(--text) 20%, transparent);
}
.nt-swatch {
  width: 44px; height: 44px; border-radius: 9px;
  cursor: pointer; padding: 0;
  border: 1px solid var(--border);
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
  transition: transform 0.1s ease;
}
.nt-swatch.is-current { border: 2px solid var(--text); }
.nt-swatch--default { background: linear-gradient(135deg, var(--surface) 49%, var(--muted) 51%); }
.nt-swatch:active { transform: scale(0.9); }
@media (hover: hover) { .nt-swatch:hover { transform: scale(1.1); } }

/* ── ConfirmModal ───────────────────────────────────────────────────────── */
/* mobius-ui:Sheet v1 — keep in sync; library candidate. Diverge below the marker only. */
.nt-modal-scrim {
  position: fixed; inset: 0; z-index: 50;
  display: flex; align-items: center; justify-content: center; padding: 20px;
  overscroll-behavior: contain;
  background: color-mix(in srgb, var(--text) 46%, transparent); backdrop-filter: blur(2px);
}
.nt-modal {
  width: 100%; max-width: 360px;
  background: var(--surface);
  border: 1px solid var(--border); border-radius: 16px; padding: 20px;
  box-shadow: 0 4px 8px color-mix(in srgb, var(--text) 22%, transparent);
}
.nt-modal-title {
  font-size: 16px; font-weight: 650; color: var(--text);
  margin: 0 0 8px; user-select: none;
}
.nt-modal-msg {
  font-size: 14px; color: var(--muted); line-height: 1.5; margin: 0 0 18px;
}
.nt-modal-actions { display: flex; gap: 10px; justify-content: flex-end; }
.nt-modal-btn {
  min-height: 44px;
  display: inline-flex; align-items: center; justify-content: center;
  padding: 9px 16px; border-radius: 10px;
  font-size: 14px; cursor: pointer; font-family: var(--font);
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
  transition: transform 0.1s ease;
}
.nt-modal-btn:active { transform: scale(0.97); }
.nt-modal-cancel {
  border: 1px solid var(--border); background: transparent; color: var(--text);
}
.nt-modal-confirm {
  border: none; color: var(--accent-fg); background: var(--accent-hover, var(--accent)); font-weight: 600;
  /* --accent-fg is the legal foreground on the platform's filled action tokens
     (no hex fallback — a custom light theme may set it dark). */
}
.nt-modal-confirm.is-danger {
  background: color-mix(in srgb, var(--danger) 78%, var(--text));
  color: var(--bg);
}
/* /mobius-ui:Sheet */

/* ── EditorPanel ────────────────────────────────────────────────────────── */
.nt-editor-root {
  position: absolute; inset: 0; z-index: 20;
  display: flex; align-items: center; justify-content: center;
  padding: max(14px, var(--nt-safe-top)) max(14px, var(--nt-safe-right)) max(14px, var(--nt-safe-bottom)) max(14px, var(--nt-safe-left));
  background: color-mix(in srgb, var(--bg) 54%, transparent);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
}
.nt-editor-sheet {
  width: min(760px, 100%);
  height: min(760px, 100%);
  max-height: 100%;
  box-sizing: border-box;
  display: flex; flex-direction: column;
  background: var(--bg);
  border: 1px solid color-mix(in srgb, var(--border) 82%, transparent);
  border-radius: 18px;
  overflow: hidden;
  box-shadow: 0 4px 8px color-mix(in srgb, var(--text) 18%, transparent);
}
@media (max-width: 640px) {
  .nt-editor-root {
    align-items: flex-end;
    padding: max(10px, var(--nt-safe-top)) max(8px, var(--nt-safe-right)) max(8px, var(--nt-safe-bottom)) max(8px, var(--nt-safe-left));
  }
  .nt-editor-sheet {
    width: 100%;
    height: min(92vh, 100%);
    border-radius: 18px 18px 14px 14px;
  }
}
/* mobius-ui:Header v1 — keep in sync; library candidate. Diverge below the marker only. */
.nt-editor-hdr {
  position: relative; z-index: 3;
  padding: 12px 14px 10px;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
  flex: 0 0 auto;
  background: color-mix(in srgb, var(--bg) 86%, transparent);
  backdrop-filter: saturate(1.35) blur(14px);
  -webkit-backdrop-filter: saturate(1.35) blur(14px);
}
.nt-editor-toolbar {
  display: flex; align-items: center; gap: 6px; min-width: 0;
  padding-bottom: 1px;
}
.nt-editor-actions {
  flex: 0 1 auto;
  min-width: 0;
  display: flex; align-items: center; gap: 6px;
  overflow-x: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
  scroll-padding-inline: 4px 20px;
}
.nt-editor-actions::-webkit-scrollbar { display: none; }
@media (max-width: 480px) {
  .nt-editor-toolbar { gap: 2px; }
  .nt-editor-actions {
    gap: 2px;
    padding-inline-end: 18px;
    -webkit-mask-image: linear-gradient(to right, #000 0, #000 calc(100% - 18px), transparent 100%);
    mask-image: linear-gradient(to right, #000 0, #000 calc(100% - 18px), transparent 100%);
  }
}
/* /mobius-ui:Header */
/* mobius-ui:Button v1 — keep in sync; library candidate. Diverge below the marker only. */
.nt-hdr-btn {
  width: 44px; height: 44px;
  display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid transparent; border-radius: 11px;
  background: transparent; color: var(--text);
  cursor: pointer; font-size: 16px; flex-shrink: 0; font-family: var(--font);
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
  transition: background 0.12s ease, transform 0.1s ease;
}
.nt-hdr-btn.is-active { background: color-mix(in srgb, var(--accent) 14%, transparent); }
.nt-hdr-btn.is-danger { color: var(--nt-danger-ink); }
.nt-hdr-btn:disabled {
  cursor: default;
  color: color-mix(in srgb, var(--text) 40%, var(--muted));
  background: transparent;
}
@media (hover: hover) {
  .nt-hdr-btn:not(:disabled):hover { background: color-mix(in srgb, var(--accent) 10%, transparent); }
}
.nt-hdr-btn:not(:disabled):active { transform: scale(0.95); }
/* keyboard focus ring comes from the shared mobius-ui:Focus block above */
/* /mobius-ui:Button */
.nt-color-dot {
  width: 9px; height: 9px; border-radius: 3px;
  flex-shrink: 0;
  /* background comes from the nt-color-dot--<tone> classes generated above */
}
.nt-cm-host {
  height: 100%;
  min-height: 0;
}
.nt-file-input { display: none; }
.nt-editor-title-band {
  position: relative; z-index: 1;
  flex: 0 0 auto;
  padding: 26px clamp(18px, 6vw, 40px) 6px;
}
.nt-title-input {
  display: block; width: 100%; max-width: var(--nt-measure); margin: 0 auto;
  padding: 0; border: none;
  background: transparent; color: var(--text);
  font-size: clamp(24px, 4vw, 31px); line-height: 1.14; font-weight: 700;
  letter-spacing: 0; font-family: var(--font);
  text-wrap: balance;
}
/* mouse focus is borderless by design; keyboard focus keeps the shared ring */
.nt-title-input:focus:not(:focus-visible) { outline: none; }
.nt-title-input::placeholder { color: var(--muted); }
.nt-title-input[readonly] { cursor: default; color: color-mix(in srgb, var(--text) 88%, var(--muted)); }
.nt-cm-host .cm-scroller {
  overflow-x: hidden;
  font-family: var(--font);
  font-size: 16px;
  line-height: 1.66;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.nt-cm-host .cm-scroller::-webkit-scrollbar { display: none; width: 0; height: 0; }
.nt-cm-host .cm-content {
  box-sizing: border-box;
  width: 100%;
  max-width: var(--nt-measure);
  margin: 0 auto;
  padding: 12px 18px 34vh;
}
.nt-cm-host .cm-line {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
}
.nt-cm-checkbox-hit {
  width: 44px; height: 44px; margin-right: 2px;
  display: inline-flex; align-items: center; justify-content: center;
  vertical-align: middle; cursor: pointer;
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
}
.nt-cm-checkbox {
  width: 24px; height: 24px; margin: 0;
  cursor: pointer; accent-color: var(--accent);
}
.nt-cm-file-chip {
  min-height: 44px; max-width: min(100%, 320px);
  display: inline-flex; align-items: center; gap: 5px;
  margin: 2px; padding: 6px 10px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  border-radius: 8px; border: 1px solid var(--border);
  background: var(--surface2, var(--surface)); color: var(--text);
  font: 500 13px/1.25 var(--font); cursor: pointer;
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
  transition: background 0.12s ease, transform 0.1s ease;
}
@media (hover: hover) {
  .nt-cm-file-chip:hover { background: color-mix(in srgb, var(--accent) 10%, var(--surface2, var(--surface))); }
}
.nt-cm-file-chip:active { transform: scale(0.98); }
.nt-editor-sheet.is-locked .cm-content { cursor: default; }
/* mobius-ui:SyncPill v1 (editor variant) — keep in sync; library candidate. */
.nt-status {
  font-size: 12px; white-space: nowrap; margin-right: 2px; flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}
/* Online+idle: nothing shown (standard); exceptional states stay muted here. */
.nt-status.is-default { color: var(--muted); }
/* /mobius-ui:SyncPill */
.nt-hdr-spacer { flex: 1; min-width: 4px; }
.nt-attach-err {
  padding: 8px 16px;
  background: color-mix(in srgb, var(--danger) 14%, transparent);
  color: var(--nt-danger-ink); font-size: 13px; flex: 0 0 auto;
}
/* Grid-level save-failure banner — surfaces a refused (dead-lettered) write that
   happened with no editor open (a closed-note pin/color, or a back-out after a
   refused save). Never silent: a failed save the user can't see is data loss. */
.nt-save-err {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 16px;
  background: color-mix(in srgb, var(--danger) 14%, transparent);
  color: var(--nt-danger-ink); font-size: 13px; flex: 0 0 auto;
}
.nt-save-err-msg { flex: 1; }
.nt-save-err-btn {
  min-height: 44px;
  display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid var(--nt-danger-ink); background: transparent; color: var(--nt-danger-ink);
  border-radius: 8px; padding: 4px 12px; font-size: 12px; cursor: pointer;
  flex-shrink: 0; font-family: var(--font);
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
}
.nt-editor-body { position: relative; z-index: 1; flex: 1; min-height: 0; overflow: hidden; }
.nt-editor-foot {
  position: relative; z-index: 3;
  flex: 0 0 auto;
  display: flex; align-items: center; justify-content: center; flex-wrap: wrap;
  gap: 8px 14px;
  padding: 10px clamp(18px, 6vw, 40px) max(14px, var(--nt-safe-bottom));
  border-top: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
  color: color-mix(in srgb, var(--text) 54%, var(--muted));
  font: 500 12px/1.2 var(--mono);
}

/* ── Grid offline pill (mobius-ui:SyncPill v2) ──────────────────────────── */
/* SILENT WHEN HEALTHY: mounted ONLY while offline (never "Saving"/pending
   counts), plain "Offline" copy. Absolute to .nt-root (which is
   position:relative), never fixed — a fixed overlay could paint over shell chrome. */
.nt-sync-pill {
  position: absolute; left: 50%; bottom: max(22px, var(--nt-safe-bottom));
  transform: translateX(-50%);
  z-index: 15;
  display: inline-flex; align-items: center; padding: 9px 14px; border-radius: 999px;
  background: var(--text); border: 1px solid transparent; color: var(--bg);
  font-size: 12.5px; line-height: 1; font-weight: 650; font-family: var(--font);
  box-shadow: 0 4px 8px color-mix(in srgb, var(--text) 20%, transparent);
}
.nt-sync-pill.is-error { border-color: var(--danger); color: var(--danger); }

/* ── Stranded-attachment strip (editor) ─────────────────────────────────── */
/* Images attached to the note (meta.attachments) whose markdown ref is no
   longer in the body. Without this strip they'd be invisible inside the note
   while still showing on the card — stranded data. */
.nt-attach-strip {
  display: flex; gap: 8px; align-items: flex-start;
  padding: 8px max(16px, var(--nt-safe-right)) max(10px, var(--nt-safe-bottom)) max(16px, var(--nt-safe-left));
  border-top: 1px solid var(--border);
  background: var(--surface2, var(--surface));
  overflow-x: auto; flex: 0 0 auto;
  overscroll-behavior: contain;
}
.nt-attach-thumb {
  height: 72px; max-width: 140px; object-fit: cover;
  border-radius: 8px; border: 1px solid var(--border);
  background: var(--surface); flex-shrink: 0;
  /* Constrain pre-existing Ultra HDR thumbnails to SDR (see .nt-card-thumb). */
  dynamic-range-limit: standard;
}

/* ── Per-note color tones (generated from NOTE_COLORS) ──────────────────── */
${NOTE_COLORS.filter((c) => c.name).map((c) => `
  .nt-card--${c.name} {
    --nt-note-tone: ${c.hex};
    background: color-mix(in srgb, var(--nt-note-tone) 14%, var(--surface));
    border-color: color-mix(in srgb, var(--nt-note-tone) 36%, var(--border));
  }
.nt-swatch--${c.name} { background: ${c.hex}; }
.nt-color-dot--${c.name},
.nt-card--${c.name} .nt-card-tone-dot { background: color-mix(in srgb, var(--nt-note-tone) 72%, var(--surface)); }`).join("\n")}

/* mobius-ui:ReducedMotion v1 — honor the OS reduce-motion setting */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
/* /mobius-ui:ReducedMotion */
`;
//#endregion
//#region src/lib/hash.js
const encoder = new TextEncoder();
async function sha256Hex(str) {
	const data = encoder.encode(String(str));
	const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
	const bytes = new Uint8Array(digest);
	let hex = "";
	for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, "0");
	return hex;
}
//#endregion
//#region src/lib/note.js
function normalize(meta, body) {
	return {
		title: meta.title ?? "",
		body: String(body ?? ""),
		pinned: meta.pinned ?? false,
		locked: meta.locked ?? false,
		color: meta.color ?? null,
		tags: Array.isArray(meta.tags) ? meta.tags : [],
		attachments: Array.isArray(meta.attachments) ? meta.attachments : [],
		type: meta.type ?? "note",
		archived: meta.archived ?? false
	};
}
async function contentHash(meta, body) {
	const canonical = normalize(meta, body);
	return sha256Hex(JSON.stringify([
		canonical.title,
		canonical.body,
		canonical.pinned,
		canonical.locked,
		canonical.color,
		canonical.tags,
		canonical.attachments,
		canonical.type,
		canonical.archived
	]));
}
function nowIso() {
	return (/* @__PURE__ */ new Date()).toISOString();
}
function newNote({ title, type } = {}) {
	const ts = nowIso();
	return {
		id: globalThis.crypto.randomUUID(),
		title: title ?? "",
		pinned: false,
		locked: false,
		color: null,
		type: type ?? "note",
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
function bumpRev(meta) {
	const oldRev = meta.mobius_rev ?? 0;
	return {
		...meta,
		mobius_rev: oldRev + 1,
		parent_rev: oldRev,
		updated: nowIso()
	};
}
//#endregion
//#region src/lib/index-cache.js
const SNIPPET_LEN = 140;
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
		locked: meta.locked ?? false,
		color: meta.color ?? null,
		type: meta.type ?? "note",
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
function notesFromIndex(index) {
	return (index && Array.isArray(index.notes) ? index.notes : []).filter((e) => e && e.id).map((e) => ({
		meta: {
			id: e.id,
			title: e.title ?? "",
			pinned: e.pinned ?? false,
			locked: e.locked ?? false,
			color: e.color ?? null,
			type: e.type ?? "note",
			updated: e.updated
		},
		body: e.snippet ?? "",
		placeholder: true
	}));
}
//#endregion
//#region src/lib/visible.js
function visibleNotes(notes, query) {
	const q = (query || "").trim().toLowerCase();
	let list = notes;
	if (q) list = list.filter((n) => (n.meta.title || "").toLowerCase().includes(q) || (n.body || "").toLowerCase().includes(q));
	return [...list].sort((a, b) => {
		if (!!a.meta.pinned !== !!b.meta.pinned) return a.meta.pinned ? -1 : 1;
		return (b.meta.updated || "").localeCompare(a.meta.updated || "");
	});
}
//#endregion
//#region src/lib/attachments.js
function attachmentPath(sha, ext) {
	return `attachments/${sha}.${ext}`;
}
const TYPE_TO_EXT = {
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
const BODY_ATTACHMENT_REF = /\]\((attachments\/[^)\s]+)\)/g;
function noteAttachmentRefs(meta = {}, body = "") {
	const refs = /* @__PURE__ */ new Set();
	if (Array.isArray(meta.attachments)) {
		for (const p of meta.attachments) if (typeof p === "string" && p.startsWith("attachments/")) refs.add(p);
	}
	let m;
	BODY_ATTACHMENT_REF.lastIndex = 0;
	while (m = BODY_ATTACHMENT_REF.exec(String(body || ""))) refs.add(m[1]);
	return refs;
}
function bodyAttachmentRefs(body = "") {
	return [...noteAttachmentRefs({}, body)];
}
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif)$/i;
function strandedImageRefs(meta = {}, body = "") {
	if (!Array.isArray(meta.attachments)) return [];
	const bodyRefs = noteAttachmentRefs({}, body);
	return meta.attachments.filter((p) => typeof p === "string" && p.startsWith("attachments/") && IMAGE_EXT.test(p) && !bodyRefs.has(p));
}
function referencedAttachments(notes = []) {
	const refs = /* @__PURE__ */ new Set();
	for (const n of notes) {
		if (!n) continue;
		for (const p of noteAttachmentRefs(n.meta || {}, n.body || "")) refs.add(p);
	}
	return refs;
}
//#endregion
//#region src/lib/note-doc.js
const notePath = (id) => `notes/${id}.json`;
const legacyPath = (id) => `notes/${id}.md`;
//#endregion
//#region src/lib/attachment-leases.js
const inflight = /* @__PURE__ */ new Map();
function leaseAttachment(path) {
	inflight.set(path, (inflight.get(path) || 0) + 1);
}
function releaseAttachment(path) {
	const n = inflight.get(path);
	if (!n) return;
	if (n <= 1) inflight.delete(path);
	else inflight.set(path, n - 1);
}
function inflightAttachmentPaths() {
	return inflight.keys();
}
//#endregion
//#region src/lib/store.js
const S$2 = () => window.mobius.storage;
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
		entries = await S$2().list("notes");
	} catch {
		return null;
	}
	if (entries == null) return null;
	const out = [];
	for (const e of entries || []) {
		if (e.type !== "file" || !e.name.endsWith(".json")) continue;
		let doc;
		try {
			doc = await S$2().get(e.path);
		} catch {
			return null;
		}
		if (doc && doc.meta && doc.meta.id) out.push({
			meta: doc.meta,
			body: doc.body ?? ""
		});
	}
	return out;
}
async function writeIndex(notes) {
	return S$2().set("index.json", buildIndex(notes));
}
async function readIndex() {
	try {
		return await S$2().get("index.json");
	} catch {
		return null;
	}
}
async function putAttachment(file) {
	const sha = await sha256Bytes(await file.arrayBuffer());
	const ext = extFromType(file.type) || extFromName(file.name) || "bin";
	const path = attachmentPath(sha, ext);
	leaseAttachment(path);
	try {
		await S$2().setBlob(path, file, { contentType: file.type || "application/octet-stream" });
	} catch (err) {
		releaseAttachment(path);
		throw err;
	}
	return {
		sha,
		ext,
		path,
		name: file.name || `${sha}.${ext}`
	};
}
async function gcAttachments(pin = []) {
	let entries;
	try {
		entries = await S$2().list("attachments");
	} catch {
		return;
	}
	const live = entries && entries.length ? entries.filter((e) => e.type === "file" && e.path.startsWith("attachments/")) : [];
	if (!live.length) return;
	const notes = await listNotes().catch(() => null);
	if (notes == null) return;
	const referenced = referencedAttachments(notes);
	for (const p of pin) if (typeof p === "string") referenced.add(p);
	for (const p of inflightAttachmentPaths()) referenced.add(p);
	for (const e of live) {
		if (referenced.has(e.path)) continue;
		try {
			await S$2().remove(e.path);
		} catch {}
	}
}
async function attachmentURL(path) {
	let blob;
	try {
		blob = await S$2().getBlob(path);
	} catch {
		return null;
	}
	return blob ? URL.createObjectURL(blob) : null;
}
const isOnline = () => window.mobius ? window.mobius.online : true;
//#endregion
//#region src/lib/collection.js
const S$1 = () => window.mobius.storage;
const READ_BATCH_SIZE = 8;
async function readJsonDocuments(entries) {
	const files = (entries || []).filter((e) => e.type === "file" && e.name.endsWith(".json"));
	const records = [];
	for (let i = 0; i < files.length; i += READ_BATCH_SIZE) {
		const batch = files.slice(i, i + READ_BATCH_SIZE);
		const resolved = await Promise.all(batch.map(async (entry) => {
			try {
				return {
					path: entry.path,
					doc: await S$1().get(entry.path)
				};
			} catch {
				return {
					path: entry.path,
					doc: null
				};
			}
		}));
		records.push(...resolved);
	}
	return records;
}
function makeChains() {
	const chains = /* @__PURE__ */ new Map();
	return function withChain(key, fn) {
		const result = (chains.get(key) || Promise.resolve()).then(fn, fn);
		const tail = result.then(() => {}, () => {});
		chains.set(key, tail);
		tail.then(() => {
			if (chains.get(key) === tail) chains.delete(key);
		});
		return result;
	};
}
async function writeJson(path, value) {
	const storage = S$1();
	if (typeof storage.durableWrite === "function") return storage.durableWrite(path, value, { kind: "json" });
	return {
		durability: (await storage.set(path, value))?.queued ? "queued" : "synced",
		path,
		legacy: true
	};
}
function makeNoteCollection() {
	const withChain = makeChains();
	const bases = /* @__PURE__ */ new Map();
	const paths = /* @__PURE__ */ new Map();
	function rememberPath(id, path) {
		if (!id || !path) return;
		let set = paths.get(id);
		if (!set) {
			set = /* @__PURE__ */ new Set();
			paths.set(id, set);
		}
		set.add(path);
	}
	function knownPaths(id) {
		return paths.get(id) ? [...paths.get(id)] : [];
	}
	function primaryPath(id) {
		return knownPaths(id)[0] || notePath(id);
	}
	function jsonIdFromPath(path) {
		const name = String(path || "").split("/").pop() || "";
		return name.endsWith(".json") ? name.slice(0, -5) : null;
	}
	async function findPathsForId(id) {
		let entries;
		try {
			entries = await S$1().list("notes");
		} catch {
			return [];
		}
		const found = [];
		for (const { path, doc } of await readJsonDocuments(entries)) if (doc && doc.meta && doc.meta.id) {
			rememberPath(doc.meta.id, path);
			if (doc.meta.id === id) found.push(path);
		}
		return found;
	}
	async function list() {
		let entries;
		try {
			entries = await S$1().list("notes");
		} catch {
			return null;
		}
		if (entries == null) return null;
		const out = [];
		for (const { path, doc } of await readJsonDocuments(entries)) if (doc && doc.meta && doc.meta.id) {
			bases.set(doc.meta.id, doc);
			rememberPath(doc.meta.id, path);
			out.push({
				meta: doc.meta,
				body: doc.body ?? "",
				storagePath: path
			});
		}
		return out;
	}
	async function load(id) {
		let doc = null;
		let path = notePath(id);
		try {
			doc = await S$1().get(path);
		} catch {
			doc = null;
		}
		if (!doc || !doc.meta || doc.meta.id !== id) {
			const found = await findPathsForId(id);
			path = found[0] || path;
			try {
				doc = found[0] ? await S$1().get(path) : null;
			} catch {
				doc = null;
			}
		}
		if (!doc || !doc.meta || doc.meta.id !== id) return null;
		bases.set(id, doc);
		rememberPath(id, path);
		return {
			meta: doc.meta,
			body: doc.body ?? "",
			storagePath: path
		};
	}
	function update(id, fn) {
		const path = primaryPath(id);
		return withChain(path, async () => {
			const remembered = bases.get(id) ?? null;
			let current = remembered;
			try {
				current = await S$1().get(path) ?? remembered;
			} catch {}
			const mine = fn(current ? {
				meta: current.meta,
				body: current.body
			} : null);
			const result = await writeJson(path, mine);
			bases.set(id, mine);
			rememberPath(id, path);
			return {
				result,
				value: mine
			};
		});
	}
	function remove(id) {
		return withChain(`remove:${id}`, async () => {
			const remembered = knownPaths(id);
			const candidates = /* @__PURE__ */ new Set([notePath(id), ...remembered]);
			if (remembered.length === 0) for (const p of await findPathsForId(id)) candidates.add(p);
			let res = null;
			let firstError = null;
			for (const path of candidates) try {
				res = await S$1().remove(path);
			} catch (err) {
				if (!firstError) firstError = err;
			}
			if (firstError) throw firstError;
			try {
				await S$1().remove(legacyPath(id));
			} catch {}
			for (const path of candidates) {
				const fileId = jsonIdFromPath(path);
				if (fileId && fileId !== id) try {
					await S$1().remove(legacyPath(fileId));
				} catch {}
			}
			bases.delete(id);
			paths.delete(id);
			return res;
		});
	}
	return {
		list,
		load,
		update,
		remove,
		notePath
	};
}
//#endregion
//#region src/lib/frontmatter.js
const FENCE = "---";
function parseScalar(raw) {
	const s = raw.trim();
	if (s === "") return "";
	if (s === "true") return true;
	if (s === "false") return false;
	if (s === "null" || s === "~") return null;
	if (s[0] === "\"" && s[s.length - 1] === "\"" || s[0] === "'" && s[s.length - 1] === "'") return s.slice(1, -1);
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
	if (!text.startsWith("---\n") && text !== FENCE) return {
		meta: {},
		body: text
	};
	const lines = text.split("\n");
	let close = -1;
	for (let i = 1; i < lines.length; i++) if (lines[i] === FENCE) {
		close = i;
		break;
	}
	if (close === -1) return {
		meta: {},
		body: text
	};
	const meta = {};
	for (let i = 1; i < close; i++) {
		const line = lines[i];
		if (line.trim() === "") continue;
		const colon = line.indexOf(":");
		if (colon === -1) continue;
		const key = line.slice(0, colon).trim();
		meta[key] = parseValue(line.slice(colon + 1));
	}
	return {
		meta,
		body: lines.slice(close + 1).join("\n")
	};
}
//#endregion
//#region src/lib/migrate.js
const S = () => window.mobius.storage;
const idFromMd = (name) => name.endsWith(".md") ? name.slice(0, -3) : null;
async function migrateNote(id) {
	let json;
	try {
		json = await S().get(notePath(id));
	} catch {
		json = void 0;
	}
	if (json && json.meta && json.meta.id === id) return "already";
	let text;
	try {
		text = await S().getText(legacyPath(id));
	} catch {
		text = null;
	}
	if (text == null) return "skipped";
	const { meta, body } = parseFrontmatter(text);
	if (!meta || !meta.id) return "skipped";
	let res;
	try {
		res = await S().durableWrite(notePath(id), {
			meta,
			body
		}, { kind: "json" });
	} catch {
		return "deferred";
	}
	if (res && res.durability === "synced") {
		try {
			await S().remove(legacyPath(id));
		} catch {}
		return "migrated";
	}
	return "queued";
}
async function migrateLegacyNotes() {
	let entries;
	try {
		entries = await S().list("notes");
	} catch {
		return [];
	}
	const results = [];
	for (const e of entries || []) {
		if (e.type !== "file") continue;
		const id = idFromMd(e.name);
		if (!id) continue;
		results.push([id, await migrateNote(id)]);
	}
	return results;
}
//#endregion
//#region src/lib/preview.js
let _libs;
async function libs() {
	if (!_libs) {
		const [m, d] = await Promise.all([import("marked"), import("dompurify")]);
		_libs = {
			marked: m.marked,
			purify: d.default || d
		};
	}
	return _libs;
}
const PREVIEW_SANITIZE_OPTIONS = {
	USE_PROFILES: { html: true },
	FORBID_TAGS: [
		"img",
		"picture",
		"source",
		"video",
		"audio",
		"iframe"
	],
	FORBID_ATTR: [
		"href",
		"src",
		"srcset",
		"xlink:href",
		"formaction"
	]
};
function neutralizePreviewMarkdown(md) {
	return (md || "").replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, url) => String(url).startsWith("attachments/") ? ` 🖼 ${alt || ""} ` : ` ${alt || "image"} `).replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");
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
	const html = marked(neutralizePreviewMarkdown(md), {
		breaks: true,
		gfm: true
	});
	return purify.sanitize(html, PREVIEW_SANITIZE_OPTIONS);
}
//#endregion
//#region src/ui/ColorPicker.jsx
const MARGIN = 12;
function ColorPicker({ anchorRef, current, onPick, onDismiss, placement = "above", align = "start" }) {
	const [pos, setPos] = useState(null);
	const pickerRef = useRef(null);
	const openerRef = useRef(null);
	const dismissRef = useRef(onDismiss);
	dismissRef.current = onDismiss;
	const normalizedCurrent = normalizeColorName(current);
	const ready = !!pos;
	const width = 216;
	const rows = Math.ceil(NOTE_COLORS.length / 4);
	const height = rows * 44 + (rows - 1) * 8 + 16;
	useLayoutEffect(() => {
		function place() {
			const el = anchorRef && anchorRef.current;
			if (!el) return;
			const r = el.getBoundingClientRect();
			let top = placement === "below" ? r.bottom + 6 : r.top - 6 - height;
			if (placement === "below" && top + height > window.innerHeight - MARGIN) top = r.top - 6 - height;
			if (placement === "above" && top < MARGIN) top = r.bottom + 6;
			let left = align === "end" ? r.right - width : r.left;
			const maxLeft = window.innerWidth - width - MARGIN;
			left = Math.max(MARGIN, Math.min(left, maxLeft));
			const maxTop = Math.max(MARGIN, window.innerHeight - height - MARGIN);
			setPos({
				top: Math.max(MARGIN, Math.min(top, maxTop)),
				left
			});
		}
		place();
		window.addEventListener("scroll", place, true);
		window.addEventListener("resize", place);
		return () => {
			window.removeEventListener("scroll", place, true);
			window.removeEventListener("resize", place);
		};
	}, [
		anchorRef,
		placement,
		align,
		height,
		width
	]);
	useEffect(() => {
		if (!ready) return void 0;
		const anchor = anchorRef?.current;
		const trigger = anchor?.matches?.("button") ? anchor : anchor?.querySelector?.("button");
		openerRef.current = trigger || document.activeElement;
		(pickerRef.current?.querySelectorAll("button") || [])[Math.max(0, NOTE_COLORS.findIndex((c) => c.name === normalizedCurrent))]?.focus?.();
		const onPointerDown = (e) => {
			if (pickerRef.current?.contains(e.target) || anchor?.contains?.(e.target)) return;
			dismissRef.current?.();
		};
		document.addEventListener("pointerdown", onPointerDown);
		return () => {
			document.removeEventListener("pointerdown", onPointerDown);
			const opener = openerRef.current;
			const stillMounted = typeof document.contains !== "function" || document.contains(opener);
			if (opener && stillMounted && typeof opener.focus === "function") opener.focus();
		};
	}, [
		anchorRef,
		normalizedCurrent,
		ready
	]);
	const onKeyDown = (e) => {
		const buttons = Array.from(pickerRef.current?.querySelectorAll("button") || []);
		if (!buttons.length) return;
		if (e.key === "Escape" || e.key === "Tab") {
			e.preventDefault();
			e.stopPropagation();
			onDismiss?.();
			return;
		}
		const currentIndex = Math.max(0, buttons.indexOf(document.activeElement));
		let nextIndex = null;
		if (e.key === "ArrowRight" || e.key === "ArrowDown") nextIndex = (currentIndex + 1) % buttons.length;
		else if (e.key === "ArrowLeft" || e.key === "ArrowUp") nextIndex = (currentIndex - 1 + buttons.length) % buttons.length;
		else if (e.key === "Home") nextIndex = 0;
		else if (e.key === "End") nextIndex = buttons.length - 1;
		if (nextIndex != null) {
			e.preventDefault();
			buttons[nextIndex].focus();
		}
	};
	if (!pos) return null;
	return createPortal(/* @__PURE__ */ jsx("div", {
		ref: pickerRef,
		role: "radiogroup",
		"aria-label": "Note color",
		onKeyDown,
		onClick: (e) => e.stopPropagation(),
		onPointerDown: (e) => e.stopPropagation(),
		className: "nt-color-picker",
		style: {
			top: pos.top,
			left: pos.left
		},
		children: NOTE_COLORS.map((c) => /* @__PURE__ */ jsx("button", {
			type: "button",
			role: "radio",
			title: c.label,
			"aria-label": c.label,
			"aria-checked": normalizedCurrent === c.name,
			tabIndex: normalizedCurrent === c.name ? 0 : -1,
			onClick: () => onPick(c.name),
			className: [
				"nt-swatch",
				c.name ? `nt-swatch--${c.name}` : "nt-swatch--default",
				normalizedCurrent === c.name ? "is-current" : ""
			].filter(Boolean).join(" ")
		}, c.name || "default"))
	}), document.body);
}
//#endregion
//#region src/ui/icons.jsx
const SDK_ICONS = {
	pin: Pin,
	palette: ColorTheme,
	paperclip: Paperclip,
	image: FileImage,
	file: File$1,
	trash: Trash,
	lock: Lock,
	back: ArrowLeft,
	edit: Edit,
	checklist: SquareCheckCheckboxChecked,
	note: FileDocument,
	check: Check,
	search: Search,
	plus: Plus
};
function Icon({ name, size = 17, ...props }) {
	const SdkIcon = SDK_ICONS[name];
	if (SdkIcon) return /* @__PURE__ */ jsx(SdkIcon, {
		width: size,
		height: size,
		"aria-hidden": "true",
		...props
	});
	if (name === "unlock") return /* @__PURE__ */ jsxs("svg", {
		width: size,
		height: size,
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "2",
		strokeLinecap: "round",
		strokeLinejoin: "round",
		"aria-hidden": "true",
		...props,
		children: [/* @__PURE__ */ jsx("rect", {
			x: "5",
			y: "11",
			width: "14",
			height: "10",
			rx: "2"
		}), /* @__PURE__ */ jsx("path", { d: "M8 11V8a4 4 0 0 1 7.2-2.4" })]
	});
	return null;
}
//#endregion
//#region src/ui/Card.jsx
const nearCardCallbacks = /* @__PURE__ */ new WeakMap();
let nearCardObserver = null;
function observeNearCard(node, callback) {
	if (typeof window === "undefined" || typeof window.IntersectionObserver !== "function") {
		callback(true);
		return () => {};
	}
	if (!nearCardObserver) nearCardObserver = new window.IntersectionObserver((entries) => {
		for (const entry of entries) nearCardCallbacks.get(entry.target)?.(entry.isIntersecting);
	}, { rootMargin: "720px 0px" });
	nearCardCallbacks.set(node, callback);
	nearCardObserver.observe(node);
	return () => {
		nearCardCallbacks.delete(node);
		nearCardObserver?.unobserve(node);
	};
}
function useNearViewport(ref) {
	const [near, setNear] = useState(() => typeof window === "undefined" || typeof window.IntersectionObserver !== "function");
	useEffect(() => {
		const node = ref.current;
		if (!node) {
			setNear(true);
			return;
		}
		return observeNearCard(node, setNear);
	}, [ref]);
	return near;
}
function IconBtn({ children, title, onClick, active, danger, disabled }) {
	return /* @__PURE__ */ jsx("button", {
		type: "button",
		title,
		"aria-label": title,
		"aria-pressed": active,
		disabled,
		onClick: (e) => {
			e.stopPropagation();
			if (!disabled && typeof onClick === "function") onClick();
		},
		className: `nt-icon-btn${active ? " is-active" : ""}${danger ? " is-danger" : ""}`,
		children
	});
}
const DATE_FORMATTER = new Intl.DateTimeFormat(void 0, {
	month: "short",
	day: "numeric"
});
function formatCardDate(meta) {
	const raw = meta.updated || meta.created;
	if (!raw) return "";
	const d = new Date(raw);
	if (Number.isNaN(d.getTime())) return "";
	return DATE_FORMATTER.format(d);
}
function Card({ note, onOpen, onPin, onColor, onLock, onDelete, resolveAttachment }) {
	const { meta, body } = note;
	const [html, setHtml] = useState("");
	const [showColors, setShowColors] = useState(false);
	const [thumbUrls, setThumbUrls] = useState([]);
	const [toolsOpen, setToolsOpen] = useState(false);
	const renderedPreviewBody = useRef(null);
	const colorBtnRef = useRef(null);
	const longPressTimer = useRef(null);
	const cardRef = useRef(null);
	const nearViewport = useNearViewport(cardRef);
	const suppressNextClick = useRef(false);
	const previewBody = (body || "").slice(0, 700);
	useEffect(() => {
		if (!nearViewport) return void 0;
		if (renderedPreviewBody.current === previewBody) return void 0;
		let live = true;
		renderPreviewHTML(previewBody).then((h) => {
			if (!live) return;
			renderedPreviewBody.current = previewBody;
			setHtml(h);
		}).catch(() => {});
		return () => {
			live = false;
		};
	}, [nearViewport, previewBody]);
	useEffect(() => {
		if (nearViewport) return;
		setShowColors(false);
		setToolsOpen(false);
	}, [nearViewport]);
	const imageRefsKey = useMemo(() => nearViewport ? localImageRefs(meta, body, 4) : [], [
		nearViewport,
		meta,
		body
	]).join("\n");
	useEffect(() => {
		let live = true;
		let urls = [];
		const refs = imageRefsKey ? imageRefsKey.split("\n") : [];
		setThumbUrls([]);
		if (!refs.length || !resolveAttachment) return () => {};
		Promise.all(refs.map((ref) => resolveAttachment(ref).catch(() => null))).then((resolved) => {
			const next = resolved.filter(Boolean);
			if (!live) {
				next.forEach((u) => URL.revokeObjectURL(u));
				return;
			}
			urls = next;
			setThumbUrls(next);
		}).catch(() => {});
		return () => {
			live = false;
			urls.forEach((u) => URL.revokeObjectURL(u));
		};
	}, [imageRefsKey, resolveAttachment]);
	useEffect(() => {
		if (!toolsOpen && !showColors) return void 0;
		const onPointerDown = (e) => {
			if (cardRef.current && !cardRef.current.contains(e.target)) {
				setToolsOpen(false);
				setShowColors(false);
			}
		};
		document.addEventListener("pointerdown", onPointerDown);
		return () => document.removeEventListener("pointerdown", onPointerDown);
	}, [toolsOpen, showColors]);
	const tone = normalizeColorName(meta.color);
	const empty = !meta.title && !(body || "").trim();
	const isChecklist = meta.type === "checklist";
	const locked = !!meta.locked;
	const cardDate = formatCardDate(meta);
	const onPointerDown = useCallback((e) => {
		if (e.pointerType === "mouse") return;
		longPressTimer.current = setTimeout(() => {
			longPressTimer.current = null;
			setToolsOpen(true);
			suppressNextClick.current = true;
		}, 300);
	}, []);
	const cancelLongPress = useCallback(() => {
		if (longPressTimer.current) {
			clearTimeout(longPressTimer.current);
			longPressTimer.current = null;
		}
	}, []);
	return /* @__PURE__ */ jsx("div", {
		className: "nt-card-wrap",
		children: /* @__PURE__ */ jsxs("div", {
			ref: cardRef,
			className: `nt-card${tone ? ` nt-card--${tone}` : ""}${toolsOpen ? " nt-card--tools" : ""}${locked ? " is-locked" : ""}`,
			onPointerDown,
			onPointerUp: cancelLongPress,
			onPointerMove: cancelLongPress,
			onPointerCancel: cancelLongPress,
			onPointerLeave: cancelLongPress,
			children: [/* @__PURE__ */ jsx("div", {
				className: "nt-card-body",
				role: "button",
				tabIndex: 0,
				"aria-label": meta.title ? `Open note: ${meta.title}` : "Open untitled note",
				onClick: () => {
					if (suppressNextClick.current) {
						suppressNextClick.current = false;
						return;
					}
					onOpen(meta.id);
				},
				onKeyDown: (e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						onOpen(meta.id);
					}
				},
				children: nearViewport && /* @__PURE__ */ jsxs(Fragment, { children: [
					thumbUrls.length > 0 && /* @__PURE__ */ jsx("div", {
						className: `nt-card-thumbs nt-card-thumbs--${thumbUrls.length}`,
						"aria-hidden": "true",
						children: thumbUrls.map((url, index) => /* @__PURE__ */ jsx("img", {
							src: url,
							alt: "",
							className: `nt-card-thumb${thumbUrls.length === 3 && index === 0 ? " is-wide" : ""}`
						}, url))
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "nt-card-main",
						"aria-hidden": "true",
						children: [
							meta.title && /* @__PURE__ */ jsx("div", {
								className: "nt-card-title",
								children: /* @__PURE__ */ jsx("span", { children: meta.title })
							}),
							!meta.title && isChecklist && /* @__PURE__ */ jsx("div", {
								className: "nt-card-kicker",
								children: "Checklist"
							}),
							empty ? /* @__PURE__ */ jsx("div", {
								className: "nt-card-empty",
								children: "Empty note"
							}) : /* @__PURE__ */ jsx("div", {
								className: "note-preview nt-card-preview",
								dangerouslySetInnerHTML: { __html: html }
							})
						]
					}),
					(tone || cardDate) && /* @__PURE__ */ jsxs("div", {
						className: "nt-card-meta",
						"aria-hidden": "true",
						children: [tone && /* @__PURE__ */ jsx("span", {
							className: "nt-card-tone-dot",
							"aria-hidden": "true"
						}), cardDate && /* @__PURE__ */ jsx("span", {
							className: "nt-card-date",
							children: cardDate
						})]
					})
				] })
			}), nearViewport && /* @__PURE__ */ jsxs("div", {
				className: "nt-card-footer",
				children: [
					/* @__PURE__ */ jsx(IconBtn, {
						title: meta.pinned ? "Unpin" : "Pin",
						active: meta.pinned,
						onClick: () => onPin(meta.id),
						children: /* @__PURE__ */ jsx(Icon, {
							name: "pin",
							size: 15
						})
					}),
					/* @__PURE__ */ jsxs("div", {
						ref: colorBtnRef,
						className: "nt-color-anchor",
						children: [/* @__PURE__ */ jsx(IconBtn, {
							title: "Color",
							onClick: () => setShowColors((v) => !v),
							children: /* @__PURE__ */ jsx(Icon, {
								name: "palette",
								size: 16
							})
						}), showColors && /* @__PURE__ */ jsx(ColorPicker, {
							anchorRef: colorBtnRef,
							current: meta.color,
							onPick: (c) => {
								onColor(meta.id, c);
								setShowColors(false);
							},
							onDismiss: () => setShowColors(false)
						})]
					}),
					/* @__PURE__ */ jsx(IconBtn, {
						title: locked ? "Unlock note" : "Lock note",
						active: locked,
						onClick: () => onLock(meta.id),
						children: /* @__PURE__ */ jsx(Icon, {
							name: locked ? "lock" : "unlock",
							size: 15
						})
					}),
					/* @__PURE__ */ jsx("div", { className: "nt-spacer" }),
					/* @__PURE__ */ jsx(IconBtn, {
						title: locked ? "Unlock to delete" : "Delete",
						danger: true,
						disabled: locked,
						onClick: () => onDelete(meta.id),
						children: /* @__PURE__ */ jsx(Icon, {
							name: "trash",
							size: 15
						})
					})
				]
			})]
		})
	});
}
var Card_default = memo(Card);
//#endregion
//#region src/ui/Grid.jsx
function Grid({ notes, onOpen, onPin, onColor, onLock, onDelete, resolveAttachment }) {
	const pinned = notes.filter((n) => n.meta.pinned);
	const others = notes.filter((n) => !n.meta.pinned);
	const header = (txt, count) => /* @__PURE__ */ jsxs("h2", {
		className: "nt-section-head",
		children: [/* @__PURE__ */ jsx("span", { children: txt }), /* @__PURE__ */ jsxs("span", {
			className: "nt-section-count",
			children: ["· ", count]
		})]
	});
	const cards = (list) => /* @__PURE__ */ jsx("div", {
		className: "nt-cards",
		children: list.map((n) => /* @__PURE__ */ jsx(Card_default, {
			note: n,
			onOpen,
			onPin,
			onColor,
			onLock,
			onDelete,
			resolveAttachment
		}, n.meta.id))
	});
	return /* @__PURE__ */ jsxs("div", {
		className: "nt-grid-wrap",
		children: [pinned.length > 0 && /* @__PURE__ */ jsxs("section", {
			className: "nt-section",
			children: [header("Pinned", pinned.length), cards(pinned)]
		}), others.length > 0 && /* @__PURE__ */ jsxs("section", { children: [header("All notes", others.length), cards(others)] })]
	});
}
var Grid_default = memo(Grid);
//#endregion
//#region src/lib/sdr-image.js
const MAX_DIMENSION = 2048;
const ENCODE_QUALITY = .9;
function isBrowserImageEnv() {
	return typeof document !== "undefined" && typeof HTMLCanvasElement !== "undefined" && typeof createImageBitmap === "function";
}
async function decodeImage(file) {
	try {
		return await createImageBitmap(file);
	} catch {}
	return await new Promise((resolve) => {
		const url = URL.createObjectURL(file);
		const img = new Image();
		img.onload = async () => {
			try {
				if (img.decode) await img.decode();
			} catch {}
			URL.revokeObjectURL(url);
			resolve(img);
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			resolve(null);
		};
		img.src = url;
	});
}
function sourceDimensions(source) {
	return {
		w: source.naturalWidth || source.width || 0,
		h: source.naturalHeight || source.height || 0
	};
}
function canvasToBlob(canvas, type, quality) {
	return new Promise((resolve) => {
		if (canvas.toBlob) canvas.toBlob((blob) => resolve(blob), type, quality);
		else resolve(null);
	});
}
function outputFormat(file) {
	const t = (file.type || "").toLowerCase();
	return t.includes("png") || t.includes("webp") ? {
		type: "image/webp",
		ext: "webp"
	} : {
		type: "image/jpeg",
		ext: "jpeg"
	};
}
function renameForOutput(originalName, ext) {
	return `${String(originalName || "image").replace(/\.[^./\\]+$/, "")}.${ext}`;
}
async function toSdrImage(file) {
	if (!file || !(file.type || "").startsWith("image/")) return file;
	const type = (file.type || "").toLowerCase();
	if (type.includes("svg")) return file;
	if (type.includes("gif")) return file;
	if (!isBrowserImageEnv()) return file;
	let source = null;
	try {
		source = await decodeImage(file);
		if (!source) return file;
		const { w, h } = sourceDimensions(source);
		if (!w || !h) return file;
		const longest = Math.max(w, h);
		const scale = longest > MAX_DIMENSION ? MAX_DIMENSION / longest : 1;
		const outW = Math.max(1, Math.round(w * scale));
		const outH = Math.max(1, Math.round(h * scale));
		const canvas = document.createElement("canvas");
		canvas.width = outW;
		canvas.height = outH;
		const ctx = canvas.getContext("2d");
		if (!ctx) return file;
		ctx.drawImage(source, 0, 0, outW, outH);
		const { type, ext } = outputFormat(file);
		let blob = await canvasToBlob(canvas, type, ENCODE_QUALITY);
		if (!blob || !blob.size) return file;
		const outName = renameForOutput(file.name, ext);
		try {
			return new File([blob], outName, { type: blob.type || type });
		} catch {
			blob.name = outName;
			return blob;
		}
	} catch {
		return file;
	} finally {
		if (source && typeof source.close === "function") try {
			source.close();
		} catch {}
	}
}
//#endregion
//#region src/editor/widgets.js
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
		const hit = document.createElement("span");
		hit.className = "nt-cm-checkbox-hit";
		hit.setAttribute("role", "presentation");
		const box = document.createElement("input");
		box.type = "checkbox";
		box.checked = this.checked;
		box.className = "nt-cm-checkbox";
		box.setAttribute("aria-label", this.checked ? "Mark task incomplete" : "Mark task complete");
		let pointerHandled = false;
		const toggle = () => {
			const insert = this.checked ? "[ ]" : "[x]";
			view.dispatch({ changes: {
				from: this.pos,
				to: this.pos + 3,
				insert
			} });
		};
		hit.addEventListener("mousedown", (e) => {
			e.preventDefault();
			pointerHandled = true;
			toggle();
			setTimeout(() => {
				pointerHandled = false;
			}, 0);
		});
		box.addEventListener("change", (e) => {
			e.preventDefault();
			if (pointerHandled) return;
			toggle();
		});
		hit.appendChild(box);
		return hit;
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
		this.destroyed = false;
	}
	eq(o) {
		return o.src === this.src && o.alt === this.alt;
	}
	toDOM() {
		const wrap = document.createElement("div");
		wrap.style.cssText = "margin:8px 0; max-width:100%;";
		const img = document.createElement("img");
		img.alt = this.alt;
		img.style.cssText = "max-width:100%; max-height:360px; border-radius:10px; display:block; border:1px solid var(--border); dynamic-range-limit:standard;";
		wrap.appendChild(img);
		if (this.resolve && this.src.startsWith("attachments/")) this.resolve(this.src).then((u) => {
			if (!u) return;
			if (this.destroyed) {
				URL.revokeObjectURL(u);
				return;
			}
			this.url = u;
			img.src = u;
		}).catch(() => {});
		else img.src = this.src;
		return wrap;
	}
	destroy() {
		this.destroyed = true;
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
		this.url = null;
		this.destroyed = false;
	}
	eq(o) {
		return o.src === this.src && o.name === this.name;
	}
	toDOM() {
		const a = document.createElement("button");
		a.type = "button";
		a.textContent = `📎 ${this.name}`;
		a.title = this.name;
		a.className = "nt-cm-file-chip";
		a.addEventListener("click", async (e) => {
			e.preventDefault();
			e.stopPropagation();
			if (this.url) {
				window.open(this.url, "_blank", "noopener");
				return;
			}
			if (this.resolve && this.src.startsWith("attachments/")) {
				const popup = window.open("about:blank", "_blank");
				if (!popup) return;
				try {
					popup.opener = null;
				} catch {}
				const u = await this.resolve(this.src).catch(() => null);
				if (u) {
					if (this.destroyed) {
						URL.revokeObjectURL(u);
						try {
							popup.close();
						} catch {}
						return;
					}
					this.url = u;
					try {
						popup.location.replace(u);
					} catch {
						try {
							popup.close();
						} catch {}
					}
				} else try {
					popup.close();
				} catch {}
			}
		});
		return a;
	}
	destroy() {
		this.destroyed = true;
		if (this.url) URL.revokeObjectURL(this.url);
	}
	ignoreEvent() {
		return true;
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
			el.innerHTML = katex.renderToString(this.src, {
				throwOnError: false,
				displayMode: this.block
			});
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
//#endregion
//#region src/lib/math-scan.js
const BLOCK_MATH = /\$\$([\s\S]+?)\$\$/g;
const INLINE_MATH = /\$([^$\n]+?)\$/g;
function isInlineMathDelims(content) {
	if (content.length === 0) return false;
	const first = content[0];
	const last = content[content.length - 1];
	if (first === " " || first === "	" || /[0-9]/.test(first)) return false;
	if (last === " " || last === "	") return false;
	return true;
}
function findMathSpans(text) {
	const src = String(text || "");
	const spans = [];
	const blocked = [];
	BLOCK_MATH.lastIndex = 0;
	let m;
	while (m = BLOCK_MATH.exec(src)) {
		const from = m.index;
		const to = from + m[0].length;
		blocked.push([from, to]);
		spans.push({
			from,
			to,
			src: m[1].trim(),
			block: true
		});
	}
	const insideBlock = (i) => blocked.some(([a, b]) => i >= a && i < b);
	INLINE_MATH.lastIndex = 0;
	while (m = INLINE_MATH.exec(src)) {
		if (insideBlock(m.index)) continue;
		if (!isInlineMathDelims(m[1])) continue;
		const from = m.index;
		const to = from + m[0].length;
		spans.push({
			from,
			to,
			src: m[1].trim(),
			block: false
		});
	}
	return spans;
}
//#endregion
//#region src/editor/livePreview.js
const HIDE_MARKS = /* @__PURE__ */ new Set([
	"HeaderMark",
	"EmphasisMark",
	"StrikethroughMark"
]);
function buildMathDecorations(state) {
	const sel = state.selection.main;
	const aFrom = state.doc.lineAt(sel.from).from;
	const aTo = state.doc.lineAt(sel.to).to;
	const onActive = (from, to) => to >= aFrom && from <= aTo;
	const spans = findMathSpans(state.doc.toString());
	const ranges = [];
	for (const sp of spans) {
		if (onActive(sp.from, sp.to)) continue;
		ranges.push(Decoration.replace({ widget: new MathWidget(sp.src, sp.block) }).range(sp.from, sp.to));
	}
	return Decoration.set(ranges, true);
}
const mathPreview = StateField.define({
	create(state) {
		try {
			return buildMathDecorations(state);
		} catch {
			return Decoration.none;
		}
	},
	update(value, tr) {
		if (!tr.docChanged && !tr.selection) return value;
		try {
			return buildMathDecorations(tr.state);
		} catch {
			return Decoration.none;
		}
	},
	provide: (f) => EditorView.decorations.from(f)
});
function livePreview({ resolveAttachment } = {}) {
	return ViewPlugin.fromClass(class {
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
				const mathSpans = findMathSpans(state.doc.toString());
				const inMath = (from, to) => mathSpans.some((s) => from < s.to && to > s.from);
				const out = [];
				const tree = syntaxTree(state);
				for (const { from, to } of view.visibleRanges) tree.iterate({
					from,
					to,
					enter: (node) => {
						if (inMath(node.from, node.to)) return;
						const name = node.name;
						if (name === "ListItem") {
							const taskMarker = node.node.getChild("Task")?.getChild("TaskMarker");
							if (taskMarker) out.push({
								from: node.from,
								to: taskMarker.from,
								deco: Decoration.replace({})
							});
						} else if (name === "TaskMarker") {
							if (!onActive(node.from, node.to)) {
								const text = state.sliceDoc(node.from, node.to);
								out.push({
									from: node.from,
									to: node.to,
									deco: Decoration.replace({ widget: new CheckboxWidget(/x/i.test(text), node.from) })
								});
							}
						} else if (name === "Image") {
							if (!onActive(node.from, node.to)) {
								const urlChild = node.node.getChild("URL");
								if (urlChild) {
									const src = state.sliceDoc(urlChild.from, urlChild.to);
									const alt = state.sliceDoc(node.from + 2, urlChild.from - 2);
									out.push({
										from: node.from,
										to: node.to,
										deco: Decoration.replace({ widget: new ImageWidget(src, alt, resolveAttachment) })
									});
								}
							}
						} else if (name === "Link") {
							if (!onActive(node.from, node.to)) {
								const md = state.sliceDoc(node.from, node.to);
								const mm = /^\[([^\]]*)\]\(([^)\s]+)/.exec(md);
								if (mm && mm[2].startsWith("attachments/")) out.push({
									from: node.from,
									to: node.to,
									deco: Decoration.replace({ widget: new FileChipWidget(mm[1] || "file", mm[2], resolveAttachment) })
								});
							}
						} else if (HIDE_MARKS.has(name)) {
							if (!onActive(node.from, node.to)) out.push({
								from: node.from,
								to: node.to,
								deco: Decoration.replace({})
							});
						}
					}
				});
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
	}, { decorations: (v) => v.decorations });
}
//#endregion
//#region src/editor/extensions.js
const heading = (size, weight) => ({
	fontSize: size,
	fontWeight: weight,
	lineHeight: "1.3"
});
const highlightStyle = HighlightStyle.define([
	{
		tag: tags.heading1,
		...heading("1.6em", "700")
	},
	{
		tag: tags.heading2,
		...heading("1.36em", "700")
	},
	{
		tag: tags.heading3,
		...heading("1.18em", "650")
	},
	{
		tag: [
			tags.heading4,
			tags.heading5,
			tags.heading6
		],
		...heading("1.06em", "650")
	},
	{
		tag: tags.strong,
		fontWeight: "700"
	},
	{
		tag: tags.emphasis,
		fontStyle: "italic"
	},
	{
		tag: tags.strikethrough,
		textDecoration: "line-through"
	},
	{
		tag: tags.link,
		color: "var(--nt-accent-ink)",
		textDecoration: "underline"
	},
	{
		tag: tags.url,
		color: "var(--muted)"
	},
	{
		tag: [tags.monospace],
		fontFamily: "var(--mono)",
		fontSize: "0.92em",
		background: "var(--surface2)",
		borderRadius: "4px",
		padding: "0 3px"
	},
	{
		tag: tags.quote,
		color: "var(--muted)",
		fontStyle: "italic"
	},
	{
		tag: tags.list,
		color: "var(--text)"
	},
	{
		tag: tags.processingInstruction,
		color: "var(--muted)",
		opacity: .6
	},
	{
		tag: tags.contentSeparator,
		color: "var(--border)"
	}
]);
const theme = EditorView.theme({
	"&": {
		height: "100%",
		backgroundColor: "transparent",
		color: "var(--text)"
	},
	".cm-scroller": {
		overflow: "auto",
		overscrollBehavior: "contain",
		fontFamily: "var(--font)",
		lineHeight: "1.66",
		fontSize: "16px"
	},
	".cm-content": {
		boxSizing: "border-box",
		padding: "12px 18px 34vh",
		caretColor: "var(--accent)",
		maxWidth: "var(--nt-measure)",
		margin: "0 auto",
		width: "100%"
	},
	"&.cm-focused": { outline: "none" },
	".cm-cursor, .cm-dropCursor": {
		borderLeftColor: "var(--accent)",
		borderLeftWidth: "2px"
	},
	".cm-selectionBackground": { backgroundColor: "color-mix(in srgb, var(--accent) 22%, transparent)" },
	"&.cm-focused .cm-selectionBackground": { backgroundColor: "color-mix(in srgb, var(--accent) 30%, transparent)" },
	".cm-line": {
		padding: "0",
		overflowWrap: "anywhere",
		wordBreak: "break-word"
	}
}, { dark: true });
function wrap(mark, markEnd = mark) {
	return (view) => {
		const tr = view.state.changeByRange((range) => {
			const text = view.state.sliceDoc(range.from, range.to);
			return {
				changes: {
					from: range.from,
					to: range.to,
					insert: mark + text + markEnd
				},
				range: EditorSelection.range(range.from + mark.length, range.to + mark.length)
			};
		});
		view.dispatch(view.state.update(tr, {
			userEvent: "input.format",
			scrollIntoView: true
		}));
		return true;
	};
}
const mdKeymap = [
	{
		key: "Mod-b",
		run: wrap("**")
	},
	{
		key: "Mod-i",
		run: wrap("*")
	},
	{
		key: "Mod-e",
		run: wrap("`")
	},
	{
		key: "Mod-Shift-x",
		run: wrap("~~")
	}
];
function buildExtensions({ onDocChange, resolveAttachment, editableCompartment, readOnlyCompartment, readOnly = false }) {
	return [
		editableCompartment.of(EditorView.editable.of(!readOnly)),
		readOnlyCompartment.of(EditorState.readOnly.of(!!readOnly)),
		history(),
		markdown({ base: markdownLanguage }),
		syntaxHighlighting(highlightStyle),
		indentOnInput(),
		EditorView.lineWrapping,
		livePreview({ resolveAttachment }),
		mathPreview,
		keymap.of([
			...mdKeymap,
			indentWithTab,
			...historyKeymap,
			...defaultKeymap
		]),
		theme,
		EditorView.updateListener.of((u) => {
			if (u.docChanged) onDocChange(u.state.doc.toString());
		})
	];
}
//#endregion
//#region src/editor/Editor.jsx
function Editor({ value, onChange, resolveAttachment, viewRef, syncKey, readOnly = false }) {
	const host = useRef(null);
	const view = useRef(null);
	const editableCompartment = useRef(new Compartment());
	const readOnlyCompartment = useRef(new Compartment());
	const readOnlyRef = useRef(readOnly);
	const onChangeRef = useRef(onChange);
	const resolveRef = useRef(resolveAttachment);
	onChangeRef.current = onChange;
	resolveRef.current = resolveAttachment;
	useEffect(() => {
		const state = EditorState.create({
			doc: value || "",
			extensions: buildExtensions({
				onDocChange: (t) => {
					if (onChangeRef.current) onChangeRef.current(t);
				},
				resolveAttachment: (p) => resolveRef.current ? resolveRef.current(p) : Promise.resolve(null),
				editableCompartment: editableCompartment.current,
				readOnlyCompartment: readOnlyCompartment.current,
				readOnly
			})
		});
		const v = new EditorView({
			state,
			parent: host.current
		});
		view.current = v;
		if (viewRef) viewRef.current = v;
		return () => {
			v.destroy();
			view.current = null;
			if (viewRef) viewRef.current = null;
		};
	}, []);
	useEffect(() => {
		const v = view.current;
		if (!v) return;
		if (readOnlyRef.current === readOnly) return;
		readOnlyRef.current = readOnly;
		v.dispatch({ effects: [editableCompartment.current.reconfigure(EditorView.editable.of(!readOnly)), readOnlyCompartment.current.reconfigure(EditorState.readOnly.of(!!readOnly))] });
	}, [readOnly]);
	useEffect(() => {
		const v = view.current;
		if (!v) return;
		const cur = v.state.doc.toString();
		if (value != null && value !== cur) v.dispatch({ changes: {
			from: 0,
			to: cur.length,
			insert: value
		} });
	}, [syncKey]);
	return /* @__PURE__ */ jsx("div", {
		ref: host,
		className: "nt-cm-host"
	});
}
//#endregion
//#region src/ui/EditorPanel.jsx
const AUTOSAVE_MS = 600;
const EDITOR_DATE_FORMATTER = new Intl.DateTimeFormat(void 0, {
	month: "short",
	day: "numeric"
});
function editorDate(meta) {
	const raw = meta.updated || meta.created;
	if (!raw) return "Draft";
	const d = new Date(raw);
	if (Number.isNaN(d.getTime())) return "Draft";
	return `Edited ${EDITOR_DATE_FORMATTER.format(d)}`;
}
function wordCount(body) {
	const words = String(body || "").trim().match(/\S+/g);
	return words ? words.length : 0;
}
function taskSummary(body) {
	const tasks = String(body || "").match(/^- \[[ x]\] /gim) || [];
	if (!tasks.length) return "";
	const done = tasks.filter((task) => /\[[xX]\]/.test(task)).length;
	return `${tasks.length} task${tasks.length === 1 ? "" : "s"} · ${done} done`;
}
function EditorPanel({ note, onSave, onBack, onPin, onColor, onDelete, resolveAttachment, putAttachment, status, forceSave, closeRequestRef, inactive = false }) {
	const [title, setTitle] = useState(note.meta.title || "");
	const [body, setBody] = useState(note.body || "");
	const [showColors, setShowColors] = useState(false);
	const [attachErr, setAttachErr] = useState("");
	const [closing, setClosing] = useState(false);
	const timer = useRef(null);
	const viewRef = useRef(null);
	const sheetRef = useRef(null);
	const backRef = useRef(null);
	const titleRef = useRef(null);
	const openerRef = useRef(null);
	const focusTimer = useRef(null);
	const closeInFlight = useRef(null);
	const pendingSaves = useRef(/* @__PURE__ */ new Set());
	const attachmentRef = useRef(null);
	const colorBtnRef = useRef(null);
	const latest = useRef({
		note,
		title: note.meta.title || "",
		body: note.body || ""
	});
	const incomingBodyRef = useRef(note.body || "");
	const reconciledTitle = useRef(note.meta.title || "");
	const localWriteBodies = useRef(/* @__PURE__ */ new Set());
	const isChecklist = note.meta.type === "checklist";
	const locked = !!note.meta.locked;
	useEffect(() => {
		if (latest.current.note.meta.id === note.meta.id) latest.current = {
			note,
			title,
			body
		};
	}, [
		note,
		title,
		body
	]);
	const saveCurrentNote = useCallback((meta, nextBody) => {
		localWriteBodies.current.add(nextBody ?? "");
		let request;
		try {
			request = Promise.resolve(onSave(meta, nextBody));
		} catch (err) {
			request = Promise.reject(err);
		}
		pendingSaves.current.add(request);
		const clear = () => pendingSaves.current.delete(request);
		request.then(clear, clear);
		return request;
	}, [onSave]);
	const liveBody = useCallback(() => viewRef.current ? viewRef.current.state.doc.toString() : latest.current.body, []);
	const replaceEditorBody = useCallback((nextBody) => {
		const v = viewRef.current;
		if (v) {
			const cur = v.state.doc.toString();
			if (cur !== nextBody) v.dispatch({ changes: {
				from: 0,
				to: cur.length,
				insert: nextBody
			} });
		} else setBody(nextBody);
	}, []);
	const saveMetaPatch = useCallback((patch, bodyOverride) => {
		const cur = latest.current;
		if (!cur?.note) return Promise.resolve();
		if (timer.current) clearTimeout(timer.current);
		const nextBody = bodyOverride ?? liveBody();
		const attachments = Array.from(/* @__PURE__ */ new Set([...cur.note.meta.attachments || [], ...bodyAttachmentRefs(nextBody)]));
		const nextMeta = {
			...cur.note.meta,
			title: cur.title,
			attachments,
			...patch
		};
		latest.current = {
			note: {
				...cur.note,
				meta: nextMeta,
				body: nextBody
			},
			title: cur.title,
			body: nextBody
		};
		return saveCurrentNote(nextMeta, nextBody);
	}, [liveBody, saveCurrentNote]);
	const flushSave = useCallback(() => {
		const cur = latest.current;
		if (!cur?.note) return Promise.resolve();
		if (cur.note.meta.locked && !forceSave) return Promise.resolve();
		const currentBody = liveBody();
		if (!forceSave && cur.title === (cur.note.meta.title || "") && currentBody === (cur.note.body || "")) return pendingSaves.current.size ? Promise.all([...pendingSaves.current]).then(() => void 0) : Promise.resolve();
		if (timer.current) clearTimeout(timer.current);
		const attachments = Array.from(/* @__PURE__ */ new Set([...cur.note.meta.attachments || [], ...bodyAttachmentRefs(currentBody)]));
		const alreadyPending = [...pendingSaves.current];
		const request = saveCurrentNote({
			...cur.note.meta,
			title: cur.title,
			attachments
		}, currentBody);
		return Promise.all([...alreadyPending, request]).then(() => void 0);
	}, [
		saveCurrentNote,
		forceSave,
		liveBody
	]);
	const closeEditor = useCallback((fromShell = false) => {
		if (closeInFlight.current) return closeInFlight.current;
		setShowColors(false);
		setClosing(true);
		const run = (async () => {
			try {
				await flushSave();
			} catch {
				setClosing(false);
				return false;
			}
			setClosing(false);
			await onBack(fromShell);
			return true;
		})();
		closeInFlight.current = run;
		const clear = () => {
			if (closeInFlight.current === run) closeInFlight.current = null;
		};
		run.then(clear, clear);
		return run;
	}, [flushSave, onBack]);
	useEffect(() => {
		if (!closeRequestRef) return void 0;
		closeRequestRef.current = closeEditor;
		return () => {
			if (closeRequestRef.current === closeEditor) closeRequestRef.current = null;
		};
	}, [closeEditor, closeRequestRef]);
	useEffect(() => {
		const active = typeof document !== "undefined" ? document.activeElement : null;
		openerRef.current = active && active !== document.body ? active : null;
		const focusEditor = () => {
			focusTimer.current = null;
			if (locked) backRef.current?.focus?.();
			else if (viewRef.current?.focus) viewRef.current.focus();
			else titleRef.current?.focus?.();
		};
		if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") focusTimer.current = window.requestAnimationFrame(focusEditor);
		else focusTimer.current = setTimeout(focusEditor, 0);
		return () => {
			if (focusTimer.current != null) if (typeof window !== "undefined" && typeof window.cancelAnimationFrame === "function") window.cancelAnimationFrame(focusTimer.current);
			else clearTimeout(focusTimer.current);
			const opener = openerRef.current;
			const stillMounted = typeof document === "undefined" || typeof document.contains !== "function" || document.contains(opener);
			if (opener && stillMounted && typeof opener.focus === "function") opener.focus();
			else {
				const focusFallback = () => document.querySelector?.(".nt-new-note-btn, .nt-empty-action")?.focus?.();
				if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") window.requestAnimationFrame(focusFallback);
				else setTimeout(focusFallback, 0);
			}
		};
	}, []);
	const onDialogKeyDown = useCallback((e) => {
		if (inactive) return;
		if (e.key === "Escape") {
			e.preventDefault();
			e.stopPropagation();
			if (showColors) setShowColors(false);
			else closeEditor();
			return;
		}
		if (e.defaultPrevented) return;
		if (e.key !== "Tab" || showColors) return;
		const candidates = sheetRef.current?.querySelectorAll("button:not([disabled]), [href], input:not([disabled]):not([type=\"hidden\"]), select:not([disabled]), textarea:not([disabled]), [contenteditable=\"true\"], [tabindex]:not([tabindex=\"-1\"])");
		const focusable = Array.from(candidates || []).filter((el) => typeof el.getClientRects !== "function" || el.getClientRects().length > 0);
		if (!focusable.length) {
			e.preventDefault();
			return;
		}
		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		const active = document.activeElement;
		if (e.shiftKey && active === first) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && active === last) {
			e.preventDefault();
			first.focus();
		}
	}, [
		closeEditor,
		inactive,
		showColors
	]);
	useEffect(() => {
		if (timer.current) clearTimeout(timer.current);
		flushSave().catch(() => {});
		latest.current = {
			note,
			title: note.meta.title || "",
			body: note.body || ""
		};
		incomingBodyRef.current = note.body || "";
		reconciledTitle.current = note.meta.title || "";
		localWriteBodies.current.clear();
		setTitle(note.meta.title || "");
		setBody(note.body || "");
	}, [note.meta.id]);
	useEffect(() => {
		if (latest.current.note.meta.id !== note.meta.id) return;
		const incoming = note.meta.title || "";
		const base = reconciledTitle.current;
		if (incoming === base) return;
		if (title === base) setTitle(incoming);
		reconciledTitle.current = incoming;
	}, [
		note.meta.title,
		note.meta.id,
		title
	]);
	useEffect(() => {
		if (latest.current.note.meta.id !== note.meta.id) return;
		const incoming = note.body || "";
		if (incoming === incomingBodyRef.current) return;
		incomingBodyRef.current = incoming;
		const v = viewRef.current;
		const current = v ? v.state.doc.toString() : body;
		if (localWriteBodies.current.has(incoming)) {
			localWriteBodies.current.delete(incoming);
			return;
		}
		if (current === incoming) {
			setBody(incoming);
			return;
		}
		if (v) {
			const head = v.state.selection.main.head;
			v.dispatch({
				changes: {
					from: 0,
					to: current.length,
					insert: incoming
				},
				selection: { anchor: Math.min(head, incoming.length) }
			});
		} else setBody(incoming);
	}, [note.body]);
	useEffect(() => {
		if (locked) {
			if (timer.current) clearTimeout(timer.current);
			return;
		}
		if (title === (note.meta.title || "") && body === (note.body || "")) return;
		if (timer.current) clearTimeout(timer.current);
		timer.current = setTimeout(() => {
			flushSave().catch(() => {});
		}, AUTOSAVE_MS);
		return () => clearTimeout(timer.current);
	}, [
		title,
		body,
		flushSave,
		locked
	]);
	useEffect(() => {
		const flushOnHide = () => {
			if (document.visibilityState === "hidden") flushSave().catch(() => {});
		};
		const flushOnUnload = () => {
			flushSave().catch(() => {});
		};
		document.addEventListener("visibilitychange", flushOnHide);
		window.addEventListener("beforeunload", flushOnUnload);
		return () => {
			document.removeEventListener("visibilitychange", flushOnHide);
			window.removeEventListener("beforeunload", flushOnUnload);
		};
	}, [flushSave]);
	const toggleType = useCallback(() => {
		if (locked) return;
		const nextType = isChecklist ? "note" : "checklist";
		const currentBody = liveBody();
		let nextBody = currentBody;
		if (nextType === "checklist" && currentBody.trim() && !/^- \[[ x]\] /m.test(currentBody)) nextBody = currentBody.replace(/^(.+)/m, "- [ ] $1");
		else if (nextType === "checklist" && !currentBody.trim()) nextBody = "- [ ] ";
		if (nextBody !== currentBody) replaceEditorBody(nextBody);
		saveMetaPatch({ type: nextType }, nextBody).catch(() => {});
	}, [
		isChecklist,
		liveBody,
		replaceEditorBody,
		saveMetaPatch,
		locked
	]);
	function insertMarkdown(md) {
		if (locked) return liveBody();
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
		if (locked) return;
		if (!f || !putAttachment) return;
		if (timer.current) clearTimeout(timer.current);
		const isImage = (f.type || "").startsWith("image/");
		let res;
		let nextBody;
		try {
			res = await putAttachment(isImage ? await toSdrImage(f) : f);
			const label = String(res.name || "").replace(/[[\]]/g, "");
			nextBody = insertMarkdown(isImage ? `\n![${label}](${res.path})\n` : `[${label}](${res.path})`);
		} catch (err) {
			setAttachErr(String(err && err.message || err).includes("limit") ? "File too large (max 25 MB)." : "Could not attach file.");
			setTimeout(() => setAttachErr(""), 3500);
			flushSave().catch(() => {});
			return;
		}
		const attachments = Array.from(/* @__PURE__ */ new Set([
			...note.meta.attachments || [],
			...bodyAttachmentRefs(nextBody),
			res.path
		]));
		try {
			await saveCurrentNote({
				...note.meta,
				title,
				attachments
			}, nextBody);
			releaseAttachment(res.path);
			setAttachErr("");
			window.mobius?.signal?.("attachment_added", {
				kind: isImage ? "image" : "file",
				bytes: f.size || 0,
				flattened: isImage
			});
		} catch (err) {}
	}
	const strandedKey = useMemo(() => strandedImageRefs(note.meta, body), [note.meta, body]).join("\n");
	const [strandedUrls, setStrandedUrls] = useState([]);
	useEffect(() => {
		let live = true;
		let urls = [];
		const refs = strandedKey ? strandedKey.split("\n") : [];
		setStrandedUrls([]);
		if (!refs.length || !resolveAttachment) return () => {};
		Promise.all(refs.map((ref) => resolveAttachment(ref).catch(() => null))).then((resolved) => {
			const next = resolved.filter(Boolean);
			if (!live) {
				next.forEach((u) => URL.revokeObjectURL(u));
				return;
			}
			urls = next;
			setStrandedUrls(next);
		}).catch(() => {});
		return () => {
			live = false;
			urls.forEach((u) => URL.revokeObjectURL(u));
		};
	}, [strandedKey, resolveAttachment]);
	const count = wordCount(body);
	const tasks = taskSummary(body);
	return /* @__PURE__ */ jsx("div", {
		className: "nt-editor-root",
		"aria-hidden": inactive ? "true" : void 0,
		inert: inactive ? true : void 0,
		onClick: (e) => {
			if (!inactive && e.target === e.currentTarget) closeEditor();
		},
		children: /* @__PURE__ */ jsxs("section", {
			ref: sheetRef,
			className: `nt-editor-sheet${locked ? " is-locked" : ""}`,
			role: "dialog",
			"aria-modal": "true",
			"aria-busy": closing ? "true" : void 0,
			"aria-label": title || "Untitled note",
			onKeyDown: onDialogKeyDown,
			onClick: (e) => e.stopPropagation(),
			children: [
				/* @__PURE__ */ jsxs("header", {
					className: "nt-editor-hdr",
					children: [/* @__PURE__ */ jsxs("div", {
						className: "nt-editor-toolbar",
						children: [
							/* @__PURE__ */ jsx("button", {
								ref: backRef,
								type: "button",
								onClick: () => closeEditor(),
								"aria-label": "Back",
								disabled: closing,
								className: "nt-hdr-btn",
								children: /* @__PURE__ */ jsx(Icon, {
									name: "back",
									size: 18
								})
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "nt-editor-actions",
								role: "toolbar",
								"aria-label": "Note actions",
								children: [
									/* @__PURE__ */ jsx("button", {
										type: "button",
										onClick: () => {
											const current = latest.current?.note?.meta?.pinned;
											saveMetaPatch({ pinned: !current }).catch(() => {});
										},
										"aria-label": note.meta.pinned ? "Unpin" : "Pin",
										"aria-pressed": note.meta.pinned,
										disabled: closing,
										title: note.meta.pinned ? "Unpin" : "Pin",
										className: `nt-hdr-btn${note.meta.pinned ? " is-active" : ""}`,
										children: /* @__PURE__ */ jsx(Icon, {
											name: "pin",
											size: 16
										})
									}),
									/* @__PURE__ */ jsx("button", {
										type: "button",
										onClick: () => attachmentRef.current && attachmentRef.current.click(),
										"aria-label": "Attach image or file",
										title: "Attach image or file",
										disabled: locked || closing,
										className: "nt-hdr-btn",
										children: /* @__PURE__ */ jsx(Icon, {
											name: "paperclip",
											size: 16
										})
									}),
									/* @__PURE__ */ jsxs("div", {
										ref: colorBtnRef,
										className: "nt-color-anchor",
										children: [/* @__PURE__ */ jsx("button", {
											type: "button",
											onClick: () => setShowColors((v) => !v),
											"aria-label": "Color",
											title: "Color",
											disabled: closing,
											className: "nt-hdr-btn",
											children: /* @__PURE__ */ jsx(Icon, {
												name: "palette",
												size: 17
											})
										}), showColors && /* @__PURE__ */ jsx(ColorPicker, {
											anchorRef: colorBtnRef,
											placement: "below",
											align: "start",
											current: note.meta.color,
											onPick: (c) => {
												saveMetaPatch({ color: c }).catch(() => {});
												setShowColors(false);
											},
											onDismiss: () => setShowColors(false)
										})]
									}),
									/* @__PURE__ */ jsx("button", {
										type: "button",
										onClick: () => saveMetaPatch({ locked: !locked }).catch(() => {}),
										"aria-label": locked ? "Unlock note" : "Lock note",
										"aria-pressed": locked,
										disabled: closing,
										title: locked ? "Unlock note" : "Lock note",
										className: `nt-hdr-btn${locked ? " is-active" : ""}`,
										children: /* @__PURE__ */ jsx(Icon, {
											name: locked ? "lock" : "unlock",
											size: 16
										})
									}),
									/* @__PURE__ */ jsx("button", {
										type: "button",
										onClick: toggleType,
										"aria-label": isChecklist ? "Switch to note" : "Switch to checklist",
										"aria-pressed": isChecklist,
										disabled: locked || closing,
										title: isChecklist ? "Switch to note" : "Switch to checklist",
										className: `nt-hdr-btn${isChecklist ? " is-active" : ""}`,
										children: /* @__PURE__ */ jsx(Icon, {
											name: isChecklist ? "checklist" : "note",
											size: 16
										})
									})
								]
							}),
							/* @__PURE__ */ jsx("div", { className: "nt-hdr-spacer" }),
							(closing || status) && /* @__PURE__ */ jsx("span", {
								className: "nt-status is-default",
								role: "status",
								"aria-live": "polite",
								children: closing ? "Saving…" : status
							}),
							/* @__PURE__ */ jsx("button", {
								type: "button",
								onClick: () => onDelete(note.meta.id),
								"aria-label": "Delete",
								title: locked ? "Unlock to delete" : "Delete",
								disabled: locked || closing,
								className: "nt-hdr-btn is-danger",
								children: /* @__PURE__ */ jsx(Icon, {
									name: "trash",
									size: 16
								})
							})
						]
					}), /* @__PURE__ */ jsx("input", {
						ref: attachmentRef,
						type: "file",
						name: "note-attachment",
						onChange: handleFile,
						disabled: locked,
						className: "nt-file-input"
					})]
				}),
				attachErr && /* @__PURE__ */ jsx("div", {
					className: "nt-attach-err",
					role: "alert",
					children: attachErr
				}),
				/* @__PURE__ */ jsx("div", {
					className: "nt-editor-title-band",
					children: /* @__PURE__ */ jsx("input", {
						ref: titleRef,
						name: "note-title",
						autoComplete: "off",
						value: title,
						readOnly: locked || closing,
						onChange: (e) => {
							if (!locked && !closing) setTitle(e.target.value);
						},
						placeholder: "Title",
						"aria-label": "Note title",
						className: "nt-title-input"
					})
				}),
				/* @__PURE__ */ jsx("div", {
					className: "nt-editor-body",
					children: /* @__PURE__ */ jsx(Editor, {
						value: body,
						onChange: locked || closing ? () => {} : setBody,
						resolveAttachment,
						viewRef,
						syncKey: note.meta.id,
						readOnly: locked || closing
					})
				}),
				/* @__PURE__ */ jsxs("footer", {
					className: "nt-editor-foot",
					"aria-label": "Note metadata",
					children: [
						/* @__PURE__ */ jsx("span", { children: editorDate(note.meta) }),
						/* @__PURE__ */ jsxs("span", { children: [
							count,
							" word",
							count === 1 ? "" : "s"
						] }),
						tasks && /* @__PURE__ */ jsx("span", { children: tasks }),
						locked && /* @__PURE__ */ jsx("span", { children: "Locked" })
					]
				}),
				strandedUrls.length > 0 && /* @__PURE__ */ jsx("div", {
					className: "nt-attach-strip",
					"aria-label": "Attached images",
					children: strandedUrls.map((u) => /* @__PURE__ */ jsx("img", {
						src: u,
						alt: "",
						className: "nt-attach-thumb"
					}, u))
				})
			]
		})
	});
}
//#endregion
//#region src/ui/ConfirmModal.jsx
function ConfirmModal({ open, title, message, confirmLabel = "Confirm", danger, onConfirm, onCancel }) {
	const dialogRef = useRef(null);
	const cancelRef = useRef(null);
	const openerRef = useRef(null);
	const titleId = useId();
	const messageId = useId();
	useEffect(() => {
		if (!open) return;
		openerRef.current = document.activeElement;
		cancelRef.current?.focus();
		return () => {
			const opener = openerRef.current;
			if (opener && typeof opener.focus === "function" && document.contains(opener)) opener.focus();
		};
	}, [open]);
	const onKeyDown = useCallback((e) => {
		if (e.key === "Escape") {
			onCancel();
			return;
		}
		if (e.key !== "Tab") return;
		const focusable = dialogRef.current?.querySelectorAll("button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex=\"-1\"])");
		if (!focusable || focusable.length === 0) {
			e.preventDefault();
			return;
		}
		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		const active = document.activeElement;
		if (e.shiftKey && active === first) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && active === last) {
			e.preventDefault();
			first.focus();
		}
	}, [onCancel]);
	if (!open) return null;
	return /* @__PURE__ */ jsx("div", {
		onClick: onCancel,
		onKeyDown,
		className: "nt-modal-scrim",
		children: /* @__PURE__ */ jsxs("div", {
			ref: dialogRef,
			role: "dialog",
			"aria-modal": "true",
			"aria-labelledby": title ? titleId : void 0,
			"aria-describedby": message ? messageId : void 0,
			onClick: (e) => e.stopPropagation(),
			className: "nt-modal",
			children: [
				title && /* @__PURE__ */ jsx("h2", {
					id: titleId,
					className: "nt-modal-title",
					children: title
				}),
				message && /* @__PURE__ */ jsx("p", {
					id: messageId,
					className: "nt-modal-msg",
					children: message
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "nt-modal-actions",
					children: [/* @__PURE__ */ jsx("button", {
						type: "button",
						ref: cancelRef,
						onClick: onCancel,
						className: "nt-modal-btn nt-modal-cancel",
						children: "Cancel"
					}), /* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: onConfirm,
						className: `nt-modal-btn nt-modal-confirm${danger ? " is-danger" : ""}`,
						children: confirmLabel
					})]
				})
			]
		})
	});
}
//#endregion
//#region src/lib/runtime-compat.js
const LEGACY_IDLE_DOCUMENT_PATH = "__notes_no_open__.json";
function idleDocumentPath(runtimeFeatures) {
	return runtimeFeatures?.idleDocument === true ? null : LEGACY_IDLE_DOCUMENT_PATH;
}
//#endregion
//#region src/app.jsx
const NO_DOC = {
	value: null,
	status: "idle",
	lastError: null,
	update: async () => {},
	set: async () => {},
	refresh: async () => {}
};
const NOTE_DOC_IDENTITY = (doc) => doc && doc.meta ? doc.meta.id : void 0;
const HAS_RUNTIME_DOC = typeof window !== "undefined" && !!(window.mobius && window.mobius.createUseDocument);
const useDocument = HAS_RUNTIME_DOC ? window.mobius.createUseDocument(React) : () => NO_DOC;
const IDLE_DOCUMENT_PATH = idleDocumentPath(HAS_RUNTIME_DOC ? window.mobius.runtimeFeatures : null);
function TopBar({ appId, query, onQuery, onCreate }) {
	const [iconOk, setIconOk] = useState(true);
	return /* @__PURE__ */ jsx("header", {
		className: "nt-topbar",
		children: /* @__PURE__ */ jsxs("div", {
			className: "nt-topbar-inner",
			children: [/* @__PURE__ */ jsxs("div", {
				className: "nt-topbar-row",
				children: [
					iconOk ? /* @__PURE__ */ jsx("img", {
						src: `/api/apps/${appId}/icon?size=128`,
						alt: "",
						width: 34,
						height: 34,
						className: "nt-brand-icon",
						onError: () => setIconOk(false)
					}) : /* @__PURE__ */ jsx("span", {
						className: "nt-brand-fallback",
						"aria-hidden": "true",
						children: "·"
					}),
					/* @__PURE__ */ jsx("h1", {
						className: "nt-app-title",
						children: "Notes"
					}),
					/* @__PURE__ */ jsx("button", {
						type: "button",
						className: "nt-new-note-btn",
						onClick: onCreate,
						"aria-label": "New note",
						title: "New note",
						children: /* @__PURE__ */ jsx(Icon, {
							name: "plus",
							size: 20
						})
					})
				]
			}), /* @__PURE__ */ jsxs("label", {
				className: "nt-search-wrap",
				children: [/* @__PURE__ */ jsx(Icon, {
					name: "search",
					size: 17
				}), /* @__PURE__ */ jsx("input", {
					value: query,
					onChange: (e) => onQuery(e.target.value),
					name: "notes-search",
					autoComplete: "off",
					placeholder: "Search notes…",
					"aria-label": "Search notes",
					className: "nt-search"
				})]
			})]
		})
	});
}
function LoadingGrid() {
	return /* @__PURE__ */ jsxs("div", {
		className: "nt-loading-grid",
		role: "status",
		"aria-live": "polite",
		"aria-label": "Loading notes",
		children: [/* @__PURE__ */ jsxs("div", {
			className: "nt-loading-label",
			children: [/* @__PURE__ */ jsx("span", {
				className: "nt-spinner",
				"aria-hidden": "true"
			}), /* @__PURE__ */ jsx("span", { children: "Loading notes…" })]
		}), /* @__PURE__ */ jsx("div", {
			className: "nt-skeleton-grid",
			"aria-hidden": "true",
			children: Array.from({ length: 6 }, (_, i) => /* @__PURE__ */ jsxs("div", {
				className: "nt-skeleton-card",
				children: [
					/* @__PURE__ */ jsx("span", { className: "nt-skeleton-line is-title" }),
					/* @__PURE__ */ jsx("span", { className: "nt-skeleton-line" }),
					/* @__PURE__ */ jsx("span", { className: "nt-skeleton-line" }),
					/* @__PURE__ */ jsx("span", { className: "nt-skeleton-line is-short" })
				]
			}, i))
		})]
	});
}
function EmptyState({ filtered, onCreate }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "nt-empty",
		children: [
			/* @__PURE__ */ jsx("div", {
				className: "nt-empty-icon",
				children: /* @__PURE__ */ jsx(Icon, {
					name: filtered ? "search" : "note",
					size: 26
				})
			}),
			/* @__PURE__ */ jsx("div", {
				className: "nt-empty-msg",
				children: filtered ? "No matching notes" : "No notes yet"
			}),
			/* @__PURE__ */ jsx("div", {
				className: "nt-empty-hint",
				children: filtered ? "Try another word or clear search to return to your notes." : "Jot a thought, a list, or a draft. Your agent can read and tidy them later."
			}),
			!filtered && /* @__PURE__ */ jsx("button", {
				type: "button",
				className: "nt-empty-action",
				onClick: onCreate,
				children: "New note"
			})
		]
	});
}
var ErrorBoundary = class extends React.Component {
	constructor(props) {
		super(props);
		this.state = { crashed: false };
	}
	static getDerivedStateFromError() {
		return { crashed: true };
	}
	componentDidCatch(err) {
		window.mobius?.signal?.("error", {
			message: err?.message ?? "render crash",
			source: "boundary"
		});
	}
	render() {
		if (this.state.crashed) return /* @__PURE__ */ jsxs("div", {
			className: "nt-empty",
			role: "alert",
			children: [/* @__PURE__ */ jsx("div", {
				className: "nt-empty-msg",
				children: "Something went wrong"
			}), /* @__PURE__ */ jsx("div", {
				className: "nt-empty-hint",
				children: "Close and reopen Notes to recover. Your notes are safe."
			})]
		});
		return this.props.children;
	}
};
function App({ appId }) {
	useEffect(() => {
		if (document.querySelector("link[data-nt-katex]")) return void 0;
		const link = document.createElement("link");
		link.rel = "stylesheet";
		link.href = "/vendor/katex@0.17.0/katex.min.css";
		link.setAttribute("data-nt-katex", "1");
		document.head.appendChild(link);
	}, []);
	const [notes, setNotes] = useState([]);
	const [loading, setLoading] = useState(true);
	const [query, setQuery] = useState("");
	const [view, setView] = useState({
		mode: "grid",
		id: null
	});
	const [draft, setDraft] = useState(null);
	const [confirmId, setConfirmId] = useState(null);
	const [saveError, setSaveError] = useState(null);
	const [failedSaveIds, setFailedSaveIds] = useState(() => /* @__PURE__ */ new Set());
	const gcTimer = useRef(null);
	const indexTimer = useRef(null);
	const editorNavOwned = useRef(false);
	const editorCloseRef = useRef(null);
	const openIdRef = useRef(null);
	const notesRef = useRef([]);
	const draftRef = useRef(null);
	const failedSaveIdsRef = useRef(/* @__PURE__ */ new Set());
	const [online, setOnline] = useState(() => isOnline());
	const setDraftNow = useCallback((next) => {
		draftRef.current = typeof next === "function" ? next(draftRef.current) : next;
		setDraft(draftRef.current);
	}, []);
	const setNotesNow = useCallback((updater) => {
		const next = typeof updater === "function" ? updater(notesRef.current) : updater;
		notesRef.current = next;
		setNotes(next);
		return next;
	}, []);
	const collection = useMemo(() => makeNoteCollection(), []);
	const openId = view.mode === "editor" ? view.id : null;
	const openNote = openId ? notes.find((n) => n.meta.id === openId && !n.placeholder) : null;
	const openPath = openId ? openNote?.storagePath || notePath(openId) : IDLE_DOCUMENT_PATH;
	useEffect(() => {
		openIdRef.current = openId;
	}, [openId]);
	useEffect(() => {
		notesRef.current = notes;
	}, [notes]);
	useEffect(() => {
		draftRef.current = draft;
	}, [draft]);
	useEffect(() => {
		failedSaveIdsRef.current = failedSaveIds;
	}, [failedSaveIds]);
	const openDocOptions = useMemo(() => ({
		initial: null,
		identity: NOTE_DOC_IDENTITY,
		mode: "lww"
	}), []);
	const liveDoc = useDocument(openPath, openDocOptions);
	const liveDocRef = useRef(liveDoc);
	liveDocRef.current = liveDoc;
	useEffect(() => {
		if (openId && liveDoc.lastError) {
			setSaveError({
				id: openId,
				message: "Could not save — your edit is kept. Retrying when possible."
			});
			setFailedSaveIds((s) => s.has(openId) ? s : new Set(s).add(openId));
		}
	}, [openId, liveDoc.lastError]);
	useEffect(() => {
		const v = liveDoc.value;
		if (!openId || !v || !v.meta || v.meta.id !== openId) return;
		setNotesNow((prev) => {
			const cur = prev.find((n) => n.meta.id === openId);
			if (cur && cur.body === v.body && cur.meta.content_hash === v.meta.content_hash) return prev;
			return prev.map((n) => n.meta.id === openId ? {
				...n,
				meta: v.meta,
				body: v.body
			} : n);
		});
	}, [
		openId,
		liveDoc.value,
		setNotesNow
	]);
	const upsert = useCallback((meta, body) => {
		setNotesNow((prev) => prev.some((n) => n.meta.id === meta.id) ? prev.map((n) => n.meta.id === meta.id ? {
			...n,
			meta,
			body,
			storagePath: n.storagePath
		} : n) : [{
			meta,
			body
		}, ...prev]);
	}, [setNotesNow]);
	const scheduleGc = useCallback(() => {
		if (gcTimer.current) clearTimeout(gcTimer.current);
		gcTimer.current = setTimeout(() => {
			const open = openIdRef.current;
			const cur = open ? notesRef.current.find((n) => n.meta.id === open) : null;
			gcAttachments(cur ? [...cur.meta.attachments || [], ...bodyAttachmentRefs(cur.body || "")] : []).catch(() => {});
		}, 1500);
	}, []);
	const canGcAfterDurableResult = useCallback((result) => !(result && (result.durability === "queued" || result.queued === true)), []);
	useEffect(() => {
		let live = true;
		(async () => {
			await migrateLegacyNotes().catch(() => {});
			readIndex().then((index) => {
				const cached = notesFromIndex(index);
				if (live && cached.length) {
					setNotesNow((prev) => prev.length ? prev : cached);
					setLoading(false);
				}
			}).catch(() => {});
			const canonical = await collection.list().catch(() => null);
			if (!live) return;
			setLoading(false);
			if (canonical == null) window.mobius?.signal?.("app_ready", {
				item_count: notesRef.current.length,
				offline: true
			});
			else {
				setNotesNow(canonical);
				window.mobius?.signal?.("app_ready", {
					item_count: canonical.length,
					offline: false
				});
			}
		})();
		return () => {
			live = false;
		};
	}, [collection, setNotesNow]);
	useEffect(() => {
		const goOnline = () => {
			setOnline(true);
			collection.list().then((canonical) => {
				if (canonical != null) {
					setNotesNow(canonical);
					setLoading(false);
				}
			}).catch(() => {});
		};
		const goOffline = () => setOnline(false);
		window.addEventListener("online", goOnline);
		window.addEventListener("offline", goOffline);
		return () => {
			window.removeEventListener("online", goOnline);
			window.removeEventListener("offline", goOffline);
		};
	}, [collection, setNotesNow]);
	useEffect(() => {
		if (loading) return;
		if (indexTimer.current) clearTimeout(indexTimer.current);
		indexTimer.current = setTimeout(() => {
			indexTimer.current = null;
			writeIndex(notesRef.current).catch(() => {});
		}, 250);
		return () => {
			if (indexTimer.current) clearTimeout(indexTimer.current);
			indexTimer.current = null;
		};
	}, [notes, loading]);
	useEffect(() => () => {
		if (gcTimer.current) clearTimeout(gcTimer.current);
		if (indexTimer.current) clearTimeout(indexTimer.current);
	}, []);
	const pushEditorNav = useCallback(() => {
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
				window.parent.postMessage({
					type: "moebius:nav-push",
					label: "notes-editor",
					requestId
				}, window.location.origin);
			} catch {
				done(false);
			}
		});
	}, []);
	const popEditorNav = useCallback(() => {
		if (!editorNavOwned.current || typeof window === "undefined" || !window.parent) return;
		editorNavOwned.current = false;
		try {
			window.parent.postMessage({ type: "moebius:nav-pop" }, window.location.origin);
		} catch {}
	}, []);
	const ensureAuthoritative = useCallback(async (id) => {
		const cur = notesRef.current.find((n) => n.meta.id === id);
		if (!cur) return null;
		if (!cur.placeholder) return cur;
		const loaded = await collection.load(id).catch(() => null);
		if (!loaded || !loaded.meta || !loaded.meta.id) return null;
		setNotesNow((prev) => prev.map((n) => n.meta.id === id ? loaded : n));
		return loaded;
	}, [collection, setNotesNow]);
	const openEditor = useCallback(async (id) => {
		const cur = notesRef.current.find((n) => n.meta.id === id);
		window.mobius?.signal?.("item_opened", { type: cur?.meta?.type || "note" });
		setSaveError((e) => e && failedSaveIdsRef.current.has(e.id) ? e : null);
		if (cur && cur.placeholder && !await ensureAuthoritative(id)) {
			setSaveError({
				id,
				message: "This note is not cached yet. Reconnect to open it."
			});
			return;
		}
		if (view.mode === "editor") {
			setView({
				mode: "editor",
				id
			});
			return;
		}
		editorNavOwned.current = await pushEditorNav();
		setView({
			mode: "editor",
			id
		});
	}, [
		ensureAuthoritative,
		pushEditorNav,
		view.mode
	]);
	const createNote = useCallback(() => {
		const meta = newNote({});
		setDraftNow({
			meta,
			body: ""
		});
		openEditor(meta.id).catch(() => setView({
			mode: "editor",
			id: meta.id
		}));
	}, [openEditor, setDraftNow]);
	const handleOpen = useCallback((id) => {
		openEditor(id).catch(() => setView({
			mode: "editor",
			id
		}));
	}, [openEditor]);
	const writeNote = useCallback(async (meta, body, { isDraftCommit = false, precomputedHash = null } = {}) => {
		const id = meta.id;
		const m = {
			...meta,
			updated: meta.updated || (/* @__PURE__ */ new Date()).toISOString()
		};
		m.content_hash = precomputedHash || await contentHash(m, body);
		upsert(m, body);
		const writeThroughHook = HAS_RUNTIME_DOC && openId === id;
		try {
			let result;
			if (writeThroughHook) result = await liveDocRef.current.update(() => ({
				meta: m,
				body
			}));
			else ({result} = await collection.update(id, () => ({
				meta: m,
				body
			})));
			setSaveError((e) => e && e.id === id ? null : e);
			setFailedSaveIds((s) => {
				if (!s.has(id)) return s;
				const n = new Set(s);
				n.delete(id);
				return n;
			});
			if (isDraftCommit) {
				setDraftNow(null);
				window.mobius?.signal?.("item_created", { type: m.type || "note" });
			} else window.mobius?.signal?.("item_updated", {
				type: m.type || "note",
				durability: result?.durability
			});
			if (canGcAfterDurableResult(result)) scheduleGc();
			return m;
		} catch (err) {
			window.mobius?.signal?.("error", {
				message: err?.message ?? "save failed",
				source: "writeNote"
			});
			setSaveError({
				id,
				message: "Could not save — your edit is kept. Retrying when possible."
			});
			setFailedSaveIds((s) => s.has(id) ? s : new Set(s).add(id));
			throw err;
		}
	}, [
		openId,
		upsert,
		collection,
		scheduleGc,
		setDraftNow,
		canGcAfterDurableResult
	]);
	const persist = useCallback(async (meta, body) => {
		const currentDraft = draftRef.current;
		if (currentDraft && currentDraft.meta.id === meta.id) {
			const next = {
				meta: {
					...currentDraft.meta,
					...meta
				},
				body
			};
			setDraftNow(next);
			if (isBlankNote(next.meta, next.body)) return;
			const nextHash = await contentHash(next.meta, next.body);
			await writeNote(next.meta, next.body, {
				isDraftCommit: true,
				precomputedHash: nextHash
			});
			return;
		}
		const prev = notesRef.current.find((n) => n.meta.id === meta.id);
		if (prev && prev.placeholder) return;
		const [nextHash, prevHash] = await Promise.all([contentHash(meta, body), prev ? contentHash(prev.meta, prev.body) : Promise.resolve(null)]);
		const retryingFailedWrite = failedSaveIdsRef.current.has(meta.id) && prevHash === nextHash;
		if (!failedSaveIdsRef.current.has(meta.id) && prevHash != null && nextHash === prevHash) return;
		const stamped = retryingFailedWrite ? {
			...meta,
			updated: (/* @__PURE__ */ new Date()).toISOString()
		} : bumpRev(meta);
		await writeNote(stamped, body, { precomputedHash: nextHash });
	}, [writeNote, setDraftNow]);
	const togglePin = useCallback(async (id) => {
		if (draft && draft.meta.id === id) {
			setDraftNow((d) => ({
				...d,
				meta: {
					...d.meta,
					pinned: !d.meta.pinned
				}
			}));
			return;
		}
		const n = await ensureAuthoritative(id);
		if (n) persist({
			...n.meta,
			pinned: !n.meta.pinned
		}, n.body).catch(() => {});
	}, [
		draft,
		ensureAuthoritative,
		persist,
		setDraftNow
	]);
	const setColor = useCallback(async (id, color) => {
		if (draft && draft.meta.id === id) {
			setDraftNow((d) => ({
				...d,
				meta: {
					...d.meta,
					color
				}
			}));
			return;
		}
		const n = await ensureAuthoritative(id);
		if (n) persist({
			...n.meta,
			color
		}, n.body).catch(() => {});
	}, [
		draft,
		ensureAuthoritative,
		persist,
		setDraftNow
	]);
	const toggleLock = useCallback(async (id) => {
		if (draft && draft.meta.id === id) {
			setDraftNow((d) => ({
				...d,
				meta: {
					...d.meta,
					locked: !d.meta.locked
				}
			}));
			return;
		}
		const n = await ensureAuthoritative(id);
		if (n) persist({
			...n.meta,
			locked: !n.meta.locked
		}, n.body).catch(() => {});
	}, [
		draft,
		ensureAuthoritative,
		persist,
		setDraftNow
	]);
	const queueDelete = useCallback(async (id) => {
		const result = await collection.remove(id);
		if (canGcAfterDurableResult(result)) scheduleGc();
	}, [
		collection,
		scheduleGc,
		canGcAfterDurableResult
	]);
	const doDelete = useCallback(async (id) => {
		setConfirmId(null);
		if (draft && draft.meta.id === id) {
			if (view.mode === "editor" && view.id === id) popEditorNav();
			setDraftNow(null);
			setView({ mode: "grid" });
			return;
		}
		const n = notes.find((x) => x.meta.id === id);
		if (n?.meta?.locked) {
			setSaveError({
				id,
				kind: "delete",
				message: "Unlock this note before deleting it."
			});
			return;
		}
		if (n) try {
			await queueDelete(id);
			window.mobius?.signal?.("item_deleted", { type: n.meta.type || "note" });
		} catch (err) {
			window.mobius?.signal?.("error", {
				message: err?.message ?? "delete failed",
				source: "deleteNote"
			});
			setSaveError({
				id,
				kind: "delete",
				message: "Could not delete — the note is still here. Try again."
			});
			return;
		}
		setNotesNow((prev) => prev.filter((note) => note.meta.id !== id));
		setView((v) => {
			if (v.mode === "editor" && v.id === id) {
				popEditorNav();
				return { mode: "grid" };
			}
			return v;
		});
	}, [
		draft,
		notes,
		popEditorNav,
		queueDelete,
		view.id,
		view.mode,
		setDraftNow,
		setNotesNow
	]);
	const leaveEditor = useCallback((fromShell = false) => {
		if (!fromShell) popEditorNav();
		else editorNavOwned.current = false;
	}, [popEditorNav]);
	const back = useCallback(async (fromShell = false) => {
		const currentDraft = draftRef.current;
		if (currentDraft && currentDraft.meta.id === view.id) {
			leaveEditor(fromShell);
			setDraftNow(null);
			setView({ mode: "grid" });
			return;
		}
		const n = notesRef.current.find((x) => x.meta.id === view.id);
		if (n && !n.placeholder && isBlankNote(n.meta, n.body)) {
			try {
				await queueDelete(n.meta.id);
			} catch (err) {
				window.mobius?.signal?.("error", {
					message: err?.message ?? "delete failed",
					source: "deleteBlankNote"
				});
				setSaveError({
					id: n.meta.id,
					kind: "delete",
					message: "Could not delete — the note is still here. Try again."
				});
				return;
			}
			leaveEditor(fromShell);
			setNotesNow((prev) => prev.filter((x) => x.meta.id !== n.meta.id));
			setView({ mode: "grid" });
			return;
		}
		leaveEditor(fromShell);
		setView({ mode: "grid" });
	}, [
		leaveEditor,
		view.id,
		queueDelete,
		setDraftNow,
		setNotesNow
	]);
	const shellBackRef = useRef(null);
	shellBackRef.current = () => {
		const closeEditor = editorCloseRef.current;
		if (typeof closeEditor === "function") closeEditor(true);
		else back(true);
	};
	useEffect(() => {
		const onMessage = (event) => {
			if (event.origin !== window.location.origin) return;
			if (event.data?.type === "moebius:nav-back") shellBackRef.current?.();
		};
		window.addEventListener("message", onMessage);
		return () => window.removeEventListener("message", onMessage);
	}, []);
	const deferredQuery = useDeferredValue(query);
	const visible = useMemo(() => visibleNotes(notes, deferredQuery), [notes, deferredQuery]);
	useEffect(() => {
		const q = deferredQuery.trim();
		if (loading || !q || visible.length > 0) return void 0;
		const h = setTimeout(() => {
			window.mobius?.signal?.("search_no_results", { query_len: q.length });
		}, 700);
		return () => clearTimeout(h);
	}, [
		deferredQuery,
		visible.length,
		loading
	]);
	const editing = view.mode === "editor" ? notes.find((n) => n.meta.id === view.id && !n.placeholder) || (draft && draft.meta.id === view.id ? draft : null) : null;
	const status = saveError && editing && saveError.id === editing.meta.id ? saveError.kind === "delete" ? "Delete failed" : "Save failed" : !online ? "Offline" : null;
	return /* @__PURE__ */ jsxs("div", {
		className: "nt-root",
		children: [/* @__PURE__ */ jsx("style", { children: CSS }), /* @__PURE__ */ jsxs(ErrorBoundary, { children: [
			/* @__PURE__ */ jsxs("div", {
				className: "nt-home",
				"aria-hidden": editing ? "true" : void 0,
				inert: editing ? true : void 0,
				children: [
					/* @__PURE__ */ jsx(TopBar, {
						appId,
						query,
						onQuery: setQuery,
						onCreate: createNote
					}),
					!editing && saveError && /* @__PURE__ */ jsxs("div", {
						className: "nt-save-err",
						role: "alert",
						"aria-live": "assertive",
						children: [/* @__PURE__ */ jsx("span", {
							className: "nt-save-err-msg",
							children: saveError.message
						}), /* @__PURE__ */ jsx("button", {
							type: "button",
							className: "nt-save-err-btn",
							onClick: () => setSaveError(null),
							"aria-label": "Dismiss save error",
							children: "Dismiss"
						})]
					}),
					/* @__PURE__ */ jsx("main", {
						className: "nt-scroll",
						children: loading ? /* @__PURE__ */ jsx(LoadingGrid, {}) : visible.length === 0 ? /* @__PURE__ */ jsx(EmptyState, {
							filtered: !!deferredQuery.trim(),
							onCreate: createNote
						}) : /* @__PURE__ */ jsx(Grid_default, {
							notes: visible,
							onOpen: handleOpen,
							onPin: togglePin,
							onColor: setColor,
							onLock: toggleLock,
							onDelete: setConfirmId,
							resolveAttachment: attachmentURL
						})
					})
				]
			}),
			editing && /* @__PURE__ */ jsx(EditorPanel, {
				note: editing,
				onSave: persist,
				onBack: back,
				onPin: togglePin,
				onColor: setColor,
				onDelete: setConfirmId,
				resolveAttachment: attachmentURL,
				putAttachment,
				status,
				forceSave: failedSaveIds.has(editing.meta.id),
				closeRequestRef: editorCloseRef,
				inactive: !!confirmId
			}),
			/* @__PURE__ */ jsx(ConfirmModal, {
				open: !!confirmId,
				title: "Delete note?",
				message: "This note will be permanently deleted.",
				confirmLabel: "Delete",
				danger: true,
				onConfirm: () => doDelete(confirmId),
				onCancel: () => setConfirmId(null)
			}),
			!online && view.mode !== "editor" && /* @__PURE__ */ jsx("div", {
				className: "nt-sync-pill",
				role: "status",
				children: "Offline"
			})
		] })]
	});
}
//#endregion
export default App;
