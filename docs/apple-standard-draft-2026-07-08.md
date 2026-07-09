# Notes Apple-Standard Draft Pass

Date: 2026-07-08

## Evidence read

- `../../archive/docs/mobius-production-review-2026-06.md` listed catalog convergence as a production theme and called Notes off-standard because it still used `T()` / `cssVar()` inline style objects.
- `../../archive/docs/mobius-design-docs-2026-06.md` preserved the Notes form-factor direction: P1 is a pure restyle toward a Keep-like card grid, full-width search, FAB creation, pin controls, and hover / long-press card tools.
- `../../archive/docs/119-design-review.json` is the clearest Apple-quality review transcript. Its Notes section graded the app highly, but called out tap targets, accent foreground consistency, safe-area handling, CodeMirror selection tokenization, reduced motion, and a bare loading state.
- A scoped search under `../../mobius-os` did not surface a separate Notes-specific chat transcript beyond those archived catalog-review docs.

## Current status

Most original issues are already fixed in `main`:

- Styling now lives in `src/ui/css.js` with `mobius-ui:*` fences instead of the banned inline-object pattern.
- Structural colors use theme tokens; accent-filled foregrounds use `--accent-fg`.
- Header/grid/editor/FAB surfaces account for `env(safe-area-inset-*)`.
- CodeMirror selection uses `color-mix(in srgb, var(--accent) ...)`.
- Reduced motion and 44px control targets are guarded by tests.
- The app icon is now about 94 KB, not the old 1.46 MB catalog-review outlier.

## Drafted in this pass

- Shifted the home grid to fluid auto-fill tracks, currently `repeat(auto-fill, minmax(min(100%, 190px), 1fr))` after widening the card floor for the footer action strip.
- Replaced the bare loading state with a skeleton grid shaped like real note cards.
- Added the standard Scrollskin block for the main scroll surface and internal horizontal scrollers.
- Removed avoidable static inline styles from the app header, card thumbnails, editor host, and hidden file inputs. The color popover keeps its measured `top/left` inline style because it is runtime geometry.
- Tightened the interaction semantics: visible buttons now declare `type="button"`, text/file inputs have stable names, the modal dialog semantics live on the dialog panel, and the color picker is a labelled pressed-button group instead of a partial listbox.
- Added locked notes: locked cards show the lock state, the editor becomes read-only, and delete is disabled until unlock.
- Moved card actions into the bottom strip: pin, color, lock, delete.
- Changed the note editor from a full-page replacement to an over-grid dialog surface and simplified its header: no repeated "Notes" label, image/file controls are icon-only.
- Updated the local design docs so they no longer tell future agents to reintroduce `cssVar()` inline styling.

## Later passes

- Consider the P2 note workflow ideas from the design doc: inline new-note card, label chips over frontmatter tags, and archive/swipe behavior.
- Decide whether Notes should adopt true masonry if browser support becomes stable; today's grid is intentionally conservative and predictable.
- Add a visual regression capture in the Mobius shell once the app-frame test harness is convenient again.
