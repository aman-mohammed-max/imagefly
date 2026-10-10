# Change log

Record each meaningful project change during the event, newest first. Update this file in the same commit as the change. Use a real timestamp with timezone, for example `YYYY-MM-DDTHH:MM:SS+05:30`.

## Event build log

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
