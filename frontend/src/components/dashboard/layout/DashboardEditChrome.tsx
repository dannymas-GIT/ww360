import React from 'react';
import { Loader2, Pencil, RotateCcw, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DashboardEditChromeProps {
  isEditMode: boolean;
  saving: boolean;
  isPreviewMode: boolean;
  dirty: boolean;
  savedNote: string | null;
  error: string | null;
  onEnterEdit: () => void;
  onExitEdit: () => void;
  onSave: () => void;
  onReset: () => void;
}

export const DashboardEditChrome: React.FC<DashboardEditChromeProps> = ({
  isEditMode,
  saving,
  isPreviewMode,
  dirty,
  savedNote,
  error,
  onEnterEdit,
  onExitEdit,
  onSave,
  onReset,
}) => {
  return (
    <div
      className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
      data-tour="dashboard-edit-chrome"
    >
      <div className="min-w-0 flex-1">
        {isEditMode ? (
          <p className="text-[1.125rem] text-slate-700">
            Edit mode — add rows, charts, and panels. Drag to reorder. Adjust column and row spans on
            each block.
          </p>
        ) : (
          <p className="text-[1.125rem] text-slate-600">
            Customize your home with rows of charts and panels.
          </p>
        )}
        {isPreviewMode && (
          <p className="mt-1 text-base text-amber-800">
            Read-only preview — exit preview to save customizations.
          </p>
        )}
        {error && (
          <p className="mt-1 text-base text-red-700" role="alert">
            {error}
          </p>
        )}
        {savedNote && !error && (
          <p className="mt-1 text-base text-emerald-800">{savedNote}</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {!isEditMode ? (
          <Button
            type="button"
            className="min-h-[44px] gap-2 text-base"
            onClick={onEnterEdit}
            data-tour="enter-edit-mode"
          >
            <Pencil className="h-4 w-4" />
            Enter Edit Mode
          </Button>
        ) : (
          <>
            <Button
              type="button"
              className="min-h-[44px] gap-2 text-base"
              disabled={saving || isPreviewMode || !dirty}
              onClick={onSave}
              data-tour="save-dashboard-layout"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Changes
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] gap-2 text-base"
              disabled={saving || isPreviewMode}
              onClick={onReset}
              data-tour="reset-dashboard-layout"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] gap-2 text-base"
              onClick={onExitEdit}
              data-tour="exit-edit-mode"
            >
              <X className="h-4 w-4" />
              Exit Edit Mode
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
