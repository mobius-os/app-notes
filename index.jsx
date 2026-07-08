// GENERATED from src/ by build.mjs — do not edit by hand.
// Edit src/app.jsx + src/{lib,ui,editor}/*, then run `npm run build`.

// src/app.jsx
import React, { useState as useState4, useEffect as useEffect5, useMemo as useMemo3, useCallback as useCallback4, useRef as useRef5 } from "react";

// src/ui/colors.js
var NOTE_COLORS = [
  { name: null, label: "Default", hex: null },
  { name: "slate", label: "Slate", hex: "#7d96b4" },
  { name: "moss", label: "Moss", hex: "#84a583" },
  { name: "sand", label: "Sand", hex: "#c2ab82" },
  { name: "clay", label: "Clay", hex: "#bd8d7c" },
  { name: "plum", label: "Plum", hex: "#a98ab4" }
];
var LEGACY_TONES = {
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

// src/ui/css.js
var TONE_CSS = NOTE_COLORS.filter((c) => c.name).map((c) => `
.nt-card--${c.name} {
  --nt-note-tone: ${c.hex};
}
.nt-card--${c.name}::before {
  background: color-mix(in srgb, var(--nt-note-tone) 72%, var(--surface));
}
.nt-swatch--${c.name} { background: ${c.hex}; }
.nt-color-dot--${c.name},
.nt-card--${c.name} .nt-card-tone-dot { background: color-mix(in srgb, var(--nt-note-tone) 72%, var(--surface)); }`).join("\n");
var CSS = `
/* mobius-ui:Root v1 \u2014 keep in sync; library candidate. Diverge below the marker only. */
.nt-root {
  --nt-measure: 704px;
  position: relative;
  display: flex; flex-direction: column;
  height: 100%; width: 100%; max-width: 100%;
  overflow: hidden;
  background: var(--bg); color: var(--text); font-family: var(--font);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
.nt-scroll {
  flex: 1; min-height: 0;
  overflow-y: auto; overflow-x: hidden;
  overscroll-behavior: contain;
  word-break: break-word; overflow-wrap: anywhere;
}
/* /mobius-ui:Root */

/* mobius-ui:Focus v1 \u2014 shared keyboard focus ring (WCAG 2.4.7); never bare outline:none */
:where(button,a,input,textarea,select,summary,[role="button"],[tabindex]:not([tabindex="-1"])):focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
/* /mobius-ui:Focus */

/* \u2500\u2500 TopBar \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
/* mobius-ui:Header v1 \u2014 keep in sync; library candidate. Diverge below the marker only. */
.nt-topbar {
  display: flex; flex-direction: column; gap: 12px;
  /* top-pinned bar: pad past the notch/status bar on notched phones */
  padding: max(14px, env(safe-area-inset-top)) 18px 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
  position: sticky; top: 0;
  background: color-mix(in srgb, var(--bg) 86%, transparent); z-index: 5;
  backdrop-filter: saturate(1.35) blur(14px);
  -webkit-backdrop-filter: saturate(1.35) blur(14px);
  flex: 0 0 auto;
}
.nt-topbar-row {
  display: flex; align-items: center; gap: 11px; min-width: 0;
}
/* Brand mark \u2014 the app's real icon, rounded and sized to the search row */
.nt-brand-icon {
  width: 32px; height: 32px; flex-shrink: 0;
  border-radius: 10px; object-fit: cover; display: block;
}
/* Accent-dot fallback when the install has no custom icon (route 404s) */
.nt-brand-fallback {
  width: 32px; height: 32px; flex-shrink: 0;
  align-items: center; justify-content: center;
  font-size: 32px; font-weight: 700; line-height: 1;
  color: var(--accent); user-select: none;
}
.nt-app-title {
  flex: 1; margin: 0; min-width: 0;
  color: var(--text);
  font-size: 22px; line-height: 1; font-weight: 700; letter-spacing: 0;
}
/* Search field \u2014 full-width quiet inset */
.nt-search-wrap {
  width: 100%; height: 40px;
  display: flex; align-items: center; gap: 9px;
  padding: 0 12px; border-radius: 11px;
  border: 1px solid transparent;
  background: var(--surface2, var(--surface)); color: var(--muted);
  transition: border-color 0.15s ease, background 0.15s ease;
}
.nt-search {
  flex: 1; min-width: 0;
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
.nt-search::placeholder { color: var(--muted); }
/* FAB \u2014 floating action button, bottom-right, above gesture bar */
.nt-fab {
  position: fixed;
  right: max(20px, env(safe-area-inset-right, 0px));
  bottom: max(24px, env(safe-area-inset-bottom, 0px));
  z-index: 20;
  width: 54px; height: 54px;
  border-radius: 18px;
  /* --accent-fg is the one legal foreground on an accent fill \u2014 a custom light
     accent theme may set it dark, so do not add a fallback literal. */
  border: none; background: var(--accent); color: var(--accent-fg);
  display: inline-flex; align-items: center; justify-content: center;
  cursor: pointer; font-family: var(--font);
  box-shadow: 0 10px 28px color-mix(in srgb, var(--accent) 22%, transparent),
              0 1px 2px color-mix(in srgb, var(--text) 16%, transparent);
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation; user-select: none;
  transition: filter 0.14s ease, transform 0.12s ease, box-shadow 0.14s ease;
}
@media (hover: hover) { .nt-fab:hover { filter: brightness(1.08); transform: scale(1.04); } }
.nt-fab:active { transform: scale(0.93); }
/* /mobius-ui:Header */

/* \u2500\u2500 Loading / Empty \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.nt-loading {
  padding: 18vh 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px;
  color: var(--muted); font-size: 14px;
}
.nt-spinner {
  width: 22px; height: 22px; border-radius: 50%;
  border: 2px solid color-mix(in srgb, var(--accent) 22%, transparent);
  border-top-color: var(--accent);
  animation: nt-spin 0.7s linear infinite;
}
@keyframes nt-spin { to { transform: rotate(360deg); } }
/* mobius-ui:Empty v1 \u2014 keep in sync; library candidate. Diverge below the marker only. */
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
/* /mobius-ui:Empty */

/* \u2500\u2500 Grid \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.nt-grid-wrap {
  /* bottom pad clears the gesture bar and FAB on Android/notched iPhones */
  padding: 18px 18px max(96px, calc(72px + env(safe-area-inset-bottom)));
  max-width: 1120px; margin: 0 auto;
}
.nt-section { margin-bottom: 26px; }
/* mobius-ui:SectionHead v1 \u2014 keep in sync; library candidate. */
.nt-section-head {
  display: flex; align-items: center; gap: 8px;
  font-size: 12px; line-height: 1; font-weight: 650; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--muted);
  margin: 4px 4px 12px; user-select: none;
}
.nt-section-count {
  letter-spacing: 0; font-weight: 500;
  color: color-mix(in srgb, var(--muted) 72%, transparent);
}
/* /mobius-ui:SectionHead */
.nt-cards {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-auto-rows: min-content;
  gap: 12px;
}
@media (min-width: 700px) {
  .nt-cards { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (min-width: 980px) {
  .nt-cards { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}

/* \u2500\u2500 Card \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
/* mobius-ui:Card v1 \u2014 keep in sync; library candidate. Diverge below the marker only. */
.nt-card-wrap { /* grid item \u2014 no extra margin needed with gap */ }
.nt-card {
  position: relative;
  border-radius: 16px; overflow: hidden;
  background: var(--surface); border: 1px solid var(--border);
  min-height: 118px;
  box-shadow: 0 1px 2px color-mix(in srgb, var(--text) 5%, transparent),
              0 8px 22px color-mix(in srgb, var(--text) 6%, transparent);
  transition: box-shadow 0.16s ease, transform 0.16s ease, border-color 0.16s ease;
}
.nt-card::before {
  content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 4px;
  background: transparent;
}
@media (hover: hover) {
  .nt-card:hover {
    box-shadow: 0 2px 6px color-mix(in srgb, var(--text) 7%, transparent),
                0 16px 40px color-mix(in srgb, var(--text) 10%, transparent);
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
  display: flex; align-items: flex-start; gap: 6px;
  font-size: 15px; line-height: 1.28; font-weight: 650; color: var(--text);
  overflow-wrap: anywhere; padding-right: 24px;
}
.nt-card-title span {
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden;
}
.nt-card-empty {
  font-size: 13px; color: var(--muted); opacity: 0.72; font-style: italic;
}
.nt-card-preview {
  font-size: 13px; color: var(--muted); line-height: 1.42;
  display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical;
  overflow: hidden;
}
.nt-card-kicker {
  display: flex; align-items: center; gap: 5px;
  color: var(--muted); opacity: 0.7; font-size: 12px;
}
.nt-card-meta {
  display: flex; align-items: center; gap: 8px; min-height: 12px;
}
.nt-card-tone-dot {
  width: 8px; height: 8px; border-radius: 3px; flex: 0 0 auto;
}
.nt-card-date {
  color: color-mix(in srgb, var(--muted) 78%, transparent);
  font: 500 11.5px/1 var(--mono); letter-spacing: 0;
}
.nt-card-thumbs {
  display: grid; gap: 6px; margin-bottom: 8px;
}
.nt-card-thumb {
  width: 100%; object-fit: cover; display: block; border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--surface2, var(--surface));
  /* Render an already-stored Ultra HDR image (gain-map JPEG) as SDR. Without
     this, Chrome on Android promotes the display surface to HDR while the image
     is painted and tone-shifts the whole shell+app background \u2014 visible to the
     eye, invisible to screenshots. Supported Chrome 136+/Android; ignored
     elsewhere. New uploads are already flattened to SDR at attach time; this
     covers images stored before that fix. */
  dynamic-range-limit: standard;
}
/* /mobius-ui:Card */

/* \u2500\u2500 Card pin button (top-right) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.nt-card-pin {
  position: absolute; top: 6px; right: 6px;
  /* 44px touch floor (icon stays 14px, centered) \u2014 a corner icon button still
     needs a full tap target on phones. */
  width: 44px; height: 44px;
  display: inline-flex; align-items: center; justify-content: center;
  border: none; border-radius: 8px;
  background: transparent; cursor: pointer;
  font-family: var(--font);
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
  transition: background 0.12s ease, opacity 0.12s ease, transform 0.1s ease;
  /* unpinned: invisible at rest, revealed on card hover/focus */
  opacity: 0;
  color: var(--muted);
  z-index: 2;
}
/* Pinned state: always faintly visible to show the pin */
.nt-card-pin.is-pinned {
  opacity: 0.35;
  color: var(--accent);
}
@media (hover: hover) {
  .nt-card:hover .nt-card-pin { opacity: 0.6; }
  .nt-card:hover .nt-card-pin.is-pinned { opacity: 1; }
  .nt-card-pin:hover { background: color-mix(in srgb, var(--accent) 14%, transparent); opacity: 1 !important; }
}
.nt-card-pin:focus-visible { opacity: 1 !important; }
.nt-card-pin:active { transform: scale(0.9); }

/* \u2500\u2500 Card toolbar \u2014 shown on hover/focus; toggled via .nt-card--tools \u2500\u2500\u2500\u2500\u2500\u2500 */
.nt-card-footer {
  display: flex; align-items: center; gap: 2px;
  padding: 4px 6px;
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

/* note-preview: prose styles for rendered markdown in card previews */
.note-preview p { margin: 0 0 6px; }
.note-preview p:last-child { margin-bottom: 0; }
.note-preview h1, .note-preview h2, .note-preview h3 { font-size: 13.5px; font-weight: 700; margin: 0 0 4px; }
.note-preview code { font-family: var(--mono); font-size: 12px; background: color-mix(in srgb, var(--muted) 15%, transparent); border-radius: 3px; padding: 0 3px; }
.note-preview pre { margin: 0 0 6px; font-size: 12px; overflow: hidden; }
.note-preview ul, .note-preview ol { margin: 0 0 6px; padding-left: 18px; }
.note-preview li { margin-bottom: 2px; }

/* \u2500\u2500 Card toolbar buttons \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
/* mobius-ui:Button v1 \u2014 keep in sync; library candidate. Diverge below the marker only. */
.nt-icon-btn {
  width: 44px; height: 44px;
  display: inline-flex; align-items: center; justify-content: center;
  border: none; border-radius: 8px;
  background: transparent; color: var(--muted);
  cursor: pointer; font-size: 14px;
  opacity: 0.85; font-family: var(--font);
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
  transition: background 0.12s ease, transform 0.1s ease;
}
.nt-icon-btn.is-active { background: color-mix(in srgb, var(--accent) 14%, transparent); color: var(--accent); opacity: 1; }
.nt-icon-btn.is-danger { color: var(--danger); }
@media (hover: hover) {
  .nt-icon-btn:hover { background: color-mix(in srgb, var(--accent) 10%, transparent); }
}
.nt-icon-btn:active { transform: scale(0.93); }
/* keyboard focus ring comes from the shared mobius-ui:Focus block above */
/* /mobius-ui:Button */
.nt-color-anchor { position: relative; }
.nt-spacer { flex: 1; }

/* \u2500\u2500 ColorPicker \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.nt-color-picker {
  position: fixed; z-index: 1000;
  display: grid; grid-template-columns: repeat(4, 44px); gap: 8px;
  max-width: calc(100vw - 24px); padding: 8px;
  background: var(--surface2, var(--surface));
  border: 1px solid var(--border); border-radius: 12px;
  box-shadow: 0 16px 40px color-mix(in srgb, var(--text) 20%, transparent);
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

/* \u2500\u2500 ConfirmModal \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
/* mobius-ui:Sheet v1 \u2014 keep in sync; library candidate. Diverge below the marker only. */
.nt-modal-scrim {
  position: fixed; inset: 0; z-index: 50;
  display: flex; align-items: center; justify-content: center; padding: 20px;
  background: color-mix(in srgb, var(--text) 46%, transparent); backdrop-filter: blur(2px);
}
.nt-modal {
  width: 100%; max-width: 360px;
  background: var(--surface);
  border: 1px solid var(--border); border-radius: 16px; padding: 20px;
  box-shadow: 0 18px 48px color-mix(in srgb, var(--text) 22%, transparent);
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
  border: none; color: var(--accent-fg); font-weight: 600;
  /* --accent-fg is the only legal foreground on an accent/danger FILL (no hex
     fallback \u2014 a custom light theme sets it dark). Background is set via inline
     style: var(--danger) or var(--accent). */
}
/* /mobius-ui:Sheet */

/* \u2500\u2500 EditorPanel \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.nt-editor-root {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  background: var(--bg); z-index: 10;
}
/* mobius-ui:Header v1 \u2014 keep in sync; library candidate. Diverge below the marker only. */
.nt-editor-hdr {
  /* The full-screen editor covers the viewport (position:absolute inset:0), so \u2014
     unlike the grid, which the sticky .nt-topbar insets \u2014 the editor header sits
     at the top edge and must clear the notch/status bar itself. */
  padding: max(12px, env(safe-area-inset-top)) 14px 10px;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
  display: flex; flex-direction: column; gap: 8px; flex: 0 0 auto;
  background: color-mix(in srgb, var(--bg) 86%, transparent);
  backdrop-filter: saturate(1.35) blur(14px);
  -webkit-backdrop-filter: saturate(1.35) blur(14px);
}
.nt-editor-row1 {
  display: flex; align-items: center; gap: 6px; min-width: 0;
}
.nt-editor-row2 {
  display: flex; align-items: center; gap: 6px;
  overflow-x: auto; padding-bottom: 1px;
  overscroll-behavior: contain;
}
.nt-editor-row2::-webkit-scrollbar { display: none; }
/* /mobius-ui:Header */
/* mobius-ui:Button v1 \u2014 keep in sync; library candidate. Diverge below the marker only. */
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
.nt-hdr-btn.is-danger { color: var(--danger); }
@media (hover: hover) {
  .nt-hdr-btn:hover { background: color-mix(in srgb, var(--accent) 10%, transparent); }
}
.nt-hdr-btn:active { transform: scale(0.95); }
/* keyboard focus ring comes from the shared mobius-ui:Focus block above */
/* /mobius-ui:Button */
.nt-color-dot {
  width: 9px; height: 9px; border-radius: 3px;
  flex-shrink: 0;
  /* background comes from the nt-color-dot--<tone> classes generated above */
}
.nt-editor-back-label {
  color: var(--accent);
  font-size: 15px; font-weight: 650; line-height: 1;
}
.nt-editor-title-band {
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
/* mobius-ui:SyncPill v1 (editor variant) \u2014 keep in sync; library candidate. */
.nt-status {
  font-size: 12px; white-space: nowrap; margin-right: 2px; flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}
/* Online+idle: nothing shown (standard). Resolving uses accent; others muted. */
.nt-status.is-resolving { color: var(--accent); }
.nt-status.is-default { color: var(--muted); }
/* /mobius-ui:SyncPill */
.nt-label-btn {
  height: 44px;
  display: inline-flex; align-items: center; justify-content: center;
  gap: 6px; border: 1px solid var(--border); border-radius: 11px; padding: 0 10px;
  background: var(--surface2, var(--surface)); color: var(--text);
  cursor: pointer; font-size: 13px; font-weight: 600;
  white-space: nowrap; flex-shrink: 0; font-family: var(--font);
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
  transition: border-color 0.12s ease, transform 0.1s ease;
}
@media (hover: hover) {
  .nt-label-btn:hover { border-color: color-mix(in srgb, var(--accent) 50%, var(--border)); }
}
.nt-label-btn:active { transform: scale(0.97); }
.nt-hdr-spacer { flex: 1; min-width: 4px; }
.nt-conflict-bar {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 16px;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--text); font-size: 13px; flex: 0 0 auto;
}
.nt-conflict-msg { flex: 1; }
.nt-conflict-btn {
  min-height: 44px;
  display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid var(--accent); background: transparent; color: var(--accent);
  border-radius: 8px; padding: 4px 12px; font-size: 12px; cursor: pointer;
  flex-shrink: 0; font-family: var(--font);
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
}
.nt-attach-err {
  padding: 8px 16px;
  background: color-mix(in srgb, var(--danger) 14%, transparent);
  color: var(--danger); font-size: 13px; flex: 0 0 auto;
}
/* Grid-level save-failure banner \u2014 surfaces a refused (dead-lettered) write that
   happened with no editor open (a closed-note pin/color, or a back-out after a
   refused save). Never silent: a failed save the user can't see is data loss. */
.nt-save-err {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 16px;
  background: color-mix(in srgb, var(--danger) 14%, transparent);
  color: var(--danger); font-size: 13px; flex: 0 0 auto;
}
.nt-save-err-msg { flex: 1; }
.nt-save-err-btn {
  min-height: 44px;
  display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid var(--danger); background: transparent; color: var(--danger);
  border-radius: 8px; padding: 4px 12px; font-size: 12px; cursor: pointer;
  flex-shrink: 0; font-family: var(--font);
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
}
.nt-editor-body { flex: 1; min-height: 0; overflow: hidden; }
.nt-editor-foot {
  flex: 0 0 auto;
  display: flex; align-items: center; justify-content: center; flex-wrap: wrap;
  gap: 8px 14px;
  padding: 10px clamp(18px, 6vw, 40px) max(14px, env(safe-area-inset-bottom));
  border-top: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
  color: color-mix(in srgb, var(--muted) 82%, transparent);
  font: 500 12px/1.2 var(--mono);
}

/* \u2500\u2500 Grid offline pill (mobius-ui:SyncPill v2) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
/* SILENT WHEN HEALTHY: mounted ONLY while offline (never "Saving"/pending
   counts), plain "Offline" copy. Positioned bottom-LEFT so it never collides
   with the bottom-right FAB. Absolute to .nt-root (which is position:relative),
   never fixed \u2014 a fixed overlay could paint over the shell chrome. */
.nt-sync-pill {
  position: absolute; left: 50%; bottom: max(22px, env(safe-area-inset-bottom));
  transform: translateX(-50%);
  z-index: 15;
  display: inline-flex; align-items: center; padding: 9px 14px; border-radius: 999px;
  background: var(--text); border: 1px solid transparent; color: var(--bg);
  font-size: 12.5px; line-height: 1; font-weight: 650; font-family: var(--font);
  box-shadow: 0 12px 28px color-mix(in srgb, var(--text) 20%, transparent);
}
.nt-sync-pill.is-error { border-color: var(--danger); color: var(--danger); }

/* \u2500\u2500 Stranded-attachment strip (editor) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
/* Images attached to the note (meta.attachments) whose markdown ref is no
   longer in the body. Without this strip they'd be invisible inside the note
   while still showing on the card \u2014 stranded data. */
.nt-attach-strip {
  display: flex; gap: 8px; align-items: flex-start;
  padding: 8px 16px max(10px, env(safe-area-inset-bottom));
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

/* \u2500\u2500 Per-note color tones (generated from NOTE_COLORS) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
${TONE_CSS}

/* mobius-ui:ReducedMotion v1 \u2014 honor the OS reduce-motion setting */
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
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    type: meta.type ?? "note",
    archived: meta.archived ?? false
  };
}
async function contentHash(meta, body) {
  const canonical = normalize(meta, body);
  const json = JSON.stringify([
    canonical.title,
    canonical.body,
    canonical.pinned,
    canonical.color,
    canonical.tags,
    canonical.type,
    canonical.archived
  ]);
  return sha256Hex(json);
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
  const entries = index && Array.isArray(index.notes) ? index.notes : [];
  return entries.filter((e) => e && e.id).map((e) => ({
    meta: {
      id: e.id,
      title: e.title ?? "",
      pinned: e.pinned ?? false,
      color: e.color ?? null,
      type: e.type ?? "note",
      updated: e.updated
    },
    body: e.snippet ?? "",
    placeholder: true
  }));
}

// src/lib/visible.js
function visibleNotes(notes, query) {
  const q = (query || "").trim().toLowerCase();
  let list = notes;
  if (q) {
    list = list.filter((n) => (n.meta.title || "").toLowerCase().includes(q) || (n.body || "").toLowerCase().includes(q));
  }
  return [...list].sort((a, b) => {
    if (!!a.meta.pinned !== !!b.meta.pinned) return a.meta.pinned ? -1 : 1;
    return (b.meta.updated || "").localeCompare(a.meta.updated || "");
  });
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
var BODY_ATTACHMENT_REF = /\]\((attachments\/[^)\s]+)\)/g;
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
var IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif)$/i;
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

// node_modules/node-diff3/dist/diff3.mjs
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
  const attachments = [.../* @__PURE__ */ new Set([...mine?.attachments ?? [], ...theirs?.attachments ?? []])];
  const mineRev = mine?.mobius_rev ?? 0;
  const theirsRev = theirs?.mobius_rev ?? 0;
  return {
    id: base?.id,
    created: base?.created,
    title: winner?.title,
    color: winner?.color ?? null,
    pinned: winner?.pinned ?? false,
    tags: tags2,
    attachments,
    type: winner?.type ?? "note",
    archived: winner?.archived ?? false,
    updated: winner?.updated,
    mobius_rev: Math.max(mineRev, theirsRev) + 1,
    parent_revs: [mineRev, theirsRev]
  };
}

// src/lib/note-doc.js
var notePath = (id) => `notes/${id}.json`;
var legacyPath = (id) => `notes/${id}.md`;
function sameContent(a, b) {
  if (a == null || b == null) return a == null && b == null;
  const am = a.meta ?? {};
  const bm = b.meta ?? {};
  const eqArr = (x, y) => {
    const xs = Array.isArray(x) ? x : [];
    const ys = Array.isArray(y) ? y : [];
    return xs.length === ys.length && xs.every((v, i) => v === ys[i]);
  };
  return (am.title ?? "") === (bm.title ?? "") && String(a.body ?? "") === String(b.body ?? "") && (am.pinned ?? false) === (bm.pinned ?? false) && (am.color ?? null) === (bm.color ?? null) && (am.type ?? "note") === (bm.type ?? "note") && (am.archived ?? false) === (bm.archived ?? false) && eqArr(am.tags, bm.tags);
}
var docId = (doc) => doc && doc.meta ? doc.meta.id : void 0;
function buildConflictDescriptor({ noteId, base, mine, server, hashes }) {
  const { baseHash, mineHash, serverHash } = hashes;
  return {
    noteId,
    baseHash,
    mineHash,
    serverHash,
    base,
    mine,
    server,
    attachmentsMine: mine?.meta?.attachments ?? [],
    attachmentsServer: server?.meta?.attachments ?? [],
    status: "open",
    path: `conflicts/${noteId}/${baseHash}.${mineHash}.${serverHash}.json`
  };
}
function mergeNoteDocs(base, mine, theirs) {
  if (mine == null) return { value: theirs ?? base ?? null, conflict: false };
  if (theirs == null) return { value: mine, conflict: false };
  if (base != null && sameContent(theirs, base)) {
    return { value: mine, conflict: false };
  }
  const baseBody = base?.body ?? "";
  const bodyMerge = merge3(baseBody, mine.body ?? "", theirs.body ?? "");
  const meta = mergeMeta(base?.meta ?? {}, mine.meta ?? {}, theirs.meta ?? {});
  if (bodyMerge.clean) {
    return { value: { meta, body: bodyMerge.text }, conflict: false };
  }
  return { value: { meta, body: mine.body }, conflict: true };
}
function makeMergeNote(onConflict) {
  return function mergeNote(base, mine, theirs) {
    const { value, conflict } = mergeNoteDocs(base, mine, theirs);
    if (conflict && typeof onConflict === "function") {
      try {
        onConflict({ base, mine, theirs });
      } catch (e) {
      }
    }
    return value;
  };
}
async function conflictDescriptorFor(base, mine, theirs, hashOf) {
  const noteId = docId(mine) ?? docId(theirs) ?? docId(base);
  if (noteId == null) return null;
  const [baseHash, mineHash, serverHash] = await Promise.all([
    base ? hashOf(base.meta, base.body) : Promise.resolve(null),
    hashOf(mine.meta, mine.body),
    hashOf(theirs.meta, theirs.body)
  ]);
  return buildConflictDescriptor({
    noteId,
    base,
    mine,
    server: theirs,
    hashes: { baseHash, mineHash, serverHash }
  });
}

// src/lib/attachment-leases.js
var inflight = /* @__PURE__ */ new Map();
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

// src/lib/store.js
var S = () => window.mobius.storage;
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
    if (e.type !== "file" || !e.name.endsWith(".json")) continue;
    let doc;
    try {
      doc = await S().get(e.path);
    } catch {
      doc = null;
    }
    if (doc && doc.meta && doc.meta.id) out.push({ meta: doc.meta, body: doc.body ?? "" });
  }
  return out;
}
async function writeIndex(notes) {
  return S().set("index.json", buildIndex(notes));
}
async function readIndex() {
  try {
    return await S().get("index.json");
  } catch {
    return null;
  }
}
async function writeConflict(path, descriptor) {
  return S().durableWrite(path, descriptor, { kind: "json" });
}
async function putAttachment(file) {
  const buf = await file.arrayBuffer();
  const sha = await sha256Bytes(buf);
  const ext = extFromType(file.type) || extFromName(file.name) || "bin";
  const path = attachmentPath(sha, ext);
  leaseAttachment(path);
  try {
    await S().setBlob(path, file, { contentType: file.type || "application/octet-stream" });
  } catch (err) {
    releaseAttachment(path);
    throw err;
  }
  return { sha, ext, path, name: file.name || `${sha}.${ext}` };
}
async function gcAttachments(pin = []) {
  let entries;
  try {
    entries = await S().list("attachments");
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
      await S().remove(e.path);
    } catch {
    }
  }
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
var isOnline = () => window.mobius ? window.mobius.online : true;

// src/lib/collection.js
var S2 = () => window.mobius.storage;
function makeChains() {
  const chains = /* @__PURE__ */ new Map();
  return function withChain(key, fn) {
    const prev = chains.get(key) || Promise.resolve();
    const result = prev.then(fn, fn);
    const tail = result.then(() => {
    }, () => {
    });
    chains.set(key, tail);
    tail.then(() => {
      if (chains.get(key) === tail) chains.delete(key);
    });
    return result;
  };
}
function makeNoteCollection({ onConflict } = {}) {
  const withChain = makeChains();
  const bases = /* @__PURE__ */ new Map();
  async function list() {
    let entries;
    try {
      entries = await S2().list("notes");
    } catch {
      return null;
    }
    if (entries == null) return null;
    const out = [];
    for (const e of entries) {
      if (e.type !== "file" || !e.name.endsWith(".json")) continue;
      let doc;
      try {
        doc = await S2().get(e.path);
      } catch {
        doc = null;
      }
      if (doc && doc.meta && doc.meta.id) {
        bases.set(doc.meta.id, doc);
        out.push({ meta: doc.meta, body: doc.body ?? "" });
      }
    }
    return out;
  }
  async function load(id) {
    let doc;
    try {
      doc = await S2().get(notePath(id));
    } catch {
      return null;
    }
    if (!doc || !doc.meta || !doc.meta.id) return null;
    bases.set(id, doc);
    return { meta: doc.meta, body: doc.body ?? "" };
  }
  function ensureBase(id, doc) {
    if (!bases.has(id)) bases.set(id, doc);
  }
  function update(id, fn) {
    const path = notePath(id);
    return withChain(path, async () => {
      const base = bases.get(id) ?? null;
      const mine = fn(base ? { meta: base.meta, body: base.body } : null);
      let theirs = base;
      try {
        theirs = await S2().get(path) ?? base;
      } catch (e) {
      }
      const { value: merged, conflict } = mergeNoteDocs(base, mine, theirs);
      const result = await S2().durableWrite(path, merged, { kind: "json" });
      bases.set(id, merged);
      if (conflict && typeof onConflict === "function") {
        try {
          await onConflict({ base, mine, theirs });
        } catch (e) {
        }
      }
      return { result, value: merged };
    });
  }
  function remove(id) {
    const path = notePath(id);
    return withChain(path, async () => {
      const res = await S2().remove(path);
      try {
        await S2().remove(legacyPath(id));
      } catch {
      }
      bases.delete(id);
      return res;
    });
  }
  return { list, load, update, remove, ensureBase, notePath, docId };
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

// src/lib/migrate.js
var S3 = () => window.mobius.storage;
var idFromMd = (name) => name.endsWith(".md") ? name.slice(0, -3) : null;
async function migrateNote(id) {
  let json;
  try {
    json = await S3().get(notePath(id));
  } catch {
    json = void 0;
  }
  if (json && json.meta && json.meta.id === id) {
    return "already";
  }
  let text;
  try {
    text = await S3().getText(legacyPath(id));
  } catch {
    text = null;
  }
  if (text == null) return "skipped";
  const { meta, body } = parseFrontmatter(text);
  if (!meta || !meta.id) return "skipped";
  let res;
  try {
    res = await S3().durableWrite(notePath(id), { meta, body }, { kind: "json" });
  } catch {
    return "deferred";
  }
  if (res && res.durability === "synced") {
    try {
      await S3().remove(legacyPath(id));
    } catch {
    }
    return "migrated";
  }
  return "queued";
}
async function migrateLegacyNotes() {
  let entries;
  try {
    entries = await S3().list("notes");
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

// src/ui/Card.jsx
import { useState as useState2, useEffect, useRef, useMemo, useCallback } from "react";

// src/lib/preview.js
var _libs;
async function libs() {
  if (!_libs) {
    const [m, d] = await Promise.all([
      import("marked"),
      import("dompurify")
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
import { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { jsx } from "react/jsx-runtime";
var MARGIN = 12;
function ColorPicker({ anchorRef, current, onPick, placement = "above", align = "start" }) {
  const [pos, setPos] = useState(null);
  const width = 4 * 44 + 3 * 8 + 2 * 8;
  const rows = Math.ceil(NOTE_COLORS.length / 4);
  const height = rows * 44 + (rows - 1) * 8 + 2 * 8;
  useLayoutEffect(() => {
    function place() {
      const el = anchorRef && anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const top = placement === "below" ? r.bottom + 6 : r.top - 6 - height;
      let left = align === "end" ? r.right - width : r.left;
      const maxLeft = window.innerWidth - width - MARGIN;
      left = Math.max(MARGIN, Math.min(left, maxLeft));
      setPos({ top: Math.max(MARGIN, top), left });
    }
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [anchorRef, placement, align, height, width]);
  if (!pos) return null;
  return createPortal(
    /* @__PURE__ */ jsx(
      "div",
      {
        role: "menu",
        "aria-label": "Note color",
        onClick: (e) => e.stopPropagation(),
        className: "nt-color-picker",
        style: { top: pos.top, left: pos.left },
        children: NOTE_COLORS.map((c) => /* @__PURE__ */ jsx(
          "button",
          {
            title: c.label,
            "aria-label": c.label,
            onClick: () => onPick(c.name),
            className: [
              "nt-swatch",
              c.name ? `nt-swatch--${c.name}` : "nt-swatch--default",
              // Legacy stored names normalize to a tone so the matching swatch highlights.
              normalizeColorName(current) === c.name ? "is-current" : ""
            ].filter(Boolean).join(" ")
          },
          c.name || "default"
        ))
      }
    ),
    document.body
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
  if (name === "checklist") {
    return /* @__PURE__ */ jsxs("svg", { ...common, children: [
      /* @__PURE__ */ jsx2("polyline", { points: "9 11 12 14 22 4" }),
      /* @__PURE__ */ jsx2("path", { d: "M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" })
    ] });
  }
  if (name === "note") {
    return /* @__PURE__ */ jsxs("svg", { ...common, children: [
      /* @__PURE__ */ jsx2("path", { d: "M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" }),
      /* @__PURE__ */ jsx2("path", { d: "M14 3v6h6" }),
      /* @__PURE__ */ jsx2("line", { x1: "8", y1: "13", x2: "16", y2: "13" }),
      /* @__PURE__ */ jsx2("line", { x1: "8", y1: "17", x2: "12", y2: "17" })
    ] });
  }
  if (name === "check") {
    return /* @__PURE__ */ jsx2("svg", { ...common, children: /* @__PURE__ */ jsx2("polyline", { points: "20 6 9 17 4 12" }) });
  }
  if (name === "search") {
    return /* @__PURE__ */ jsxs("svg", { ...common, children: [
      /* @__PURE__ */ jsx2("circle", { cx: "11", cy: "11", r: "7" }),
      /* @__PURE__ */ jsx2("path", { d: "m20 20-3.5-3.5" })
    ] });
  }
  if (name === "plus") {
    return /* @__PURE__ */ jsxs("svg", { ...common, children: [
      /* @__PURE__ */ jsx2("path", { d: "M12 5v14" }),
      /* @__PURE__ */ jsx2("path", { d: "M5 12h14" })
    ] });
  }
  return null;
}

// src/ui/Card.jsx
import { jsx as jsx3, jsxs as jsxs2 } from "react/jsx-runtime";
function IconBtn({ children, title, onClick, active, danger }) {
  return /* @__PURE__ */ jsx3(
    "button",
    {
      title,
      "aria-label": title,
      onClick: (e) => {
        e.stopPropagation();
        onClick();
      },
      className: `nt-icon-btn${active ? " is-active" : ""}${danger ? " is-danger" : ""}`,
      children
    }
  );
}
var DATE_FORMATTER = new Intl.DateTimeFormat(void 0, { month: "short", day: "numeric" });
function formatCardDate(meta) {
  const raw = meta.updated || meta.created;
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  return DATE_FORMATTER.format(d);
}
function Card({ note, onOpen, onPin, onColor, onDelete, resolveAttachment }) {
  const { meta, body } = note;
  const [html, setHtml] = useState2("");
  const [showColors, setShowColors] = useState2(false);
  const [thumbUrls, setThumbUrls] = useState2([]);
  const [toolsOpen, setToolsOpen] = useState2(false);
  const colorBtnRef = useRef(null);
  const longPressTimer = useRef(null);
  const cardRef = useRef(null);
  const suppressNextClick = useRef(false);
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
  const imageRefs = useMemo(() => localImageRefs(meta, body, 4), [meta, body]);
  const imageRefsKey = imageRefs.join("\n");
  useEffect(() => {
    let live = true;
    let urls = [];
    const refs = imageRefsKey ? imageRefsKey.split("\n") : [];
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
  }, [imageRefsKey, resolveAttachment]);
  useEffect(() => {
    if (!toolsOpen) return void 0;
    const onPointerDown2 = (e) => {
      if (cardRef.current && !cardRef.current.contains(e.target)) {
        setToolsOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown2);
    return () => document.removeEventListener("pointerdown", onPointerDown2);
  }, [toolsOpen]);
  const tone = normalizeColorName(meta.color);
  const empty = !meta.title && !(body || "").trim();
  const isChecklist = meta.type === "checklist";
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
  return /* @__PURE__ */ jsx3("div", { className: "nt-card-wrap", children: /* @__PURE__ */ jsxs2(
    "div",
    {
      ref: cardRef,
      className: `nt-card${tone ? ` nt-card--${tone}` : ""}${toolsOpen ? " nt-card--tools" : ""}`,
      onPointerDown,
      onPointerUp: cancelLongPress,
      onPointerMove: cancelLongPress,
      onPointerCancel: cancelLongPress,
      onPointerLeave: cancelLongPress,
      children: [
        /* @__PURE__ */ jsx3(
          "button",
          {
            title: meta.pinned ? "Unpin" : "Pin",
            "aria-label": meta.pinned ? "Unpin" : "Pin",
            "aria-pressed": meta.pinned,
            onClick: (e) => {
              e.stopPropagation();
              onPin(meta.id);
            },
            className: `nt-card-pin${meta.pinned ? " is-pinned" : ""}`,
            children: /* @__PURE__ */ jsx3(Icon, { name: "pin", size: 14 })
          }
        ),
        /* @__PURE__ */ jsxs2(
          "div",
          {
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
            children: [
              thumbUrls.length > 0 && /* @__PURE__ */ jsx3(
                "div",
                {
                  className: "nt-card-thumbs",
                  style: { gridTemplateColumns: thumbUrls.length === 1 ? "1fr" : "repeat(2, minmax(0, 1fr))" },
                  children: thumbUrls.map((url, index) => /* @__PURE__ */ jsx3(
                    "img",
                    {
                      src: url,
                      alt: "",
                      className: "nt-card-thumb",
                      style: {
                        aspectRatio: thumbUrls.length === 1 ? "16 / 10" : "1 / 1",
                        gridColumn: thumbUrls.length === 3 && index === 0 ? "span 2" : void 0
                      }
                    },
                    url
                  ))
                }
              ),
              /* @__PURE__ */ jsxs2("div", { className: "nt-card-main", children: [
                meta.title && /* @__PURE__ */ jsxs2("div", { className: "nt-card-title", children: [
                  isChecklist && /* @__PURE__ */ jsx3(Icon, { name: "checklist", size: 13 }),
                  /* @__PURE__ */ jsx3("span", { children: meta.title })
                ] }),
                !meta.title && isChecklist && /* @__PURE__ */ jsxs2("div", { className: "nt-card-kicker", children: [
                  /* @__PURE__ */ jsx3(Icon, { name: "checklist", size: 12 }),
                  "Checklist"
                ] }),
                empty ? /* @__PURE__ */ jsx3("div", { className: "nt-card-empty", children: "Empty note" }) : /* @__PURE__ */ jsx3(
                  "div",
                  {
                    className: "note-preview nt-card-preview",
                    dangerouslySetInnerHTML: { __html: html }
                  }
                )
              ] }),
              (tone || cardDate) && /* @__PURE__ */ jsxs2("div", { className: "nt-card-meta", children: [
                tone && /* @__PURE__ */ jsx3("span", { className: "nt-card-tone-dot", "aria-hidden": "true" }),
                cardDate && /* @__PURE__ */ jsx3("span", { className: "nt-card-date", children: cardDate })
              ] })
            ]
          }
        ),
        /* @__PURE__ */ jsxs2("div", { className: "nt-card-footer", children: [
          /* @__PURE__ */ jsxs2("div", { ref: colorBtnRef, className: "nt-color-anchor", children: [
            /* @__PURE__ */ jsx3(IconBtn, { title: "Color", onClick: () => setShowColors((v) => !v), children: /* @__PURE__ */ jsx3(Icon, { name: "palette", size: 16 }) }),
            showColors && /* @__PURE__ */ jsx3(
              ColorPicker,
              {
                anchorRef: colorBtnRef,
                current: meta.color,
                onPick: (c) => {
                  onColor(meta.id, c);
                  setShowColors(false);
                }
              }
            )
          ] }),
          /* @__PURE__ */ jsx3("div", { className: "nt-spacer" }),
          /* @__PURE__ */ jsx3(IconBtn, { title: "Delete", danger: true, onClick: () => onDelete(meta.id), children: /* @__PURE__ */ jsx3(Icon, { name: "trash", size: 15 }) })
        ] })
      ]
    }
  ) });
}

// src/ui/Grid.jsx
import { jsx as jsx4, jsxs as jsxs3 } from "react/jsx-runtime";
function Grid({ notes, onOpen, onPin, onColor, onDelete, resolveAttachment }) {
  const pinned = notes.filter((n) => n.meta.pinned);
  const others = notes.filter((n) => !n.meta.pinned);
  const header = (txt, count) => /* @__PURE__ */ jsxs3("h2", { className: "nt-section-head", children: [
    /* @__PURE__ */ jsx4("span", { children: txt }),
    /* @__PURE__ */ jsxs3("span", { className: "nt-section-count", children: [
      "\xB7 ",
      count
    ] })
  ] });
  const cards = (list) => /* @__PURE__ */ jsx4("div", { className: "nt-cards", children: list.map((n) => /* @__PURE__ */ jsx4(
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
  return /* @__PURE__ */ jsxs3("div", { className: "nt-grid-wrap", children: [
    pinned.length > 0 && /* @__PURE__ */ jsxs3("section", { className: "nt-section", children: [
      header("Pinned", pinned.length),
      cards(pinned)
    ] }),
    others.length > 0 && /* @__PURE__ */ jsxs3("section", { children: [
      header("All notes", others.length),
      cards(others)
    ] })
  ] });
}

// src/ui/EditorPanel.jsx
import { useState as useState3, useEffect as useEffect3, useRef as useRef3, useCallback as useCallback2, useMemo as useMemo2 } from "react";

// src/lib/sdr-image.js
var MAX_DIMENSION = 2048;
var ENCODE_QUALITY = 0.9;
function isBrowserImageEnv() {
  return typeof document !== "undefined" && typeof HTMLCanvasElement !== "undefined" && typeof createImageBitmap === "function";
}
async function decodeImage(file) {
  try {
    return await createImageBitmap(file);
  } catch {
  }
  return await new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async () => {
      try {
        if (img.decode) await img.decode();
      } catch {
      }
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
  const w = source.naturalWidth || source.width || 0;
  const h = source.naturalHeight || source.height || 0;
  return { w, h };
}
function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    if (canvas.toBlob) {
      canvas.toBlob((blob) => resolve(blob), type, quality);
    } else {
      resolve(null);
    }
  });
}
function outputFormat(file) {
  const t = (file.type || "").toLowerCase();
  const mayHaveAlpha = t.includes("png") || t.includes("webp");
  return mayHaveAlpha ? { type: "image/webp", ext: "webp" } : { type: "image/jpeg", ext: "jpeg" };
}
function renameForOutput(originalName, ext) {
  const base = String(originalName || "image").replace(/\.[^./\\]+$/, "");
  return `${base}.${ext}`;
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
    const { type: type2, ext } = outputFormat(file);
    let blob = await canvasToBlob(canvas, type2, ENCODE_QUALITY);
    if (!blob || !blob.size) return file;
    const outName = renameForOutput(file.name, ext);
    try {
      return new File([blob], outName, { type: blob.type || type2 });
    } catch {
      blob.name = outName;
      return blob;
    }
  } catch {
    return file;
  } finally {
    if (source && typeof source.close === "function") {
      try {
        source.close();
      } catch {
      }
    }
  }
}

// src/editor/Editor.jsx
import { useRef as useRef2, useEffect as useEffect2 } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView as EditorView3 } from "@codemirror/view";

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
import { EditorView as EditorView2, keymap } from "@codemirror/view";

// src/editor/livePreview.js
import { syntaxTree } from "@codemirror/language";
import { ViewPlugin, Decoration, EditorView } from "@codemirror/view";
import { StateField } from "@codemirror/state";

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
    img.style.cssText = "max-width:100%; max-height:360px; border-radius:10px; display:block; border:1px solid var(--border); dynamic-range-limit:standard;";
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
    this.url = null;
  }
  eq(o) {
    return o.src === this.src && o.name === this.name;
  }
  toDOM() {
    const a = document.createElement("span");
    a.textContent = `\u{1F4CE} ${this.name}`;
    a.title = this.name;
    a.style.cssText = "display:inline-flex; align-items:center; gap:4px; padding:2px 8px; margin:0 2px; border-radius:8px; border:1px solid var(--border); background:var(--surface2); color:var(--text); font-size:13px; cursor:pointer;";
    a.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.resolve && this.src.startsWith("attachments/")) {
        const u = await this.resolve(this.src).catch(() => null);
        if (u) {
          this.url = u;
          window.open(u, "_blank", "noopener");
        }
      }
    });
    return a;
  }
  destroy() {
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

// src/lib/math-scan.js
var BLOCK_MATH = /\$\$([\s\S]+?)\$\$/g;
var INLINE_MATH = /\$([^$\n]+?)\$/g;
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
    spans.push({ from, to, src: m[1].trim(), block: true });
  }
  const insideBlock = (i) => blocked.some(([a, b]) => i >= a && i < b);
  INLINE_MATH.lastIndex = 0;
  while (m = INLINE_MATH.exec(src)) {
    if (insideBlock(m.index)) continue;
    if (!isInlineMathDelims(m[1])) continue;
    const from = m.index;
    const to = from + m[0].length;
    spans.push({ from, to, src: m[1].trim(), block: false });
  }
  return spans;
}

// src/editor/livePreview.js
var HIDE_MARKS = /* @__PURE__ */ new Set(["HeaderMark", "EmphasisMark", "StrikethroughMark"]);
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
var mathPreview = StateField.define({
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
          const mathSpans = findMathSpans(state.doc.toString());
          const inMath = (from, to) => mathSpans.some((s) => from < s.to && to > s.from);
          const out = [];
          const tree = syntaxTree(state);
          for (const { from, to } of view.visibleRanges) {
            tree.iterate({
              from,
              to,
              enter: (node) => {
                if (inMath(node.from, node.to)) return;
                const name = node.name;
                if (name === "TaskMarker") {
                  if (!onActive(node.from, node.to)) {
                    const text = state.sliceDoc(node.from, node.to);
                    out.push({ from: node.from, to: node.to, deco: Decoration.replace({ widget: new CheckboxWidget(/x/i.test(text), node.from) }) });
                  }
                } else if (name === "Image") {
                  if (!onActive(node.from, node.to)) {
                    const urlChild = node.node.getChild("URL");
                    if (urlChild) {
                      const src = state.sliceDoc(urlChild.from, urlChild.to);
                      const alt = state.sliceDoc(node.from + 2, urlChild.from - 2);
                      out.push({ from: node.from, to: node.to, deco: Decoration.replace({ widget: new ImageWidget(src, alt, resolveAttachment) }) });
                    }
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
var theme = EditorView2.theme({
  "&": { height: "100%", backgroundColor: "transparent", color: "var(--text)" },
  // overscrollBehavior:contain — without it, adding a tall image makes this
  // scroller overscroll-bouncy and Android's overscroll-stretch reveals the
  // (transparent) iframe <html> behind the transparent editor as a warm
  // color-scheme tint over the cards. Matches the .nt-scroll containment.
  // 16px (not 15px): a focusable text surface below 16px triggers iOS Safari
  // zoom-on-focus, which then leaves the whole app frame zoomed. Matches .nt-search.
  ".cm-scroller": { overflow: "auto", overscrollBehavior: "contain", fontFamily: "var(--font)", lineHeight: "1.66", fontSize: "16px" },
  ".cm-content": { padding: "12px 18px 34vh", caretColor: "var(--accent)", maxWidth: "var(--nt-measure)", margin: "0 auto", width: "100%" },
  "&.cm-focused": { outline: "none" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--accent)", borderLeftWidth: "2px" },
  ".cm-selectionBackground": { backgroundColor: "color-mix(in srgb, var(--accent) 22%, transparent)" },
  "&.cm-focused .cm-selectionBackground": { backgroundColor: "color-mix(in srgb, var(--accent) 30%, transparent)" },
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
    EditorView2.lineWrapping,
    livePreview({ resolveAttachment }),
    mathPreview,
    keymap.of([...mdKeymap, indentWithTab, ...historyKeymap, ...defaultKeymap]),
    theme,
    EditorView2.updateListener.of((u) => {
      if (u.docChanged) onDocChange(u.state.doc.toString());
    })
  ];
}

// src/editor/Editor.jsx
import { jsx as jsx5 } from "react/jsx-runtime";
function Editor({ value, onChange, resolveAttachment, viewRef }) {
  const host = useRef2(null);
  const view = useRef2(null);
  const onChangeRef = useRef2(onChange);
  const resolveRef = useRef2(resolveAttachment);
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
    const v = new EditorView3({ state, parent: host.current });
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
var EDITOR_DATE_FORMATTER = new Intl.DateTimeFormat(void 0, { month: "short", day: "numeric" });
function resolveNow(note, appId) {
  try {
    const data = `/data/apps/${appId}`;
    window.parent.postMessage({
      type: "moebius:new-chat",
      draft: `Resolve the Notes merge conflict for note ${note.meta.id}: read the descriptor under ${data}/conflicts/${note.meta.id}/, 3-way-merge mine + server against base (preserve attachment refs), write the result to ${data}/notes/${note.meta.id}.json as a JSON object {"meta":{...},"body":"<merged markdown>"}, then mark the descriptor resolved.`
    }, window.location.origin);
  } catch (e) {
  }
}
function statusClass(status) {
  if (status === "Resolving\u2026") return "is-resolving";
  return "is-default";
}
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
  return `${tasks.length} task${tasks.length === 1 ? "" : "s"} \xB7 ${done} done`;
}
function EditorPanel({ appId, note, onSave, onBack, onPin, onColor, onDelete, resolveAttachment, putAttachment: putAttachment2, conflict, status, forceSave }) {
  const [title, setTitle] = useState3(note.meta.title || "");
  const [body, setBody] = useState3(note.body || "");
  const [showColors, setShowColors] = useState3(false);
  const [attachErr, setAttachErr] = useState3("");
  const timer = useRef3(null);
  const viewRef = useRef3(null);
  const imageRef = useRef3(null);
  const fileRef = useRef3(null);
  const colorBtnRef = useRef3(null);
  const latest = useRef3({ note, title: note.meta.title || "", body: note.body || "" });
  const reconciledBody = useRef3(note.body || "");
  const isChecklist = note.meta.type === "checklist";
  useEffect3(() => {
    if (latest.current.note.meta.id === note.meta.id) {
      latest.current = { note, title, body };
    }
  }, [note, title, body]);
  const flushSave = useCallback2(() => {
    const cur = latest.current;
    if (!cur?.note) return Promise.resolve();
    const liveBody = viewRef.current ? viewRef.current.state.doc.toString() : cur.body;
    if (!forceSave && cur.title === (cur.note.meta.title || "") && liveBody === (cur.note.body || "")) {
      return Promise.resolve();
    }
    if (timer.current) clearTimeout(timer.current);
    const attachments = Array.from(/* @__PURE__ */ new Set([
      ...cur.note.meta.attachments || [],
      ...bodyAttachmentRefs(liveBody)
    ]));
    return Promise.resolve(onSave({ ...cur.note.meta, title: cur.title, attachments }, liveBody));
  }, [onSave, forceSave]);
  useEffect3(() => {
    if (timer.current) clearTimeout(timer.current);
    flushSave().catch(() => {
    });
    latest.current = { note, title: note.meta.title || "", body: note.body || "" };
    reconciledBody.current = note.body || "";
    setTitle(note.meta.title || "");
    setBody(note.body || "");
  }, [note.meta.id]);
  useEffect3(() => {
    if (latest.current.note.meta.id !== note.meta.id) return;
    const incoming = note.body || "";
    const base = reconciledBody.current;
    if (incoming === base) return;
    const v = viewRef.current;
    const mineBuf = v ? v.state.doc.toString() : body;
    const merged = mineBuf === base ? incoming : merge3(base, mineBuf, incoming).text;
    reconciledBody.current = incoming;
    if (v) {
      const cur = v.state.doc.toString();
      if (cur !== merged) {
        const head = v.state.selection.main.head;
        v.dispatch({
          changes: { from: 0, to: cur.length, insert: merged },
          selection: { anchor: Math.min(head, merged.length) }
        });
      } else {
        setBody(merged);
      }
    } else {
      setBody(merged);
    }
  }, [note.body]);
  useEffect3(() => {
    if (title === (note.meta.title || "") && body === (note.body || "")) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      flushSave().catch(() => {
      });
    }, AUTOSAVE_MS);
    return () => clearTimeout(timer.current);
  }, [title, body, flushSave]);
  useEffect3(() => {
    const flushOnHide = () => {
      if (document.visibilityState === "hidden") flushSave().catch(() => {
      });
    };
    const flushOnUnload = () => {
      flushSave().catch(() => {
      });
    };
    document.addEventListener("visibilitychange", flushOnHide);
    window.addEventListener("beforeunload", flushOnUnload);
    return () => {
      document.removeEventListener("visibilitychange", flushOnHide);
      window.removeEventListener("beforeunload", flushOnUnload);
    };
  }, [flushSave]);
  const toggleType = useCallback2(() => {
    const nextType = isChecklist ? "note" : "checklist";
    let nextBody = body;
    if (nextType === "checklist" && body.trim() && !/^- \[[ x]\] /m.test(body)) {
      nextBody = body.replace(/^(.+)/m, "- [ ] $1");
    } else if (nextType === "checklist" && !body.trim()) {
      nextBody = "- [ ] ";
    }
    if (nextBody !== body) setBody(nextBody);
    Promise.resolve(onSave({ ...note.meta, title, type: nextType }, nextBody)).catch(() => {
    });
  }, [isChecklist, body, note.meta, title, onSave]);
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
    if (timer.current) clearTimeout(timer.current);
    const isImage = (f.type || "").startsWith("image/");
    let res;
    let nextBody;
    try {
      const upload = isImage ? await toSdrImage(f) : f;
      res = await putAttachment2(upload);
      const label = String(res.name || "").replace(/[[\]]/g, "");
      const md = isImage ? `
![${label}](${res.path})
` : `[${label}](${res.path})`;
      nextBody = insertMarkdown(md);
    } catch (err) {
      setAttachErr(String(err && err.message || err).includes("limit") ? "File too large (max 25 MB)." : "Could not attach file.");
      setTimeout(() => setAttachErr(""), 3500);
      flushSave().catch(() => {
      });
      return;
    }
    const attachments = Array.from(/* @__PURE__ */ new Set([
      ...note.meta.attachments || [],
      ...bodyAttachmentRefs(nextBody),
      res.path
    ]));
    try {
      await onSave({ ...note.meta, title, attachments }, nextBody);
      releaseAttachment(res.path);
      setAttachErr("");
      window.mobius?.signal?.("attachment_added", { kind: isImage ? "image" : "file", bytes: f.size || 0, flattened: isImage });
    } catch (err) {
    }
  }
  const stranded = useMemo2(() => strandedImageRefs(note.meta, body), [note.meta, body]);
  const strandedKey = stranded.join("\n");
  const [strandedUrls, setStrandedUrls] = useState3([]);
  useEffect3(() => {
    let live = true;
    let urls = [];
    const refs = strandedKey ? strandedKey.split("\n") : [];
    setStrandedUrls([]);
    if (!refs.length || !resolveAttachment) return () => {
    };
    Promise.all(refs.map((ref) => resolveAttachment(ref).catch(() => null))).then((resolved) => {
      const next = resolved.filter(Boolean);
      if (!live) {
        next.forEach((u) => URL.revokeObjectURL(u));
        return;
      }
      urls = next;
      setStrandedUrls(next);
    }).catch(() => {
    });
    return () => {
      live = false;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [strandedKey, resolveAttachment]);
  const tone = normalizeColorName(note.meta.color);
  const count = wordCount(body);
  const tasks = taskSummary(body);
  return /* @__PURE__ */ jsxs4("div", { className: "nt-editor-root", children: [
    /* @__PURE__ */ jsxs4("header", { className: "nt-editor-hdr", children: [
      /* @__PURE__ */ jsxs4("div", { className: "nt-editor-row1", children: [
        /* @__PURE__ */ jsx6(
          "button",
          {
            onClick: async () => {
              try {
                await flushSave();
              } catch {
                return;
              }
              onBack();
            },
            "aria-label": "Back",
            className: "nt-hdr-btn",
            children: /* @__PURE__ */ jsx6(Icon, { name: "back", size: 18 })
          }
        ),
        tone && /* @__PURE__ */ jsx6("span", { className: `nt-color-dot nt-color-dot--${tone}` }),
        /* @__PURE__ */ jsx6("span", { className: "nt-editor-back-label", children: "Notes" }),
        /* @__PURE__ */ jsx6("div", { className: "nt-hdr-spacer" }),
        status && /* @__PURE__ */ jsx6("span", { className: `nt-status ${statusClass(status)}`, children: status })
      ] }),
      /* @__PURE__ */ jsxs4("div", { className: "nt-editor-row2", children: [
        /* @__PURE__ */ jsx6(
          "button",
          {
            onClick: () => onPin(note.meta.id),
            "aria-label": note.meta.pinned ? "Unpin" : "Pin",
            "aria-pressed": note.meta.pinned,
            title: note.meta.pinned ? "Unpin" : "Pin",
            className: `nt-hdr-btn${note.meta.pinned ? " is-active" : ""}`,
            children: /* @__PURE__ */ jsx6(Icon, { name: "pin", size: 16 })
          }
        ),
        /* @__PURE__ */ jsxs4("div", { ref: colorBtnRef, style: { position: "relative", flexShrink: 0 }, children: [
          /* @__PURE__ */ jsx6(
            "button",
            {
              onClick: () => setShowColors((v) => !v),
              "aria-label": "Color",
              title: "Color",
              className: "nt-hdr-btn",
              children: /* @__PURE__ */ jsx6(Icon, { name: "palette", size: 17 })
            }
          ),
          showColors && /* @__PURE__ */ jsx6(
            ColorPicker,
            {
              anchorRef: colorBtnRef,
              placement: "below",
              align: "start",
              current: note.meta.color,
              onPick: (c) => {
                onColor(note.meta.id, c);
                setShowColors(false);
              }
            }
          )
        ] }),
        /* @__PURE__ */ jsx6(
          "button",
          {
            onClick: toggleType,
            "aria-label": isChecklist ? "Switch to note" : "Switch to checklist",
            "aria-pressed": isChecklist,
            title: isChecklist ? "Switch to note" : "Switch to checklist",
            className: `nt-hdr-btn${isChecklist ? " is-active" : ""}`,
            children: /* @__PURE__ */ jsx6(Icon, { name: isChecklist ? "checklist" : "note", size: 16 })
          }
        ),
        /* @__PURE__ */ jsxs4(
          "button",
          {
            onClick: () => imageRef.current && imageRef.current.click(),
            "aria-label": "Insert image",
            title: "Insert image",
            className: "nt-label-btn",
            children: [
              /* @__PURE__ */ jsx6(Icon, { name: "image", size: 16 }),
              "Image"
            ]
          }
        ),
        /* @__PURE__ */ jsxs4(
          "button",
          {
            onClick: () => fileRef.current && fileRef.current.click(),
            "aria-label": "Attach file",
            title: "Attach file",
            className: "nt-label-btn",
            children: [
              /* @__PURE__ */ jsx6(Icon, { name: "file", size: 16 }),
              "File"
            ]
          }
        ),
        /* @__PURE__ */ jsx6("div", { className: "nt-hdr-spacer" }),
        /* @__PURE__ */ jsx6(
          "button",
          {
            onClick: () => onDelete(note.meta.id),
            "aria-label": "Delete",
            title: "Delete",
            className: "nt-hdr-btn is-danger",
            children: /* @__PURE__ */ jsx6(Icon, { name: "trash", size: 16 })
          }
        )
      ] }),
      /* @__PURE__ */ jsx6("input", { ref: imageRef, type: "file", accept: "image/*", onChange: handleFile, style: { display: "none" } }),
      /* @__PURE__ */ jsx6("input", { ref: fileRef, type: "file", onChange: handleFile, style: { display: "none" } })
    ] }),
    conflict && /* @__PURE__ */ jsxs4("div", { className: "nt-conflict-bar", children: [
      /* @__PURE__ */ jsx6("span", { className: "nt-conflict-msg", children: "Edited in two places \u2014 merging\u2026" }),
      /* @__PURE__ */ jsx6("button", { onClick: () => resolveNow(note, appId), className: "nt-conflict-btn", children: "Resolve now" })
    ] }),
    attachErr && /* @__PURE__ */ jsx6("div", { className: "nt-attach-err", children: attachErr }),
    /* @__PURE__ */ jsx6("div", { className: "nt-editor-title-band", children: /* @__PURE__ */ jsx6(
      "input",
      {
        value: title,
        onChange: (e) => setTitle(e.target.value),
        placeholder: "Title",
        "aria-label": "Note title",
        className: "nt-title-input"
      }
    ) }),
    /* @__PURE__ */ jsx6("div", { className: "nt-editor-body", children: /* @__PURE__ */ jsx6(Editor, { value: body, onChange: setBody, resolveAttachment, viewRef }) }),
    /* @__PURE__ */ jsxs4("footer", { className: "nt-editor-foot", "aria-label": "Note metadata", children: [
      /* @__PURE__ */ jsx6("span", { children: editorDate(note.meta) }),
      /* @__PURE__ */ jsxs4("span", { children: [
        count,
        " word",
        count === 1 ? "" : "s"
      ] }),
      tasks && /* @__PURE__ */ jsx6("span", { children: tasks }),
      status && /* @__PURE__ */ jsx6("span", { children: status })
    ] }),
    strandedUrls.length > 0 && /* @__PURE__ */ jsx6("div", { className: "nt-attach-strip", "aria-label": "Attached images", children: strandedUrls.map((u) => /* @__PURE__ */ jsx6("img", { src: u, alt: "", className: "nt-attach-thumb" }, u)) })
  ] });
}

// src/ui/ConfirmModal.jsx
import { useEffect as useEffect4, useId, useRef as useRef4, useCallback as useCallback3 } from "react";
import { jsx as jsx7, jsxs as jsxs5 } from "react/jsx-runtime";
function ConfirmModal({ open, title, message, confirmLabel = "Confirm", danger, onConfirm, onCancel }) {
  const dialogRef = useRef4(null);
  const cancelRef = useRef4(null);
  const openerRef = useRef4(null);
  const titleId = useId();
  useEffect4(() => {
    if (!open) return;
    openerRef.current = document.activeElement;
    cancelRef.current?.focus();
    return () => {
      const opener = openerRef.current;
      if (opener && typeof opener.focus === "function" && document.contains(opener)) {
        opener.focus();
      }
    };
  }, [open]);
  const onKeyDown = useCallback3((e) => {
    if (e.key === "Escape") {
      onCancel();
      return;
    }
    if (e.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
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
  return /* @__PURE__ */ jsx7(
    "div",
    {
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": title ? titleId : void 0,
      onClick: onCancel,
      onKeyDown,
      className: "nt-modal-scrim",
      children: /* @__PURE__ */ jsxs5(
        "div",
        {
          ref: dialogRef,
          onClick: (e) => e.stopPropagation(),
          className: "nt-modal",
          children: [
            title && /* @__PURE__ */ jsx7("h2", { id: titleId, className: "nt-modal-title", children: title }),
            message && /* @__PURE__ */ jsx7("p", { className: "nt-modal-msg", children: message }),
            /* @__PURE__ */ jsxs5("div", { className: "nt-modal-actions", children: [
              /* @__PURE__ */ jsx7("button", { ref: cancelRef, onClick: onCancel, className: "nt-modal-btn nt-modal-cancel", children: "Cancel" }),
              /* @__PURE__ */ jsx7(
                "button",
                {
                  onClick: onConfirm,
                  className: "nt-modal-btn nt-modal-confirm",
                  style: { background: danger ? "var(--danger)" : "var(--accent)" },
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
var NO_DOC = { value: null, status: "idle", lastError: null, update: async () => {
}, set: async () => {
}, refresh: async () => {
} };
var HAS_RUNTIME_DOC = typeof window !== "undefined" && !!(window.mobius && window.mobius.createUseDocument);
var useDocument = HAS_RUNTIME_DOC ? window.mobius.createUseDocument(React) : () => NO_DOC;
function TopBar({ appId, query, onQuery }) {
  return /* @__PURE__ */ jsxs6("header", { className: "nt-topbar", children: [
    /* @__PURE__ */ jsxs6("div", { className: "nt-topbar-row", children: [
      /* @__PURE__ */ jsx8(
        "img",
        {
          src: `/api/apps/${appId}/icon?size=128`,
          alt: "",
          width: 34,
          height: 34,
          className: "nt-brand-icon",
          onError: (e) => {
            e.currentTarget.style.display = "none";
            const f = e.currentTarget.nextElementSibling;
            if (f) f.style.display = "flex";
          }
        }
      ),
      /* @__PURE__ */ jsx8("span", { className: "nt-brand-fallback", style: { display: "none" }, "aria-hidden": "true", children: "\xB7" }),
      /* @__PURE__ */ jsx8("h1", { className: "nt-app-title", children: "Notes" })
    ] }),
    /* @__PURE__ */ jsxs6("label", { className: "nt-search-wrap", children: [
      /* @__PURE__ */ jsx8(Icon, { name: "search", size: 17 }),
      /* @__PURE__ */ jsx8(
        "input",
        {
          value: query,
          onChange: (e) => onQuery(e.target.value),
          placeholder: "Search notes",
          "aria-label": "Search notes",
          className: "nt-search"
        }
      )
    ] })
  ] });
}
function EmptyState({ filtered }) {
  return /* @__PURE__ */ jsxs6("div", { className: "nt-empty", children: [
    /* @__PURE__ */ jsx8("div", { className: "nt-empty-icon", children: /* @__PURE__ */ jsx8(Icon, { name: filtered ? "search" : "note", size: 26 }) }),
    /* @__PURE__ */ jsx8("div", { className: "nt-empty-msg", children: filtered ? "No matching notes" : "No notes yet" }),
    /* @__PURE__ */ jsx8("div", { className: "nt-empty-hint", children: filtered ? "Try another word or clear search to return to your notes." : "Jot a thought, a list, or a draft. Your agent can read and tidy them later." })
  ] });
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
    window.mobius?.signal?.("error", { message: err?.message ?? "render crash", source: "boundary" });
  }
  render() {
    if (this.state.crashed) {
      return /* @__PURE__ */ jsxs6("div", { className: "nt-empty", role: "alert", children: [
        /* @__PURE__ */ jsx8("div", { className: "nt-empty-msg", children: "Something went wrong" }),
        /* @__PURE__ */ jsx8("div", { className: "nt-empty-hint", children: "Close and reopen Notes to recover. Your notes are safe." })
      ] });
    }
    return this.props.children;
  }
};
function App({ appId, token }) {
  useEffect5(() => {
    if (document.querySelector("style[data-nt-katex]")) return void 0;
    let cancelled = false;
    const CSS_URL = "https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.css";
    fetch(`/api/proxy?url=${encodeURIComponent(CSS_URL)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    }).then((r) => {
      if (!r.ok) throw new Error(`KaTeX CSS proxy failed (${r.status})`);
      return r.text();
    }).then((css) => {
      if (cancelled || document.querySelector("style[data-nt-katex]")) return;
      const style = document.createElement("style");
      style.setAttribute("data-nt-katex", "1");
      style.textContent = css;
      document.head.appendChild(style);
    }).catch(() => {
    });
    return () => {
      cancelled = true;
    };
  }, [token]);
  const [notes, setNotes] = useState4([]);
  const [loading, setLoading] = useState4(true);
  const [query, setQuery] = useState4("");
  const [view, setView] = useState4({ mode: "grid", id: null });
  const [draft, setDraft] = useState4(null);
  const [confirmId, setConfirmId] = useState4(null);
  const [conflicts, setConflicts] = useState4(() => /* @__PURE__ */ new Set());
  const [saveError, setSaveError] = useState4(null);
  const [failedSaveIds, setFailedSaveIds] = useState4(() => /* @__PURE__ */ new Set());
  const gcTimer = useRef5(null);
  const editorNavOwned = useRef5(false);
  const openIdRef = useRef5(null);
  const notesRef = useRef5([]);
  const lastWrittenBodyRef = useRef5(/* @__PURE__ */ new Map());
  const [online, setOnline] = useState4(() => isOnline());
  const conflictsRef = useRef5(conflicts);
  useEffect5(() => {
    conflictsRef.current = conflicts;
  }, [conflicts]);
  const onConflict = useCallback4(async (sides) => {
    const id = sides?.mine?.meta?.id ?? sides?.theirs?.meta?.id ?? sides?.base?.meta?.id;
    if (id != null) {
      setConflicts((prev) => prev.has(id) ? prev : new Set(prev).add(id));
    }
    try {
      const d = await conflictDescriptorFor(sides.base, sides.mine, sides.theirs, contentHash);
      if (d) {
        await writeConflict(d.path, d);
        window.mobius?.signal?.("conflict_raised", { note_count: 1 });
      }
    } catch (err) {
      window.mobius?.signal?.("error", { message: err?.message ?? "conflict save failed", source: "onConflict" });
      if (id != null) {
        setConflicts((prev) => prev.has(id) ? prev : new Set(prev).add(id));
        setSaveError({
          id,
          message: "Merge conflict could not be saved for recovery \u2014 your local copy is kept. Reconnect and reopen the note to retry."
        });
      }
    }
  }, []);
  const collection = useMemo3(() => makeNoteCollection({ onConflict }), [onConflict]);
  const openId = view.mode === "editor" ? view.id : null;
  const openPath = openId ? notePath(openId) : "__notes_no_open__.json";
  useEffect5(() => {
    openIdRef.current = openId;
  }, [openId]);
  useEffect5(() => {
    notesRef.current = notes;
  }, [notes]);
  const mergeNote = useMemo3(() => makeMergeNote(onConflict), [onConflict]);
  const liveDoc = useDocument(openPath, {
    initial: null,
    identity: (d) => d && d.meta ? d.meta.id : void 0,
    merge: mergeNote,
    mode: "lww"
  });
  const liveDocRef = useRef5(liveDoc);
  liveDocRef.current = liveDoc;
  useEffect5(() => {
    if (openId && liveDoc.lastError) {
      setSaveError({ id: openId, message: "Could not save \u2014 your edit is kept. Retrying when possible." });
      setFailedSaveIds((s) => s.has(openId) ? s : new Set(s).add(openId));
    }
  }, [openId, liveDoc.lastError]);
  useEffect5(() => {
    const v = liveDoc.value;
    if (!openId || !v || !v.meta || v.meta.id !== openId) return;
    setNotes((prev) => {
      const cur = prev.find((n) => n.meta.id === openId);
      if (cur && cur.body === v.body && cur.meta.content_hash === v.meta.content_hash) return prev;
      return prev.map((n) => n.meta.id === openId ? { meta: v.meta, body: v.body } : n);
    });
  }, [openId, liveDoc.value]);
  useEffect5(() => {
    if (!openId) return;
    const id = openId;
    const path = notePath(id);
    const unsub = window.mobius?.storage?.subscribe?.(path, (doc) => {
      if (!doc || !doc.meta || doc.meta.id !== id) return;
      const body = doc.body ?? "";
      const known = lastWrittenBodyRef.current.get(id);
      if (known === void 0) {
        lastWrittenBodyRef.current.set(id, body);
        return;
      }
      if (known === body) return;
      lastWrittenBodyRef.current.set(id, body);
      if (conflictsRef.current.has(id)) {
        window.mobius?.signal?.("conflict_resolved", { resolved_by: "external" });
      }
      setConflicts((prev) => {
        if (!prev.has(id)) return prev;
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
    });
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [openId]);
  const upsert = useCallback4((meta, body) => {
    setNotes((prev) => prev.some((n) => n.meta.id === meta.id) ? prev.map((n) => n.meta.id === meta.id ? { meta, body } : n) : [{ meta, body }, ...prev]);
  }, []);
  const scheduleGc = useCallback4(() => {
    if (gcTimer.current) clearTimeout(gcTimer.current);
    gcTimer.current = setTimeout(() => {
      const open = openIdRef.current;
      const cur = open ? notesRef.current.find((n) => n.meta.id === open) : null;
      const pin = cur ? [...cur.meta.attachments || [], ...bodyAttachmentRefs(cur.body || "")] : [];
      gcAttachments(pin).catch(() => {
      });
    }, 1500);
  }, []);
  useEffect5(() => {
    let live = true;
    (async () => {
      await migrateLegacyNotes().catch(() => {
      });
      readIndex().then((index) => {
        const cached = notesFromIndex(index);
        if (live && cached.length) {
          setNotes((prev) => prev.length ? prev : cached);
          setLoading(false);
        }
      }).catch(() => {
      });
      const canonical = await collection.list().catch(() => null);
      if (!live) return;
      setLoading(false);
      if (canonical == null) {
        window.mobius?.signal?.("app_ready", { item_count: notesRef.current.length, offline: true });
      } else {
        setNotes(canonical);
        window.mobius?.signal?.("app_ready", { item_count: canonical.length, offline: false });
      }
    })();
    return () => {
      live = false;
    };
  }, [collection]);
  useEffect5(() => {
    const goOnline = () => {
      setOnline(true);
      collection.list().then((canonical) => {
        if (canonical != null) {
          setNotes(canonical);
          setLoading(false);
        }
      }).catch(() => {
      });
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [collection]);
  useEffect5(() => {
    if (loading) return;
    writeIndex(notes).catch(() => {
    });
  }, [notes, loading]);
  useEffect5(() => () => {
    if (gcTimer.current) clearTimeout(gcTimer.current);
  }, []);
  const pushEditorNav = useCallback4(() => {
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
  const popEditorNav = useCallback4(() => {
    if (!editorNavOwned.current || typeof window === "undefined" || !window.parent) return;
    editorNavOwned.current = false;
    try {
      window.parent.postMessage({ type: "moebius:nav-pop" }, window.location.origin);
    } catch {
    }
  }, []);
  const ensureAuthoritative = useCallback4(async (id) => {
    const cur = notes.find((n) => n.meta.id === id);
    if (!cur) return null;
    if (!cur.placeholder) return cur;
    const loaded = await collection.load(id).catch(() => null);
    if (!loaded || !loaded.meta || !loaded.meta.id) return null;
    setNotes((prev) => prev.map((n) => n.meta.id === id ? loaded : n));
    return loaded;
  }, [notes, collection]);
  const openEditor = useCallback4(async (id) => {
    const cur = notes.find((n) => n.meta.id === id);
    window.mobius?.signal?.("item_opened", { type: cur?.meta?.type || "note" });
    setSaveError((e) => e && failedSaveIds.has(e.id) ? e : null);
    if (cur && cur.placeholder && !await ensureAuthoritative(id)) {
      setSaveError({ id, message: "This note is not cached yet. Reconnect to open it." });
      return;
    }
    if (view.mode === "editor") {
      setView({ mode: "editor", id });
      return;
    }
    editorNavOwned.current = await pushEditorNav();
    setView({ mode: "editor", id });
  }, [ensureAuthoritative, notes, pushEditorNav, view.mode, failedSaveIds]);
  const createNote = useCallback4(() => {
    const meta = newNote({});
    setDraft({ meta, body: "" });
    openEditor(meta.id).catch(() => setView({ mode: "editor", id: meta.id }));
  }, [openEditor]);
  const writeNote = useCallback4(async (meta, body, { isDraftCommit = false } = {}) => {
    const id = meta.id;
    const m = { ...meta, updated: meta.updated || (/* @__PURE__ */ new Date()).toISOString() };
    m.content_hash = await contentHash(m, body);
    lastWrittenBodyRef.current.set(id, body ?? "");
    upsert(m, body);
    const writeThroughHook = HAS_RUNTIME_DOC && openId === id;
    try {
      let result;
      if (writeThroughHook) {
        result = await liveDocRef.current.update(() => ({ meta: m, body }));
      } else {
        ;
        ({ result } = await collection.update(id, () => ({ meta: m, body })));
      }
      setSaveError((e) => e && e.id === id ? null : e);
      setFailedSaveIds((s) => {
        if (!s.has(id)) return s;
        const n = new Set(s);
        n.delete(id);
        return n;
      });
      if (isDraftCommit) {
        setDraft(null);
        window.mobius?.signal?.("item_created", { type: m.type || "note" });
      } else {
        window.mobius?.signal?.("item_updated", { type: m.type || "note", durability: result?.durability });
      }
      scheduleGc();
      return m;
    } catch (err) {
      window.mobius?.signal?.("error", { message: err?.message ?? "save failed", source: "writeNote" });
      setSaveError({ id, message: "Could not save \u2014 your edit is kept. Retrying when possible." });
      setFailedSaveIds((s) => s.has(id) ? s : new Set(s).add(id));
      throw err;
    }
  }, [openId, upsert, collection, scheduleGc]);
  const persist = useCallback4(async (meta, body) => {
    if (draft && draft.meta.id === meta.id) {
      const next = { meta: { ...draft.meta, ...meta }, body };
      setDraft(next);
      if (isBlankNote(next.meta, next.body)) return;
      await writeNote(next.meta, next.body, { isDraftCommit: true });
      return;
    }
    const prev = notes.find((n) => n.meta.id === meta.id);
    if (prev && prev.placeholder) return;
    const nextHash = await contentHash(meta, body);
    const prevHash = prev ? await contentHash(prev.meta, prev.body) : null;
    if (!failedSaveIds.has(meta.id) && prevHash != null && nextHash === prevHash) return;
    await writeNote({ ...meta, updated: (/* @__PURE__ */ new Date()).toISOString() }, body);
  }, [draft, notes, writeNote, failedSaveIds]);
  const togglePin = useCallback4(async (id) => {
    if (draft && draft.meta.id === id) {
      setDraft((d) => ({ ...d, meta: { ...d.meta, pinned: !d.meta.pinned } }));
      return;
    }
    const n = await ensureAuthoritative(id);
    if (n) persist({ ...n.meta, pinned: !n.meta.pinned }, n.body).catch(() => {
    });
  }, [draft, ensureAuthoritative, persist]);
  const setColor = useCallback4(async (id, color) => {
    if (draft && draft.meta.id === id) {
      setDraft((d) => ({ ...d, meta: { ...d.meta, color } }));
      return;
    }
    const n = await ensureAuthoritative(id);
    if (n) persist({ ...n.meta, color }, n.body).catch(() => {
    });
  }, [draft, ensureAuthoritative, persist]);
  const queueDelete = useCallback4(async (id) => {
    await collection.remove(id).catch(() => {
    });
    setConflicts((prev) => {
      if (!prev.has(id)) return prev;
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
    scheduleGc();
  }, [collection, scheduleGc]);
  const doDelete = useCallback4((id) => {
    if (draft && draft.meta.id === id) {
      if (view.mode === "editor" && view.id === id) popEditorNav();
      setDraft(null);
      setConfirmId(null);
      setView({ mode: "grid" });
      return;
    }
    const n = notes.find((x) => x.meta.id === id);
    if (n) {
      window.mobius?.signal?.("item_deleted", { type: n.meta.type || "note" });
      queueDelete(id).catch(() => {
      });
    }
    setNotes((prev) => prev.filter((note) => note.meta.id !== id));
    setConfirmId(null);
    setView((v) => {
      if (v.mode === "editor" && v.id === id) {
        popEditorNav();
        return { mode: "grid" };
      }
      return v;
    });
  }, [draft, notes, popEditorNav, queueDelete, view.id, view.mode]);
  const back = useCallback4((fromShell = false) => {
    if (!fromShell) popEditorNav();
    else editorNavOwned.current = false;
    if (draft && draft.meta.id === view.id) {
      setDraft(null);
      setView({ mode: "grid" });
      return;
    }
    const n = notes.find((x) => x.meta.id === view.id);
    if (n && !n.placeholder && isBlankNote(n.meta, n.body)) {
      queueDelete(n.meta.id).catch(() => {
      });
      setNotes((prev) => prev.filter((x) => x.meta.id !== n.meta.id));
    }
    setView({ mode: "grid" });
  }, [draft, notes, popEditorNav, view.id, queueDelete]);
  useEffect5(() => {
    const onMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "moebius:nav-back") back(true);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [back]);
  const visible = useMemo3(() => visibleNotes(notes, query), [notes, query]);
  useEffect5(() => {
    const q = query.trim();
    if (loading || !q || visible.length > 0) return void 0;
    const h = setTimeout(() => {
      window.mobius?.signal?.("search_no_results", { query_len: q.length });
    }, 700);
    return () => clearTimeout(h);
  }, [query, visible.length, loading]);
  const editing = view.mode === "editor" ? notes.find((n) => n.meta.id === view.id && !n.placeholder) || (draft && draft.meta.id === view.id ? draft : null) : null;
  const status = saveError && editing && saveError.id === editing.meta.id ? "Save failed" : !online ? "Offline" : editing && conflicts.has(editing.meta.id) ? "Resolving\u2026" : null;
  return /* @__PURE__ */ jsxs6("div", { className: "nt-root", children: [
    /* @__PURE__ */ jsx8("style", { children: CSS }),
    /* @__PURE__ */ jsxs6(ErrorBoundary, { children: [
      /* @__PURE__ */ jsx8(TopBar, { appId, query, onQuery: setQuery }),
      !editing && saveError && /* @__PURE__ */ jsxs6("div", { className: "nt-save-err", role: "alert", "aria-live": "assertive", children: [
        /* @__PURE__ */ jsx8("span", { className: "nt-save-err-msg", children: saveError.message }),
        /* @__PURE__ */ jsx8(
          "button",
          {
            className: "nt-save-err-btn",
            onClick: () => setSaveError(null),
            "aria-label": "Dismiss save error",
            children: "Dismiss"
          }
        )
      ] }),
      /* @__PURE__ */ jsx8("main", { className: "nt-scroll", children: loading ? /* @__PURE__ */ jsxs6("div", { className: "nt-loading", role: "status", "aria-live": "polite", children: [
        /* @__PURE__ */ jsx8("span", { className: "nt-spinner", "aria-hidden": "true" }),
        /* @__PURE__ */ jsx8("span", { children: "Loading\u2026" })
      ] }) : visible.length === 0 ? /* @__PURE__ */ jsx8(EmptyState, { filtered: !!query.trim() }) : /* @__PURE__ */ jsx8(
        Grid,
        {
          notes: visible,
          onOpen: (id) => {
            openEditor(id).catch(() => setView({ mode: "editor", id }));
          },
          onPin: togglePin,
          onColor: setColor,
          onDelete: setConfirmId,
          resolveAttachment: attachmentURL
        }
      ) }),
      view.mode !== "editor" && /* @__PURE__ */ jsx8(
        "button",
        {
          className: "nt-fab",
          onClick: createNote,
          "aria-label": "New note",
          title: "New note",
          children: /* @__PURE__ */ jsx8(Icon, { name: "plus", size: 24 })
        }
      ),
      editing && /* @__PURE__ */ jsx8(
        EditorPanel,
        {
          appId,
          note: editing,
          onSave: persist,
          onBack: back,
          onPin: togglePin,
          onColor: setColor,
          onDelete: setConfirmId,
          resolveAttachment: attachmentURL,
          putAttachment,
          conflict: conflicts.has(editing.meta.id),
          status,
          forceSave: failedSaveIds.has(editing.meta.id)
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
      ),
      !online && view.mode !== "editor" && /* @__PURE__ */ jsx8("div", { className: "nt-sync-pill", role: "status", children: "Offline" })
    ] })
  ] });
}
export default App;
