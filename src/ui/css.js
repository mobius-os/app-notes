// Module-level CSS for the Notes app. Injected once as <style>{CSS}</style>
// at the nt-root level. Uses shell theme tokens (var(--bg), var(--text), …)
// so the app follows light/dark switches without a page reload.
//
// Class prefix: nt-  (Notes)
// Per-note color tones are CSS classes (nt-card--<tone> etc.) generated below
// from the NOTE_COLORS palette, blended into theme tokens with color-mix so the
// tones track light/dark switches. No per-note inline color styles remain.

import { NOTE_COLORS } from './colors.js'

// One block per tone: card surface + border, footer divider, picker swatch,
// editor-header dot. The tone hex is mixed INTO the theme tokens rather than
// painted raw, which is what keeps the palette muted on any theme.
const TONE_CSS = NOTE_COLORS.filter((c) => c.name).map((c) => `
  .nt-card--${c.name} {
    --nt-note-tone: ${c.hex};
    background: color-mix(in srgb, var(--nt-note-tone) 14%, var(--surface));
    border-color: color-mix(in srgb, var(--nt-note-tone) 36%, var(--border));
  }
.nt-swatch--${c.name} { background: ${c.hex}; }
.nt-color-dot--${c.name},
.nt-card--${c.name} .nt-card-tone-dot { background: color-mix(in srgb, var(--nt-note-tone) 72%, var(--surface)); }`).join('\n')

export const CSS = `
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
  display: flex; flex-direction: column; gap: 12px;
  /* top-pinned bar: pad past the notch/status bar on notched phones */
  padding: max(14px, var(--nt-safe-top)) max(18px, var(--nt-safe-right)) 12px max(18px, var(--nt-safe-left));
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
/* FAB — floating action button, bottom-right, above gesture bar */
.nt-fab {
  position: fixed;
  right: max(20px, var(--nt-safe-right));
  bottom: max(24px, var(--nt-safe-bottom));
  z-index: 20;
  width: 54px; height: 54px;
  border-radius: 18px;
  /* --accent-fg is the one legal foreground on an accent fill — a custom light
     accent theme may set it dark, so do not add a fallback literal. */
  border: none; background: var(--accent-hover, var(--accent)); color: var(--accent-fg);
  display: inline-flex; align-items: center; justify-content: center;
  cursor: pointer; font-family: var(--font);
  box-shadow: 0 6px 12px color-mix(in srgb, var(--accent) 18%, transparent),
              0 1px 2px color-mix(in srgb, var(--text) 16%, transparent);
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation; user-select: none;
  transition: filter 0.14s ease, transform 0.12s ease, box-shadow 0.14s ease;
}
.nt-fab[hidden] { display: none; }
@media (hover: hover) { .nt-fab:hover { filter: brightness(0.94); transform: scale(1.04); } }
.nt-fab:active { transform: scale(0.93); }
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
  padding: 18px max(18px, var(--nt-safe-right)) max(126px, calc(102px + var(--nt-safe-bottom))) max(18px, var(--nt-safe-left));
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
/* /mobius-ui:Empty */

/* ── Grid ───────────────────────────────────────────────────────────────── */
.nt-grid-wrap {
  /* bottom pad clears the gesture bar and FAB on Android/notched iPhones */
  padding: 18px max(18px, var(--nt-safe-right)) max(126px, calc(102px + var(--nt-safe-bottom))) max(18px, var(--nt-safe-left));
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
.nt-editor-sheet.is-locked .cm-content { cursor: default; }
/* mobius-ui:SyncPill v1 (editor variant) — keep in sync; library candidate. */
.nt-status {
  font-size: 12px; white-space: nowrap; margin-right: 2px; flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}
/* Online+idle: nothing shown (standard). Resolving uses accent; others muted. */
.nt-status.is-resolving { color: var(--nt-accent-ink); }
.nt-status.is-default { color: var(--muted); }
/* /mobius-ui:SyncPill */
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
  border: 1px solid var(--nt-accent-ink); background: transparent; color: var(--nt-accent-ink);
  border-radius: 8px; padding: 4px 12px; font-size: 12px; cursor: pointer;
  flex-shrink: 0; font-family: var(--font);
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
}
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
   counts), plain "Offline" copy. Positioned bottom-LEFT so it never collides
   with the bottom-right FAB. Absolute to .nt-root (which is position:relative),
   never fixed — a fixed overlay could paint over the shell chrome. */
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
${TONE_CSS}

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
`
