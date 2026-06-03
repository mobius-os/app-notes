# Platform support for Notes

Notes imports `codemirror` and `katex`. Those must be vendored under `/vendor`
in the Möbius shell (like `react` and `three`) and externalized by the mini-app
compiler. That's a small, additive **mobius platform change**, captured here as
a patch so it can be applied to a clean checkout independent of any local repo
state.

## Apply

```bash
cd <mobius checkout>            # the mobius platform repo, on a clean main
git checkout -b vendor-cm6-katex
git am path/to/vendor-cm6-katex.patch
```

The patch (3 commits) touches:
- `Dockerfile` — `npm install` + build CM6 into one singleton-safe bundle; copy
  KaTeX JS+CSS+fonts; both under `/vendor`.
- `backend/scripts/build-codemirror-vendor.mjs` — the CM6 bundler (new file).
- `frontend/public/app-frame.html` + `backend/app/routes/standalone.py` — add
  `codemirror` + `katex` to the mini-app import maps.
- `backend/app/runtime_libs.py` — externalize `codemirror` + `katex` so apps
  importing them compile.

Then deploy via the normal mobius image-build ritual (this needs a full image
rebuild — run it on a host with memory headroom, since a build OOM could affect
a co-located prod container).

Verified: the bundle compiles, resolves in the real app frame, and the editor +
KaTeX render (see `../demo-logs/notes-app-verification/`).
