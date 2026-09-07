/**
 * Structured step editor for tutorial review (Scribe/Tango-style).
 */
import React, { useCallback, useState } from 'react';
import { ArrowDown, ArrowUp, Camera, Eye, EyeOff, Pencil, Plus, Trash2, Merge } from 'lucide-react';
import type { EditableStep } from '@/utils/stepMarkdown';
import type { StepAnnotation } from '@/utils/stepAnnotations';
import { StepAnnotator } from '@/components/tutorial/StepAnnotator';
import { grabDisplayFrame } from '@/utils/screenshotCapture';

interface TutorialStepEditorProps {
  steps: EditableStep[];
  onChange: (steps: EditableStep[]) => void;
  markdown: string;
  onMarkdownChange: (md: string) => void;
  showMarkdown: boolean;
  onToggleMarkdown: (show: boolean) => void;
}

export const TutorialStepEditor: React.FC<TutorialStepEditorProps> = ({
  steps,
  onChange,
  markdown,
  onMarkdownChange,
  showMarkdown,
  onToggleMarkdown,
}) => {
  const [annotateIndex, setAnnotateIndex] = useState<number | null>(null);
  const [recapturingIndex, setRecapturingIndex] = useState<number | null>(null);

  const reindex = (list: EditableStep[]): EditableStep[] =>
    list.map((s, i) => ({ ...s, index: i + 1 }));

  const moveStep = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(reindex(next));
  };

  const deleteStep = (idx: number) => {
    onChange(reindex(steps.filter((_, i) => i !== idx)));
  };

  const mergeWithPrevious = (idx: number) => {
    if (idx === 0) return;
    const next = [...steps];
    const prev = next[idx - 1];
    const cur = next[idx];
    prev.description = [prev.description, cur.title, cur.description].filter(Boolean).join('\n');
    if (cur.screenshot) prev.screenshot = cur.screenshot;
    if (cur.previewUrl) prev.previewUrl = cur.previewUrl;
    next.splice(idx, 1);
    onChange(reindex(next));
  };

  const updateStep = (idx: number, patch: Partial<EditableStep>) => {
    const next = steps.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    onChange(next);
  };

  const insertManualStep = () => {
    const nextIndex = steps.length + 1;
    onChange([
      ...steps,
      {
        index: nextIndex,
        title: '',
        description: '',
      },
    ]);
  };

  const recaptureScreenshot = useCallback(
    async (idx: number) => {
      setRecapturingIndex(idx);
      try {
        const frame = await grabDisplayFrame();
        if (!frame) return;
        updateStep(idx, {
          screenshot: frame.blob,
          previewUrl: frame.dataUrl,
          annotations: [],
        });
      } finally {
        setRecapturingIndex(null);
      }
    },
    [steps]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-700">Step-by-step guide</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={insertManualStep}
            className="flex items-center gap-1 text-xs text-sky-700 hover:underline"
          >
            <Plus className="w-3.5 h-3.5" /> Insert step
          </button>
          <button
            type="button"
            onClick={() => onToggleMarkdown(!showMarkdown)}
            className="flex items-center gap-1 text-xs text-sky-700 hover:underline"
          >
            {showMarkdown ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showMarkdown ? 'Visual steps' : 'Markdown'}
          </button>
        </div>
      </div>

      {showMarkdown ? (
        <textarea
          value={markdown}
          onChange={e => onMarkdownChange(e.target.value)}
          rows={14}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono"
        />
      ) : (
        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
          {steps.map((step, idx) => (
            <div
              key={`step-${step.index}-${idx}`}
              className="rounded-lg border border-gray-200 p-3 space-y-2 bg-gray-50"
            >
              <div className="flex gap-3">
                {step.previewUrl || step.screenshot ? (
                  <button
                    type="button"
                    className="shrink-0"
                    onClick={() => step.screenshot && setAnnotateIndex(idx)}
                    title="Annotate screenshot"
                  >
                    <img
                      src={step.previewUrl}
                      alt={`Step ${step.index}`}
                      className="w-28 h-20 object-contain rounded border border-gray-200 bg-white"
                    />
                  </button>
                ) : (
                  <div className="w-28 h-20 rounded border border-dashed border-gray-300 bg-white flex items-center justify-center text-xs text-gray-400 shrink-0">
                    No shot
                  </div>
                )}
                <div className="flex-1 space-y-2 min-w-0">
                  <input
                    value={step.title}
                    onChange={e => updateStep(idx, { title: e.target.value })}
                    placeholder={`Step ${step.index} title`}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm font-medium"
                  />
                  <textarea
                    value={step.description}
                    onChange={e => updateStep(idx, { description: e.target.value })}
                    rows={2}
                    placeholder="Step description"
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  title="Move up"
                  disabled={idx === 0}
                  onClick={() => moveStep(idx, -1)}
                  className="p-1 rounded hover:bg-gray-200 disabled:opacity-40"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  title="Move down"
                  disabled={idx === steps.length - 1}
                  onClick={() => moveStep(idx, 1)}
                  className="p-1 rounded hover:bg-gray-200 disabled:opacity-40"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  title="Merge with previous"
                  disabled={idx === 0}
                  onClick={() => mergeWithPrevious(idx)}
                  className="p-1 rounded hover:bg-gray-200 disabled:opacity-40"
                >
                  <Merge className="w-3.5 h-3.5" />
                </button>
                {step.screenshot && (
                  <>
                    <button
                      type="button"
                      title="Annotate"
                      onClick={() => setAnnotateIndex(idx)}
                      className="px-2 py-0.5 text-xs rounded border border-gray-300 hover:bg-gray-200 flex items-center gap-1"
                    >
                      <Pencil className="w-3 h-3" /> Annotate
                    </button>
                    <button
                      type="button"
                      title="Re-capture screenshot"
                      disabled={recapturingIndex === idx}
                      onClick={() => void recaptureScreenshot(idx)}
                      className="px-2 py-0.5 text-xs rounded border border-gray-300 hover:bg-gray-200 flex items-center gap-1 disabled:opacity-40"
                    >
                      <Camera className="w-3 h-3" />
                      {recapturingIndex === idx ? 'Capturing…' : 'Re-capture'}
                    </button>
                  </>
                )}
                {!step.screenshot && (
                  <button
                    type="button"
                    title="Capture screenshot"
                    disabled={recapturingIndex === idx}
                    onClick={() => void recaptureScreenshot(idx)}
                    className="px-2 py-0.5 text-xs rounded border border-sky-300 text-sky-800 hover:bg-sky-50"
                  >
                    {recapturingIndex === idx ? 'Capturing…' : 'Capture screenshot'}
                  </button>
                )}
                <button
                  type="button"
                  title="Delete step"
                  onClick={() => deleteStep(idx)}
                  className="p-1 rounded text-red-600 hover:bg-red-50 ml-auto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
          {steps.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">No steps captured.</p>
          )}
        </div>
      )}

      {annotateIndex != null && steps[annotateIndex]?.screenshot && (
        <StepAnnotator
          screenshot={steps[annotateIndex].screenshot!}
          stepNumber={steps[annotateIndex].index}
          annotations={(steps[annotateIndex].annotations ?? []) as StepAnnotation[]}
          onChange={anns => updateStep(annotateIndex, { annotations: anns })}
          onScreenshotChange={(blob, previewUrl) =>
            updateStep(annotateIndex, {
              screenshot: blob,
              previewUrl,
            })
          }
          onClose={() => setAnnotateIndex(null)}
        />
      )}
    </div>
  );
};

export default TutorialStepEditor;
