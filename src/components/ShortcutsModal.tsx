"use client";

import React from "react";

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="brand-mark">✳</span>
            <h3>Keyboard Shortcuts & Editing Guide</h3>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close dialog">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="shortcuts-section">
            <h4>Keyboard Shortcuts</h4>
            <div className="shortcuts-grid">
              <div className="shortcut-row">
                <span className="shortcut-desc">Undo editing operation</span>
                <span className="shortcut-keys"><kbd>⌘/Ctrl</kbd> + <kbd>Z</kbd></span>
              </div>
              <div className="shortcut-row">
                <span className="shortcut-desc">Redo editing operation</span>
                <span className="shortcut-keys"><kbd>⌘/Ctrl</kbd> + <kbd>⇧</kbd> + <kbd>Z</kbd></span>
              </div>
              <div className="shortcut-row">
                <span className="shortcut-desc">Fit canvas to screen</span>
                <span className="shortcut-keys"><kbd>⌘/Ctrl</kbd> + <kbd>0</kbd></span>
              </div>
              <div className="shortcut-row">
                <span className="shortcut-desc">Zoom in / Zoom out</span>
                <span className="shortcut-keys"><kbd>+</kbd> / <kbd>−</kbd></span>
              </div>
              <div className="shortcut-row">
                <span className="shortcut-desc">Decrease / Increase brush size</span>
                <span className="shortcut-keys"><kbd>[</kbd> / <kbd>]</kbd></span>
              </div>
              <div className="shortcut-row">
                <span className="shortcut-desc">Close polygon / Commit</span>
                <span className="shortcut-keys"><kbd>Double Click</kbd></span>
              </div>
            </div>
          </div>

          <div className="guide-section">
            <h4>Workflow Guidelines</h4>
            <div className="guide-card">
              <b>Object Removal & Background Inpainting</b>
              <p>Brush slightly outside the object boundary so the AI can blend surrounding textures seamlessly.</p>
            </div>
            <div className="guide-card">
              <b>Eye Recoloring</b>
              <p>Zoom in and select the iris contour. The pupil and corneal catchlights will automatically be protected.</p>
            </div>
            <div className="guide-card">
              <b>Object Movement & Scaling</b>
              <p>Select any subject, click &quot;Move / resize selection&quot;, then drag and resize the extracted layer. The background will be repaired and the object composited seamlessly.</p>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="primary-button compact" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
