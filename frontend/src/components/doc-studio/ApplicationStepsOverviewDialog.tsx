/**
 * Avatar overview for “Record application steps” — full-frame player (optional).
 * Primary teaching path is ApplicationStepsTourOverlay (avatar PiP + step card).
 */
import { PlayCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  APPLICATION_STEPS_SAMPLE_CAPTIONS,
  APPLICATION_STEPS_SAMPLE_SRC,
} from '@/components/doc-studio/applicationStepsTourContent';

export { APPLICATION_STEPS_SAMPLE_SRC, APPLICATION_STEPS_SAMPLE_CAPTIONS };

export interface ApplicationStepsOverviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ApplicationStepsOverviewDialog({
  open,
  onOpenChange,
}: ApplicationStepsOverviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl gap-3 p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[1.25rem] text-slate-900">
            <PlayCircle className="h-5 w-5 text-sky-600" aria-hidden />
            Record application steps — full video
          </DialogTitle>
          <DialogDescription className="text-[1.125rem] leading-relaxed text-slate-600">
            Full avatar overview. Prefer <strong className="font-semibold">Watch overview</strong> for
            the step-by-step tour with highlights; this dialog plays the complete clip.
          </DialogDescription>
        </DialogHeader>
        <div
          className="overflow-hidden rounded-lg border border-slate-200 bg-black"
          data-tour="studio-application-steps-player"
        >
          <video
            key={open ? 'open' : 'closed'}
            className="aspect-video w-full"
            controls
            playsInline
            preload="metadata"
            crossOrigin="anonymous"
          >
            <source src={APPLICATION_STEPS_SAMPLE_SRC} type="video/mp4" />
            <track
              kind="captions"
              src={APPLICATION_STEPS_SAMPLE_CAPTIONS}
              srcLang="en"
              label="English"
              default
            />
            Your browser does not support embedded video.
          </video>
        </div>
      </DialogContent>
    </Dialog>
  );
}
