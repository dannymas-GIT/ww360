/**
 * Branded shell for workforce Add/Edit and sample-preview dialogs.
 */
import type { ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConceptArtForEntity } from '@/components/workforce/workforceConceptArt';
import {
  workforceEntityChrome,
  WORKFORCE_ENTITY_DIALOG_MAX_WIDTH,
  WORKFORCE_ENTITY_FORM_GRID_CLASS,
} from '@/components/workforce/workforceEntityDialogChrome';
import { cn } from '@/lib/utils';
import type { WorkforceEntityType } from '@/services/workforceSuccessionService';

export function WorkforceFormRequiredNote({ entityType }: { entityType: WorkforceEntityType }) {
  const { theme } = workforceEntityChrome(entityType);
  return (
    <p className={`text-xs ${theme.requiredNote}`}>
      <span className="text-red-600">*</span> required to save. Reference fields, saved values, and
      dates use dropdowns or date pickers.
    </p>
  );
}

export interface WorkforceEntityDialogShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: WorkforceEntityType;
  title: string;
  description?: ReactNode;
  badges?: ReactNode;
  headerPrefix?: ReactNode;
  /** Override default phase gradient (e.g. sample pathway themes). */
  headerGradientClass?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function WorkforceEntityFormGrid({ children }: { children: ReactNode }) {
  return <div className={WORKFORCE_ENTITY_FORM_GRID_CLASS}>{children}</div>;
}

export function WorkforceEntityDialogShell({
  open,
  onOpenChange,
  entityType,
  title,
  description,
  badges,
  headerPrefix,
  headerGradientClass,
  children,
  footer,
}: WorkforceEntityDialogShellProps) {
  const { tabMeta, theme, accentBorder, accentText, headerGradient } =
    workforceEntityChrome(entityType);
  const TabIcon = tabMeta.icon;
  const gradient = headerGradientClass ?? headerGradient;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn('max-h-[85vh] gap-0 overflow-y-auto p-0', WORKFORCE_ENTITY_DIALOG_MAX_WIDTH)}
      >
        <div className={`border-b-4 ${accentBorder}`} />
        <div className={`border-b bg-gradient-to-r px-6 pt-6 pb-4 ${gradient}`}>
          {headerPrefix}
          <DialogHeader className="space-y-0 text-left">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                {badges ? (
                  <div className="mb-2 flex flex-wrap items-center gap-2">{badges}</div>
                ) : null}
                <DialogTitle
                  className={`flex items-center gap-2 text-lg ${theme.sectionAccent.split(' ')[1]}`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${theme.badge}`}
                  >
                    <TabIcon className={`h-4 w-4 ${accentText}`} aria-hidden />
                  </span>
                  {title}
                </DialogTitle>
                {description ? (
                  <DialogDescription className="mt-2 text-xs leading-relaxed text-gray-600">
                    {description}
                  </DialogDescription>
                ) : null}
              </div>
              <div className={`hidden rounded-xl border p-1.5 sm:block ${theme.fieldCard}`}>
                <ConceptArtForEntity entityType={entityType} className="h-16 w-24 shrink-0" />
              </div>
            </div>
          </DialogHeader>
        </div>
        <div className={`space-y-3 px-6 py-4 ${theme.bodyBg}`}>{children}</div>
        {footer ? (
          <DialogFooter className={`border-t px-6 py-4 ${theme.footerBg}`}>{footer}</DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** Header block for dialogs that manage their own DialogContent (e.g. record detail). */
export interface WorkforceEntityDialogHeaderProps {
  entityType: WorkforceEntityType;
  title: ReactNode;
  description?: ReactNode;
  badges?: ReactNode;
  headerPrefix?: ReactNode;
  headerGradientClass?: string;
}

export function WorkforceEntityDialogHeader({
  entityType,
  title,
  description,
  badges,
  headerPrefix,
  headerGradientClass,
}: WorkforceEntityDialogHeaderProps) {
  const { tabMeta, theme, accentBorder, accentText, headerGradient } =
    workforceEntityChrome(entityType);
  const TabIcon = tabMeta.icon;
  const gradient = headerGradientClass ?? headerGradient;

  return (
    <>
      <div className={`border-b-4 ${accentBorder}`} />
      <div className={`border-b bg-gradient-to-r px-6 pt-6 pb-4 ${gradient}`}>
        {headerPrefix}
        <DialogHeader className="space-y-0 text-left">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              {badges ? (
                <div className="mb-2 flex flex-wrap items-center gap-2">{badges}</div>
              ) : null}
              <DialogTitle
                className={`flex items-center gap-2 text-lg ${theme.sectionAccent.split(' ')[1]}`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${theme.badge}`}
                >
                  <TabIcon className={`h-4 w-4 ${accentText}`} aria-hidden />
                </span>
                <span className="min-w-0 truncate">{title}</span>
              </DialogTitle>
              {description ? (
                <DialogDescription className="mt-2 text-xs leading-relaxed text-gray-600">
                  {description}
                </DialogDescription>
              ) : null}
            </div>
            <div className={`hidden rounded-xl border p-1.5 sm:block ${theme.fieldCard}`}>
              <ConceptArtForEntity entityType={entityType} className="h-16 w-24 shrink-0" />
            </div>
          </div>
        </DialogHeader>
      </div>
    </>
  );
}

export function WorkforceEntityDialogBody({ children }: { children: ReactNode }) {
  return <div className="space-y-4 px-6 py-4">{children}</div>;
}

export function WorkforceEntityDialogFooterBar({
  children,
  className,
  entityType,
}: {
  children: ReactNode;
  className?: string;
  entityType?: WorkforceEntityType;
}) {
  const footerBg = entityType ? workforceEntityChrome(entityType).theme.footerBg : 'bg-slate-50/90';
  return (
    <DialogFooter className={cn('border-t px-6 py-4', footerBg, className)}>
      {children}
    </DialogFooter>
  );
}
