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


### 5. A4 exam authoring workspace
- Replaced the former form-like authoring route with an A4 page editor styled like a word processor: editable institution/school/exam header, candidate fields, subject, grade, duration, formatting toolbar, multi-page content area, section outline, quick insertion actions, and autosave.
- Added inline recognition for `Câu 1.` / `Câu 1:` and point labels such as `Câu 3 (1 điểm).`; recognized questions are globally renumbered when reordered, duplicated, or deleted. Typed `PHẦN I/II/III` headings update the question type for subsequent questions.
- Added A–D option entry and 1/2/4-column layout controls, answer selection by clicking the option letter, per-statement Đ/S controls, and short-answer keys with teacher-only solutions.
- Added a LaTeX formula dialog with KaTeX preview and an OOXML math export path for Word. The exporter handles common fractions, powers, roots, subscripts, vectors/accents, matrices, symbols, and common chemistry formula subscripts. These are generated as editable Word math elements rather than raster images.
- Added a board split view using the separate Lớp học Mực app. A selected group or page can be sent to the editor; the inserted image is resizable/aligned, remembers its originating board ID, and “Sửa hình” reopens that board. The main app and whiteboard share the board-to-exam link metadata on the same origin.
- Added Word teacher/student exports, PDF teacher/student print views, multiple local drafts (up to 12, subject to browser storage capacity), and a board-list label/menu action for **Soạn đề thi khổ A4** or **Mở đề thi**. Draft and board IDs are additive; existing drawing data is not migrated or overwritten. The DOCX path embeds board images as DrawingML, places inline figures inside valid Word paragraphs, and exports math as editable OMML objects. A board only receives the **Đề thi** badge after the linked draft has actual exam content.
- Kept the existing `/exam-room` flow separate. The A4 editor saves into the existing draft contract, so the room creator can load the authored questions without coupling authoring UI to room creation.

## Verification

- `node --test ./test/*.test.js`: **14 tests passed**, including five new Word-math structure tests. The final A4/board-link and DOCX image-layout changes were rechecked after these tests.
- `node --check` passed across JavaScript files under `src`, `shared`, `api`, and `lib`, plus `server.cjs` and `scripts.js`.
- JSON parsing passed for `package.json`, `vercel.json`, `database.rules.json`, and `public/manifest.webmanifest`.
- Production build was **not run successfully**: the uploaded source has no `node_modules`, and the environment does not have the Vite executable (`vite: not found`). Install the project dependencies, then run `npm run build` in the deployment environment.
- No browser-based visual verification or live Firebase/API test was performed in this environment. TypeScript syntax transpilation passed for `notes-app/src/App.tsx`, `notes-app/src/Studio.tsx`, and `notes-app/src/pages/Home.tsx`. Full TypeScript type-checking was not performed because React and component type dependencies are not installed in this source-only environment.

## Data / compatibility notes

- Existing app data stores were not intentionally renamed or cleared.
- New local data keys are namespaced and additive: `htvvm.exam-author-draft.v1`, `htvvm.exam-author-drafts.v1`, `htvvm.exam-board-links.v1`, and `htvvm-handbook-subjects-v1`.
- Existing exam routes and study-tracker API contracts remain in place; the changes add routes and update the client-side countdown behavior.

## Follow-up update: remove duplicate ChemMaker and repair study timer

- Removed the ChemMaker module, navigation item, dashboard shortcut, and its unused legacy editor code. The Chemistry Handbook and Chem Arena are retained. A legacy `/chemmaker` URL is canonicalized to `/exam-author` so bookmarks do not break.
- Fixed the timer start path: Pomodoro countdown now starts immediately on the client; it no longer returns early when Firebase authentication or `/api/study-tracker` fails. Server tracking starts asynchronously and is stopped if the countdown was paused/reset while the request was pending.
- Added an offline study ledger in `localStorage`. When server tracking is unavailable, manually started study time and visible-time focus sessions continue to be counted and saved on the current device. This local-only fallback is displayed alongside cloud stats but is not uploaded to the leaderboard.
- Hidden-tab time is not credited to study totals. Countdown accuracy remains deadline-based, so delayed UI ticks do not freeze or drift the clock.
- Validation: `node --test test/*.test.js` passed 19/19; `node --check` passed for JS under `src`, `shared`, `api`, `lib`, plus `server.cjs` and `scripts.js`.
- Production build was not run: `npm install --no-audit --no-fund` timed out in the editing environment before dependencies were installed. Vercel must confirm `npm run build` after deployment.
