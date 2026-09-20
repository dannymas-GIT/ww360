import React from 'react';
import {
  useSortable,
  SortableContext,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { BarChart3, GripVertical, LayoutGrid, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ROW_WIDGET_GRID_CLASS,
  canFitWidgetInRow,
  getBlockColumnSpanClass,
  getBlockRowSpanClass,
  getRowColumnSpan,
  shouldEqualSplitRow,
  type DashboardBlock,
  type DashboardColumnSpan,
  type DashboardRow,
  type DashboardRowSpan,
} from './dashboardLayoutTypes';

interface SortableBlockShellProps {
  block: DashboardBlock;
  blocksInRow: DashboardBlock[];
  isEditMode: boolean;
  equalSplit: boolean;
  children: React.ReactNode;
  onRemove: (blockId: string) => void;
  onColumnSpanChange: (blockId: string, span: DashboardColumnSpan) => void;
  onRowSpanChange: (blockId: string, span: DashboardRowSpan) => void;
  allowRowSpan: boolean;
}

const SortableBlockShell: React.FC<SortableBlockShellProps> = ({
  block,
  blocksInRow,
  isEditMode,
  equalSplit,
  children,
  onRemove,
  onColumnSpanChange,
  onRowSpanChange,
  allowRowSpan,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
    disabled: !isEditMode,
  });

  const visualSpan = equalSplit ? 2 : getRowColumnSpan(block, blocksInRow);
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${equalSplit ? 'col-span-1' : getBlockColumnSpanClass(visualSpan)} ${getBlockRowSpanClass(block.rowSpan)} relative`}
      data-block-id={block.id}
      data-module-id={block.module_id}
    >
      {isEditMode && (
        <div className="mb-2 flex flex-wrap items-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 p-2">
          <button
            type="button"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
            aria-label="Drag block"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <label className="flex items-center gap-2 text-base text-slate-700">
            Col
            <select
              className="min-h-[44px] rounded-md border border-slate-300 bg-white px-2 text-base"
              value={block.columnSpan}
              onChange={e =>
                onColumnSpanChange(block.id, Number(e.target.value) as DashboardColumnSpan)
              }
              data-tour="block-column-span"
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </label>
          {allowRowSpan && (
            <label className="flex items-center gap-2 text-base text-slate-700">
              Row
              <select
                className="min-h-[44px] rounded-md border border-slate-300 bg-white px-2 text-base"
                value={block.rowSpan}
                onChange={e =>
                  onRowSpanChange(block.id, Number(e.target.value) as DashboardRowSpan)
                }
                data-tour="block-row-span"
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
              </select>
            </label>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-[44px] gap-1 text-base text-red-700"
            onClick={() => onRemove(block.id)}
            aria-label="Remove block"
            data-tour="remove-block"
          >
            <Trash2 className="h-4 w-4" />
            Remove
          </Button>
        </div>
      )}
      <div className="h-full">{children}</div>
    </div>
  );
};

interface SortableDashboardRowProps {
  row: DashboardRow;
  isEditMode: boolean;
  renderBlock: (block: DashboardBlock) => React.ReactNode;
  allowRowSpanFor: (block: DashboardBlock) => boolean;
  onAddChart: (rowId: string) => void;
  onAddWidget: (rowId: string) => void;
  onRemoveRow: (rowId: string) => void;
  onRemoveBlock: (rowId: string, blockId: string) => void;
  onColumnSpanChange: (rowId: string, blockId: string, span: DashboardColumnSpan) => void;
  onRowSpanChange: (rowId: string, blockId: string, span: DashboardRowSpan) => void;
}

export const SortableDashboardRow: React.FC<SortableDashboardRowProps> = ({
  row,
  isEditMode,
  renderBlock,
  allowRowSpanFor,
  onAddChart,
  onAddWidget,
  onRemoveRow,
  onRemoveBlock,
  onColumnSpanChange,
  onRowSpanChange,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
    disabled: !isEditMode,
  });

  const equalSplit = shouldEqualSplitRow(row.blocks);
  const canAddChart = canFitWidgetInRow(row.blocks, 1);
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  };

  const gridClass = equalSplit
    ? 'grid grid-cols-1 gap-3 md:grid-cols-2'
    : ROW_WIDGET_GRID_CLASS;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg ${isEditMode ? 'border border-dashed border-slate-300 p-3' : ''}`}
      data-tour="dashboard-row"
      data-row-id={row.id}
    >
      {isEditMode && (
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
              aria-label="Drag row"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-4 w-4" />
            </button>
            <span className="text-base font-medium text-slate-700">Row</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] gap-2 text-base"
              disabled={!canAddChart}
              onClick={() => onAddChart(row.id)}
              data-tour="add-chart-to-row"
            >
              <BarChart3 className="h-4 w-4" />
              Add Chart
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] gap-2 text-base"
              onClick={() => onAddWidget(row.id)}
              data-tour="add-widget-to-row"
            >
              <LayoutGrid className="h-4 w-4" />
              Add Widget
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] gap-2 text-base text-red-700"
              onClick={() => onRemoveRow(row.id)}
              data-tour="remove-row"
            >
              <Trash2 className="h-4 w-4" />
              Remove Row
            </Button>
          </div>
        </div>
      )}

      <SortableContext items={row.blocks.map(b => b.id)} strategy={horizontalListSortingStrategy}>
        <div className={gridClass}>
          {row.blocks.map(block => (
            <SortableBlockShell
              key={block.id}
              block={block}
              blocksInRow={row.blocks}
              isEditMode={isEditMode}
              equalSplit={equalSplit}
              allowRowSpan={allowRowSpanFor(block)}
              onRemove={blockId => onRemoveBlock(row.id, blockId)}
              onColumnSpanChange={(blockId, span) => onColumnSpanChange(row.id, blockId, span)}
              onRowSpanChange={(blockId, span) => onRowSpanChange(row.id, blockId, span)}
            >
              {renderBlock(block)}
            </SortableBlockShell>
          ))}
        </div>
      </SortableContext>

      {isEditMode && row.blocks.length === 0 && (
        <p className="py-6 text-center text-base text-slate-500">
          Empty row — use Add Chart or Add Widget.
        </p>
      )}
    </div>
  );
};

// Re-export strategy helper for parent DnD context
export { verticalListSortingStrategy };
