/** Dashboard layout v2 — 3-column rows with columnSpan / rowSpan. */

export type DashboardColumnSpan = 1 | 2 | 3;
export type DashboardRowSpan = 1 | 2;
export type DashboardBlockType = 'module' | 'chart' | 'metric' | 'metric_group';

export interface DashboardBlock {
  id: string;
  type: DashboardBlockType;
  module_id: string;
  columnSpan: DashboardColumnSpan;
  rowSpan: DashboardRowSpan;
  config?: Record<string, unknown>;
}

export interface DashboardRow {
  id: string;
  blocks: DashboardBlock[];
}

export interface DashboardLayoutV2 {
  version: 2;
  rows: DashboardRow[];
}

export const ROW_WIDGET_GRID_CLASS = 'grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3';

export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
}

export function isChartLikeBlock(block: Pick<DashboardBlock, 'type' | 'module_id'>): boolean {
  return block.type === 'chart' || block.module_id === 'trend_chart';
}

export function getStoredColumnSpan(block: Pick<DashboardBlock, 'columnSpan'>): DashboardColumnSpan {
  const span = block.columnSpan;
  if (span === 1 || span === 2 || span === 3) return span;
  return 1;
}

/**
 * Visual column span for CSS grid.
 * Chart-only rows autoscale: 1 → full, 2 → equal halves, 3 → equal thirds.
 * Lone non-chart widgets without an explicit span still fill the row width.
 */
export function getRowColumnSpan(
  block: DashboardBlock,
  blocksInRow?: DashboardBlock[]
): DashboardColumnSpan {
  const main = blocksInRow || [];
  if (main.length > 0 && main.every(isChartLikeBlock)) {
    if (main.length === 1) return 3;
    if (main.length === 2) return 2;
    return 1;
  }

  const span = getStoredColumnSpan(block);
  if (main.length === 1) return 3;
  return span;
}

/** True when the row should use a 2-column equal split layout. */
export function shouldEqualSplitRow(blocks: DashboardBlock[]): boolean {
  if (blocks.length !== 2) return false;
  if (blocks.every(isChartLikeBlock)) return true;
  return blocks.every(b => getRowColumnSpan(b, blocks) === 2);
}

/**
 * Capacity span for a block. A lone chart saved as columnSpan 3
 * still leaves room to add more charts.
 */
export function getCapacityColumnSpan(
  block: DashboardBlock,
  mainBlocks: DashboardBlock[]
): DashboardColumnSpan {
  const span = getStoredColumnSpan(block);
  if (mainBlocks.length === 1 && span === 3 && isChartLikeBlock(block)) {
    return 1;
  }
  return span;
}

export function getRowUsedColumns(blocks: DashboardBlock[]): number {
  return blocks.reduce((sum, block) => sum + getCapacityColumnSpan(block, blocks), 0);
}

export function canFitWidgetInRow(
  blocks: DashboardBlock[],
  columnSpan: DashboardColumnSpan
): boolean {
  return getRowUsedColumns(blocks) + columnSpan <= 3;
}

export function getBlockColumnSpanClass(span: DashboardColumnSpan): string {
  if (span >= 3) return 'col-span-1 md:col-span-2 lg:col-span-3';
  if (span === 2) return 'col-span-1 md:col-span-2 lg:col-span-2';
  return 'col-span-1';
}

export function getBlockRowSpanClass(span: DashboardRowSpan): string {
  return span >= 2 ? 'row-span-2 min-h-[28rem]' : 'row-span-1';
}

export function emptyLayout(): DashboardLayoutV2 {
  return { version: 2, rows: [] };
}

export function createChartBlock(columnSpan: DashboardColumnSpan = 1): DashboardBlock {
  return {
    id: newId('blk'),
    type: 'chart',
    module_id: 'trend_chart',
    columnSpan,
    rowSpan: 1,
    config: {},
  };
}

export function createEmptyRowWithChart(): DashboardRow {
  return {
    id: newId('row'),
    blocks: [createChartBlock(1)],
  };
}

/** Collect unique module_ids already on the board (for unique catalog items). */
export function usedUniqueModuleIds(layout: DashboardLayoutV2): Set<string> {
  const used = new Set<string>();
  for (const row of layout.rows) {
    for (const block of row.blocks) {
      used.add(block.module_id);
    }
  }
  return used;
}
