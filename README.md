# Image Fixer

Image Fixer is a focused image repair editor. Select a region with a brush or polygon, describe the repair (or use the default object removal prompt), and get an AI inpainted result. The server composites the provider result only through the selection mask; pixels outside that selection are copied from the source image.

## Run locally

Prerequisites: Node.js 20.9 or newer and npm.

```sh
npm install
cp .env.example .env.local
# Set OPENAI_API_KEY in .env.local (server only)
npm run dev
```

Open <http://localhost:3000>. Select a PNG, JPEG, or WebP under 18 MB, paint or draw a polygon around the area, enter an instruction or leave it blank to remove an object, then choose **Fix selected area**. Drag the divider to compare before and after. Export PNG downloads the full edited image.

For production, run `npm run build` and `npm run start`. `npm run lint` runs ESLint.

## Editing pipeline

- The browser creates an alpha selection mask from the brush strokes or closed polygon. Original images are not uploaded until the user asks to run an edit.
- The Next.js API route validates the request, normalizes EXIF orientation, scales an editing copy to a provider-compatible size, and calls the OpenAI Images edit API using the server-side `OPENAI_API_KEY`.
- Provider output is resized to the orientation-corrected source dimensions and composited through the selection mask with Sharp. All RGB values outside the mask come from the decoded source pixels.
- The result panel reports exact RGB matches outside the source and destination masks used for an operation. This is a deterministic byte-level measure of the final composite, not a measure of visual quality. It cannot guarantee that the selection itself perfectly follows object boundaries.

## Current scope and limitations

- Brush and polygon selection, natural-language inpainting, moving and resizing a selected cutout, a draggable before/after divider, full-size PNG export, clear progress/errors, and deterministic compositing are implemented.
- Move edits keep the source repair mask separate from the moved object's destination alpha. The source is inpainted first; the extracted selection is then composited at its transformed position. The preservation metric excludes both regions.
- Object boundaries still depend on the user's brush/polygon selection; there is no automatic segmentation or rotation control.
- GPT Image treats the mask as guidance and may not honor its exact boundary inside the selected area. The app's composite still keeps pixels outside the source and destination masks from changing.
- OpenAI image editing needs an API key, API access, and network connectivity. Without those, the app reports a setup/provider error; it never substitutes a fake result.
- Provider results are generated at reduced working resolution (usually up to 1536 px on the longest side), then enlarged for full-size export. Small inputs may be enlarged to meet the provider's minimum pixel count. Fine detail in the edited area can therefore be softer than the source.
- The API route limits uploads to 18 MB and images to 20 megapixels. Processing is synchronous and intended for a local hackathon demo, not a high-traffic deployment.
- Images are sent to OpenAI for processing. The app itself does not persist uploads or edits.

## Stack and sources

- Next.js, React, TypeScript, Tailwind CSS, React Konva, and Sharp.
- OpenAI Images edit API (`gpt-image-1` by default), called only by the server route: [API reference](https://platform.openai.com/docs/api-reference/images/createEdit) and [image generation guide, including mask requirements and limitations](https://developers.openai.com/api/docs/guides/image-generation).

## Demo script

1. Upload a photo with a distracting object.
2. Use the brush or polygon to select the object. To move it, choose **Move / resize selection**, drag the cutout, and adjust a corner handle.
3. Choose **Remove object** or enter a custom repair instruction, then run the edit.
4. Drag the before/after divider and read the outside-edited-areas pixel preservation metric.
5. Export the edited PNG.
