/**
 * Canvas-based screenshot annotator for tutorial step review.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Circle,
  Crop,
  Eraser,
  Eye,
  EyeOff,
  Hash,
  MousePointer2,
  Square,
  Trash2,
  Type,
} from 'lucide-react';
import type { StepAnnotation } from '@/utils/stepAnnotations';
import {
  ANNOTATION_COLORS,
  DEFAULT_ANNOTATION_STYLE,
  STROKE_WIDTH_OPTIONS,
  blobToCanvas,
  cropAnnotations,
  drawStepAnnotations,
  hitTestAnnotation,
  moveAnnotation,
  nextBadgeNumber,
  type AnnotationLineStyle,
} from '@/utils/stepAnnotations';
import {
  cropImageToCanvas,
  normalizeSelectionRect,
  type SelectionRect,
} from '@/utils/screenshotCapture';
import { blurRegionOnImage } from '@/utils/stepMarkdown';

export type AnnotatorTool =
  | 'select'
  | 'arrow'
  | 'rect'
  | 'ellipse'
  | 'highlight'
  | 'badge'
  | 'text'
  | 'blur'
  | 'crop';

interface StepAnnotatorProps {
  screenshot: Blob;
  stepNumber: number;
  annotations: StepAnnotation[];
  onChange: (next: StepAnnotation[]) => void;
  onScreenshotChange: (blob: Blob, previewUrl: string) => void;
  onClose: () => void;
}

export function StepAnnotator({
  screenshot,
  stepNumber,
  annotations,
  onChange,
  onScreenshotChange,
  onClose,
}: StepAnnotatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const annotationsRef = useRef(annotations);
  annotationsRef.current = annotations;

  const [tool, setTool] = useState<AnnotatorTool>('select');
  const [dragging, setDragging] = useState(false);
  const [start, setStart] = useState({ x: 0, y: 0 });
  const [end, setEnd] = useState({ x: 0, y: 0 });
  const [textPrompt, setTextPrompt] = useState('');
  const [ready, setReady] = useState(false);
  const [hideAnnotations, setHideAnnotations] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [moveIndex, setMoveIndex] = useState<number>(-1);
  const [moveOrigin, setMoveOrigin] = useState({ x: 0, y: 0 });
  const [moveSnapshot, setMoveSnapshot] = useState<StepAnnotation | null>(null);

  const [color, setColor] = useState(DEFAULT_ANNOTATION_STYLE.color);
  const [strokeWidth, setStrokeWidth] = useState(DEFAULT_ANNOTATION_STYLE.strokeWidth);
  const [lineStyle, setLineStyle] = useState<AnnotationLineStyle>(
    DEFAULT_ANNOTATION_STYLE.lineStyle
  );
  const [fill, setFill] = useState(DEFAULT_ANNOTATION_STYLE.fill);
  const [fillOpacity, setFillOpacity] = useState(DEFAULT_ANNOTATION_STYLE.fillOpacity);
  const [badgeNumber, setBadgeNumber] = useState(() =>
    nextBadgeNumber(annotations, stepNumber)
  );

  useEffect(() => {
    setBadgeNumber(nextBadgeNumber(annotations, stepNumber));
  }, [annotations, stepNumber]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const base = baseCanvasRef.current;
    if (!canvas || !base) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(base, 0, 0);
    if (!hideAnnotations) {
      drawStepAnnotations(ctx, annotations, canvas.width, canvas.height, selectedIndex);
    }
    if (dragging && tool !== 'blur' && tool !== 'select' && tool !== 'badge' && tool !== 'text') {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      ctx.setLineDash(
        lineStyle === 'dashed'
          ? [strokeWidth * 3, strokeWidth * 2]
          : lineStyle === 'dotted'
            ? [strokeWidth, strokeWidth * 1.5]
            : []
      );
      if (tool === 'arrow') {
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
      } else if (tool === 'ellipse') {
        const left = Math.min(start.x, end.x);
        const top = Math.min(start.y, end.y);
        const w = Math.abs(end.x - start.x);
        const h = Math.abs(end.y - start.y);
        ctx.beginPath();
        ctx.ellipse(left + w / 2, top + h / 2, w / 2 || 1, h / 2 || 1, 0, 0, Math.PI * 2);
        if (fill) {
          ctx.fillStyle = color + '33';
          ctx.fill();
        }
        ctx.stroke();
      } else {
        const left = Math.min(start.x, end.x);
        const top = Math.min(start.y, end.y);
        ctx.strokeRect(left, top, Math.abs(end.x - start.x), Math.abs(end.y - start.y));
      }
      ctx.restore();
    }
  }, [
    annotations,
    color,
    dragging,
    end,
    fill,
    hideAnnotations,
    lineStyle,
    selectedIndex,
    start,
    strokeWidth,
    tool,
  ]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const base = await blobToCanvas(screenshot);
      if (cancelled) return;
      baseCanvasRef.current = base;
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = base.width;
        canvas.height = base.height;
      }
      setReady(true);
      redraw();
    })();
    return () => {
      cancelled = true;
    };
  }, [screenshot, redraw]);

  useEffect(() => {
    if (ready) redraw();
  }, [ready, redraw]);

  const canvasPoint = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const patchSelected = (patch: Partial<StepAnnotation>) => {
    if (selectedIndex < 0 || selectedIndex >= annotations.length) return;
    const next = annotations.map((a, i) => (i === selectedIndex ? { ...a, ...patch } : a));
    onChange(next);
  };

  useEffect(() => {
    if (selectedIndex < 0 || selectedIndex >= annotations.length) return;
    const selected = annotations[selectedIndex];
    setColor(selected.color);
    if (selected.strokeWidth) setStrokeWidth(selected.strokeWidth);
    if (selected.lineStyle) setLineStyle(selected.lineStyle);
    if (typeof selected.fill === 'boolean') setFill(selected.fill);
    if (typeof selected.fillOpacity === 'number') setFillOpacity(selected.fillOpacity);
    if (selected.type === 'badge' && selected.text) {
      const n = parseInt(selected.text, 10);
      if (Number.isFinite(n)) setBadgeNumber(n);
    }
  }, [selectedIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyBlur = async (rect: SelectionRect) => {
    const base = baseCanvasRef.current;
    if (!base) return;
    const blob = await new Promise<Blob | null>(resolve => {
      base.toBlob(b => resolve(b), 'image/png', 0.92);
    });
    if (!blob) return;
    const blurred = await blurRegionOnImage(blob, {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      w: Math.round(rect.width),
      h: Math.round(rect.height),
    });
    const nextBase = await blobToCanvas(blurred);
    baseCanvasRef.current = nextBase;
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = nextBase.width;
      canvas.height = nextBase.height;
    }
    const url = URL.createObjectURL(blurred);
    onScreenshotChange(blurred, url);
    redraw();
  };

  const applyCrop = async (rect: SelectionRect) => {
    const base = baseCanvasRef.current;
    if (!base) return;
    const cropped = cropImageToCanvas(base, rect);
    baseCanvasRef.current = cropped;
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = cropped.width;
      canvas.height = cropped.height;
    }
    const blob = await new Promise<Blob | null>(resolve => {
      cropped.toBlob(b => resolve(b), 'image/png', 0.92);
    });
    if (!blob) return;
    const remapped = cropAnnotations(annotationsRef.current, rect);
    const url = URL.createObjectURL(blob);
    onScreenshotChange(blob, url);
    onChange(remapped);
    setSelectedIndex(-1);
    redraw();
  };

  const finishDraw = async (point: { x: number; y: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = normalizeSelectionRect(
      start.x,
      start.y,
      point.x,
      point.y,
      canvas.width,
      canvas.height
    );

    if (tool === 'blur' && rect) {
      await applyBlur(rect);
      return;
    }
    if (tool === 'crop' && rect) {
      await applyCrop(rect);
      return;
    }
    if (tool === 'badge') {
      const radius = 16;
      const n = badgeNumber || nextBadgeNumber(annotations, stepNumber);
      onChange([
        ...annotations,
        {
          type: 'badge',
          color,
          x1: point.x - radius,
          y1: point.y - radius,
          x2: point.x + radius,
          y2: point.y + radius,
          text: String(n),
        },
      ]);
      setBadgeNumber(
        nextBadgeNumber([...annotations, { type: 'badge', text: String(n) } as StepAnnotation], n + 1)
      );
      return;
    }
    if (tool === 'text') {
      const label = textPrompt.trim() || window.prompt('Label text') || '';
      if (!label) return;
      onChange([
        ...annotations,
        {
          type: 'text',
          color,
          x1: point.x,
          y1: point.y,
          x2: point.x,
          y2: point.y,
          text: label,
        },
      ]);
      setTextPrompt('');
      return;
    }
    if (!rect && (tool === 'arrow' || tool === 'rect' || tool === 'ellipse' || tool === 'highlight')) {
      return;
    }
    if (tool === 'arrow' || tool === 'rect' || tool === 'ellipse' || tool === 'highlight') {
      onChange([
        ...annotations,
        {
          type: tool,
          color,
          x1: start.x,
          y1: start.y,
          x2: point.x,
          y2: point.y,
          strokeWidth,
          lineStyle,
          fill: tool === 'highlight' ? true : fill,
          fillOpacity: tool === 'highlight' ? Math.max(fillOpacity, 0.3) : fillOpacity,
        },
      ]);
    }
  };

  const deleteSelected = () => {
    if (selectedIndex < 0) return;
    onChange(annotations.filter((_, i) => i !== selectedIndex));
    setSelectedIndex(-1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIndex >= 0 && !(e.target instanceof HTMLInputElement)) {
          e.preventDefault();
          deleteSelected();
        }
      }
      if (e.key === 'Escape') setSelectedIndex(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const tools: { id: AnnotatorTool; icon: React.ReactNode; label: string }[] = [
    { id: 'select', icon: <MousePointer2 className="w-4 h-4" />, label: 'Select / move' },
    { id: 'arrow', icon: <ArrowRight className="w-4 h-4" />, label: 'Arrow' },
    { id: 'rect', icon: <Square className="w-4 h-4" />, label: 'Rectangle' },
    { id: 'ellipse', icon: <Circle className="w-4 h-4" />, label: 'Ellipse' },
    { id: 'highlight', icon: <Square className="w-4 h-4 fill-current opacity-40" />, label: 'Highlight' },
    { id: 'badge', icon: <Hash className="w-4 h-4" />, label: 'Number badge' },
    { id: 'text', icon: <Type className="w-4 h-4" />, label: 'Text' },
    { id: 'blur', icon: <Eraser className="w-4 h-4" />, label: 'Blur / redact' },
    { id: 'crop', icon: <Crop className="w-4 h-4" />, label: 'Crop (keeps annotations in frame)' },
  ];

  const showStrokeControls =
    tool === 'arrow' ||
    tool === 'rect' ||
    tool === 'ellipse' ||
    (selectedIndex >= 0 &&
      ['arrow', 'rect', 'ellipse'].includes(annotations[selectedIndex]?.type || ''));
  const showFillControls =
    tool === 'rect' ||
    tool === 'ellipse' ||
    tool === 'highlight' ||
    (selectedIndex >= 0 &&
      ['rect', 'ellipse', 'highlight'].includes(annotations[selectedIndex]?.type || ''));

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-4 py-2 border-b">
          <span className="text-sm font-medium shrink-0">Annotate step {stepNumber}</span>
          <div className="flex flex-wrap gap-1 justify-center">
            {tools.map(t => (
              <button
                key={t.id}
                type="button"
                title={t.label}
                onClick={() => {
                  setTool(t.id);
                  if (t.id !== 'select') setSelectedIndex(-1);
                }}
                className={`p-2 rounded ${tool === t.id ? 'bg-sky-100 text-sky-800' : 'hover:bg-gray-100'}`}
              >
                {t.icon}
              </button>
            ))}
            <button
              type="button"
              title={hideAnnotations ? 'Show annotations' : 'Hide annotations'}
              onClick={() => setHideAnnotations(v => !v)}
              className={`p-2 rounded ${hideAnnotations ? 'bg-amber-100 text-amber-800' : 'hover:bg-gray-100'}`}
            >
              {hideAnnotations ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <button
              type="button"
              title="Delete selected"
              disabled={selectedIndex < 0}
              onClick={deleteSelected}
              className="p-2 rounded hover:bg-red-50 text-red-600 disabled:opacity-30"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-sky-700 font-medium shrink-0">
            Done
          </button>
        </div>

        <div className="px-4 py-2 border-b bg-gray-50 flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1">
            <span className="text-gray-500 mr-1">Color</span>
            {ANNOTATION_COLORS.map(c => (
              <button
                key={c}
                type="button"
                title={c}
                onClick={() => {
                  setColor(c);
                  patchSelected({ color: c });
                }}
                className={`w-5 h-5 rounded-full border ${color === c ? 'ring-2 ring-sky-500 ring-offset-1' : 'border-gray-300'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          {showStrokeControls && (
            <>
              <div className="flex items-center gap-1">
                <span className="text-gray-500">Weight</span>
                {STROKE_WIDTH_OPTIONS.map(w => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => {
                      setStrokeWidth(w);
                      patchSelected({ strokeWidth: w });
                    }}
                    className={`px-2 py-0.5 rounded border ${strokeWidth === w ? 'bg-sky-100 border-sky-300' : 'border-gray-200'}`}
                  >
                    {w}px
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-500">Style</span>
                {(['solid', 'dashed', 'dotted'] as AnnotationLineStyle[]).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setLineStyle(s);
                      patchSelected({ lineStyle: s });
                    }}
                    className={`px-2 py-0.5 rounded border capitalize ${lineStyle === s ? 'bg-sky-100 border-sky-300' : 'border-gray-200'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </>
          )}

          {showFillControls && (
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={fill || tool === 'highlight'}
                  disabled={tool === 'highlight'}
                  onChange={e => {
                    setFill(e.target.checked);
                    patchSelected({ fill: e.target.checked });
                  }}
                />
                Fill
              </label>
              <label className="flex items-center gap-1">
                Opacity
                <input
                  type="range"
                  min={0.05}
                  max={0.8}
                  step={0.05}
                  value={fillOpacity}
                  onChange={e => {
                    const v = Number(e.target.value);
                    setFillOpacity(v);
                    patchSelected({ fillOpacity: v });
                  }}
                  className="w-20"
                />
              </label>
            </div>
          )}

          {(tool === 'badge' ||
            (selectedIndex >= 0 && annotations[selectedIndex]?.type === 'badge')) && (
            <label className="flex items-center gap-1">
              Badge #
              <input
                type="number"
                min={1}
                max={99}
                value={badgeNumber}
                onChange={e => {
                  const n = Math.max(1, Math.min(99, Number(e.target.value) || 1));
                  setBadgeNumber(n);
                  if (selectedIndex >= 0 && annotations[selectedIndex]?.type === 'badge') {
                    patchSelected({ text: String(n) });
                  }
                }}
                className="w-14 px-1 py-0.5 border rounded"
              />
            </label>
          )}

          {tool === 'text' && (
            <input
              value={textPrompt}
              onChange={e => setTextPrompt(e.target.value)}
              placeholder="Label text (or click to prompt)"
              className="px-2 py-1 border rounded min-w-[160px]"
            />
          )}
        </div>

        <div className="flex-1 overflow-auto p-4 bg-gray-100">
          <canvas
            ref={canvasRef}
            className={`max-w-full mx-auto border border-gray-200 bg-white ${
              tool === 'select' ? 'cursor-default' : 'cursor-crosshair'
            }`}
            onMouseDown={e => {
              const p = canvasPoint(e);
              setStart(p);
              setEnd(p);
              if (tool === 'select') {
                const hit = hitTestAnnotation(
                  annotations,
                  p.x,
                  p.y,
                  canvasRef.current?.width || 0,
                  canvasRef.current?.height || 0
                );
                setSelectedIndex(hit);
                if (hit >= 0) {
                  setMoveIndex(hit);
                  setMoveOrigin(p);
                  setMoveSnapshot(annotations[hit]);
                  setDragging(true);
                }
                return;
              }
              setDragging(true);
              if (tool === 'badge' || tool === 'text') {
                void finishDraw(p);
                setDragging(false);
              }
            }}
            onMouseMove={e => {
              if (!dragging) return;
              const p = canvasPoint(e);
              if (tool === 'select' && moveIndex >= 0 && moveSnapshot) {
                const dx = p.x - moveOrigin.x;
                const dy = p.y - moveOrigin.y;
                const moved = moveAnnotation(moveSnapshot, dx, dy);
                onChange(annotations.map((a, i) => (i === moveIndex ? moved : a)));
                return;
              }
              setEnd(p);
              redraw();
            }}
            onMouseUp={e => {
              if (!dragging) return;
              setDragging(false);
              if (tool === 'select') {
                setMoveIndex(-1);
                setMoveSnapshot(null);
                return;
              }
              void finishDraw(canvasPoint(e));
            }}
            onMouseLeave={() => {
              if (dragging && tool === 'select') {
                setDragging(false);
                setMoveIndex(-1);
                setMoveSnapshot(null);
              } else if (dragging) {
                setDragging(false);
              }
            }}
          />
        </div>
        <div className="px-4 py-2 border-t text-xs text-gray-500 flex justify-between gap-2">
          <span>
            Select to drag. Crop keeps annotations still in frame. Eye toggles overlay visibility
            (blur/redact is the eraser).
          </span>
          <button
            type="button"
            className="text-red-600 hover:underline shrink-0"
            onClick={() => {
              onChange([]);
              setSelectedIndex(-1);
            }}
          >
            Clear annotations
          </button>
        </div>
      </div>
    </div>
  );
}

export default StepAnnotator;
