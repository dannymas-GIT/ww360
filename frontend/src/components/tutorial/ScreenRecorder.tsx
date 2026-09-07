import React from 'react';
import { Video } from 'lucide-react';
import {
  useTutorialRecorder,
  type TutorialRecorderLaunchOptions,
} from '@/context/TutorialRecorderContext';

export interface ScreenRecorderProps {
  documentTitle?: string;
  onPublished?: (docId: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
  studioTarget?: { scope?: string; folderId?: string; existingDocumentId?: string };
}

function buildLaunchOptions(props: ScreenRecorderProps): TutorialRecorderLaunchOptions {
  return {
    ...(props.documentTitle ? { documentTitle: props.documentTitle } : {}),
    ...(props.studioTarget ? { studioTarget: props.studioTarget } : {}),
    ...(props.onPublished ? { onPublished: props.onPublished } : {}),
    ...(props.onOpenChange ? { onOpenChange: props.onOpenChange } : {}),
  };
}

/** True when this instance owns the parent's open/close state (sidebar). */
function isControlledInstance(props: ScreenRecorderProps): boolean {
  return props.open !== undefined || props.onOpenChange !== undefined;
}

export const ScreenRecorder: React.FC<ScreenRecorderProps> = props => {
  const { openRecorder, closeRecorder, isOpen } = useTutorialRecorder();
  const { showTrigger = true, open, onOpenChange } = props;
  const controlled = isControlledInstance(props);
  const prevOpenRef = React.useRef<boolean | undefined>(undefined);

  React.useEffect(() => {
    if (!controlled) return;

    const wasOpen = prevOpenRef.current;
    if (open && !wasOpen) {
      openRecorder(buildLaunchOptions(props));
    } else if (!open && wasOpen && isOpen) {
      closeRecorder();
    }
    prevOpenRef.current = open;
  }, [controlled, open, isOpen, openRecorder, closeRecorder, props.documentTitle, onOpenChange]);

  if (!showTrigger) return null;

  return (
    <button
      type="button"
      onClick={() => openRecorder(buildLaunchOptions(props))}
      className="flex items-center gap-2 px-3 py-1.5 text-sm bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors"
      title="Record a screen tutorial for this guide"
    >
      <Video className="w-4 h-4" />
      Record tutorial
    </button>
  );
};

export default ScreenRecorder;
