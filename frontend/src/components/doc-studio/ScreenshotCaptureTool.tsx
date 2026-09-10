/**
 * Screenshot Capture Tool for documentation editing.
 * Pick a window → select region with crosshairs → annotate → insert into markdown.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Camera,
  Check,
  Highlighter,
  Loader2,
  MousePointer2,
  Redo2,
  Square,
  Type,
  X,
} from 'lucide-react';
import {
  type Annotation,
  type AnnotationColor,
  type AnnotationTool,
  type TransformHandle,
  type WorkspaceTool,
  createAnnotationId,
  cropImageToCanvas,
  defaultTextFontSize,
  drawAnnotations,
  flattenScreenshot,
  generateScreenshotFilename,
  grabDisplayFrame,
  hitTestAnnotation,
  hitTestHandle,
  isDisplayCaptureSupported,
  measureTextSize,
  moveAnnotation,
  normalizeSelectionRect,
  resizeAnnotation,
  rotateAnnotation,
  type SelectionRect,
} from '@/utils/screenshotCapture';

export type UploadScreenshotFn = (
  blob: Blob,
  filename: string,
  topicId?: string | null
) => Promise<{ url: string; filename: string }>;

type CaptureStep = 'intro' | 'select' | 'annotate' | 'uploading';

interface ScreenshotCaptureToolProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (url: string, filename: string) => void;
  topicId?: string | null | undefined;
  uploadScreenshot: UploadScreenshotFn;
}

const COLORS: { color: AnnotationColor; label: string }[] = [
  { color: '#ef4444', label: 'Red' },
  { color: '#eab308', label: 'Yellow' },
  { color: '#3b82f6', label: 'Blue' },
];

const TOOLS: { tool: WorkspaceTool; label: string; icon: React.ReactNode }[] = [
  { tool: 'select', label: 'Select', icon: <MousePointer2 className="w-4 h-4" /> },
  { tool: 'arrow', label: 'Arrow', icon: <ArrowRight className="w-4 h-4" /> },
  { tool: 'rect', label: 'Box', icon: <Square className="w-4 h-4" /> },
  { tool: 'highlight', label: 'Highlight', icon: <Highlighter className="w-4 h-4" /> },
  { tool: 'text', label: 'Text', icon: <Type className="w-4 h-4" /> },
];

export const ScreenshotCaptureTool: React.FC<ScreenshotCaptureToolProps> = ({
  isOpen,
  onClose,
  onInsert,
  topicId,
  uploadScreenshot,
}) => {
  const [step, setStep] = useState<CaptureStep>('intro');
  const [captureDataUrl, setCaptureDataUrl] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [selection, setSelection] = useState<SelectionRect | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null);
  const [activeTool, setActiveTool] = useState<WorkspaceTool>('select');
  const [activeColor, setActiveColor] = useState<AnnotationColor>('#ef4444');
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);
  const [transform, setTransform] = useState<{
    handle: TransformHandle;
    lastX: number;
    lastY: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const imageRef = useRef<HTMLImageElement>(null);
  const selectContainerRef = useRef<HTMLDivElement>(null);
  const annotateCanvasRef = useRef<HTMLCanvasElement>(null);
  const baseCropCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const resetState = useCallback(() => {
    setStep('intro');
    setCaptureDataUrl(null);
    setImageSize({ width: 0, height: 0 });
    setSelection(null);
    setDragStart(null);
    setDragCurrent(null);
    setAnnotations([]);
    setSelectedId(null);
    setDrawStart(null);
    setDrawCurrent(null);
    setTransform(null);
    setActiveTool('select');
    setErrorMessage(null);
    setUploadError(null);
    baseCropCanvasRef.current = null;
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [onClose, resetState]);

  const startCapture = useCallback(async () => {
    if (!isDisplayCaptureSupported()) {
      setErrorMessage(
        'Your browser does not support screen capture. Try pasting an image (Ctrl+V) or use the Media Library instead.'
      );
      return;
    }
    setErrorMessage(null);
    const frame = await grabDisplayFrame();
    if (!frame) {
      setErrorMessage(
        'Could not capture the screen. You may have cancelled the picker, or your browser blocked access. Try again, paste an image, or use the Media Library.'
      );
      setStep('intro');
      return;
    }
    setCaptureDataUrl(frame.dataUrl);
    setImageSize({ width: frame.width, height: frame.height });
    setStep('select');
  }, []);

  const getImageCoords = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const container = selectContainerRef.current;
      const img = imageRef.current;
      if (!container || !img || !imageSize.width) return null;

      const containerRect = container.getBoundingClientRect();
      const displayW = img.clientWidth;
      const displayH = img.clientHeight;
      const offsetX = (containerRect.width - displayW) / 2;
      const offsetY = (containerRect.height - displayH) / 2;
      const relX = clientX - containerRect.left - offsetX;
      const relY = clientY - containerRect.top - offsetY;
      const scaleX = imageSize.width / displayW;
      const scaleY = imageSize.height / displayH;
      const x = Math.round(relX * scaleX);
      const y = Math.round(relY * scaleY);
      if (x < 0 || y < 0 || x > imageSize.width || y > imageSize.height) return null;
      return { x, y };
    },
    [imageSize]
  );

  const handleSelectMouseDown = (e: React.MouseEvent) => {
    const coords = getImageCoords(e.clientX, e.clientY);
    if (!coords) return;
    setSelection(null);
    setDragStart(coords);
    setDragCurrent(coords);
  };

  const handleSelectMouseMove = (e: React.MouseEvent) => {
    if (!dragStart) return;
    const coords = getImageCoords(e.clientX, e.clientY);
    if (coords) setDragCurrent(coords);
  };

  const handleSelectMouseUp = () => {
    if (!dragStart || !dragCurrent) return;
    const rect = normalizeSelectionRect(
      dragStart.x,
      dragStart.y,
      dragCurrent.x,
      dragCurrent.y,
      imageSize.width,
      imageSize.height
    );
    setSelection(rect);
    setDragStart(null);
    setDragCurrent(null);
  };

  const activeDragRect = (): SelectionRect | null => {
    if (!dragStart || !dragCurrent) return selection;
    return normalizeSelectionRect(
      dragStart.x,
      dragStart.y,
      dragCurrent.x,
      dragCurrent.y,
      imageSize.width,
      imageSize.height
    );
  };

  const confirmSelection = useCallback(
    (rect: SelectionRect | null) => {
      const finalRect =
        rect ||
        (imageSize.width > 0
          ? { x: 0, y: 0, width: imageSize.width, height: imageSize.height }
          : null);
      if (!finalRect || !captureDataUrl) return;

      const img = new Image();
      img.onload = () => {
        const cropped = cropImageToCanvas(img, finalRect);
        baseCropCanvasRef.current = cropped;
        setSelection(finalRect);
        setStep('annotate');
      };
      img.src = captureDataUrl;
    },
    [captureDataUrl, imageSize]
  );

  const handleUseWholeImage = () => {
    confirmSelection({ x: 0, y: 0, width: imageSize.width, height: imageSize.height });
  };

  const handleConfirmRegion = useCallback(() => {
    const rect =
      dragStart && dragCurrent
        ? normalizeSelectionRect(
            dragStart.x,
            dragStart.y,
            dragCurrent.x,
            dragCurrent.y,
            imageSize.width,
            imageSize.height
          )
        : selection;
    if (rect) confirmSelection(rect);
  }, [dragStart, dragCurrent, selection, imageSize, confirmSelection]);

  // Draw annotation preview canvas
  useEffect(() => {
    if (step !== 'annotate' || !baseCropCanvasRef.current) return;
    const canvas = annotateCanvasRef.current;
    const base = baseCropCanvasRef.current;
    if (!canvas || !base) return;
    canvas.width = base.width;
    canvas.height = base.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(base, 0, 0);

    const previewList = [...annotations];
    if (drawStart && drawCurrent && activeTool !== 'select' && activeTool !== 'text') {
      previewList.push({
        id: 'preview',
        type: activeTool,
        color: activeColor,
        x1: drawStart.x,
        y1: drawStart.y,
        x2: drawCurrent.x,
        y2: drawCurrent.y,
      });
    }
    drawAnnotations(ctx, previewList, canvas.width, canvas.height, selectedId);
  }, [step, annotations, drawStart, drawCurrent, activeTool, activeColor, selectedId]);

  const getAnnotateCoords = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const canvas = annotateCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.round((clientX - rect.left) * scaleX);
    const y = Math.round((clientY - rect.top) * scaleY);
    if (x < 0 || y < 0 || x > canvas.width || y > canvas.height) return null;
    return { x, y };
  };

  const handleAnnotateMouseDown = (e: React.MouseEvent) => {
    const coords = getAnnotateCoords(e.clientX, e.clientY);
    if (!coords) return;
    const canvas = annotateCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // Prefer transforming the current selection when a handle is hit.
    if (selectedId) {
      const selected = annotations.find(a => a.id === selectedId);
      if (selected) {
        const handle = hitTestHandle(ctx, selected, coords.x, coords.y, canvas.width, canvas.height);
        if (handle) {
          setTransform({ handle, lastX: coords.x, lastY: coords.y });
          return;
        }
      }
    }

    const hit = hitTestAnnotation(ctx, annotations, coords.x, coords.y, canvas.width, canvas.height);
    if (hit) {
      setSelectedId(hit.id);
      setActiveTool('select');
      const handle =
        hitTestHandle(ctx, hit, coords.x, coords.y, canvas.width, canvas.height) || 'move';
      setTransform({ handle, lastX: coords.x, lastY: coords.y });
      return;
    }

    setSelectedId(null);

    if (activeTool === 'select') return;

    if (activeTool === 'text') {
      const text = window.prompt('Enter label text:');
      if (!text?.trim()) return;
      const fontSize = defaultTextFontSize(canvas.width, canvas.height);
      const size = measureTextSize(ctx, text.trim(), fontSize);
      const id = createAnnotationId();
      setAnnotations(prev => [
        ...prev,
        {
          id,
          type: 'text',
          color: activeColor,
          text: text.trim(),
          fontSize,
          rotation: 0,
          x1: coords.x - size.width / 2,
          y1: coords.y - size.height / 2,
          x2: coords.x + size.width / 2,
          y2: coords.y + size.height / 2,
        },
      ]);
      setSelectedId(id);
      setActiveTool('select');
      return;
    }

    setDrawStart(coords);
    setDrawCurrent(coords);
  };

  const handleAnnotateMouseMove = (e: React.MouseEvent) => {
    const coords = getAnnotateCoords(e.clientX, e.clientY);
    if (!coords) return;
    const canvas = annotateCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    if (transform && selectedId) {
      setAnnotations(prev =>
        prev.map(ann => {
          if (ann.id !== selectedId) return ann;
          if (transform.handle === 'move') {
            return moveAnnotation(ann, coords.x - transform.lastX, coords.y - transform.lastY);
          }
          if (transform.handle === 'rotate') {
            return rotateAnnotation(ann, coords.x, coords.y);
          }
          return resizeAnnotation(
            ann,
            transform.handle,
            coords.x,
            coords.y,
            canvas.width,
            canvas.height,
            ctx
          );
        })
      );
      setTransform({ ...transform, lastX: coords.x, lastY: coords.y });
      return;
    }

    if (drawStart) setDrawCurrent(coords);
  };

  const handleAnnotateMouseUp = () => {
    if (transform) {
      setTransform(null);
      return;
    }
    if (!drawStart || !drawCurrent || activeTool === 'select' || activeTool === 'text') {
      setDrawStart(null);
      setDrawCurrent(null);
      return;
    }
    const w = Math.abs(drawCurrent.x - drawStart.x);
    const h = Math.abs(drawCurrent.y - drawStart.y);
    if (w >= 4 || h >= 4) {
      const id = createAnnotationId();
      setAnnotations(prev => [
        ...prev,
        {
          id,
          type: activeTool as AnnotationTool,
          color: activeColor,
          x1: drawStart.x,
          y1: drawStart.y,
          x2: drawCurrent.x,
          y2: drawCurrent.y,
          rotation: 0,
        },
      ]);
      setSelectedId(id);
      setActiveTool('select');
    }
    setDrawStart(null);
    setDrawCurrent(null);
  };

  const handleUndo = () => {
    setAnnotations(prev => {
      const next = prev.slice(0, -1);
      setSelectedId(cur => (cur && !next.some(a => a.id === cur) ? null : cur));
      return next;
    });
  };

  const handleDeleteSelected = () => {
    if (!selectedId) return;
    setAnnotations(prev => prev.filter(a => a.id !== selectedId));
    setSelectedId(null);
  };

  const handleInsert = async () => {
    const base = baseCropCanvasRef.current;
    if (!base) return;
    setStep('uploading');
    setUploadError(null);
    try {
      const blob = await flattenScreenshot(base, annotations);
      if (!blob) throw new Error('Could not prepare image');
      const filename = generateScreenshotFilename(topicId);
      const result = await uploadScreenshot(blob, filename, topicId);
      onInsert(result.url, result.filename);
      handleClose();
    } catch (err) {
      console.error('[ScreenshotCaptureTool] upload failed:', err);
      setUploadError('Upload failed. Check your connection and try again.');
      setStep('annotate');
    }
  };

  const handleRetake = () => {
    setCaptureDataUrl(null);
    setSelection(null);
    setAnnotations([]);
    setSelectedId(null);
    setTransform(null);
    baseCropCanvasRef.current = null;
    void startCapture();
  };

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedId && step === 'annotate') {
          setSelectedId(null);
          return;
        }
        handleClose();
      }
      if (step === 'select' && e.key === 'Enter') {
        handleConfirmRegion();
      }
      if (step === 'annotate' && (e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        handleDeleteSelected();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, step, handleClose, handleConfirmRegion, selectedId]);

  if (!isOpen) return null;

  const displayRect = activeDragRect();

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-gray-900/95 text-white"
      data-screenshot-capture
      role="dialog"
      aria-modal="true"
      aria-label="Capture screenshot"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gray-900">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-blue-400" />
          <span className="font-semibold">Capture Screenshot</span>
          <StepBadge step={step} />
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="p-2 rounded-lg hover:bg-white/10"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {step === 'intro' && (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="max-w-lg text-center space-y-6">
              <div className="w-16 h-16 mx-auto rounded-full bg-blue-600/20 flex items-center justify-center">
                <Camera className="w-8 h-8 text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-2">Add a screenshot to your guide</h2>
                <p className="text-gray-300 text-sm leading-relaxed">
                  We will ask you to pick a window or screen, then let you drag a box around the
                  part you want. You can add arrows or labels, and the image goes right into your
                  document.
                </p>
              </div>
              <ol className="text-left text-sm text-gray-400 space-y-2 bg-white/5 rounded-lg p-4">
                <li>
                  <strong className="text-white">Step 1:</strong> Pick what to capture (your browser
                  will show a list of windows)
                </li>
                <li>
                  <strong className="text-white">Step 2:</strong> Drag a box around the area you
                  want
                </li>
                <li>
                  <strong className="text-white">Step 3:</strong> Add arrows or notes (optional),
                  then insert
                </li>
              </ol>
              {errorMessage && (
                <div className="text-sm text-amber-200 bg-amber-900/40 border border-amber-700/50 rounded-lg p-3">
                  {errorMessage}
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  type="button"
                  onClick={() => void startCapture()}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium"
                >
                  Start capture
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 'select' && captureDataUrl && (
          <>
            <div className="px-4 py-2 bg-blue-900/40 text-sm text-center border-b border-white/10">
              <MousePointer2 className="w-4 h-4 inline mr-1" />
              Drag a box around the area you want. Press{' '}
              <kbd className="px-1 bg-white/20 rounded">Enter</kbd> when done, or{' '}
              <kbd className="px-1 bg-white/20 rounded">Esc</kbd> to cancel.
            </div>
            <div
              ref={selectContainerRef}
              className="flex-1 relative overflow-hidden flex items-center justify-center cursor-crosshair select-none"
              onMouseDown={handleSelectMouseDown}
              onMouseMove={handleSelectMouseMove}
              onMouseUp={handleSelectMouseUp}
              onMouseLeave={handleSelectMouseUp}
            >
              <img
                ref={imageRef}
                src={captureDataUrl}
                alt="Captured screen"
                className="max-w-full max-h-full object-contain pointer-events-none"
                draggable={false}
              />
              {displayRect && imageRef.current && (
                <SelectionOverlay
                  rect={displayRect}
                  imageEl={imageRef.current}
                  containerEl={selectContainerRef.current}
                />
              )}
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-t border-white/10 bg-gray-900 gap-3">
              <span className="text-sm text-gray-400">
                {displayRect
                  ? `${displayRect.width} × ${displayRect.height} px`
                  : 'Click and drag to select an area'}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleUseWholeImage}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm"
                >
                  Use whole image
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRegion}
                  disabled={!displayRect}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-lg text-sm"
                >
                  <Check className="w-4 h-4" />
                  Continue
                </button>
              </div>
            </div>
          </>
        )}

        {step === 'annotate' && (
          <>
            <div className="px-4 py-2 bg-blue-900/40 text-sm text-center border-b border-white/10">
              Draw with a tool, then use <strong>Select</strong> to move, resize (corners), or rotate
              (blue handle). Delete removes the selection.
            </div>
            <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-white/10 bg-gray-900">
              {TOOLS.map(({ tool, label, icon }) => (
                <button
                  key={tool}
                  type="button"
                  onClick={() => setActiveTool(tool)}
                  title={label}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm ${
                    activeTool === tool ? 'bg-blue-600' : 'bg-white/10 hover:bg-white/20'
                  }`}
                >
                  {icon}
                  {label}
                </button>
              ))}
              <span className="w-px h-6 bg-white/20 mx-1" />
              {COLORS.map(({ color, label }) => (
                <button
                  key={color}
                  type="button"
                  title={label}
                  onClick={() => setActiveColor(color)}
                  className={`w-7 h-7 rounded-full border-2 ${
                    activeColor === color ? 'border-white scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
              <span className="w-px h-6 bg-white/20 mx-1" />
              <button
                type="button"
                onClick={handleUndo}
                disabled={annotations.length === 0}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-white/10 hover:bg-white/20 disabled:opacity-40"
              >
                <Redo2 className="w-4 h-4 rotate-180" />
                Undo
              </button>
              <button
                type="button"
                onClick={handleDeleteSelected}
                disabled={!selectedId}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-white/10 hover:bg-red-600/80 disabled:opacity-40"
              >
                <X className="w-4 h-4" />
                Delete
              </button>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-black/40">
              <canvas
                ref={annotateCanvasRef}
                className={`max-w-full max-h-full shadow-2xl ${
                  activeTool === 'select' || selectedId ? 'cursor-default' : 'cursor-crosshair'
                }`}
                onMouseDown={handleAnnotateMouseDown}
                onMouseMove={handleAnnotateMouseMove}
                onMouseUp={handleAnnotateMouseUp}
                onMouseLeave={handleAnnotateMouseUp}
              />
            </div>
            {uploadError && (
              <div className="px-4 py-2 text-sm text-red-200 bg-red-900/40 text-center">
                {uploadError}
              </div>
            )}
            <div className="flex items-center justify-between px-4 py-3 border-t border-white/10 bg-gray-900 gap-3">
              <button
                type="button"
                onClick={handleRetake}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm"
              >
                Retake
              </button>
              <button
                type="button"
                onClick={() => void handleInsert()}
                className="flex items-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-medium"
              >
                <Check className="w-4 h-4" />
                Insert into document
              </button>
            </div>
          </>
        )}

        {step === 'uploading' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-10 h-10 animate-spin text-blue-400" />
            <p className="text-gray-300">Uploading screenshot…</p>
          </div>
        )}
      </div>
    </div>
  );
};

function StepBadge({ step }: { step: CaptureStep }) {
  const labels: Record<CaptureStep, string> = {
    intro: 'Getting started',
    select: 'Step 1 of 2 — Select area',
    annotate: 'Step 2 of 2 — Annotate',
    uploading: 'Saving…',
  };
  return (
    <span className="text-xs text-gray-400 bg-white/10 px-2 py-0.5 rounded-full ml-2">
      {labels[step]}
    </span>
  );
}

function SelectionOverlay({
  rect,
  imageEl,
  containerEl,
}: {
  rect: SelectionRect;
  imageEl: HTMLImageElement;
  containerEl: HTMLDivElement | null;
}) {
  if (!containerEl) return null;
  const containerRect = containerEl.getBoundingClientRect();
  const displayW = imageEl.clientWidth;
  const displayH = imageEl.clientHeight;
  const offsetX = (containerRect.width - displayW) / 2;
  const offsetY = (containerRect.height - displayH) / 2;
  const scaleX = displayW / imageEl.naturalWidth;
  const scaleY = displayH / imageEl.naturalHeight;

  const left = offsetX + rect.x * scaleX;
  const top = offsetY + rect.y * scaleY;
  const width = rect.width * scaleX;
  const height = rect.height * scaleY;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Dim outside selection using four panels */}
      <div className="absolute bg-black/50" style={{ left: 0, top: 0, right: 0, height: top }} />
      <div
        className="absolute bg-black/50"
        style={{ left: 0, top: top + height, right: 0, bottom: 0 }}
      />
      <div className="absolute bg-black/50" style={{ left: 0, top, width: left, height }} />
      <div className="absolute bg-black/50" style={{ left: left + width, top, right: 0, height }} />
      {/* Selection border */}
      <div
        className="absolute border-2 border-blue-400 shadow-[0_0_0_1px_rgba(59,130,246,0.5)]"
        style={{ left, top, width, height }}
      >
        <span className="absolute -top-6 left-0 text-xs bg-blue-600 px-2 py-0.5 rounded whitespace-nowrap">
          {rect.width} × {rect.height}
        </span>
      </div>
    </div>
  );
}

export default ScreenshotCaptureTool;
