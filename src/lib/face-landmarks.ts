"use client";

import { normalizedIrisPolygons } from "@/lib/selection-mask.mjs";

type IrisPoint = { x: number; y: number };
type FaceLandmarkerInstance = import("@mediapipe/tasks-vision").FaceLandmarker;

let landmarkerPromise: Promise<{ instance: FaceLandmarkerInstance }> | null = null;

async function getLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = import("@mediapipe/tasks-vision").then(async (module) => {
      const wasm = await module.FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/wasm");
      const instance = await module.FaceLandmarker.createFromOptions(wasm, {
        baseOptions: { modelAssetPath: "/models/face_landmarker.task" },
        runningMode: "IMAGE",
        numFaces: 5,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
      });
      return { instance };
    }).catch((error) => {
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
