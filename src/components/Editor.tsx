"use client";

/* eslint-disable @next/next/no-img-element -- source blobs and edit data URLs are rendered directly. */

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Circle, Image as KonvaImage, Layer, Line, Stage, Transformer } from "react-konva/lib/ReactKonvaCore";
import "konva/lib/shapes/Circle.js";
import "konva/lib/shapes/Image.js";
import "konva/lib/shapes/Line.js";
import "konva/lib/shapes/Transformer.js";
import type Konva from "konva";

type Tool = "brush" | "polygon";
type Point = { x: number; y: number };
type Stroke = { points: number[]; size: number };
type MovingObject = { image: HTMLImageElement; url: string; x: number; y: number; width: number; height: number };

function readImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not read this image."));
    image.src = URL.createObjectURL(file);
  });
}

function createMask(image: HTMLImageElement, strokes: Stroke[], polygon: Point[], scale: number) {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d")!;
  context.scale(1 / scale, 1 / scale);
  context.fillStyle = "#fff";
  context.strokeStyle = "#fff";
  context.lineCap = "round";
  context.lineJoin = "round";
  for (const stroke of strokes) {
    if (stroke.size === 0) {
      context.beginPath();
      for (let i = 0; i < stroke.points.length; i += 2) {
        if (i === 0) context.moveTo(stroke.points[i], stroke.points[i + 1]);
        else context.lineTo(stroke.points[i], stroke.points[i + 1]);
      }
      context.closePath(); context.fill();
    } else {
      context.lineWidth = stroke.size; context.beginPath(); context.moveTo(stroke.points[0], stroke.points[1]);
      for (let i = 2; i < stroke.points.length; i += 2) context.lineTo(stroke.points[i], stroke.points[i + 1]);
      if (stroke.points.length === 2) context.lineTo(stroke.points[0] + 0.01, stroke.points[1]);
      context.stroke();
    }
  }
  if (polygon.length >= 3) {
    context.beginPath(); polygon.forEach((point, index) => index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y));
    context.closePath(); context.fill();
  }
  return canvas;
}

export default function Editor() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [originalUrl, setOriginalUrl] = useState("");
  const [editedUrl, setEditedUrl] = useState("");
  const [tool, setTool] = useState<Tool>("brush");
  const [brushSize, setBrushSize] = useState(36);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [draft, setDraft] = useState<Stroke | null>(null);
  const [polygon, setPolygon] = useState<Point[]>([]);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preservation, setPreservation] = useState<number | null>(null);
  const [comparison, setComparison] = useState(50);
  const [movingObject, setMovingObject] = useState<MovingObject | null>(null);
  const [moveMode, setMoveMode] = useState(false);
  const [workspace, setWorkspace] = useState({ width: 900, height: 620 });
  const stageRef = useRef<Konva.Stage>(null);
  const movingNodeRef = useRef<Konva.Image>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    const element = workspaceRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWorkspace({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (moveMode && movingNodeRef.current && transformerRef.current) {
      transformerRef.current.nodes([movingNodeRef.current]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [moveMode, movingObject]);

  useEffect(() => () => { if (originalUrl) URL.revokeObjectURL(originalUrl); }, [originalUrl]);
  useEffect(() => () => { if (movingObject?.url) URL.revokeObjectURL(movingObject.url); }, [movingObject?.url]);

  const scale = image ? Math.min(workspace.width / image.naturalWidth, workspace.height / image.naturalHeight, 1) : 1;
  const canvasWidth = image ? image.naturalWidth * scale : 0;
  const canvasHeight = image ? image.naturalHeight * scale : 0;

  async function loadFile(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Choose a JPEG, PNG, or WebP image.");
    try {
      const loaded = await readImage(file);
      setImage(loaded);
      setOriginalUrl(loaded.src);
      setEditedUrl("");
      setStrokes([]);
      setPolygon([]);
      setPreservation(null);
      setMovingObject(null);
      setMoveMode(false);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load this image.");
    }
  }

  function position() {
    const pointer = stageRef.current?.getPointerPosition();
    return pointer ? { x: pointer.x, y: pointer.y } : null;
  }

  function beginStroke() {
    if (!image || moveMode || tool !== "brush") return;
    const point = position();
    if (!point) return;
    drawingRef.current = true;
    setDraft({ points: [point.x, point.y], size: brushSize });
  }

  function continueStroke() {
    if (!drawingRef.current || !draft) return;
    const point = position();
    if (!point) return;
    setDraft({ ...draft, points: [...draft.points, point.x, point.y] });
  }

  function endStroke() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (draft) setStrokes((current) => [...current, draft]);
    setDraft(null);
  }

  function commitPolygon() {
    if (polygon.length < 3) return;
    setStrokes((current) => [...current, { points: polygon.flatMap((point) => [point.x, point.y]), size: 0 }]);
    setPolygon([]);
  }

  async function prepareMove() {
    if (!image || !hasSelection) return;
    const mask = createMask(image, strokes, polygon, scale);
    const pixels = mask.getContext("2d")!.getImageData(0, 0, mask.width, mask.height).data;
    let left = mask.width, top = mask.height, right = 0, bottom = 0;
    for (let y = 0; y < mask.height; y += 1) for (let x = 0; x < mask.width; x += 1) {
      if (pixels[(y * mask.width + x) * 4 + 3] > 0) { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y); }
    }
    if (right <= left || bottom <= top) return setError("Select an area before moving it.");
    const padding = Math.max(1, Math.round(brushSize / scale));
    left = Math.max(0, left - padding); top = Math.max(0, top - padding);
    right = Math.min(mask.width - 1, right + padding); bottom = Math.min(mask.height - 1, bottom + padding);
    const cutout = document.createElement("canvas"); cutout.width = mask.width; cutout.height = mask.height;
    const cutoutContext = cutout.getContext("2d")!;
    cutoutContext.drawImage(image, 0, 0);
    cutoutContext.globalCompositeOperation = "destination-in";
    cutoutContext.drawImage(mask, 0, 0);
    const width = right - left + 1, height = bottom - top + 1;
    const cropped = document.createElement("canvas"); cropped.width = width; cropped.height = height;
    cropped.getContext("2d")!.drawImage(cutout, left, top, width, height, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) => cropped.toBlob((value) => value ? resolve(value) : reject(new Error("Could not extract this selection.")), "image/png"));
    const url = URL.createObjectURL(blob);
    const objectImage = await readImage(new File([blob], "selected-object.png", { type: "image/png" }));
    setMovingObject({ image: objectImage, url, x: left * scale, y: top * scale, width: width * scale, height: height * scale });
    setMoveMode(true); setEditedUrl(""); setError("");
  }

  function finishTransform() {
    const node = movingNodeRef.current;
    if (!node) return;
    const width = Math.max(8, node.width() * node.scaleX()), height = Math.max(8, node.height() * node.scaleY());
    setMovingObject((current) => current ? { ...current, x: node.x(), y: node.y(), width, height } : null);
    node.scaleX(1); node.scaleY(1);
  }

  function undo() {
    setMovingObject(null);
    setMoveMode(false);
    if (polygon.length) setPolygon((points) => points.slice(0, -1));
    else setStrokes((current) => current.slice(0, -1));
  }

  async function runEdit() {
    if (!image || !stageRef.current || (moveMode && !movingObject)) return;
    const canvas = createMask(image, strokes, polygon, scale);

    setBusy(true);
    setError("");
    try {
      const mask = await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not create the selection mask.")), "image/png"));
      const sourceBlob = await (await fetch(originalUrl)).blob();
      const form = new FormData();
      form.append("image", sourceBlob, "source.png");
      form.append("mask", mask, "mask.png");
      form.append("prompt", prompt);
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
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The edit could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  const hasSelection = strokes.length > 0 || polygon.length >= 3;
  const handleFile = (event: ChangeEvent<HTMLInputElement>) => void loadFile(event.target.files?.[0]);

  return <main className="app-shell">
    <header className="topbar">
      <a className="brand" href="#"><span className="brand-mark">✳</span><span>image<span className="brand-light">fixer</span></span></a>
      <div className="topbar-center"><span className="saved-dot" />Edits stay in this tab</div>
      <div className="topbar-actions"><button className="quiet-button" onClick={() => { setStrokes([]); setPolygon([]); setMovingObject(null); setMoveMode(false); }}>Reset selection</button><button className="export-button" disabled={!editedUrl} onClick={() => { const anchor = document.createElement("a"); anchor.href = editedUrl; anchor.download = "image-fixer-edit.png"; anchor.click(); }}>↓ <span>Export PNG</span></button></div>
    </header>

    <section className="project-bar"><div><div className="eyebrow">YOUR CREATIVE CANVAS</div><h1>Make the small fix.</h1><p>Careful edits, with the rest of the image left alone.</p></div><div className="project-meta"><span className="meta-icon">⌘</span><div><b>{image ? "Untitled edit" : "New project"}</b><small>{image ? `${image.naturalWidth} × ${image.naturalHeight} px` : "Drop in a photo to begin"}</small></div></div></section>

    <section className="editor-layout">
      <aside className="panel left-panel">
        <div className="panel-heading"><div><span className="step-index">01</span><h2>Select area</h2></div><button className="icon-button" title="Selection help">?</button></div>
        <div className="tool-switch"><button className={tool === "brush" ? "tool active" : "tool"} onClick={() => setTool("brush")}><span>◉</span> Brush</button><button className={tool === "polygon" ? "tool active" : "tool"} onClick={() => setTool("polygon")}><span>⬡</span> Polygon</button></div>
        {hasSelection && <button className={moveMode ? "move-selection active" : "move-selection"} onClick={() => moveMode ? setMoveMode(false) : void prepareMove()}>{moveMode ? "↗ Object ready · drag to place" : "↗ Move / resize selection"}</button>}
        {tool === "brush" && <label className="slider-label">Brush size <span>{brushSize}px</span><input type="range" min="8" max="100" value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} /></label>}
        {tool === "polygon" && <p className="helper-copy">Click to add points. Double click to finish a shape.</p>}
        <div className="selection-actions"><button className="quiet-button" onClick={undo} disabled={!hasSelection}>↶ Undo</button><button className="quiet-button" onClick={() => { setStrokes([]); setPolygon([]); setMovingObject(null); setMoveMode(false); }} disabled={!hasSelection}>Clear</button></div>
        <div className="panel-divider" />
        <div className="panel-heading compact"><div><span className="step-index">02</span><h2>Tell us what to do</h2></div></div>
        <div className="prompt-card"><div className="prompt-title"><span>✦</span> AI INSTRUCTION <span className="optional">OPTIONAL</span></div><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="e.g. Remove the person and continue the brick wall naturally…" rows={5} /></div>
        <div className="quick-prompts"><button onClick={() => setPrompt("Remove the selected object and naturally reconstruct the background behind it.")}>Remove object</button><button onClick={() => setPrompt("Replace the selected area with a natural continuation of its surroundings.")}>Repair background</button></div>
        <button className="primary-button" disabled={!image || !hasSelection || busy} onClick={runEdit}>{busy ? <><span className="spinner" /> Working on your image…</> : <>✦ <span>Fix selected area</span> <span className="button-arrow">↗</span></>}</button>
        <p className="privacy-note"><span>♧</span> Your image is sent securely for processing and is not stored by this app.</p>
      </aside>

      <div className="canvas-column">
        <div className="canvas-toolbar"><div className="canvas-title">{image ? "Untitled edit" : "Untitled canvas"}<span className="unsaved-dot" /></div><div className="canvas-tools"><button title="Zoom out">−</button><span>{image ? `${Math.round(scale * 100)}%` : "100%"}</span><button title="Zoom in">+</button><i /><button title="Fit to canvas">⛶</button></div></div>
        <div ref={workspaceRef} className={`workspace ${image ? "has-image" : ""}`}>
          {!image ? <label className="upload-card" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void loadFile(event.dataTransfer.files[0]); }}><div className="upload-art"><span>▧</span><i>✦</i><i>✦</i></div><strong>Bring an image to life</strong><p>Drop a photo here, or browse files</p><span className="browse-button">Choose an image</span><small>PNG, JPEG, or WebP · up to 18 MB</small><input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFile} /></label> : <div className="image-frame" style={{ width: canvasWidth, height: canvasHeight }}>
            {editedUrl ? <div className="comparison" style={{ width: canvasWidth, height: canvasHeight }}><img src={originalUrl} alt="Original" /><div className="comparison-after" style={{ clipPath: `inset(0 ${100 - comparison}% 0 0)` }}><img src={editedUrl} alt="Edited result" /></div><div className="comparison-divider" style={{ left: `${comparison}%` }}><span>↔</span></div><div className="compare-label before">BEFORE</div><div className="compare-label after">AFTER</div><input aria-label="Before and after comparison" className="comparison-range" type="range" min="0" max="100" value={comparison} onChange={(event) => setComparison(Number(event.target.value))} /></div> : <Stage ref={stageRef} width={canvasWidth} height={canvasHeight} onMouseDown={beginStroke} onMouseMove={continueStroke} onMouseUp={endStroke} onTouchStart={beginStroke} onTouchMove={continueStroke} onTouchEnd={endStroke} onClick={() => { if (!moveMode && tool === "polygon") { const point = position(); if (point) setPolygon((current) => [...current, point]); } }} onDblClick={commitPolygon}>
              <Layer><KonvaImage image={image} width={canvasWidth} height={canvasHeight} /></Layer>
              <Layer listening={false}>{strokes.map((stroke, index) => <Line key={index} points={stroke.points} closed={stroke.size === 0} fill={stroke.size === 0 ? "rgba(230,75,76,.38)" : undefined} stroke="rgba(230,75,76,.72)" strokeWidth={stroke.size || 2} lineCap="round" lineJoin="round" />)}{draft && <Line points={draft.points} stroke="rgba(230,75,76,.72)" strokeWidth={draft.size} lineCap="round" lineJoin="round" />}{polygon.length > 0 && <><Line points={polygon.flatMap((point) => [point.x, point.y])} stroke="#ef5350" strokeWidth={2} lineCap="round" lineJoin="round" />{polygon.map((point, index) => <Circle key={index} x={point.x} y={point.y} radius={3} fill="#fff" stroke="#ef5350" strokeWidth={2} />)}</>}</Layer>
              {moveMode && movingObject && <Layer><KonvaImage ref={movingNodeRef} image={movingObject.image} x={movingObject.x} y={movingObject.y} width={movingObject.width} height={movingObject.height} draggable dragBoundFunc={(position) => ({ x: Math.max(0, Math.min(canvasWidth - movingObject.width, position.x)), y: Math.max(0, Math.min(canvasHeight - movingObject.height, position.y)) })} onDragEnd={(event) => setMovingObject({ ...movingObject, x: event.target.x(), y: event.target.y() })} onTransformEnd={finishTransform} /><Transformer ref={transformerRef} rotateEnabled={false} keepRatio={false} boundBoxFunc={(oldBox, newBox) => newBox.x < 0 || newBox.y < 0 || newBox.x + newBox.width > canvasWidth || newBox.y + newBox.height > canvasHeight ? oldBox : newBox} enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right", "middle-left", "middle-right", "top-center", "bottom-center"]} /></Layer>}
            </Stage>}
          </div>}
          {busy && <div className="busy-overlay"><span className="spinner large" /><b>Finding the right pixels</b><small>Rebuilding your selected area…</small></div>}
          {error && <div className="error-banner"><span>!</span><div>{error}</div><button onClick={() => setError("")}>×</button></div>}
        </div>
        <div className="canvas-footer"><div><span className="cursor-icon">⌖</span>{image ? "Paint over the area you’d like to edit" : "Your image will appear here"}</div><div className="privacy-pill"><span>●</span> Private workspace</div></div>
      </div>

      <aside className="panel right-panel"><div className="panel-heading"><div><span className="step-index">03</span><h2>Result</h2></div><span className="beta-tag">LIVE</span></div>
        {!editedUrl ? <div className="result-empty"><div className="result-orbit"><span>✦</span><i /><i /><i /></div><strong>A little room for magic</strong><p>Your original stays safe. Your new version will land here when it’s ready.</p></div> : <div className="result-info"><div className="result-check">✓</div><strong>Looking good.</strong><p>Compare your edit on the canvas, then export a full size PNG.</p><div className="metric-card"><span>OUTSIDE EDITED AREAS PRESERVED</span><b>{preservation?.toFixed(2)}<small>%</small></b><p>Exact RGB match outside the source and destination masks.</p></div><button className="export-button full" onClick={() => { const anchor = document.createElement("a"); anchor.href = editedUrl; anchor.download = "image-fixer-edit.png"; anchor.click(); }}>↓ Export PNG</button></div>}
        <div className="right-tip"><span>✳</span><div><b>A small tip</b><p>Paint just beyond the object edges to give the AI enough context to blend the repair.</p></div></div>
      </aside>
    </section>
    <footer className="app-footer"><span>IMAGE FIXER <span className="footer-star">✳</span> A MORE THOUGHTFUL WAY TO EDIT</span><span>YOUR ORIGINAL IS ALWAYS ONE STEP AWAY</span></footer>
  </main>;
}
