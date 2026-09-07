/**
 * Avatar overview for “Record application steps” — HeyGen sample from Mission Control.
 * Watermarked WIP until a paid publish replaces the asset.
 */
import { PlayCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export const APPLICATION_STEPS_SAMPLE_SRC = '/tutorials/application-steps-sample.mp4';
export const APPLICATION_STEPS_SAMPLE_CAPTIONS = '/tutorials/application-steps-sample.vtt';

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
      <DialogContent className="max-w-3xl gap-3 p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900">
            <PlayCircle className="h-5 w-5 text-sky-600" aria-hidden />
            Record application steps — overview
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-600">
            Short avatar guide from Mission Control. After this, use{' '}
            <span className="font-medium text-slate-800">Record tutorial</span> in Document Studio to
            capture the real clicks. This preview is a watermarked sample.
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
        <ol className="list-decimal space-y-1 pl-5 text-xs text-slate-600">
          <li>Watch this overview (~1 minute).</li>
          <li>Click Record tutorial in the header.</li>
          <li>Walk through the application; review steps; publish to your library.</li>
        </ol>
      </DialogContent>
    </Dialog>
  );
}
