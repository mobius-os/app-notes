// Module-level CSS for the Notes app. Injected once as <style>{CSS}</style>
// at the nt-root level. Uses shell theme tokens (var(--bg), var(--text), …)
// so the app follows light/dark switches without a page reload.
//
// Class prefix: nt-  (Notes)
// Inline style={} props remain ONLY for genuinely dynamic per-note values:
//   - card tint gradient/border (depends on per-note color name → hex at render)
//   - color bar background
//   - color dot in editor header
//   - swatch backgrounds in ColorPicker

export const CSS = `
/* mobius-ui:Root v1 — keep in sync; library candidate. Diverge below the marker only. */
.nt-root {
  position: relative;
  display: flex; flex-direction: column;
  height: 100%; width: 100%; max-width: 100%;
  overflow: hidden;
  background: var(--bg); color: var(--text); font-family: var(--font);
  -webkit-font-smoothing: antialiased;
}
.nt-scroll {
  flex: 1; min-height: 0;
  overflow-y: auto; overflow-x: hidden;
  overscroll-behavior: contain;
  word-break: break-word; overflow-wrap: anywhere;
}
/* /mobius-ui:Root */

/* mobius-ui:Focus v1 — shared keyboard focus ring (WCAG 2.4.7); never bare outline:none */
:where(button,a,input,textarea,select,summary,[role="button"],[tabindex]:not([tabindex="-1"])):focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
/* /mobius-ui:Focus */

/* ── TopBar ─────────────────────────────────────────────────────────────── */
/* mobius-ui:Header v1 — keep in sync; library candidate. Diverge below the marker only. */
.nt-topbar {
  display: flex; align-items: center; gap: 12px;
  /* top-pinned bar: pad past the notch/status bar on notched phones */
  padding: max(12px, env(safe-area-inset-top)) 16px 12px;
  border-bottom: 1px solid var(--border);
  position: sticky; top: 0;
  background: var(--bg); z-index: 5;
  flex: 0 0 auto;
}
.nt-title {
  font-size: 18px; font-weight: 650; color: var(--text);
  letter-spacing: -0.01em; margin: 0; user-select: none;
}
/* Search pill — full-width rounded pill */
.nt-search-wrap {
  flex: 1; display: flex; justify-content: center;
}
.nt-search {
  width: 100%;
  padding: 9px 16px; border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface2, var(--surface)); color: var(--text);
  font-size: 15px; font-family: var(--font);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
/* mouse focus uses the accent border; keyboard focus keeps the shared ring */
.nt-search:focus:not(:focus-visible) { outline: none; }
.nt-search:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent);
}
.nt-search::placeholder { color: var(--muted); }
/* FAB — floating action button, bottom-right, above gesture bar */
.nt-fab {
  position: fixed;
  right: max(20px, env(safe-area-inset-right, 0px));
  bottom: max(24px, env(safe-area-inset-bottom, 0px));
  z-index: 20;
  width: 56px; height: 56px;
  border-radius: 50%;
  border: none; background: var(--accent); color: #ffffff;
  font-size: 28px; line-height: 1;
  display: inline-flex; align-items: center; justify-content: center;
  cursor: pointer; font-family: var(--font);
  box-shadow: 0 4px 16px color-mix(in srgb, var(--accent) 55%, transparent),
              0 1px 4px rgba(0,0,0,0.25);
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation; user-select: none;
  transition: filter 0.14s ease, transform 0.12s ease, box-shadow 0.14s ease;
}
@media (hover: hover) { .nt-fab:hover { filter: brightness(1.08); transform: scale(1.04); } }
.nt-fab:active { transform: scale(0.93); }
/* /mobius-ui:Header */

/* ── Loading / Empty ────────────────────────────────────────────────────── */
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
/* mobius-ui:Empty v1 — keep in sync; library candidate. Diverge below the marker only. */
.nt-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 8px; padding: 18vh 24px; text-align: center; color: var(--muted);
}
.nt-empty-icon { opacity: 0.5; }
.nt-empty-msg { font-size: 15px; }
.nt-empty-hint { font-size: 13px; opacity: 0.8; }
/* /mobius-ui:Empty */

/* ── Grid ───────────────────────────────────────────────────────────────── */
.nt-grid-wrap {
  /* bottom pad clears the gesture bar and FAB on Android/notched iPhones */
  padding: 16px 8px max(96px, calc(72px + env(safe-area-inset-bottom)));
  max-width: 1120px; margin: 0 auto;
}
.nt-section { margin-bottom: 18px; }
/* mobius-ui:SectionHead v1 — keep in sync; library candidate. */
.nt-section-head {
  font-size: 11px; font-weight: 700; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--muted);
  margin: 4px 8px 10px; user-select: none;
}
/* /mobius-ui:SectionHead */
/* Masonry-style grid: content-height cards, no fixed row sizes */
.nt-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  grid-auto-rows: min-content;
  gap: 10px;
}

/* ── Card ───────────────────────────────────────────────────────────────── */
/* mobius-ui:Card v1 — keep in sync; library candidate. Diverge below the marker only. */
.nt-card-wrap { /* grid item — no extra margin needed with gap */ }
.nt-card {
  position: relative;
  border-radius: 10px; overflow: hidden;
  /* background + border are dynamic (per-note tint) — set via inline style */
  transition: box-shadow 0.14s ease, transform 0.1s ease;
}
@media (hover: hover) {
  .nt-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.12); transform: translateY(-1px); }
}
.nt-card:active { transform: scale(0.985); }
.nt-card-body {
  cursor: pointer; padding: 12px 14px 8px;
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
}
.nt-card-body:active { opacity: 0.85; }
/* Title darkened to contrast against the full card tint background */
.nt-card-title {
  font-size: 14px; font-weight: 700; color: var(--text);
  margin-bottom: 5px; overflow-wrap: anywhere;
}
.nt-card-empty {
  font-size: 13px; color: var(--muted); opacity: 0.6; font-style: italic;
}
/* Preview slightly muted over the tinted background */
.nt-card-preview {
  font-size: 13px; color: var(--text); opacity: 0.72; line-height: 1.5;
  max-height: 180px; overflow: hidden;
}
.nt-card-thumbs {
  display: grid; gap: 6px; margin-bottom: 8px;
}
.nt-card-thumb {
  width: 100%; object-fit: cover; display: block; border-radius: 6px;
}
/* /mobius-ui:Card */

/* ── Card pin button (top-right) ────────────────────────────────────────── */
.nt-card-pin {
  position: absolute; top: 6px; right: 6px;
  width: 32px; height: 32px;
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

/* ── Card toolbar — shown on hover/focus; toggled via .nt-card--tools ────── */
.nt-card-footer {
  display: flex; align-items: center; gap: 2px;
  padding: 4px 6px;
  /* border-top + background are dynamic (per-note tint) — set via inline style */
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
.note-preview code { font-family: var(--mono); font-size: 12px; background: rgba(128,128,128,0.15); border-radius: 3px; padding: 0 3px; }
.note-preview pre { margin: 0 0 6px; font-size: 12px; overflow: hidden; }
.note-preview ul, .note-preview ol { margin: 0 0 6px; padding-left: 18px; }
.note-preview li { margin-bottom: 2px; }

/* ── Card toolbar buttons ─────────────────────────────────────────────── */
/* mobius-ui:Button v1 — keep in sync; library candidate. Diverge below the marker only. */
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

/* ── ColorPicker ────────────────────────────────────────────────────────── */
.nt-color-picker {
  position: fixed; z-index: 1000;
  display: grid; grid-template-columns: repeat(4, 44px); gap: 8px;
  max-width: calc(100vw - 24px); padding: 8px;
  background: var(--surface2, var(--surface));
  border: 1px solid var(--border); border-radius: 8px;
  box-shadow: 0 8px 24px var(--scrim, rgba(0,0,0,0.4));
}
.nt-swatch {
  width: 44px; height: 44px; border-radius: 9px;
  cursor: pointer; padding: 0;
  /* border and background set via inline style (dynamic per swatch) */
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
  transition: transform 0.1s ease;
}
.nt-swatch:active { transform: scale(0.9); }
@media (hover: hover) { .nt-swatch:hover { transform: scale(1.1); } }

/* ── ConfirmModal ───────────────────────────────────────────────────────── */
/* mobius-ui:Sheet v1 — keep in sync; library candidate. Diverge below the marker only. */
.nt-modal-scrim {
  position: fixed; inset: 0; z-index: 50;
  display: flex; align-items: center; justify-content: center; padding: 20px;
  background: var(--scrim, rgba(0,0,0,0.55)); backdrop-filter: blur(2px);
}
.nt-modal {
  width: 100%; max-width: 360px;
  background: var(--surface);
  border: 1px solid var(--border); border-radius: 16px; padding: 20px;
  box-shadow: 0 12px 40px var(--scrim, rgba(0,0,0,0.5));
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
  border: none; color: #ffffff; font-weight: 600;
  /* on-accent/on-danger text matches the + New button (shell standardizes white) */
  /* background set via inline style: var(--danger) or var(--accent) */
}
/* /mobius-ui:Sheet */

/* ── EditorPanel ────────────────────────────────────────────────────────── */
.nt-editor-root {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  background: var(--bg); z-index: 10;
}
/* mobius-ui:Header v1 — keep in sync; library candidate. Diverge below the marker only. */
.nt-editor-hdr {
  padding: 8px 10px 9px;
  border-bottom: 1px solid var(--border);
  display: flex; flex-direction: column; gap: 7px; flex: 0 0 auto;
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
/* mobius-ui:Button v1 — keep in sync; library candidate. Diverge below the marker only. */
.nt-hdr-btn {
  width: 44px; height: 44px;
  display: inline-flex; align-items: center; justify-content: center;
  border: none; border-radius: 9px;
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
  /* width/height/border-radius/background set via inline style (dynamic per note) */
  flex-shrink: 0;
}
.nt-title-input {
  flex: 1; min-width: 0;
  padding: 7px 6px; border: none;
  background: transparent; color: var(--text);
  font-size: 17px; font-weight: 650; font-family: var(--font);
}
/* mouse focus is borderless by design; keyboard focus keeps the shared ring */
.nt-title-input:focus:not(:focus-visible) { outline: none; }
.nt-title-input::placeholder { color: var(--muted); }
/* mobius-ui:SyncPill v1 (editor variant) — keep in sync; library candidate. */
.nt-status {
  font-size: 12px; white-space: nowrap; margin-right: 2px; flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}
.nt-status.is-synced { color: var(--green); }
.nt-status.is-resolving { color: var(--accent); }
.nt-status.is-default { color: var(--muted); }
/* /mobius-ui:SyncPill */
.nt-label-btn {
  height: 44px;
  display: inline-flex; align-items: center; justify-content: center;
  gap: 6px; border: 1px solid var(--border); border-radius: 8px; padding: 0 10px;
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
  border: 1px solid var(--accent); background: transparent; color: var(--accent);
  border-radius: 8px; padding: 4px 10px; font-size: 12px; cursor: pointer;
  font-family: var(--font);
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
}
.nt-attach-err {
  padding: 8px 16px;
  background: color-mix(in srgb, var(--danger) 14%, transparent);
  color: var(--danger); font-size: 13px; flex: 0 0 auto;
}
.nt-editor-body { flex: 1; overflow: hidden; }

/* ── Inline capture widget (Keep-style "Take a note…" at grid top) ──────── */
.nt-capture-wrap {
  padding: 0 8px 12px;
  max-width: 1120px; margin: 0 auto;
}
/* Collapsed state: single-row affordance */
.nt-capture-pill {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 16px; border-radius: 12px;
  background: var(--surface); border: 1px solid var(--border);
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  cursor: text;
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
  transition: box-shadow 0.14s ease;
}
@media (hover: hover) { .nt-capture-pill:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.14); } }
.nt-capture-placeholder {
  flex: 1; font-size: 15px; color: var(--muted); user-select: none;
}
.nt-capture-type-toggle {
  width: 44px; height: 44px; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  border: none; border-radius: 9px;
  background: transparent; color: var(--muted);
  cursor: pointer; font-family: var(--font);
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
  transition: background 0.12s ease;
}
@media (hover: hover) { .nt-capture-type-toggle:hover { background: color-mix(in srgb, var(--accent) 10%, transparent); } }
.nt-capture-type-toggle.is-checklist { color: var(--accent); }

/* Expanded state: inline card */
.nt-capture-card {
  border-radius: 12px;
  background: var(--surface); border: 1px solid var(--border);
  box-shadow: 0 2px 12px rgba(0,0,0,0.12);
}
.nt-capture-title {
  width: 100%;
  padding: 12px 16px 0;
  border: none; background: transparent; color: var(--text);
  font-size: 15px; font-weight: 650; font-family: var(--font);
}
.nt-capture-title:focus { outline: none; }
.nt-capture-title::placeholder { color: var(--muted); font-weight: 400; }
.nt-capture-body {
  width: 100%;
  padding: 8px 16px;
  border: none; background: transparent; color: var(--text);
  font-size: 14px; font-family: var(--font); line-height: 1.55;
  resize: none; min-height: 72px; max-height: 280px;
  overflow-y: auto;
}
.nt-capture-body:focus { outline: none; }
.nt-capture-body::placeholder { color: var(--muted); }
.nt-capture-footer {
  display: flex; align-items: center; gap: 4px;
  padding: 4px 8px; border-top: 1px solid var(--border);
}
.nt-capture-done {
  margin-left: auto;
  height: 36px; padding: 0 14px;
  border: none; border-radius: 8px;
  background: var(--accent); color: #fff;
  font-size: 13px; font-weight: 600; font-family: var(--font);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
  transition: filter 0.12s ease;
}
@media (hover: hover) { .nt-capture-done:hover { filter: brightness(1.08); } }

/* ── Label / tag filter chips ────────────────────────────────────────────── */
.nt-chips-wrap {
  padding: 0 8px 10px;
  max-width: 1120px; margin: 0 auto;
  display: flex; gap: 6px; overflow-x: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
}
.nt-chips-wrap::-webkit-scrollbar { display: none; }
.nt-chip {
  display: inline-flex; align-items: center; gap: 4px;
  height: 32px; padding: 0 12px;
  border-radius: 999px; border: 1px solid var(--border);
  background: transparent; color: var(--muted);
  font-size: 13px; font-family: var(--font);
  white-space: nowrap; cursor: pointer; flex-shrink: 0;
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
  transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease;
}
.nt-chip.is-active {
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  border-color: var(--accent); color: var(--accent);
}
@media (hover: hover) {
  .nt-chip:not(.is-active):hover { background: color-mix(in srgb, var(--accent) 8%, transparent); }
}

/* ── Card tag chips ──────────────────────────────────────────────────────── */
.nt-card-tags {
  display: flex; flex-wrap: wrap; gap: 4px;
  padding: 4px 14px 8px;
}
.nt-card-tag {
  display: inline-flex; align-items: center;
  height: 20px; padding: 0 7px;
  border-radius: 999px; border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--accent); font-size: 11px; font-family: var(--font);
  white-space: nowrap;
}
/* ── Card archived badge ────────────────────────────────────────────────── */
.nt-card-archived {
  position: absolute; top: 6px; left: 6px;
  width: 24px; height: 24px;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 6px;
  background: color-mix(in srgb, var(--muted) 18%, transparent);
  color: var(--muted); pointer-events: none;
}

/* ── Tag editor in EditorPanel ───────────────────────────────────────────── */
.nt-tags-wrap {
  display: flex; flex-wrap: wrap; align-items: center; gap: 4px;
  padding: 4px 10px;
  border-top: 1px solid var(--border);
  background: var(--surface2, var(--surface));
  flex: 0 0 auto;
}
.nt-tag-chip {
  display: inline-flex; align-items: center; gap: 3px;
  height: 26px; padding: 0 8px;
  border-radius: 999px; border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--accent); font-size: 12px; font-family: var(--font);
  white-space: nowrap;
}
.nt-tag-remove {
  width: 16px; height: 16px;
  display: inline-flex; align-items: center; justify-content: center;
  border: none; border-radius: 50%; padding: 0;
  background: transparent; color: var(--accent);
  cursor: pointer; font-size: 13px; line-height: 1; font-family: var(--font);
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
}
.nt-tag-remove:hover { background: color-mix(in srgb, var(--accent) 20%, transparent); }
.nt-tag-input {
  flex: 1; min-width: 90px;
  height: 26px; padding: 0 8px;
  border: 1px dashed var(--border); border-radius: 999px;
  background: transparent; color: var(--text);
  font-size: 12px; font-family: var(--font);
}
.nt-tag-input:focus { outline: none; border-color: var(--accent); }
.nt-tag-input::placeholder { color: var(--muted); }

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
