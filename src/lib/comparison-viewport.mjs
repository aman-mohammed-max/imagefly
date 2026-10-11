/**
 * Keep a point under the cursor stationary while zooming a comparison view.
 * Translation and scale are shared by the original and edited layers.
 */
export function zoomViewportAtPoint(viewport, factor, point, minScale = 0.5, maxScale = 4) {
  const scale = Math.min(maxScale, Math.max(minScale, viewport.scale * factor));
  const ratio = scale / viewport.scale;

  return {
    scale,
    x: point.x - (point.x - viewport.x) * ratio,
    y: point.y - (point.y - viewport.y) * ratio,
  };
}
