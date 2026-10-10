# AI usage record

Use Codex during the hackathon and briefly document its actual contribution here. Add a row after each meaningful task or milestone. Keep summaries concise and omit secrets, private data, and full chat transcripts.

## Event build log

Mark human review as pending until someone has reviewed the contribution.

| Date and time with timezone | Tool / model, if known | Task | Assistance and affected files | Human review / corrections | Validation and result |
| --- | --- | --- | --- | --- | --- |
| 2026-10-10T21:42:13+02:00 | Codex | Verify the real image-edit pipeline | Configured the user-provided key in ignored `.env.local`, submitted a local PNG and selection mask to the server route, and recorded results in `README.md`, `SUBMISSION.md`, and `CHANGELOG.md`. | Pending | OpenAI edit returned HTTP 200. The output changed 82,368 selected pixels and 0 outside-mask pixels; reported preservation was 100%. |
| 2026-10-10T21:12:55+02:00 | Codex | Record the implementation checkpoint | Added the actual local implementation SHA and pending submission state to `SUBMISSION.md` and `CHANGELOG.md`. | Pending | Confirmed SHA from Git; checked local links and diff whitespace. |
| 2026-10-10T21:11:02+02:00 | Codex | Complete the image move workflow and submission docs | Added source/destination mask separation, object resize/move, provider input sizing, and README/SUBMISSION setup/demo details. | Pending | Build, lint, TypeScript, and diff checks pass. Sample image upload reaches the provider boundary; genuine edit unavailable because `OPENAI_API_KEY` is unset. |
| 2026-10-10T20:26:55+02:00 | Codex | Add object move/resize and verify the MVP | Implemented alpha cutout, Konva transform handles, separate source/destination compositing, and revised project documentation. | Pending | Production build, TypeScript, and lint passed. Local sample image/mask request returned the documented missing-key response; no genuine provider output was available. |
| 2026-10-10T18:59:17+02:00 | Codex | Build the Image Fixer MVP | Created the Next.js editor, selection UI, inpainting route/provider, deterministic compositor, and project docs. | Pending | Confirmed the OpenAI image edit approach using its official API reference. Runtime/build and real-provider checks not run: Node/npm and `OPENAI_API_KEY` are unavailable in this environment. |

## Template preparation

On 10 October 2026, Codex prepared this documentation template from the organizer's supplied rules and checked the linked Luma page for the event name and dates. This covered `README.md`, `RULES.md`, `AGENTS.md`, `CHANGELOG.md`, `AI_USAGE.md`, `SUBMISSION.md`, `.gitignore`, and the pull request checklist. Agent validation covered local links, event consistency, required documents, and diff whitespace; organizer review is pending.

This preparation is separate from participant project implementation and participant AI usage during the event.
