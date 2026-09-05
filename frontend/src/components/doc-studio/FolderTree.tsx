import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Folder, FolderOpen, FolderPlus, Inbox, Library, MoreHorizontal } from 'lucide-react';
import type { DocFolder } from '@/services/docStudioService';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export const ALL_DOCS = '__all__';
export const UNFILED = '__root__';

export interface FolderTreeProps {
  folders: DocFolder[];
  selectedId: string;
  totalCount: number;
  unfiledCount: number;
  canManage: boolean;
  onSelect: (id: string) => void;
  onCreate: (parentId: string | null) => void;
  onRename: (folder: DocFolder) => void;
  onDelete: (folder: DocFolder) => void;
}

export function FolderTree({
  folders,
  selectedId,
  totalCount,
  unfiledCount,
  canManage,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: FolderTreeProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const byParent = useMemo(() => {
    const map = new Map<string | null, DocFolder[]>();
    folders.forEach(f => {
      const key = f.parent_id ?? null;
      map.set(key, [...(map.get(key) ?? []), f]);
    });
    map.forEach(list => list.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)));
    return map;
  }, [folders]);

  const renderNode = (f: DocFolder, depth: number): React.ReactNode => {
    const children = byParent.get(f.id) ?? [];
    const isOpen = !collapsed[f.id];
    const active = selectedId === f.id;
    return (
      <li key={f.id}>
        <div
          className={`group flex items-center gap-1 rounded-md pr-1 text-sm ${
            active ? 'bg-sky-50 text-sky-900' : 'text-slate-700 hover:bg-slate-100'
          }`}
          style={{ paddingLeft: 4 + depth * 14 }}
        >
          {children.length ? (
            <button
              type="button"
              className="rounded p-0.5 text-slate-400 hover:text-slate-700"
              aria-label={isOpen ? 'Collapse' : 'Expand'}
              onClick={() => setCollapsed(c => ({ ...c, [f.id]: !c[f.id] }))}
            >
              {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          ) : (
            <span className="w-[18px]" aria-hidden />
          )}
          <button
            type="button"
            className="flex min-h-[36px] flex-1 items-center gap-2 truncate py-1 text-left"
            onClick={() => onSelect(f.id)}
            aria-current={active ? 'true' : undefined}
          >
            {active ? <FolderOpen className="h-4 w-4 shrink-0 text-sky-600" /> : <Folder className="h-4 w-4 shrink-0 text-slate-400" />}
            <span className="truncate">{f.name}</span>
            <span className="ml-auto text-[11px] tabular-nums text-slate-400">{f.document_count}</span>
          </button>
          {canManage ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="rounded p-1 text-slate-400 opacity-0 transition group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100 hover:bg-slate-200/70 hover:text-slate-700"
                  aria-label={`Folder actions for ${f.name}`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => onCreate(f.id)}>New subfolder</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onRename(f)}>Rename</DropdownMenuItem>
                <DropdownMenuItem className="text-red-700 focus:text-red-700" onClick={() => onDelete(f)}>
                  Delete folder
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
        {children.length && isOpen ? <ul>{children.map(c => renderNode(c, depth + 1))}</ul> : null}
      </li>
    );
  };

  const roots = byParent.get(null) ?? [];

  return (
    <nav aria-label="Folders" className="flex h-full flex-col">
      <ul className="space-y-0.5">
        <li>
          <button
            type="button"
            className={`flex min-h-[36px] w-full items-center gap-2 rounded-md px-2 py-1 text-sm ${
              selectedId === ALL_DOCS ? 'bg-sky-50 text-sky-900' : 'text-slate-700 hover:bg-slate-100'
            }`}
            onClick={() => onSelect(ALL_DOCS)}
          >
            <Library className="h-4 w-4 text-slate-400" />
            <span>All documents</span>
            <span className="ml-auto text-[11px] tabular-nums text-slate-400">{totalCount}</span>
          </button>
        </li>
        <li>
          <button
            type="button"
            className={`flex min-h-[36px] w-full items-center gap-2 rounded-md px-2 py-1 text-sm ${
              selectedId === UNFILED ? 'bg-sky-50 text-sky-900' : 'text-slate-700 hover:bg-slate-100'
            }`}
            onClick={() => onSelect(UNFILED)}
          >
            <Inbox className="h-4 w-4 text-slate-400" />
            <span>Unfiled</span>
            <span className="ml-auto text-[11px] tabular-nums text-slate-400">{unfiledCount}</span>
          </button>
        </li>
      </ul>
      <div className="mt-3 flex items-center justify-between px-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Folders</p>
        {canManage ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-sky-700 hover:bg-sky-50"
            onClick={() => onCreate(null)}
          >
            <FolderPlus className="h-3.5 w-3.5" /> New
          </button>
        ) : null}
      </div>
      <ul className="mt-1 space-y-0.5 overflow-y-auto">{roots.map(f => renderNode(f, 0))}</ul>
      {!roots.length ? (
        <p className="px-2 py-3 text-xs text-slate-500">No folders yet.</p>
      ) : null}
    </nav>
  );
}
