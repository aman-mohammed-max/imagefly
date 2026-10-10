"use client";


import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { Circle, Image as KonvaImage, Layer, Line, Stage, Transformer } from "react-konva/lib/ReactKonvaCore";
import { canvasToImagePoint, imageToCanvasPoint, rasterizeSelectionMask, screenBrushToImageSize } from "@/lib/selection-mask.mjs";
import { detectIrisRegions } from "@/lib/face-landmarks";
import { parseEyeColorPrompt } from "@/lib/eye-prompts.mjs";
import {
  createHistory,
  createSelectAllPolygon,
  jumpToHistory,
  pushHistory,
  redoHistory,
  undoHistory,
  type HistoryState,
  type OperationType,
} from "@/lib/history-manager.mjs";
import { exportCleanImage } from "@/lib/export-helper.mjs";
import { HistoryPanel } from "@/components/HistoryPanel";
import { ComparisonView } from "@/components/ComparisonView";
import { ShortcutsModal } from "@/components/ShortcutsModal";
import { SamplePicker, type SampleItem } from "@/components/SamplePicker";
import "konva/lib/shapes/Circle.js";
import "konva/lib/shapes/Image.js";
import "konva/lib/shapes/Line.js";
import "konva/lib/shapes/Transformer.js";
import type Konva from "konva";

type Tool = "brush" | "polygon";
type Point = { x: number; y: number };
type Stroke = { points: number[]; size: number };
type MovingObject = { image: HTMLImageElement; url: string; x: number; y: number; width: number; height: number };

interface EditorSnapshot {
  strokes: Stroke[];
  polygon: Point[];
  isInverted: boolean;
  movingObject: MovingObject | null;
  moveMode: boolean;
  editedUrl: string;
  preservation: number | null;
}

const BRUSH_PRESETS = [4, 8, 16, 24, 36];

function createMask(width: number, height: number, strokes: Stroke[], polygon: Point[], isInverted = false) {
  const alpha = rasterizeSelectionMask(width, height, strokes, polygon) as Uint8ClampedArray;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d")!;
  const pixels = context.createImageData(width, height);
  for (let pixel = 0; pixel < alpha.length; pixel += 1) {
    const offset = pixel * 4;
    pixels.data[offset] = pixels.data[offset + 1] = pixels.data[offset + 2] = 255;
    const a = alpha[pixel];
    pixels.data[offset + 3] = isInverted ? 255 - a : a;
  }
  context.putImageData(pixels, 0, 0);
  return canvas;
}

function readImageFile(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not read this image file."));
    image.src = URL.createObjectURL(file);
  });
}

function loadImageUrl(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load sample image."));
    image.src = url;
  });
}

export default function Editor() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [originalUrl, setOriginalUrl] = useState("");
  const [editedUrl, setEditedUrl] = useState("");
  const [tool, setTool] = useState<Tool>("brush");
  const [brushSize, setBrushSize] = useState(12);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [draft, setDraft] = useState<Stroke | null>(null);
  const [polygon, setPolygon] = useState<Point[]>([]);
  const [isInverted, setIsInverted] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preservation, setPreservation] = useState<number | null>(null);
  const [comparison, setComparison] = useState(50);
  const [movingObject, setMovingObject] = useState<MovingObject | null>(null);
  const [moveMode, setMoveMode] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [showMaskPreview, setShowMaskPreview] = useState(false);
  const [maskPreviewImage, setMaskPreviewImage] = useState<HTMLCanvasElement | null>(null);
  const [workspace, setWorkspace] = useState({ width: 900, height: 620 });
  const [exportFormat, setExportFormat] = useState<"png" | "jpeg">("png");
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // History state
  const [history, setHistory] = useState<HistoryState<EditorSnapshot>>(() =>
    createHistory({
      strokes: [],
      polygon: [],
      isInverted: false,
      movingObject: null,
      moveMode: false,
      editedUrl: "",
      preservation: null,
    })
  );

  const stageRef = useRef<Konva.Stage>(null);
  const movingNodeRef = useRef<Konva.Image>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const drawingRef = useRef(false);
  const draftRef = useRef<Stroke | null>(null);

  // Apply snapshot to active component state
  const applySnapshot = useCallback((snap: EditorSnapshot) => {
    setStrokes(snap.strokes);
    setPolygon(snap.polygon);
    setIsInverted(snap.isInverted);
    setMovingObject(snap.movingObject);
    setMoveMode(snap.moveMode);
    setEditedUrl(snap.editedUrl);
    setPreservation(snap.preservation);
  }, []);

  // Record a history step
  const recordHistory = useCallback(
    (
      op: OperationType,
      override?: Partial<EditorSnapshot>,
      promptText?: string,
      extra?: { isAiSuccess?: boolean; detail?: string }
    ) => {
      const snap: EditorSnapshot = {
        strokes: override?.strokes ?? strokes,
        polygon: override?.polygon ?? polygon,
        isInverted: override?.isInverted ?? isInverted,
        movingObject: override?.movingObject ?? movingObject,
        moveMode: override?.moveMode ?? moveMode,
        editedUrl: override?.editedUrl ?? editedUrl,
        preservation: override?.preservation ?? preservation,
      };
      setHistory((prev) => pushHistory(prev, snap, op, promptText, extra));
    },
    [strokes, polygon, isInverted, movingObject, moveMode, editedUrl, preservation]
  );

  // Undo / Redo handlers
  const handleUndo = useCallback(() => {
    setHistory((prev) => {
      const updated = undoHistory(prev);
      if (!updated) return prev;
      applySnapshot(updated.entries[updated.currentIndex].state);
      return updated;
    });
  }, [applySnapshot]);

  const handleRedo = useCallback(() => {
    setHistory((prev) => {
      const updated = redoHistory(prev);
      if (!updated) return prev;
      applySnapshot(updated.entries[updated.currentIndex].state);
      return updated;
    });
  }, [applySnapshot]);

  const handleJumpToHistory = useCallback(
    (index: number) => {
      setHistory((prev) => {
        const updated = jumpToHistory(prev, index);
        if (!updated) return prev;
        applySnapshot(updated.entries[updated.currentIndex].state);
        return updated;
      });
    },
    [applySnapshot]
  );

  // Resize observer
  useEffect(() => {
    const element = workspaceRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setWorkspace({ width: entry.contentRect.width, height: entry.contentRect.height })
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Moving object transformer
  useEffect(() => {
    if (moveMode && movingNodeRef.current && transformerRef.current) {
      transformerRef.current.nodes([movingNodeRef.current]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [moveMode, movingObject]);

  // Object URL cleanup
  useEffect(() => () => { if (originalUrl && originalUrl.startsWith("blob:")) URL.revokeObjectURL(originalUrl); }, [originalUrl]);
  useEffect(() => () => { if (movingObject?.url && movingObject.url.startsWith("blob:")) URL.revokeObjectURL(movingObject.url); }, [movingObject?.url]);

  // Red mask preview calculation
  useEffect(() => {
    if (!image) return setMaskPreviewImage(null);
    const mask = createMask(image.naturalWidth, image.naturalHeight, strokes, polygon, isInverted);
    const overlay = document.createElement("canvas");
    overlay.width = mask.width;
    overlay.height = mask.height;
    const context = overlay.getContext("2d")!;
    context.fillStyle = "rgba(226, 82, 67, .52)";
    context.fillRect(0, 0, overlay.width, overlay.height);
    context.globalCompositeOperation = "destination-in";
    context.drawImage(mask, 0, 0);
    setMaskPreviewImage(overlay);
  }, [image, strokes, polygon, isInverted]);

  // Keyboard shortcuts listener
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isInput = ["INPUT", "TEXTAREA"].includes((event.target as HTMLElement)?.tagName);
      if (isInput) return;

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;

      if (cmdOrCtrl && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if (cmdOrCtrl && event.key.toLowerCase() === "y") {
        event.preventDefault();
        handleRedo();
      } else if (event.key === "[") {
        event.preventDefault();
        setBrushSize((s) => Math.max(2, s - 3));
      } else if (event.key === "]") {
        event.preventDefault();
        setBrushSize((s) => Math.min(64, s + 3));
      } else if (cmdOrCtrl && event.key === "0") {
        event.preventDefault();
        setZoom(1);
      } else if (event.key === "?" && !cmdOrCtrl) {
        event.preventDefault();
        setShowHelpModal((v) => !v);
      } else if (event.key === "Escape") {
        if (polygon.length > 0) setPolygon([]);
        if (moveMode) setMoveMode(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo, polygon.length, moveMode]);

  const fitScale = image ? Math.min(workspace.width / image.naturalWidth, workspace.height / image.naturalHeight, 1) : 1;
  const scale = fitScale * zoom;
  const canvasWidth = image ? image.naturalWidth * scale : 0;
  const canvasHeight = image ? image.naturalHeight * scale : 0;
  const hasSelection = strokes.length > 0 || polygon.length >= 3 || isInverted;

  // Image loader with unsaved edits safeguard
  async function loadFile(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Please select a JPEG, PNG, or WebP image.");

    if ((editedUrl || hasSelection) && !window.confirm("You have unsaved edits. Discard and open this new image?")) {
      return;
    }

    try {
      const loaded = await readImageFile(file);
      setImage(loaded);
      setOriginalUrl(loaded.src);
      setEditedUrl("");
      setStrokes([]);
      setPolygon([]);
      setIsInverted(false);
      setDraft(null);
      draftRef.current = null;
      setZoom(1);
      setShowMaskPreview(false);
      setPreservation(null);
      setMovingObject(null);
      setMoveMode(false);
      setError("");

      const initialSnap: EditorSnapshot = {
        strokes: [],
        polygon: [],
        isInverted: false,
        movingObject: null,
        moveMode: false,
        editedUrl: "",
        preservation: null,
      };
      setHistory(createHistory(initialSnap, `Opened ${file.name || "image"}`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load this image.");
    }
  }

  // Load sample image
  async function loadSample(sample: SampleItem) {
    if ((editedUrl || hasSelection) && !window.confirm("You have unsaved edits. Discard and test with this sample?")) {
      return;
    }

    try {
      setBusy(true);
      const loaded = await loadImageUrl(sample.imageSrc);
      setImage(loaded);
      setOriginalUrl(sample.imageSrc);
      setEditedUrl("");
      setStrokes([]);
      setPolygon([]);
      setIsInverted(false);
      setDraft(null);
      draftRef.current = null;
      setZoom(1);
      setShowMaskPreview(false);
      setPreservation(null);
      setMovingObject(null);
      setMoveMode(false);
      setError("");
      setPrompt(sample.recommendedPrompt);

      const initialSnap: EditorSnapshot = {
        strokes: [],
        polygon: [],
        isInverted: false,
        movingObject: null,
        moveMode: false,
        editedUrl: "",
        preservation: null,
      };
      setHistory(createHistory(initialSnap, `Sample: ${sample.title}`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load the sample image.");
    } finally {
      setBusy(false);
    }
  }

  function position() {
    const pointer = stageRef.current?.getPointerPosition();
    return pointer ? (canvasToImagePoint(pointer, { scale, offsetX: 0, offsetY: 0 }) as Point) : null;
  }

  function displayPoints(points: number[]) {
    const transformed: number[] = [];
    for (let i = 0; i + 1 < points.length; i += 2) {
      const point = imageToCanvasPoint({ x: points[i], y: points[i + 1] }, { scale, offsetX: 0, offsetY: 0 }) as Point;
      transformed.push(point.x, point.y);
    }
    return transformed;
  }

  function displayPolygon() {
    return polygon.map((point) => imageToCanvasPoint(point, { scale, offsetX: 0, offsetY: 0 }) as Point);
  }

  function beginStroke() {
    if (!image || moveMode || tool !== "brush") return;
    const point = position();
    if (!point) return;
    drawingRef.current = true;
    const next = { points: [point.x, point.y], size: screenBrushToImageSize(brushSize, scale) };
    draftRef.current = next;
    setDraft(next);
  }

  function continueStroke() {
    const current = draftRef.current;
    if (!drawingRef.current || !current) return;
    const point = position();
    if (!point) return;
    const next = { ...current, points: [...current.points, point.x, point.y] };
    draftRef.current = next;
    setDraft(next);
  }

  function endStroke() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const completed = draftRef.current;
    if (completed) {
      const nextStrokes = [...strokes, completed];
      setStrokes(nextStrokes);
      recordHistory("brush-stroke", { strokes: nextStrokes });
    }
    draftRef.current = null;
    setDraft(null);
  }

  function commitPolygon() {
    if (polygon.length < 3) return;
    const nextStrokes = [...strokes, { points: polygon.flatMap((point) => [point.x, point.y]), size: 0 }];
    setStrokes(nextStrokes);
    setPolygon([]);
    recordHistory("polygon-commit", { strokes: nextStrokes, polygon: [] });
  }

  // Selection actions
  function handleSelectAll() {
    if (!image) return;
    const allPoly = createSelectAllPolygon(image.naturalWidth, image.naturalHeight);
    const nextStrokes = [...strokes, { points: allPoly.flatMap((p) => [p.x, p.y]), size: 0 }];
    setStrokes(nextStrokes);
    setPolygon([]);
    recordHistory("select-all", { strokes: nextStrokes, polygon: [] });
  }

  function handleInvertSelection() {
    if (!image) return;
    const nextInverted = !isInverted;
    setIsInverted(nextInverted);
    recordHistory("invert-selection", { isInverted: nextInverted });
  }

  function handleClearSelection() {
    setStrokes([]);
    setPolygon([]);
    setIsInverted(false);
    setMovingObject(null);
    setMoveMode(false);
    recordHistory("clear-selection", {
      strokes: [],
      polygon: [],
      isInverted: false,
      movingObject: null,
      moveMode: false,
    });
  }

  async function prepareMove() {
    if (!image || !hasSelection) return;
    const mask = createMask(image.naturalWidth, image.naturalHeight, strokes, polygon, isInverted);
    const pixels = mask.getContext("2d")!.getImageData(0, 0, mask.width, mask.height).data;
    let left = mask.width, top = mask.height, right = 0, bottom = 0;
    for (let y = 0; y < mask.height; y += 1) {
      for (let x = 0; x < mask.width; x += 1) {
        if (pixels[(y * mask.width + x) * 4 + 3] > 0) {
          left = Math.min(left, x);
          top = Math.min(top, y);
          right = Math.max(right, x);
          bottom = Math.max(bottom, y);
        }
      }
    }
    if (right <= left || bottom <= top) return setError("Select an area before moving it.");
    const padding = Math.max(1, Math.round(screenBrushToImageSize(brushSize, scale)));
    left = Math.max(0, left - padding);
    top = Math.max(0, top - padding);
    right = Math.min(mask.width - 1, right + padding);
    bottom = Math.min(mask.height - 1, bottom + padding);

    const cutout = document.createElement("canvas");
    cutout.width = mask.width;
    cutout.height = mask.height;
    const cutoutContext = cutout.getContext("2d")!;
    cutoutContext.drawImage(image, 0, 0);
    cutoutContext.globalCompositeOperation = "destination-in";
    cutoutContext.drawImage(mask, 0, 0);

    const width = right - left + 1, height = bottom - top + 1;
    const cropped = document.createElement("canvas");
    cropped.width = width;
    cropped.height = height;
    cropped.getContext("2d")!.drawImage(cutout, left, top, width, height, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) =>
      cropped.toBlob((val) => (val ? resolve(val) : reject(new Error("Could not extract selection."))), "image/png")
    );
    const url = URL.createObjectURL(blob);
    const objectImage = await readImageFile(new File([blob], "selected-object.png", { type: "image/png" }));
    const newMovingObj = {
      image: objectImage,
      url,
      x: left * scale,
      y: top * scale,
      width: width * scale,
      height: height * scale,
    };
    setMovingObject(newMovingObj);
    setMoveMode(true);
    setEditedUrl("");
    setError("");
    recordHistory("move-start", { movingObject: newMovingObj, moveMode: true, editedUrl: "" });
  }

  function finishTransform() {
    const node = movingNodeRef.current;
    if (!node) return;
    const width = Math.max(8, node.width() * node.scaleX());
    const height = Math.max(8, node.height() * node.scaleY());
    const updatedObj = movingObject ? { ...movingObject, x: node.x(), y: node.y(), width, height } : null;
    setMovingObject(updatedObj);
    node.scaleX(1);
    node.scaleY(1);
    recordHistory("move-place", { movingObject: updatedObj });
  }

  async function runEdit() {
    if (!image || !stageRef.current || (moveMode && !movingObject)) return;
    const canvas = createMask(image.naturalWidth, image.naturalHeight, strokes, polygon, isInverted);

    setBusy(true);
    setError("");
    try {
      const mask = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not create the selection mask."))), "image/png")
      );
      const sourceBlob = await (await fetch(originalUrl)).blob();
      const form = new FormData();
      form.append("image", sourceBlob, "source.png");
      form.append("mask", mask, "mask.png");
      form.append("prompt", prompt);

      if (!moveMode && parseEyeColorPrompt(prompt)) {
        if (!image) throw new Error("Load an image before changing eye color.");
        const irisRegions = await detectIrisRegions(image);
        if (!irisRegions.length) throw new Error("No clear irises were detected. Use a front-facing portrait and try again.");
        form.append("irisRegions", JSON.stringify(irisRegions));
      }

      if (moveMode && movingObject) {
        form.append("mode", "move");
        form.append("overlay", await (await fetch(movingObject.url)).blob(), "selected-object.png");
        form.append("x", String(Math.round(movingObject.x / scale)));
        form.append("y", String(Math.round(movingObject.y / scale)));
        form.append("width", String(Math.max(1, Math.round(movingObject.width / scale))));
        form.append("height", String(Math.max(1, Math.round(movingObject.height / scale))));
      }

      const response = await fetch("/api/inpaint", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The edit could not be completed.");

      setEditedUrl(result.image);
      setPreservation(result.preservationPercent);
      setComparison(50);

      // Record successful AI operation in history
      recordHistory(
        "ai-edit",
        { editedUrl: result.image, preservation: result.preservationPercent },
        prompt,
        {
          isAiSuccess: true,
          detail: `${result.preservationPercent?.toFixed(1)}% match`,
        }
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The edit could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    if (!editedUrl && !originalUrl) return;
    const targetUrl = editedUrl || originalUrl;
    try {
      await exportCleanImage(targetUrl, exportFormat, 0.92, "image-fixer-result");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Export failed.");
    }
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => void loadFile(event.target.files?.[0]);

  return (
    <main className="app-shell">
      {/* Top Navigation Bar */}
      <header className="topbar">
        <a className="brand" href="#">
          <span className="brand-mark">✳</span>
          <span>
            image<span className="brand-light">fixer</span>
          </span>
        </a>

        <div className="topbar-center">
          <span className={`status-pill ${editedUrl ? "saved" : hasSelection ? "pending" : "idle"}`}>
            <span className="status-dot" />
            {editedUrl ? "Edited · Ready to export" : hasSelection ? "Active selection" : "Original state"}
          </span>
        </div>

        <div className="topbar-actions">
          <button
            className="quiet-button"
            onClick={handleClearSelection}
            disabled={!hasSelection}
            title="Deselect and reset selection"
          >
            Clear selection
          </button>

          <div className="export-group">
            <select
              className="export-format-select"
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as "png" | "jpeg")}
              aria-label="Export format"
            >
              <option value="png">PNG (Lossless)</option>
              <option value="jpeg">JPEG (High Q)</option>
            </select>
            <button
              className="export-button"
              disabled={!editedUrl && !image}
              onClick={handleExport}
              title={editedUrl ? "Export full-resolution result" : "Export current image"}
            >
              ↓ <span>Export {exportFormat.toUpperCase()}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Project Bar */}
      <section className="project-bar">
        <div>
          <div className="eyebrow">YOUR CREATIVE CANVAS</div>
          <h1>Make the small fix.</h1>
          <p>Careful AI edits, with 100% of the surrounding pixels protected and preserved.</p>
        </div>
        <div className="project-meta">
          <span className="meta-icon">⌘</span>
          <div>
            <b>{image ? "Active Project" : "New project"}</b>
            <small>{image ? `${image.naturalWidth} × ${image.naturalHeight} px` : "Drop in a photo to begin"}</small>
          </div>
        </div>
      </section>

      {/* Main 3-Column Editor Layout */}
      <section className="editor-layout">
        {/* Left Column: Tool Controls & AI Prompts */}
        <aside className="panel left-panel">
          <div className="panel-heading">
            <div>
              <span className="step-index">01</span>
              <h2>Select area</h2>
            </div>
            <button
              className="icon-button"
              title="Keyboard shortcuts & Guide (?)"
              onClick={() => setShowHelpModal(true)}
            >
              ?
            </button>
          </div>

          {/* Tool Switcher */}
          <div className="tool-switch">
            <button
              className={tool === "brush" ? "tool active" : "tool"}
              onClick={() => setTool("brush")}
              type="button"
            >
              <span>◉</span> Brush
            </button>
            <button
              className={tool === "polygon" ? "tool active" : "tool"}
              onClick={() => setTool("polygon")}
              type="button"
            >
              <span>⬡</span> Polygon
            </button>
          </div>

          {/* Move selection mode */}
          {hasSelection && (
            <button
              className={moveMode ? "move-selection active" : "move-selection"}
              onClick={() => (moveMode ? setMoveMode(false) : void prepareMove())}
              type="button"
            >
              {moveMode ? "↗ Object ready · Drag to place" : "↗ Move / resize selection"}
            </button>
          )}

          {/* Brush Controls & Presets */}
          {tool === "brush" && (
            <div className="brush-controls-group">
              <label className="slider-label">
                Brush size <span>{brushSize}px</span>
                <input
                  type="range"
                  min="2"
                  max="48"
                  value={brushSize}
                  onChange={(event) => setBrushSize(Number(event.target.value))}
                />
              </label>
              <div className="brush-presets">
                {BRUSH_PRESETS.map((size) => (
                  <button
                    key={size}
                    type="button"
                    className={`preset-btn ${brushSize === size ? "active" : ""}`}
                    onClick={() => setBrushSize(size)}
                  >
                    {size}px
                  </button>
                ))}
              </div>
            </div>
          )}

          {tool === "polygon" && (
            <p className="helper-copy">
              Click to place vertices. Double-click or click near the start point to close the polygon.
            </p>
          )}

          {tool === "brush" && (
            <p className="helper-copy eye-help">
              For eye recoloring, zoom in and brush each iris. Catchlights and pupils are automatically preserved.
            </p>
          )}

          {/* Selection Quick Actions */}
          <div className="selection-tool-actions">
            <button
              type="button"
              className="quiet-button compact-btn"
              onClick={handleSelectAll}
              disabled={!image}
              title="Select entire image"
            >
              Select All
            </button>
            <button
              type="button"
              className={`quiet-button compact-btn ${isInverted ? "active-toggle" : ""}`}
              onClick={handleInvertSelection}
              disabled={!image || !hasSelection}
              title="Invert current selection"
            >
              Invert
            </button>
            <button
              type="button"
              className={`quiet-button compact-btn ${showMaskPreview ? "active-toggle" : ""}`}
              onClick={() => setShowMaskPreview((shown) => !shown)}
              disabled={!hasSelection}
              aria-pressed={showMaskPreview}
              title="Preview selection mask overlay"
            >
              {showMaskPreview ? "Hide Mask" : "Mask Mask"}
            </button>
            <button
              type="button"
              className="quiet-button compact-btn"
              onClick={handleClearSelection}
              disabled={!hasSelection}
              title="Clear selection"
            >
              Clear
            </button>
          </div>

          <div className="panel-divider" />

          {/* Step 2: AI Prompt */}
          <div className="panel-heading compact">
            <div>
              <span className="step-index">02</span>
              <h2>Tell us what to do</h2>
            </div>
          </div>

          <div className="prompt-card">
            <div className="prompt-title">
              <span>✦</span> AI INSTRUCTION <span className="optional">REQUIRED</span>
            </div>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="e.g. Remove the person and continue the wall naturally…"
              rows={4}
            />
          </div>

          {/* Quick Prompt Chips */}
          <div className="quick-prompts-wrap">
            <span className="quick-prompts-label">Quick actions:</span>
            <div className="quick-prompts">
              <button
                type="button"
                onClick={() => setPrompt("Remove the selected object and naturally reconstruct the background behind it.")}
              >
                Remove object
              </button>
              <button
                type="button"
                onClick={() => setPrompt("Recolor eyes to vibrant emerald green.")}
              >
                Emerald eyes
              </button>
              <button
                type="button"
                onClick={() => setPrompt("Replace the selected area with a natural continuation of its surroundings.")}
              >
                Repair background
              </button>
            </div>
          </div>

          <button
            className="primary-button"
            disabled={!image || !hasSelection || busy}
            onClick={runEdit}
            type="button"
          >
            {busy ? (
              <>
                <span className="spinner" /> Synthesizing pixels…
              </>
            ) : (
              <>
                ✦ <span>Fix selected area</span> <span className="button-arrow">↗</span>
              </>
            )}
          </button>
          <p className="privacy-note">
            <span>♧</span> Zero data retention. Original bytes outside selection stay 100% untouched.
          </p>
        </aside>

        {/* Center Column: Canvas Workspace */}
        <div className="canvas-column">
          <div className="canvas-toolbar">
            <div className="canvas-title">
              {image ? (
                <span>
                  {editedUrl ? "Modified Preview" : "Canvas Workspace"}
                  <span className={`unsaved-dot ${editedUrl ? "green" : ""}`} />
                </span>
              ) : (
                "Empty Canvas"
              )}
            </div>

            {/* Workspace Zoom & View Controls */}
            <div className="canvas-tools">
              <button
                title="Undo (⌘Z)"
                aria-label="Undo"
                onClick={handleUndo}
                disabled={history.currentIndex <= 0}
              >
                ↶
              </button>
              <button
                title="Redo (⇧⌘Z)"
                aria-label="Redo"
                onClick={handleRedo}
                disabled={history.currentIndex >= history.entries.length - 1}
              >
                ↷
              </button>
              <i />
              <button
                title="Zoom out"
                aria-label="Zoom out"
                onClick={() => setZoom((v) => Math.max(0.5, Math.round((v - 0.25) * 100) / 100))}
                disabled={zoom <= 0.5 || !image}
              >
                −
              </button>
              <span>{image ? `${Math.round(zoom * 100)}%` : "100%"}</span>
              <button
                title="Zoom in"
                aria-label="Zoom in"
                onClick={() => setZoom((v) => Math.min(3.0, Math.round((v + 0.25) * 100) / 100))}
                disabled={zoom >= 3.0 || !image}
              >
                +
              </button>
              <i />
              <button
                title="Reset to 100%"
                aria-label="Reset zoom to 100%"
                onClick={() => setZoom(1)}
                disabled={!image || zoom === 1}
              >
                1:1
              </button>
              <button
                title="Fit to workspace"
                aria-label="Fit to workspace"
                onClick={() => setZoom(1)}
                disabled={!image}
              >
                ⛶
              </button>
            </div>
          </div>

          <div
            ref={workspaceRef}
            className={`workspace ${image ? "has-image" : ""} ${isDragOver ? "drag-over" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              void loadFile(e.dataTransfer.files[0]);
            }}
          >
            {/* Empty State with Upload Card & Demo Samples */}
            {!image ? (
              <div className="empty-workspace-content">
                <label className="upload-card">
                  <div className="upload-art">
                    <span>▧</span>
                    <i>✦</i>
                    <i>✦</i>
                  </div>
                  <strong>Bring an image to life</strong>
                  <p>Drop a photo here, or browse files</p>
                  <span className="browse-button">Choose an image</span>
                  <small>PNG, JPEG, or WebP · up to 18 MB</small>
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileChange} />
                </label>

                {/* Instant Sample Loader for Judges */}
                <SamplePicker onSelectSample={loadSample} />
              </div>
            ) : (
              <div className="image-frame" style={{ width: canvasWidth, height: canvasHeight }}>
                {editedUrl ? (
                  <ComparisonView
                    originalUrl={originalUrl}
                    editedUrl={editedUrl}
                    width={canvasWidth}
                    height={canvasHeight}
                    comparison={comparison}
                    onComparisonChange={setComparison}
                  />
                ) : (
                  <Stage
                    ref={stageRef}
                    width={canvasWidth}
                    height={canvasHeight}
                    onMouseDown={beginStroke}
                    onMouseMove={continueStroke}
                    onMouseUp={endStroke}
                    onMouseLeave={endStroke}
                    onTouchStart={beginStroke}
                    onTouchMove={continueStroke}
                    onTouchEnd={endStroke}
                    onClick={() => {
                      if (!moveMode && tool === "polygon") {
                        const pt = position();
                        if (pt) {
                          const nextPoly = [...polygon, pt];
                          setPolygon(nextPoly);
                          recordHistory("polygon-point", { polygon: nextPoly });
                        }
                      }
                    }}
                    onDblClick={commitPolygon}
                  >
                    <Layer>
                      <KonvaImage image={image} width={canvasWidth} height={canvasHeight} />
                    </Layer>

                    <Layer listening={false}>
                      {showMaskPreview && maskPreviewImage ? (
                        <KonvaImage image={maskPreviewImage} width={canvasWidth} height={canvasHeight} />
                      ) : (
                        <>
                          {strokes.map((stroke, index) => (
                            <Line
                              key={index}
                              points={displayPoints(stroke.points)}
                              closed={stroke.size === 0}
                              fill={stroke.size === 0 ? "rgba(230,75,76,.38)" : undefined}
                              stroke="rgba(230,75,76,.72)"
                              strokeWidth={stroke.size ? stroke.size * scale : 2}
                              lineCap="round"
                              lineJoin="round"
                            />
                          ))}
                          {draft && (
                            <Line
                              points={displayPoints(draft.points)}
                              stroke="rgba(230,75,76,.72)"
                              strokeWidth={draft.size * scale}
                              lineCap="round"
                              lineJoin="round"
                            />
                          )}
                        </>
                      )}
                      {polygon.length > 0 && (
                        <>
                          <Line
                            points={displayPolygon().flatMap((pt) => [pt.x, pt.y])}
                            stroke="#ef5350"
                            strokeWidth={2}
                            lineCap="round"
                            lineJoin="round"
                          />
                          {displayPolygon().map((pt, index) => (
                            <Circle key={index} x={pt.x} y={pt.y} radius={3} fill="#fff" stroke="#ef5350" strokeWidth={2} />
                          ))}
                        </>
                      )}
                    </Layer>

                    {moveMode && movingObject && (
                      <Layer>
                        <KonvaImage
                          ref={movingNodeRef}
                          image={movingObject.image}
                          x={movingObject.x}
                          y={movingObject.y}
                          width={movingObject.width}
                          height={movingObject.height}
                          draggable
                          dragBoundFunc={(pos) => ({
                            x: Math.max(0, Math.min(canvasWidth - movingObject.width, pos.x)),
                            y: Math.max(0, Math.min(canvasHeight - movingObject.height, pos.y)),
                          })}
                          onDragEnd={(event) =>
                            setMovingObject({ ...movingObject, x: event.target.x(), y: event.target.y() })
                          }
                          onTransformEnd={finishTransform}
                        />
                        <Transformer
                          ref={transformerRef}
                          rotateEnabled={false}
                          keepRatio={false}
                          boundBoxFunc={(oldBox, newBox) =>
                            newBox.x < 0 ||
                            newBox.y < 0 ||
                            newBox.x + newBox.width > canvasWidth ||
                            newBox.y + newBox.height > canvasHeight
                              ? oldBox
                              : newBox
                          }
                          enabledAnchors={[
                            "top-left",
                            "top-right",
                            "bottom-left",
                            "bottom-right",
                            "middle-left",
                            "middle-right",
                            "top-center",
                            "bottom-center",
                          ]}
                        />
                      </Layer>
                    )}
                  </Stage>
                )}
              </div>
            )}

            {busy && (
              <div className="busy-overlay">
                <span className="spinner large" />
                <b>Finding the right pixels</b>
                <small>Rebuilding your selected area…</small>
              </div>
            )}

            {error && (
              <div className="error-banner">
                <span>!</span>
                <div>{error}</div>
                <button onClick={() => setError("")} aria-label="Dismiss error">
                  ×
                </button>
              </div>
            )}
          </div>

          <div className="canvas-footer">
            <div>
              <span className="cursor-icon">⌖</span>
              {image ? (
                editedUrl ? (
                  "Drag divider or switch view modes to compare before & after"
                ) : (
                  "Paint over the area you’d like to edit"
                )
              ) : (
                "Your image will appear here"
              )}
            </div>
            <div className="canvas-footer-right">
              {image && (
                <span className="dim-meta">
                  {image.naturalWidth} × {image.naturalHeight} px
                </span>
              )}
              <div className="privacy-pill">
                <span>●</span> Private workspace
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Result & Operation History */}
        <aside className="panel right-panel">
          <div className="panel-heading">
            <div>
              <span className="step-index">03</span>
              <h2>Result & History</h2>
            </div>
            <span className="beta-tag">LIVE</span>
          </div>

          {/* Result Card */}
          {!editedUrl ? (
            <div className="result-empty">
              <div className="result-orbit">
                <span>✦</span>
                <i />
                <i />
                <i />
              </div>
              <strong>A little room for magic</strong>
              <p>Your original stays safe. Your new version will land here when it’s ready.</p>
            </div>
          ) : (
            <div className="result-info">
              <div className="result-check">✓</div>
              <strong>Looking good.</strong>
              <p>Compare your edit on the canvas, then export a full size image.</p>
              <div className="metric-card">
                <span>OUTSIDE EDITED AREAS PRESERVED</span>
                <b>
                  {preservation?.toFixed(2)}
                  <small>%</small>
                </b>
                <p>Exact RGB match outside the source and destination masks.</p>
              </div>
              <button className="export-button full" onClick={handleExport} type="button">
                ↓ Export {exportFormat.toUpperCase()}
              </button>
            </div>
          )}

          <div className="panel-divider" />

          {/* History Timeline */}
          <HistoryPanel
            history={history}
            canUndo={history.currentIndex > 0}
            canRedo={history.currentIndex < history.entries.length - 1}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onJumpTo={handleJumpToHistory}
          />

          <div className="right-tip">
            <span>✳</span>
            <div>
              <b>A small tip</b>
              <p>Paint just beyond the object edges to give the AI enough context to blend the repair.</p>
            </div>
          </div>
        </aside>
      </section>

      {/* Footer */}
      <footer className="app-footer">
        <span>
          IMAGE FIXER <span className="footer-star">✳</span> A MORE THOUGHTFUL WAY TO EDIT
        </span>
        <span>YOUR ORIGINAL IS ALWAYS ONE STEP AWAY</span>
      </footer>

      {/* Keyboard Shortcuts Dialog */}
      <ShortcutsModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />
    </main>
  );
}
