/**
 * TipTap's markdown parser only recognizes GFM tables that include a header
 * row and a `| --- |` separator. Older binder samples sometimes stored a lone
 * body row like `| — | — | — |`, which rendered as plain text.
 */
const PIPE_ROW = /^\|(?:[^|\n]+\|)+$/;
const SEP_ROW = /^\|(?:\s*:?-{3,}:?\s*\|)+$/;

function columnCount(line: string): number {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').length;
}

function headerLabelsFor(cols: number): string[] {
  const presets: Record<number, string[]> = {
    3: ['Title', 'Type', 'Status'],
    4: ['Employee', 'Position / credential', 'Date', 'Detail'],
    5: ['Name / role', 'Primary', 'Backup', 'Risk', 'Notes'],
    7: ['Operator', 'Grade', 'Cycle end', 'Required', 'Earned', 'Remaining', 'Status'],
  };
  if (presets[cols]) return presets[cols];
  return Array.from({ length: cols }, (_, i) => `Column ${i + 1}`);
}

function headerRow(cols: number): string {
  return `| ${headerLabelsFor(cols).join(' | ')} |`;
}

function separatorRow(cols: number): string {
  return `| ${Array.from({ length: cols }, () => '---').join(' | ')} |`;
}

/** Wrap orphan pipe-row clusters in a full GFM table when no separator is present. */
export function repairOrphanMarkdownTables(markdown: string): string {
  const lines = (markdown || '').split('\n');
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!PIPE_ROW.test(trimmed) || SEP_ROW.test(trimmed)) {
      out.push(line);
      i += 1;
      continue;
    }

    const blockStart = i;
    const block: string[] = [];
    while (i < lines.length && PIPE_ROW.test(lines[i].trim())) {
      block.push(lines[i].trim());
      i += 1;
    }

    const hasSeparator = block.some(row => SEP_ROW.test(row));
    if (hasSeparator || block.length === 0) {
      out.push(...lines.slice(blockStart, i));
      continue;
    }

    const cols = Math.max(...block.map(columnCount), 1);
    out.push(headerRow(cols));
    out.push(separatorRow(cols));
    out.push(...block);
  }
  return out.join('\n');
}
