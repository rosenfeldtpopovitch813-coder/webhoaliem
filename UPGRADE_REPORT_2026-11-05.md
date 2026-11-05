# HTVVM Studio – Upgrade report (2026-11-05)

## Applied changes

### 1. Separate exam authoring and room setup
- Added standalone routes: `/exam-author` (Soạn đề) and `/exam-room` (Tạo phòng thi).
- Kept `/exam` for the exam library, entering rooms, history, and mistake review.
- Added navigation entries and separate landing actions.
- Preserved the current author draft in `localStorage` under `htvvm.exam-author-draft.v1`; the author page and room setup page share this draft so learners can move between the two tasks without losing work.

### 2. Focus timer
- Changed the countdown to use an absolute wall-clock deadline (`deadlineAt`) instead of relying on how often `setInterval` runs.
- A background tab that receives a delayed UI tick recalculates the remaining time from the deadline rather than losing or accumulating arbitrary seconds.
- The Pomodoro countdown can continue while the tab is hidden; study-time tracking pauses when the page is hidden so hidden time is not added to study statistics.
- Added a pure helper, `remainingToDeadline`, and tests for delayed ticks beyond 10 seconds.

### 3. Multi-subject handbook
- Added an overview for Mathematics, Chemistry, English, Physics, Biology, Literature, and Informatics. Mathematics and Chemistry retain their integrated tools (graph plotter, periodic table, IR) and also receive subject-specific notes/resource areas.
- The English subject defaults to the supplied Google Sites page.
- Each subject workspace supports an HTTPS resource URL, iframe preview, an external-open fallback, and per-subject notes saved locally.
- Notes can be exported as `.txt` files.
- The Google Sites page's outer shell was reachable, but its embedded lesson content could not be inspected by the available page reader. The iframe may also be blocked by the source site's embedding policy; the external-open fallback is provided for that case.

### 4. Motion, accessibility, and typography
- Added shared motion tokens for quick controls, ordinary surfaces, and emphasized transitions in both the main app and the separate React whiteboard app.
- Replaced scattered transition durations in the main app and the whiteboard app's home, geometry, calculator, and math-hub styles with shared tokens.
- Added fine-pointer hover handling and neutralized lift effects on touch/coarse pointers.
- Strengthened reduced-motion behavior in both apps.
- Whiteboard laser trails stop dispatching React state updates while the tab is hidden; reduced-motion mode removes trails without a fade. Geometry net folding now uses one cancellable `requestAnimationFrame` timeline and pauses while the tab is hidden.
- Expanded Vietnamese-friendly font fallbacks and focus-visible styles.

## Verification

- `node --test ./test/*.test.js`: **9 tests passed**.
- `node --check` passed across JavaScript files under `src`, `shared`, `api`, and `lib`, plus `server.cjs` and `scripts.js`.
- JSON parsing passed for `package.json`, `vercel.json`, `database.rules.json`, and `public/manifest.webmanifest`.
- Production build was **not run successfully**: the uploaded source has no `node_modules`, and the environment does not have the Vite executable (`vite: not found`). Install the project dependencies, then run `npm run build` in the deployment environment.
- No browser-based visual verification or live Firebase/API test was performed in this environment. TypeScript checking of the two edited React components was also blocked by the missing React and component type dependencies in this source-only environment.

## Data / compatibility notes

- Existing app data stores were not intentionally renamed or cleared.
- New local data keys are namespaced and additive: `htvvm.exam-author-draft.v1` and `htvvm-handbook-subjects-v1`.
- Existing exam routes and study-tracker API contracts remain in place; the changes add routes and update the client-side countdown behavior.
