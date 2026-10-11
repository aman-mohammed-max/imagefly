"use client";

/* eslint-disable @next/next/no-img-element -- original and edited image blobs are rendered directly */

import React, { useRef, useState } from "react";
import { zoomViewportAtPoint } from "@/lib/comparison-viewport.mjs";

interface ComparisonViewProps {
  originalUrl: string;
  editedUrl: string;
  width: number;
  height: number;
  comparison: number;
  onComparisonChange: (val: number) => void;
}

export type CompareMode = "slider" | "toggle" | "side-by-side";

export function ComparisonView({
  originalUrl,
  editedUrl,
  width,
  height,
  comparison,
  onComparisonChange,
}: ComparisonViewProps) {
  const [mode, setMode] = useState<CompareMode>("slider");
  const [toggleShowOriginal, setToggleShowOriginal] = useState(false);
  const [viewport, setViewport] = useState({ scale: 1, x: 0, y: 0 });
  const pointerDrag = useRef<{ pointerId: number; x: number; y: number; originX: number; originY: number } | null>(null);

  function zoomAt(factor: number, x = width / 2, y = height / 2) {
    setViewport((current) => zoomViewportAtPoint(current, factor, { x, y }));
  }

  function beginPan(event: React.PointerEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.closest("button, input")) return;
    pointerDrag.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      originX: viewport.x,
      originY: viewport.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function movePan(event: React.PointerEvent<HTMLDivElement>) {
    const drag = pointerDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setViewport((current) => ({
      ...current,
      x: drag.originX + event.clientX - drag.x,
      y: drag.originY + event.clientY - drag.y,
    }));
  }

  function endPan(event: React.PointerEvent<HTMLDivElement>) {
    if (pointerDrag.current?.pointerId !== event.pointerId) return;
    pointerDrag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function resetViewport() {
    setViewport({ scale: 1, x: 0, y: 0 });
  }

  return (
    <div
      className="comparison-container"
      style={{ width, height }}
      onWheel={(event) => {
        event.preventDefault();
        const bounds = event.currentTarget.getBoundingClientRect();
        zoomAt(event.deltaY < 0 ? 1.1 : 1 / 1.1, event.clientX - bounds.left, event.clientY - bounds.top);
      }}
    >
      {/* Mode Switcher Floating Bar */}
      <div className="compare-mode-bar">
        <button
          className={`compare-mode-tab ${mode === "slider" ? "active" : ""}`}
          onClick={() => setMode("slider")}
          title="Split comparison slider"
        >
          ↔ Split
        </button>
        <button
          className={`compare-mode-tab ${mode === "toggle" ? "active" : ""}`}
          onClick={() => setMode("toggle")}
          title="Instant A/B toggle"
        >
          ⇆ A/B Toggle
        </button>
        <button
          className={`compare-mode-tab ${mode === "side-by-side" ? "active" : ""}`}
          onClick={() => setMode("side-by-side")}
          title="Side by side comparison"
        >
          ◫ 2-Up
        </button>
      </div>

      <div className="comparison-zoom-controls" aria-label="Comparison view controls">
        <button type="button" title="Zoom out" aria-label="Zoom out comparison" onClick={() => zoomAt(1 / 1.25)} disabled={viewport.scale <= 0.5}>−</button>
        <span aria-live="polite">{Math.round(viewport.scale * 100)}%</span>
        <button type="button" title="Zoom in" aria-label="Zoom in comparison" onClick={() => zoomAt(1.25)} disabled={viewport.scale >= 4}>+</button>
        <button type="button" title="Reset zoom and pan" aria-label="Reset comparison view" onClick={resetViewport}>Reset</button>
      </div>

      <div
        className="comparison-viewport is-pannable"
        onPointerDown={beginPan}
        onPointerMove={movePan}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onLostPointerCapture={() => { pointerDrag.current = null; }}
      >
        <div
          className="comparison-canvas"
          style={{
            width,
            height,
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
          }}
        >
          {/* Mode 1: Split Slider */}
          {mode === "slider" && (
            <div className="comparison" style={{ width, height }}>
              <img src={originalUrl} alt="Original input" draggable={false} />
              <div
                className="comparison-after"
                style={{ clipPath: `inset(0 ${100 - comparison}% 0 0)` }}
              >
                <img src={editedUrl} alt="Edited AI result" draggable={false} />
              </div>
              <div className="comparison-divider" style={{ left: `${comparison}%` }}>
                <span>↔</span>
              </div>
              <div className="compare-label before">BEFORE</div>
              <div className="compare-label after">AFTER</div>
              <input
                aria-label="Before and after split slider"
                className="comparison-range"
                type="range"
                min="0"
                max="100"
                value={comparison}
                onChange={(e) => onComparisonChange(Number(e.target.value))}
              />
            </div>
          )}

          {/* Mode 2: Instant A/B Toggle */}
          {mode === "toggle" && (
            <div className="comparison-toggle-view" style={{ width, height }}>
              <img
                src={toggleShowOriginal ? originalUrl : editedUrl}
                alt={toggleShowOriginal ? "Original" : "Edited"}
                className="w-full h-full object-fill block"
                draggable={false}
              />
              <div className={`compare-label ${toggleShowOriginal ? "before" : "after"}`}>
                {toggleShowOriginal ? "ORIGINAL (BEFORE)" : "EDITED (AFTER)"}
              </div>
              <div className="compare-toggle-controls">
                <button
                  className={`toggle-view-btn ${!toggleShowOriginal ? "active" : ""}`}
                  onClick={() => setToggleShowOriginal(false)}
                >
                  Show Edited
                </button>
                <button
                  className={`toggle-view-btn ${toggleShowOriginal ? "active" : ""}`}
                  onClick={() => setToggleShowOriginal(true)}
                  onMouseDown={() => setToggleShowOriginal(true)}
                  onMouseUp={() => setToggleShowOriginal(false)}
                >
                  Show Original (Hold)
                </button>
              </div>
            </div>
          )}

          {/* Mode 3: Side-by-Side 2-Up */}
          {mode === "side-by-side" && (
            <div className="comparison-side-by-side" style={{ width, height }}>
              <div className="side-half">
                <img src={originalUrl} alt="Original" draggable={false} />
                <div className="compare-label before">BEFORE</div>
              </div>
              <div className="side-divider" />
              <div className="side-half">
                <img src={editedUrl} alt="Edited" draggable={false} />
                <div className="compare-label after">AFTER</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
