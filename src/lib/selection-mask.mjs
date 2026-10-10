/**
 * Konva pointer coordinates are logical canvas pixels, independent of the
 * canvas backing-store/device-pixel ratio. `offsetX/Y` describe the displayed
 * image origin in those same coordinates.
 */
export function canvasToImagePoint(point, { scale, offsetX = 0, offsetY = 0 }) {
  if (!Number.isFinite(scale) || scale <= 0) throw new Error("Image display scale must be positive.");
  return { x: (point.x - offsetX) / scale, y: (point.y - offsetY) / scale };
}

export function imageToCanvasPoint(point, { scale, offsetX = 0, offsetY = 0 }) {
  if (!Number.isFinite(scale) || scale <= 0) throw new Error("Image display scale must be positive.");
  return { x: point.x * scale + offsetX, y: point.y * scale + offsetY };
}

export function screenBrushToImageSize(screenSize, displayScale) {
  if (!Number.isFinite(displayScale) || displayScale <= 0) throw new Error("Image display scale must be positive.");
  return screenSize / displayScale;
}

/** Convert MediaPipe's normalized four-point iris contours to source pixels. */
export function normalizedIrisPolygons(landmarks, width, height) {
  const contours = [[469, 470, 471, 472], [474, 475, 476, 477]];
  return contours.map((indices) => indices.map((index) => {
    const point = landmarks[index];
    return { x: point.x * width, y: point.y * height };
  }));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distanceToSegment(x, y, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : clamp(((x - ax) * dx + (y - ay) * dy) / lengthSquared, 0, 1);
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}

function addStroke(alpha, width, height, points, brushWidth) {
  if (points.length < 2 || brushWidth <= 0) return;
  const radius = brushWidth / 2;
  const segments = points.length === 2 ? [[points[0], points[1], points[0], points[1]]] :
    Array.from({ length: points.length / 2 - 1 }, (_, index) => [
      points[index * 2], points[index * 2 + 1], points[index * 2 + 2], points[index * 2 + 3],
    ]);

  for (const [ax, ay, bx, by] of segments) {
    const left = clamp(Math.floor(Math.min(ax, bx) - radius - 1), 0, width - 1);
    const right = clamp(Math.ceil(Math.max(ax, bx) + radius + 1), 0, width - 1);
    const top = clamp(Math.floor(Math.min(ay, by) - radius - 1), 0, height - 1);
    const bottom = clamp(Math.ceil(Math.max(ay, by) + radius + 1), 0, height - 1);
    for (let y = top; y <= bottom; y += 1) {
      for (let x = left; x <= right; x += 1) {
        const distance = distanceToSegment(x + 0.5, y + 0.5, ax, ay, bx, by);
        const coverage = clamp(radius + 0.5 - distance, 0, 1);
        const index = y * width + x;
        alpha[index] = Math.max(alpha[index], Math.round(coverage * 255));
      }
    }
  }
}

function pointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const a = points[i];
    const b = points[j];
    const crosses = (a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function addPolygon(alpha, width, height, points) {
  if (points.length < 3) return;
  const left = clamp(Math.floor(Math.min(...points.map((point) => point.x))), 0, width - 1);
  const right = clamp(Math.ceil(Math.max(...points.map((point) => point.x))), 0, width - 1);
  const top = clamp(Math.floor(Math.min(...points.map((point) => point.y))), 0, height - 1);
  const bottom = clamp(Math.ceil(Math.max(...points.map((point) => point.y))), 0, height - 1);
  const offsets = [0.25, 0.75];

  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      let covered = 0;
      for (const oy of offsets) for (const ox of offsets) {
        if (pointInPolygon(x + ox, y + oy, points)) covered += 1;
      }
      if (covered > 0) {
        const index = y * width + x;
        alpha[index] = Math.max(alpha[index], Math.round((covered / 4) * 255));
      }
    }
  }
}

/** Rasterize source-resolution brush paths and polygons with antialiased edges. */
export function rasterizeSelectionMask(width, height, strokes = [], polygon = []) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error("Mask dimensions must be positive integers.");
  }
  const alpha = new Uint8ClampedArray(width * height);
  for (const stroke of strokes) {
    if (stroke.size === 0) {
      const points = [];
      for (let i = 0; i + 1 < stroke.points.length; i += 2) points.push({ x: stroke.points[i], y: stroke.points[i + 1] });
      addPolygon(alpha, width, height, points);
    } else {
      addStroke(alpha, width, height, stroke.points, stroke.size);
    }
  }
  addPolygon(alpha, width, height, polygon);
  return alpha;
}
