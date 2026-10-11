# Change log

Record each meaningful project change during the event, newest first. Update this file in the same commit as the change. Use a real timestamp with timezone, for example `YYYY-MM-DDTHH:MM:SS+05:30`.

## Event build log

## 2026-10-11T02:46:00+02:00 — Add synchronized comparison zoom and pan

- Changed: Added cursor-centered zoom, pointer drag panning, zoom percentage, and reset controls to the comparison viewer. Added unit tests for cursor anchoring, zoom limits, and a shared transform. Affected files: `ComparisonView.tsx`, `comparison-viewport.mjs`, its test, and comparison styles.
- Why: Let users inspect small edits closely while keeping original and edited pixels aligned across all comparison modes.
- Validation: `npm test` passed all 6 test files, including the new viewport math tests; `npm run lint`, `npx tsc --noEmit`, `npm run build`, and `git diff --check` all passed.
- Limitations: Pointer interactions were not manually exercised in a browser, especially on touch devices; the app has no browser automation dependency.

## 2026-10-11T01:23:05+02:00 — Implement undo/redo, history panel, comparison modes, export options, and demo samples

- Changed: Added lightweight undo/redo history engine (`Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`), a visual history timeline with state jumping and descriptive operation names, enhanced selection tools (Select All, Invert, Clear, quick brush presets), 3 comparison modes (interactive split slider, instant A/B toggle, 2-Up side-by-side), workspace controls (fit, 1:1, zoom in/out, dimensions display, drag-and-drop upload, unsaved edits safeguard), full-resolution clean PNG/JPEG export without UI artifacts, bundled demo samples (park bench, brick wall, portrait) with quick action chips, and a keyboard shortcuts modal.
- Why: Enhance usability, creative workflow reliability, and hackathon presentation without altering ongoing eye-recoloring and mask pipeline work.
- Validation: Added unit tests for history transitions, branching, and export utilities. `npm test` (21 passing tests across 5 test suites), `npx tsc --noEmit`, `npm run lint`, and `npm run build` all completed with exit code 0.
- Limitations: Full interactive dragging requires a browser supporting HTML5 Canvas and Pointer Events. Real OpenAI API calls still require `OPENAI_API_KEY`.

## 2026-10-11T00:56:16+02:00 — Correct iris selection and recoloring

- Changed: Replaced screen-space mask scaling with source-resolution brush rasterization and explicit fit/zoom coordinate mapping; added a mask preview and smaller eye-selection brush. Added MediaPipe iris contour detection and a deterministic, luminance-aware iris recolor path with pupil/highlight protection and inside-only Gaussian feathering. Added alpha-correct compositing, real outside-mask preservation measurements, and regression tests for geometry, mapping, blending, preservation, prompts, and two-eye recoloring.
- Why: The previous brush width was divided by the fit scale after its points had already been converted to image pixels, creating oversized circular masks. Raw general-purpose inpainting then changed the surrounding eye region and left hard circular seams.
- Validation: Reproduced the circular artifacts with a real OpenAI edit before the fix. `npm test` (3 test files), `npm run build`, `npm run lint`, `npx tsc --noEmit`, and `git diff --check` pass. A local API request on a real portrait returned HTTP 200, recolored 1,102 pixels across two manually supplied iris regions, and measured 100% exact RGB preservation outside the permitted iris mask.
- Limitations: The supplied report screenshot was not attached. Automatic MediaPipe detection was compiled but not exercised in a browser; the real portrait API regression supplied manually measured iris contours. MediaPipe's matching WASM runtime is fetched from jsDelivr.

## 2026-10-10T22:31:43+02:00 — Align React Konva with Next.js runtime

- Changed: Pinned React and React DOM to 19.2 and React Konva to 19.2.x in `package.json` and `package-lock.json`; documented the compatibility constraint in `README.md`.
- Why: Next.js 15 bundles a React 19.2 renderer, while React Konva 19.3 throws when loaded with a React runtime below 19.3.
- Validation: Confirmed installed versions are React/React DOM 19.2.0 and React Konva 19.2.7. `npm run build`, `npm run lint`, `npx tsc --noEmit`, and `git diff --check` pass.
- Limitations: React Konva and React/React DOM must remain on matching minor lines while using this Next.js 15 version.

## 2026-10-10T22:17:05+02:00 — Align React and react-konva versions

- Changed: Upgraded `react`, `react-dom`, and `react-konva` to `19.3.0`; updated `@types/react` and `@types/react-dom` to `^19.3.0`.
- Why: `react-konva@19.3` requires React ≥19.3. The project had React 19.1 with react-konva 19.0, causing a peer dependency mismatch and potential runtime errors.
- Validation: `npm install` completed with exit code 0; `package.json` confirms matching `^19.3.0` for all three packages.
- Limitations: 8 pre-existing audit vulnerabilities (1 moderate, 7 high) in transitive dev deps; not introduced by this change.

## 2026-10-10T21:42:13+02:00 — Verify a real AI image edit

- Changed: Updated `README.md`, `SUBMISSION.md`, and `AI_USAGE.md` with the real-provider verification results.
- Why: Replace the earlier no-key limitation with observed results from the configured, real edit workflow.
- Validation: Sent a local 1024×1024 PNG and a square selection mask through the running `/api/inpaint` route; OpenAI returned HTTP 200. The result changed 82,368 pixels inside the selection, 0 of 966,207 outside pixels, and reported 100% preservation.
- Limitations: This was one graphic PNG sample rather than a photographic sample; it verifies the provider/compositor path and byte preservation for this mask, not broad generative quality.

## 2026-10-10T21:12:55+02:00 — Record the implementation checkpoint

- Changed: Recorded implementation commit `3427087978fb2dbdf4596d5d801cdf1bbdd064eb` in `SUBMISSION.md` and documented that push/submission remain pending.
- Why: Keep the submission record tied to the actual code commit without claiming an unperformed push or event submission.
- Validation: Confirmed the SHA with `git rev-parse HEAD`; local Markdown links and `git diff --check` are valid.
- Limitations: Participant name/contribution, push, working public demo, and real API-backed image edit remain to be completed.

## 2026-10-10T21:11:02+02:00 — Finish move workflow and document the demo

- Changed: Added alpha cutout move/resize interactions, source repair and destination compositing with separate masks, EXIF normalization, provider-compatible input sizing, and completed README/submission/demo records.
- Why: Deliver the requested one-day editor workflow and make its setup, behavior, and limits reviewable.
- Validation: `npm run build`, `npm run lint`, `npx tsc --noEmit`, and `git diff --check` pass. Production home returned HTTP 200. Uploading a real local PNG and mask reached the provider boundary and returned the expected HTTP 503 because no API key is configured. A genuine AI edit could not be verified.
- Limitations: No automatic segmentation or rotation. Provider mask adherence and generated image quality are not verified in this environment.

## 2026-10-10T20:26:55+02:00 — Add transformed object moves and verify the build

- Changed: Added transparent object extraction, draggable/resizable placement, separate source repair and destination compositing, and preservation measurement outside both affected regions. Fixed React Konva's server bundle to use its core entry; updated setup and scope docs.
- Why: Complete the requested move workflow while keeping source repair and destination editing masks distinct.
- Validation: `npm run build`, `npx tsc --noEmit`, and `npm run lint` pass (lint was clean after suppressing the intentional raw image tags). Production homepage returned HTTP 200. A sample image/mask POST reached the route and returned the expected HTTP 503 setup message because `OPENAI_API_KEY` is unavailable. A genuine provider edit remains unverified.
- Limitations: API-backed image generation could not be run without a key. User-provided selection boundaries can be imprecise; rotation is not available.

## 2026-10-10T18:59:17+02:00 — Build the Image Fixer MVP

- Changed: Added a Next.js/TypeScript/Tailwind/React Konva editor, brush and polygon selection, prompt input, server-side OpenAI image edit provider, Sharp mask compositing, before/after comparison, PNG export, and setup/demo notes.
- Why: Establish the highest-priority end-to-end image repair workflow while preserving original pixels outside the user's selection.
- Validation: Inspected repository and event rules; verified the OpenAI image edit endpoint in the [official API reference](https://platform.openai.com/docs/api-reference/images/createEdit). Runtime/build and real-provider checks could not run because this environment has no Node.js/npm runtime or `OPENAI_API_KEY`.
- Limitations at this milestone: Object movement was incomplete; it is implemented in the later entry above. Provider output is generated at reduced working resolution. See README for current limits.

```text
## <actual timestamp> — <short change title>

- Changed: <feature or files changed>
- Why: <reason for the change>
- Validation: <commands or manual checks actually run, with results>
- Limitations: <known issues or "None identified in these checks">
```

## Template setup — 10 October 2026

- Changed: Added the event README, rules, agent guide, change log, AI usage record, submission checklist, Git ignore rules, and pull request checklist.
- Why: Give participants a consistent starting point for event rules, basic coding patterns, documented changes, and regular commits.
- Validation: Checked local Markdown links, event detail consistency, required documents, and diff whitespace before publishing.
- Limitations: Documentation scaffolding only; no participant project, application, or working demo is included. GitHub publication and template status are verified separately after creation.
