# HTVVM Studio — Firebase probe & 120+ answer-sheet patch

This is an overlay for the current HTVVM source after the Firebase/library updates, the One Exam Room integration, and the Exam Authoring / Drive Room patch. It is not a standalone application.

## What changed

- Firebase diagnostics now probes the harmless ordinary node `__htvvm_diagnostics_probe__` instead of `.info/serverTimeOffset`. The `.info` namespace is intended for client SDK server-info listeners; calling it as a normal Admin SDK reference caused the observed `Invalid token in path` message. This probe only reads and does not write or return student data.
- Leave the existing Firebase URL and service-account values alone for the first retest. Deploy this patch, open “Chẩn đoán Firebase” again, and check the new result. If it reports a different error, diagnose that exact new code/message. Do not make Realtime Database Rules public to bypass it.
- Replaces the old 60-question cap with `MAX_EXAM_QUESTIONS = 1000` for question validation, submitted answers, draft answers and flags.
- The Drive room creator shows three distinct answer-key sections together: Part I multiple-choice A–D, Part II true/false with four sub-items, and Part III short numeric answers. The teacher sets the count of each part independently. The default template is 40 + 40 + 40 = 120 questions. Each part must contain at least one question; total questions are capped at 1,000 for payload/performance safety.
- Increments the service-worker cache key to `htvvm-studio-clean-ui-7` so old code is not kept cached after deployment.

## Runtime files (6)

- `api/diagnostics/firebase.js`
- `api/exam.js`
- `shared/exam-grading.js`
- `src/modules/exam-room/index.js`
- `src/css/input.css`
- `public/sw.js`

The three `test/` files are included for regression checks. They are not needed for serving the website, but are useful to keep in GitHub and run with `npm test`.

## Apply

1. Back up the repository.
2. Extract this ZIP and copy its contents into the repository root, preserving folder paths and allowing the six runtime files to overwrite older versions.
3. Commit and push; let Vercel redeploy. This patch doesn't change `package.json` or Firebase environment variables.
4. After deployment, force-refresh the site (`Ctrl+F5`) and run “Chẩn đoán Firebase” again.
5. Go to “Phòng thi” → “Tạo phòng thi” and verify all three answer-key sections. The default is 120 questions (40/40/40); change the counts for your exam format.

## Verification

- Full test suite: 84 tests passed, 0 failed.
- Syntax checks passed for the modified runtime JavaScript.
- Production Vite build has not been verified in this environment because dependencies are not installed (`vite: not found`). Confirm the Vercel Build Logs after redeploy.
