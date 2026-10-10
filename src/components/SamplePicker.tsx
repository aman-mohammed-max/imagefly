"use client";

import React from "react";

export interface SampleItem {
  id: string;
  title: string;
  tag: string;
  recommendedPrompt: string;
  imageSrc: string;
  description: string;
}

export const SAMPLES: SampleItem[] = [
  {
    id: "bench",
    title: "Park Bench",
    tag: "Object Removal",
    recommendedPrompt: "Remove the red backpack from the bench and naturally reconstruct the wooden slats behind it.",
    imageSrc: "/samples/sample-park-bench.png",
    description: "Try removing the red backpack",
  },
  {
    id: "wall",
    title: "Brick Wall",
    tag: "Background Repair",
    recommendedPrompt: "Repair the wall and seamlessly continue the brick pattern over the blue paint stain.",
    imageSrc: "/samples/sample-brick-wall.png",
    description: "Try repairing the blue spray paint",
  },
  {
    id: "portrait",
    title: "Portrait",
    tag: "Eye Recoloring",
    recommendedPrompt: "Recolor eyes to vibrant emerald green.",
    imageSrc: "/samples/sample-portrait.png",
    description: "Try changing eye color to green",
  },
];

interface SamplePickerProps {
  onSelectSample: (sample: SampleItem) => void;
}

export function SamplePicker({ onSelectSample }: SamplePickerProps) {
  return (
    <div className="sample-picker-section">
      <div className="sample-picker-heading">
        <span>✦</span>
        <span>Or test immediately with a sample project:</span>
      </div>
      <div className="sample-cards-grid">
        {SAMPLES.map((sample) => (
          <button
            key={sample.id}
            className="sample-card"
            onClick={() => onSelectSample(sample)}
            type="button"
          >
            <div className="sample-thumbnail-wrapper">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sample.imageSrc} alt={sample.title} className="sample-thumb" />
              <span className="sample-tag">{sample.tag}</span>
            </div>
            <div className="sample-info">
              <strong>{sample.title}</strong>
              <small>{sample.description}</small>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
