/**
 * useEditHistory – lightweight undo/redo for the image editor.
 *
 * Each snapshot records only selection and canvas metadata (never raw image
 * pixel data), keeping memory usage proportional to the number of strokes
 * rather than image resolution.
 */

import { useCallback, useRef, useState } from "react";

export type Point = { x: number; y: number };
export type Stroke = { points: number[]; size: number };
export type MovingObject = {
  image: HTMLImageElement;
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type OperationType =
  | "brush-stroke"
  | "polygon-point"
  | "polygon-commit"
  | "clear-selection"
  | "move-start"
  | "move-place"
  | "ai-edit"
  | "load-image";

export interface HistoryEntry {
  id: number;
  operation: OperationType;
  label: string;
  timestamp: number;
  /** Whether this operation produced a completed AI edit result. */
  hasResult: boolean;
  editedUrl: string;
  preservationPercent: number | null;
}

export interface SelectionSnapshot {
  strokes: Stroke[];
  polygon: Point[];
  movingObject: MovingObject | null;
  moveMode: boolean;
  editedUrl: string;
  preservationPercent: number | null;
}

const MAX_HISTORY = 50;
let _nextId = 1;

function operationLabel(op: OperationType, extra?: string): string {
  switch (op) {
    case "brush-stroke":    return "Brush stroke";
    case "polygon-point":   return "Polygon point";
    case "polygon-commit":  return "Polygon selection";
    case "clear-selection": return "Clear selection";
    case "move-start":      return "Move selection";
    case "move-place":      return "Place object";
    case "ai-edit":         return extra ? `AI edit: ${extra}` : "AI edit";
    case "load-image":      return "Load image";
    default:                return "Edit";
  }
}

export function useEditHistory() {
  // undoStack[top] is the current state; undoStack[top-1] is one step back.
  const [undoStack, setUndoStack] = useState<SelectionSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<SelectionSnapshot[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Keep a ref for the current snapshot so push() can read it synchronously.
  const currentRef = useRef<SelectionSnapshot>({
    strokes: [], polygon: [], movingObject: null, moveMode: false,
    editedUrl: "", preservationPercent: null,
  });

  /** Record a new state snapshot and operation name. */
  const push = useCallback((
    next: SelectionSnapshot,
    operation: OperationType,
    labelExtra?: string,
  ) => {
    const prev = currentRef.current;
    currentRef.current = next;

    setUndoStack((stack) => {
      const limited = stack.length >= MAX_HISTORY ? stack.slice(1) : stack;
      return [...limited, prev];
    });
    setRedoStack([]);

    const entry: HistoryEntry = {
      id: _nextId++,
      operation,
      label: operationLabel(operation, labelExtra),
      timestamp: Date.now(),
      hasResult: !!next.editedUrl,
      editedUrl: next.editedUrl,
      preservationPercent: next.preservationPercent,
    };
    setHistory((h) => [...h, entry]);
  }, []);

  /** Undo: return previous snapshot and update stacks. Returns null if empty. */
  const undo = useCallback((): SelectionSnapshot | null => {
    const stack = undoStack;
    if (stack.length === 0) return null;
    const prev = stack[stack.length - 1];
    const current = currentRef.current;
    currentRef.current = prev;
    setUndoStack(stack.slice(0, -1));
    setRedoStack((redo) => [current, ...redo]);
    setHistory((h) => h.slice(0, -1));
    return prev;
  }, [undoStack]);

  /** Redo: move forward. Returns null if nothing to redo. */
  const redo = useCallback((): SelectionSnapshot | null => {
    const [next, ...rest] = redoStack;
    if (!next) return null;
    const current = currentRef.current;
    currentRef.current = next;
    setRedoStack(rest);
    setUndoStack((stack) => [...stack, current]);
    return next;
  }, [redoStack]);

  /** Jump to a specific history index (0-based from start). */
  const jumpTo = useCallback((index: number) => {
    setHistory((h) => {
      if (index < 0 || index >= h.length) return h;
      return h.slice(0, index + 1);
    });
  }, []);

  /** Reset everything (on new image load). */
  const reset = useCallback((initial: SelectionSnapshot) => {
    currentRef.current = initial;
    setUndoStack([]);
    setRedoStack([]);
    setHistory([]);
  }, []);

  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;

  return { push, undo, redo, jumpTo, reset, history, canUndo, canRedo };
}
