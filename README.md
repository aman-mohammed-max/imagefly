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

Open <http://localhost:3000>. Choose an image or click one of the bundled demo samples (Park Bench for object removal, Brick Wall for background repair, Portrait for eye recoloring). Paint or draw a polygon around the area, enter an instruction (or click a quick prompt chip), and select **Fix selected area**.

### Workflow and controls

- **Undo & Redo**: Full keyboard support (`Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z` / `Ctrl+Y`) and header/history controls.
- **Editing History**: Interactive history panel tracking operations with meaningful names; click any step to restore that exact canvas and selection state.
- **Selection Tools**: Brush and polygon tools, quick brush size presets (4px, 8px, 16px, 24px, 36px), Select All, Invert Selection, and Clear Selection.
- **Before & After Comparison**: Interactive split slider, instant A/B toggle view, and 2-Up side-by-side view. Scroll over the comparison to zoom toward the pointer, drag to pan, or use the zoom controls; the original and edited layers always share one transform.
- **Workspace Controls**: Fit-to-screen (`⛶`), 1:1 actual pixels, zoom in/out with percentage readout, drag-and-drop upload, unsaved edit safeguards, and dimensions display.
- **Clean Export**: Export in PNG (lossless) or JPEG (high quality) at full native resolution without capturing editor controls, selection outlines, or UI overlays.
- **Keyboard Shortcuts**: Press `?` anytime for the in-app shortcut and editing guide.

For eye recoloring, zoom in and brush over the iris or irises, then use an instruction such as **“make it green eye.”** Face landmarks narrow each selection to the iris boundary; a local color transform preserves luminance and leaves dark pupils and bright catchlights untouched. The recolor is deterministic and does not call the generative image provider.

For production, run `npm run build` and `npm run start`. `npm run lint` runs ESLint, `npx tsc --noEmit` checks types, and `npm test` runs the unit tests (history manager, export helpers, mask rasterization, transforms, compositing, preservation, and eye recoloring).

## Editing pipeline

- The browser creates an alpha selection mask from the brush strokes or closed polygon. Original images are not uploaded until the user asks to run an edit.
- Brush samples are mapped from Konva's logical canvas coordinates back to full-resolution image pixels before rasterization. The configured display scale accounts for fit and zoom; device-pixel-ratio backing pixels are not used as image coordinates. The red mask preview shows the exact rasterized selected pixels.
- For eye-color prompts, MediaPipe Face Landmarker detects both iris contours in the browser. The API receives those source-image coordinates and uses the brush mask only to decide which eye(s) to edit. It recolors within the detected iris contour, preserving highlights, dark pupils, and pixels outside a short inside-only feather. The model file is bundled at `public/models/face_landmarker.task`; the matching MediaPipe WASM files are loaded from jsDelivr on first use.
- The Next.js API route validates the request, normalizes EXIF orientation, scales an editing copy to a provider-compatible size, and calls the OpenAI Images edit API using the server-side `OPENAI_API_KEY`.
- Provider output is resized to the orientation-corrected source dimensions and composited through the selection mask with Sharp. All RGB values outside the mask come from the decoded source pixels.
- The result panel reports exact RGB matches outside the source and destination masks used for an operation. This is a deterministic byte-level measure of the final composite, not a measure of visual quality. It cannot guarantee that the selection itself perfectly follows object boundaries.

## Current scope and limitations

- Brush and polygon selection, natural-language inpainting, moving and resizing a selected cutout, a draggable before/after divider, full-size PNG export, clear progress/errors, and deterministic compositing are implemented.
- Move edits keep the source repair mask separate from the moved object's destination alpha. The source is inpainted first; the extracted selection is then composited at its transformed position. The preservation metric excludes both regions.
- Object boundaries still depend on the user's brush/polygon selection; there is no automatic segmentation or rotation control.
- Iris recoloring requires a clear face with visible irises and a network connection on first use to fetch the MediaPipe WASM runtime. The browser face detector was type/build checked, but automatic landmark detection was not exercised in a browser during this fix. Its failures are shown as errors, with no simulated result.
- GPT Image treats the mask as guidance and may not honor its exact boundary inside the selected area. The app's composite still keeps pixels outside the source and destination masks from changing.
- OpenAI image editing needs an API key, API access, and network connectivity. Without those, the app reports a setup/provider error; it never substitutes a fake result.
- Provider results are generated at reduced working resolution (usually up to 1536 px on the longest side), then enlarged for full-size export. Small inputs may be enlarged to meet the provider's minimum pixel count. Fine detail in the edited area can therefore be softer than the source.
- The API route limits uploads to 18 MB and images to 20 megapixels. Processing is synchronous and intended for a local hackathon demo, not a high-traffic deployment.
- Images are sent to OpenAI for processing. The app itself does not persist uploads or edits.

## Stack and sources

- Next.js, React, TypeScript, Tailwind CSS, React Konva, Sharp, and MediaPipe Tasks Vision Face Landmarker. The model is from [Google AI Edge's MediaPipe model collection](https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task); its web task documentation is [here](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js).
- React and React DOM use 19.2 with React Konva 19.2.x to stay compatible with the React 19.2 renderer bundled in Next.js 15.
- OpenAI Images edit API (`gpt-image-1` by default), called only by the server route: [API reference](https://platform.openai.com/docs/api-reference/images/createEdit) and [image generation guide, including mask requirements and limitations](https://developers.openai.com/api/docs/guides/image-generation).

## Demo script

1. Upload a photo with a distracting object.
2. Use the brush or polygon to select the object. To move it, choose **Move / resize selection**, drag the cutout, and adjust a corner handle.
3. Choose **Remove object** or enter a custom repair instruction, then run the edit. For eye color, zoom in, select each iris, and enter “make it green eye.”
4. Drag the before/after divider and read the outside-edited-areas pixel preservation metric.
5. Export the edited PNG.

## Verification sample

A real OpenAI edit request through `/api/inpaint` succeeded with a local 1024×1024 PNG and a 28% square selection. The resulting PNG changed 82,368 pixels inside the selection and 0 of 966,207 pixels outside it; the route reported 100% outside-mask RGB preservation. This verifies the API and compositor path for that sample, not photographic quality across different images or selection shapes.

The eye recoloring regression used a real portrait crop from [Brooks Leibee on Unsplash](https://unsplash.com/photos/portrait-of-woman-J5eJi1BoWpc). Pre-fix, the real provider produced broad circular patches around both eyes, similar to the reported artifact. After the fix, the local iris transform changed only the two supplied iris regions (1,102 pixels in this sample) and measured 100% exact RGB preservation outside the permitted edit mask. This portrait check used manually marked iris coordinates to validate the recolor/composite path; it does not validate automatic face detection in a browser. No screenshot was attached in the request, so the report screenshot itself could not be compared.
