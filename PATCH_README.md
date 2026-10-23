# HTVVM patch — exam authoring, Drive exam rooms, route fixes

This is a small overlay patch for the current HTVVM Studio × Hoá Liêm source. It is not a standalone application.

## Apply

1. Back up the current GitHub repository.
2. Extract this ZIP and copy its contents into the repository root, preserving the directory structure and allowing the runtime files to overwrite the older files.
3. The seven runtime files are:
   - `src/modules/exam-room/index.js`
   - `api/exam.js`
   - `shared/exam-grading.js`
   - `src/modules/focus-zone/index.js`
   - `src/main.js`
   - `src/css/input.css`
   - `public/sw.js`
4. Test files are included under `test/`. They are optional for Vercel deployment but useful to keep in GitHub and run with `npm test`.
5. Commit/push and Redeploy on Vercel. After it deploys, force-refresh the website (`Ctrl+F5`) so the updated service-worker cache is used.

## What this patch changes

- Fixes Firebase Realtime Database list/history queries that depended on a missing `createdAt` index by sorting a bounded collection in the API instead.
- Fixes the missing `field()` helper that prevented Góc tập trung from rendering.
- Replaces the broken legacy 3D scene iframe, which was leaking a 404/debug page into the exam hero, with a clean CSS-only header.
- Splits exam creation into **Biên soạn đề** (Markdown with live preview, image insertion, question types, answer key, PDF/print) and **Tạo phòng thi** (Google Drive preview, answer-key setup, room creation).
- In Drive-backed exam rooms, candidates see the source document on the left and the answer sheet on the right.
- Keeps scoring and result history on the existing HTVVM exam API.
- Increments the service worker cache version to prevent old code being served after deployment.

No Firebase Rules index change is required for the `exams_meta/createdAt` error after applying this patch. Drive documents still need Google sharing settings that allow the intended candidates to view the document.

## Verification

`npm test`: 81 tests passed. JavaScript syntax checks passed for modified modules. A production Vite build could not be verified in the current environment because Vite dependencies were not installed and registry access timed out. Confirm the Vercel build log after redeploying.
