import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { WorkspaceProfile } from '@/utils/workspaceProfile';
import {
  catalogSectionsForProfile,
  type Ww360CatalogOption,
} from './ww360WidgetCatalog';
import { canFitWidgetInRow, type DashboardBlock } from './dashboardLayoutTypes';

interface WidgetPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: WorkspaceProfile;
  targetBlocks: DashboardBlock[];
  usedModuleIds: Set<string>;
  onSelect: (option: Ww360CatalogOption) => void;
}

export const WidgetPickerDialog: React.FC<WidgetPickerDialogProps> = ({
  open,
  onOpenChange,
  profile,
  targetBlocks,
  usedModuleIds,
  onSelect,
}) => {
  const sections = catalogSectionsForProfile(profile);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] max-w-3xl overflow-y-auto text-base"
        data-tour="widget-picker-dialog"
      >
        <DialogHeader>
          <DialogTitle className="text-xl">Add panel to row</DialogTitle>
          <DialogDescription className="text-[1.125rem] text-slate-600">
            Choose a categorized panel. If it does not fit this row, it opens in a new row.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {sections.map(section => (
            <section key={section.title} className="space-y-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {section.title} ({section.columnSpan} column
                  {section.columnSpan === 1 ? '' : 's'})
                </h3>
                <p className="text-base text-slate-600">{section.subtitle}</p>
              </div>
              <ul className="grid gap-3 sm:grid-cols-2">
                {section.options.map(option => {
                  const alreadyUsed = option.unique && usedModuleIds.has(option.module_id);
                  const fits = canFitWidgetInRow(targetBlocks, option.columnSpan);
                  let statusNote = '';
                  if (alreadyUsed) statusNote = 'Already on your home';
                  else if (!fits) statusNote = `Needs ${option.columnSpan} free columns — will add as new row`;

                  return (
                    <li key={option.module_id}>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={alreadyUsed}
                        className="h-auto min-h-[44px] w-full flex-col items-start gap-1 whitespace-normal p-4 text-left text-base"
                        data-tour={`picker-${option.module_id}`}
                        onClick={() => {
                          onSelect(option);
                          onOpenChange(false);
                        }}
                      >
                        <span className="font-semibold text-slate-900">{option.label}</span>
                        <span className="text-[0.875rem] font-normal text-slate-600">
                          {option.description}
                        </span>
                        {statusNote && (
                          <span className="text-[0.875rem] font-medium text-sky-700">
                            {statusNote}
                          </span>
                        )}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
