export type OperationType =
  | "load-image"
  | "brush-stroke"
  | "polygon-point"
  | "polygon-commit"
  | "select-all"
  | "invert-selection"
  | "clear-selection"
  | "move-start"
  | "move-place"
  | "ai-edit";

export interface HistoryItem<T> {
  id: string;
  operation: OperationType;
  title: string;
  detail?: string;
  timestamp: number;
  state: T;
  isAiSuccess?: boolean;
}

export interface HistoryState<T> {
  entries: HistoryItem<T>[];
  currentIndex: number;
  maxEntries: number;
}

export function inferOperationTitle(op: OperationType, prompt?: string): string;

export function createHistory<T>(initialState: T, title?: string, maxEntries?: number): HistoryState<T>;

export function pushHistory<T>(
  history: HistoryState<T>,
  newState: T,
  operation: OperationType,
  prompt?: string,
  extra?: { isAiSuccess?: boolean; detail?: string }
): HistoryState<T>;

export function undoHistory<T>(history: HistoryState<T>): HistoryState<T> | null;

export function redoHistory<T>(history: HistoryState<T>): HistoryState<T> | null;

export function jumpToHistory<T>(history: HistoryState<T>, index: number): HistoryState<T> | null;

export function createSelectAllPolygon(width: number, height: number): Array<{ x: number; y: number }>;
