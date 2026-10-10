# Project submission

Complete this file during the hackathon and use it to prepare your submission through the method announced by the organizers. Do not submit your project to the template repository.

## Project

- **Project name:** Image Fixer
- **Short description:** A browser image editor for removing, repairing, and moving selected image regions with AI inpainting while preserving untouched pixels.
- **Code repository URL:** https://github.com/aman-mohammed-max/imagefly
- **Final implementation commit SHA:** `3427087978fb2dbdf4596d5d801cdf1bbdd064eb` (local commit; push and organizer submission still pending).
- **Working demo URL or local demo steps:** Install dependencies, set `OPENAI_API_KEY` in `.env.local`, run `npm run dev`, then open `http://localhost:3000`.
- **Demo access requirements:** Node.js 20.9+, npm, network access, and an OpenAI API key with GPT Image access. Do not publish the key.

## Participants

Participate solo or in a team of up to 4. Remove unused rows.

| Participant name | GitHub handle | Contribution |
| --- | --- | --- |
| TODO — participant name | aman-mohammed-max | TODO — describe participant contribution |

## Run and demonstrate

- **Prerequisites and versions:** Node.js 20.9+, npm.
- **Install command:** `npm install`
- **Required environment variable names:** `OPENAI_API_KEY`; optional `IMAGE_MODEL` (defaults to `gpt-image-1`). See [.env.example](.env.example).
- **Start command:** `npm run dev`
- **Demo walkthrough:** Upload a photo; brush or polygon-select an object; optionally move/resize the cutout; add an instruction or remove it; compare before/after; export PNG.
- **Checks performed and results:** `npm run build`, `npm run lint`, `npx tsc --noEmit`, and `git diff --check` passed. Production page returned HTTP 200. Sample image/mask POST returned HTTP 503 with the expected missing-key message; the actual provider edit was not tested because no API key was configured.
- **Known limitations or incomplete features:** No automatic object segmentation or rotation; the user defines object boundaries. Provider output uses a reduced working resolution. Real OpenAI output remains unverified until run with a configured key.
- **Libraries, APIs, and public datasets used:** Next.js, React, TypeScript, Tailwind CSS, React Konva, Sharp, and [OpenAI Images edit API](https://platform.openai.com/docs/api-reference/images/createEdit). No public datasets.
- **AI usage record:** [AI_USAGE.md](AI_USAGE.md)
- **Development change log:** [CHANGELOG.md](CHANGELOG.md)

## Submission checklist

- [ ] The project implementation started from scratch at the event.
- [ ] I participated solo or with no more than 4 team members in total.
- [ ] Codex was used during development and its usage is documented.
- [ ] The code repository URL, short description, and working demo are provided.
- [ ] README setup and demo instructions match the submitted code.
- [ ] Actual checks and known limitations are documented.
- [ ] Meaningful changes are documented and committed throughout development.
- [ ] The final implementation is committed and pushed, and its SHA is recorded above.
- [ ] No credentials or private data are included in the repository or demo instructions.
- [ ] The organizers' announced submission method and timing have been followed.

Event reference: [DevDay Exchange Community: Kochi on Luma](https://luma.com/z10nz8gp). The event wraps up by **10:00 AM IST on 11 October 2026**.
