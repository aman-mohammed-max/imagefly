/**
 * Pure functions for history management, selection utilities, and export helpers.
 * Fully tested and side-effect free.
 */

/**
 * Infer human-friendly operation title from operation type and prompt.
 * @param {string} op
 * @param {string} [prompt]
 * @returns {string}
 */
export function inferOperationTitle(op, prompt) {
  if (op === "ai-edit") {
    if (!prompt) return "AI Inpaint";
    const lower = prompt.toLowerCase();
    if (lower.includes("eye") || lower.includes("iris")) return "Eye Recoloring";
    if (lower.includes("remove") || lower.includes("erase") || lower.includes("delete")) return "Object Removal";
    if (lower.includes("repair") || lower.includes("reconstruct") || lower.includes("background") || lower.includes("replace")) {
      return "Background Repair";
    }
    return `AI Edit: ${prompt.slice(0, 24)}${prompt.length > 24 ? "…" : ""}`;
  }

  switch (op) {
    case "load-image":
      return "Open Image";
    case "brush-stroke":
      return "Brush Stroke";
    case "polygon-point":
      return "Add Polygon Point";
    case "polygon-commit":
      return "Close Polygon";
    case "select-all":
      return "Select Entire Image";
    case "invert-selection":
      return "Invert Selection";
    case "clear-selection":
      return "Clear Selection";
    case "move-start":
      return "Lift Selection";
    case "move-place":
      return "Place Moved Object";
    default:
      return "Edit";
  }
}

/**
 * Create initial history state.
 * @template T
 * @param {T} initialState
 * @param {string} [title="Open Image"]
 * @param {number} [maxEntries=40]
 */
export function createHistory(initialState, title = "Open Image", maxEntries = 40) {
  const initialItem = {
    id: "init-0",
    operation: "load-image",
    title,
    timestamp: Date.now(),
    state: initialState,
  };
  return {
    entries: [initialItem],
    currentIndex: 0,
    maxEntries,
  };
}

/**
 * Push a new state to history. Truncates redo history past currentIndex.
 * @template T
 * @param {any} history
 * @param {T} newState
 * @param {string} operation
 * @param {string} [prompt]
 * @param {{ isAiSuccess?: boolean, detail?: string }} [extra]
 */
export function pushHistory(history, newState, operation, prompt, extra) {
  const activeEntries = history.entries.slice(0, history.currentIndex + 1);

  const newItem = {
    id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    operation,
    title: inferOperationTitle(operation, prompt),
    detail: extra?.detail,
    timestamp: Date.now(),
    state: newState,
    isAiSuccess: extra?.isAiSuccess,
  };

  const combined = [...activeEntries, newItem];
  if (combined.length > history.maxEntries) {
    combined.shift();
  }

  return {
    entries: combined,
    currentIndex: combined.length - 1,
    maxEntries: history.maxEntries,
  };
}

/**
 * Undo to previous state. Returns updated history or null if cannot undo.
 * @param {any} history
 */
export function undoHistory(history) {
  if (history.currentIndex <= 0) return null;
  return {
    ...history,
    currentIndex: history.currentIndex - 1,
  };
}

/**
 * Redo to next state. Returns updated history or null if cannot redo.
 * @param {any} history
 */
export function redoHistory(history) {
  if (history.currentIndex >= history.entries.length - 1) return null;
  return {
    ...history,
    currentIndex: history.currentIndex + 1,
  };
}

/**
 * Jump directly to a specific entry in history by index.
 * @param {any} history
 * @param {number} index
 */
export function jumpToHistory(history, index) {
  if (index < 0 || index >= history.entries.length || index === history.currentIndex) {
    return null;
  }
  return {
    ...history,
    currentIndex: index,
  };
}

/**
 * Create a select-all polygon for given dimensions.
 * @param {number} width
 * @param {number} height
 */
export function createSelectAllPolygon(width, height) {
  return [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
}
