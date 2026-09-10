/**
 * Publish a tutorial recording to the WW360 Document Studio library.
 */
import {
  createDocument,
  deleteDocument,
  publishDocument,
  saveContent,
  setDocumentReviewState,
  uploadAsset,
  type TutorialData,
  type TutorialStep,
} from '@/services/docStudioService';
import { submitTaskForReview } from '@/services/documentationTaskService';
import type { RecordingMode } from '@/utils/recorderUtils';
import { isScreenshotOnlyMode } from '@/utils/recorderUtils';
import type { EditableStep } from '@/utils/stepMarkdown';
import { flattenStepScreenshot, blobToCanvas, type StepAnnotation } from '@/utils/stepAnnotations';

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function blobToFile(blob: Blob, filename: string): File {
  return new File([blob], filename, { type: blob.type || 'application/octet-stream' });
}

export interface StudioPublishInput {
  scope?: string;
  folderId?: string;
  title: string;
  markdown: string;
  steps: EditableStep[];
  videoBlob?: Blob | null;
  recordingMode?: RecordingMode;
  /** When set, update this document instead of creating a new draft. */
  existingDocumentId?: string;
  /** Operator flow: save draft + submit for manager review instead of publishing. */
  submitForReview?: boolean;
  /** Link submission to a documentation task. */
  documentationTaskId?: number;
}

export interface StudioPublishResult {
  documentId: string;
}

/** Flatten annotated screenshots before upload. */
export async function flattenStepForUpload(step: EditableStep): Promise<Blob | null> {
  if (!step.screenshot) return null;
  const anns = (step.annotations ?? []) as StepAnnotation[];
  if (anns.length === 0) return step.screenshot;
  const canvas = await blobToCanvas(step.screenshot);
  return flattenStepScreenshot(canvas, anns);
}

function studioMode(recordingMode?: RecordingMode): string {
  return isScreenshotOnlyMode(recordingMode ?? 'screen')
    ? 'studio-screenshots'
    : 'studio-recorder';
}

/** Build tutorial_data payload from editable steps (pre-upload). */
export function buildTutorialDataPayload(
  steps: EditableStep[],
  recordingMode?: RecordingMode,
  videoAssetId?: string
): TutorialData {
  return {
    steps: steps.map((s, i) => ({
      id: `step-${s.index}`,
      order: i + 1,
      title: s.title,
      description: s.description,
      caption: s.title || `Step ${s.index}`,
      ...(s.annotations ? { annotations: s.annotations } : {}),
      ...(typeof s.tMs === 'number' ? { tMs: s.tMs } : {}),
    })),
    mode: studioMode(recordingMode),
    ...(videoAssetId ? { video_asset_id: videoAssetId } : {}),
  };
}

export async function publishTutorialToStudio(
  input: StudioPublishInput
): Promise<StudioPublishResult> {
  let documentId = input.existingDocumentId;
  let createdNew = false;
  const scope = input.scope;

  if (!documentId) {
    const doc = await createDocument(
      {
        title: input.title.trim(),
        folder_id: input.folderId,
        doc_type: 'tutorial',
        content_markdown: input.markdown,
      },
      scope
    );
    documentId = doc.id;
    createdNew = true;
  }

  try {
    let videoAssetId: string | undefined;
    if (input.videoBlob) {
      const videoFile = blobToFile(
        input.videoBlob,
        `${input.title.trim() || 'tutorial'}.webm`
      );
      const videoUpload = await uploadAsset(videoFile, documentId, scope);
      videoAssetId = videoUpload.id;
    }

    const tutorialSteps: TutorialStep[] = [];
    for (let i = 0; i < input.steps.length; i += 1) {
      const step = input.steps[i];
      let screenshotAssetId: string | undefined;
      const flat = await flattenStepForUpload(step);
      if (flat) {
        const upload = await uploadAsset(
          blobToFile(flat, `step-${pad2(step.index)}.png`),
          documentId,
          scope
        );
        screenshotAssetId = upload.id;
      }
      tutorialSteps.push({
        id: `step-${step.index}`,
        order: i + 1,
        title: step.title,
        description: step.description,
        caption: step.title || `Step ${step.index}`,
        ...(screenshotAssetId ? { screenshot_asset_id: screenshotAssetId } : {}),
        ...(step.annotations ? { annotations: step.annotations } : {}),
        ...(typeof step.tMs === 'number' ? { tMs: step.tMs } : {}),
      });
    }

    const tutorialData: TutorialData = {
      steps: tutorialSteps,
      mode: studioMode(input.recordingMode),
      ...(videoAssetId ? { video_asset_id: videoAssetId } : {}),
    };

    await saveContent(
      documentId,
      {
        content_markdown: input.markdown,
        tutorial_data: tutorialData,
        note: input.submitForReview
          ? 'Tutorial submitted for manager review'
          : input.existingDocumentId
            ? 'Tutorial re-published from recorder'
            : 'Tutorial published from recorder',
        force_version: true,
      },
      scope
    );

    if (input.submitForReview) {
      await setDocumentReviewState(documentId, 'submitted', scope);
      if (input.documentationTaskId) {
        await submitTaskForReview(input.documentationTaskId, documentId);
      }
      return { documentId };
    }

    await publishDocument(documentId, scope);

    return { documentId };
  } catch (err) {
    if (createdNew && documentId) {
      await deleteDocument(documentId, scope).catch(() => {});
    }
    throw err;
  }
}
