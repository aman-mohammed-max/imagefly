"use client";

import { normalizedIrisPolygons } from "@/lib/selection-mask.mjs";

type IrisPoint = { x: number; y: number };
type FaceLandmarkerInstance = import("@mediapipe/tasks-vision").FaceLandmarker;

let landmarkerPromise: Promise<{ instance: FaceLandmarkerInstance }> | null = null;

async function getLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2");
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
      if (!gl) throw new Error("Iris detection needs WebGL2. Enable hardware acceleration or try a browser that supports WebGL2.");

      // Keep this vendor bundle out of Next's Webpack transform. MediaPipe's
      // browser runtime initializes its own Wasm/WebGL pipeline at load time.
      const bundleUrl: string = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/vision_bundle.mjs";
      const visionTasks = await import(/* webpackIgnore: true */ bundleUrl) as typeof import("@mediapipe/tasks-vision");
      const wasm = await visionTasks.FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/wasm");
      const instance = await visionTasks.FaceLandmarker.createFromOptions(wasm, {
        baseOptions: { modelAssetPath: "/models/face_landmarker.task" },
        runningMode: "IMAGE",
        numFaces: 5,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
      });
      return { instance };
    })().catch((error) => {
      landmarkerPromise = null;
      throw error;
    });
  }
  return landmarkerPromise;
}

export async function detectIrisRegions(image: HTMLImageElement): Promise<IrisPoint[][]> {
  const { instance } = await getLandmarker();
  const result = instance.detect(image);
  const faces = result.faceLandmarks.filter((landmarks) => landmarks.length >= 478);
  return faces.flatMap((landmarks) => normalizedIrisPolygons(landmarks, image.naturalWidth, image.naturalHeight));
}
