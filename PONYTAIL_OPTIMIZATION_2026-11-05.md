# HTVVM Studio — Ponytail optimization pass

Date: 2026-11-05
Mode: `ponytail full`

## Changes applied

1. **Lớp học Mực landing-page code split**
   - `notes-app/src/App.tsx` now lazy-loads `Studio` only after a board is opened.
   - The home/library screen no longer eagerly imports the full drawing workspace.

2. **On-demand tool panels**
   - `GraphPanel`, `Geometry3DPanel`, `GeometryLibraryPanel`, `ScientificCalculator`, `GeometryTools`, and `MathHub` are lazy-loaded when opened.
   - Added concise loading fallbacks so the interface indicates when a tool chunk is being loaded.

3. **KaTeX CSS route split**
   - Removed KaTeX CSS from the main HTVVM and Lớp học Mực entry points.
   - Load it with the A4 exam authoring, exam room, or drawing Studio modules that actually render formulas.

4. **Focus timer update frequency**
   - Changed the UI/accounting interval from 250 ms to 1,000 ms.
   - The countdown remains deadline-based; the UI only displays whole seconds, so four wake-ups per second were unnecessary.
   - Heartbeat cadence and study-time persistence rules are unchanged.

5. **Accessibility**
   - Removed `aria-live` from the whole application root so every timer/UI mutation is not announced as a live-region update.
   - Kept route-title announcements and a dedicated status role for app notices.

## Verification performed

- `npm test`: 19/19 passed.
- TypeScript/TSX syntax transpilation: 40/40 files passed.
- `node --check`: all JavaScript files under `src`, `shared`, `api`, and `lib`, plus `server.cjs` and `scripts.js`, passed.
- JSON parsing: `package.json`, `vercel.json`, `database.rules.json`, and `public/manifest.webmanifest` passed.
- Verified each lazy-loaded panel has a default export.

## Not verified / deployment risks

- `npm run build` could not run because `vite` is not installed in this source-only environment. Dependencies were not installed here.
- No browser-based performance profile, visual check, real Google sign-in, or live Firebase/API test was run.
- Exact bundle-size savings are not reported because the production bundle could not be generated.

## Deployment

Replace the current repository contents with this source package, keep existing Vercel Environment Variables and Firebase data/rules, then let Vercel install dependencies and run `npm run build`. Review the Vercel build log before publishing.
