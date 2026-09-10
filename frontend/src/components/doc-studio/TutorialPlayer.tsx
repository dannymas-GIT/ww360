/**
 * Step-by-step tutorial player for Document Studio.
 */
import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Circle } from 'lucide-react';
import type { DocDetail, TutorialStep } from '@/services/docStudioService';
import { AUTH_TOKEN_KEY } from '@/services/authService';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

export interface TutorialPlayerProps {
  document: Pick<DocDetail, 'title' | 'tutorial_data' | 'content_markdown'>;
  scope?: string;
  compact?: boolean;
  onStepChange?: (index: number) => void;
}

/** Build a media URL the browser can load without Authorization headers. */
function assetUrl(assetId: string, scope?: string): string {
  const base = `/api/v1/doc-studio/assets/${assetId}/file`;
  const params = new URLSearchParams();
  if (scope) params.set('scope', scope);
  const token = typeof window !== 'undefined' ? localStorage.getItem(AUTH_TOKEN_KEY) : null;
  if (token) params.set('access_token', token);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export function TutorialPlayer({
  document,
  scope,
  compact,
  onStepChange,
}: TutorialPlayerProps) {
  const steps: TutorialStep[] = document.tutorial_data?.steps?.length
    ? [...document.tutorial_data.steps].sort((a, b) => a.order - b.order)
    : [];

  const videoUrl = document.tutorial_data?.video_asset_id
    ? assetUrl(document.tutorial_data.video_asset_id, scope)
    : null;

  const [activeStep, setActiveStep] = useState(0);
  const [videoError, setVideoError] = useState('');

  const goTo = useCallback(
    (idx: number) => {
      const next = Math.max(0, Math.min(steps.length - 1, idx));
      setActiveStep(next);
      onStepChange?.(next);
    },
    [steps.length, onStepChange]
  );

  useEffect(() => {
    setVideoError('');
  }, [videoUrl]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goTo(activeStep + 1);
      if (e.key === 'ArrowLeft') goTo(activeStep - 1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeStep, goTo]);

  if (steps.length === 0 && !videoUrl) {
    return (
      <div
        className={`rounded-lg border bg-muted/20 ${compact ? 'p-3' : 'p-6'} text-sm text-muted-foreground`}
      >
        {document.content_markdown ? (
          <div className="prose prose-sm max-w-none whitespace-pre-wrap">
            {document.content_markdown}
          </div>
        ) : (
          'No tutorial steps defined yet.'
        )}
      </div>
    );
  }

  const step = steps[activeStep];
  const progress = steps.length ? ((activeStep + 1) / steps.length) * 100 : 0;
  const screenshotUrl =
    step?.screenshot_url ||
    (step?.screenshot_asset_id ? assetUrl(step.screenshot_asset_id, scope) : null);

  return (
    <div className={`tutorial-player flex flex-col ${compact ? 'gap-2' : 'gap-4'}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className={`font-semibold ${compact ? 'text-sm' : 'text-lg'}`}>{document.title}</h3>
        {steps.length > 0 && (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            Step {activeStep + 1} of {steps.length}
          </span>
        )}
      </div>

      {videoUrl && (
        <div className="rounded-lg border overflow-hidden bg-black">
          <video
            key={videoUrl}
            src={videoUrl}
            controls
            playsInline
            preload="metadata"
            className={`w-full ${compact ? 'max-h-48' : 'max-h-80'} object-contain`}
            onError={() =>
              setVideoError(
                'Could not play this video. In-app recordings use WebM (Chrome/Edge). Imported QuickTime (.mov / HEVC) often only plays in Safari — re-import as H.264 MP4 for widest support.'
              )
            }
          >
            <track kind="captions" />
          </video>
          {videoError && (
            <p className="p-3 text-sm text-amber-200 bg-black border-t border-amber-900/40">
              {videoError}
            </p>
          )}
        </div>
      )}

      {steps.length > 0 && <Progress value={progress} className="h-1.5" />}

      {steps.length > 0 && step && (
        <div className={`grid ${compact ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-5'} gap-4`}>
          <div className={compact ? '' : 'lg:col-span-2'}>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {steps.map((s, idx) => (
                <button
                  key={s.id || idx}
                  type="button"
                  onClick={() => goTo(idx)}
                  className={`w-full text-left flex items-start gap-2 rounded-md px-2 py-2 text-sm transition-colors ${
                    idx === activeStep ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
                  }`}
                >
                  <Circle
                    className={`h-3 w-3 mt-1 shrink-0 ${idx <= activeStep ? 'fill-primary text-primary' : 'text-muted-foreground'}`}
                  />
                  <span>{s.caption || s.title || `Step ${idx + 1}`}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={compact ? '' : 'lg:col-span-3'}>
            <div className="rounded-lg border bg-background overflow-hidden">
              {screenshotUrl && (
                <img
                  src={screenshotUrl}
                  alt={step.caption || `Step ${activeStep + 1}`}
                  className="w-full max-h-80 object-contain bg-muted/30"
                />
              )}
              <div className="p-4">
                <h4 className="font-medium mb-2">
                  {step.caption || step.title || `Step ${activeStep + 1}`}
                </h4>
                {step.description && (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {step.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {steps.length > 0 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={activeStep === 0}
            onClick={() => goTo(activeStep - 1)}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <Button
            size="sm"
            disabled={activeStep >= steps.length - 1}
            onClick={() => goTo(activeStep + 1)}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
