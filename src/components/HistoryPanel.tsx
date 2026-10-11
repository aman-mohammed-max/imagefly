"use client";

import React from "react";
import type { HistoryState } from "@/lib/history-manager.mjs";

interface HistoryPanelProps<T> {
  history: HistoryState<T>;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onJumpTo: (index: number) => void;
}

export function HistoryPanel<T>({
  history,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onJumpTo,
}: HistoryPanelProps<T>) {
  const { entries, currentIndex } = history;

  const getIcon = (op: string) => {
    switch (op) {
      case "load-image":
        return "▦";
      case "brush-stroke":
        return "◉";
      case "polygon-commit":
      case "polygon-point":
        return "⬡";
      case "select-all":
        return "⛶";
      case "invert-selection":
        return "◧";
      case "clear-selection":
        return "◌";
      case "move-start":
      case "move-place":
        return "↗";
      case "ai-edit":
        return "✦";
      default:
        return "•";
    }
  };

  return (
    <div className="history-panel">
      <div className="history-header">
        <div className="history-title-group">
          <span className="history-icon">◷</span>
          <span className="history-title">History</span>
          <span className="history-badge">{entries.length}</span>
        </div>
        <div className="history-actions">
          <button
            className="history-nav-btn"
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl/Cmd+Z)"
            aria-label="Undo"
          >
            ↶
          </button>
          <button
            className="history-nav-btn"
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl/Cmd+Shift+Z)"
            aria-label="Redo"
          >
            ↷
          </button>
        </div>
      </div>

      <div className="history-list" role="list">
        {entries.map((item, index) => {
          const isActive = index === currentIndex;
          const isPast = index <= currentIndex;

          return (
            <button
              key={item.id}
              className={`history-item ${isActive ? "active" : ""} ${!isPast ? "future" : ""}`}
              onClick={() => onJumpTo(index)}
              title={`Jump to step ${index + 1}: ${item.title}`}
              role="listitem"
            >
              <span className={`history-item-icon op-${item.operation}`}>
                {getIcon(item.operation)}
              </span>
              <div className="history-item-content">
                <span className="history-item-title">{item.title}</span>
                {item.detail && <span className="history-item-detail">{item.detail}</span>}
              </div>
              {isActive && <span className="history-active-indicator" title="Current state">●</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
