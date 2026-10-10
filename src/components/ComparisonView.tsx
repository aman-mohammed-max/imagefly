"use client";

/* eslint-disable @next/next/no-img-element -- original and edited image blobs are rendered directly */

import React, { useState } from "react";

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

  return (
    <div className="comparison-container" style={{ width, height }}>
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
  );
}
