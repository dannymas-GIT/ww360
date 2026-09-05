/**
 * Document Studio rich editor — TipTap with toolbar, bubble menu, slash commands,
 * tables, task lists, images and template insertion. Markdown in, markdown out.
 */
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import CharacterCount from '@tiptap/extension-character-count';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Markdown } from 'tiptap-markdown';
import { common, createLowlight } from 'lowlight';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Table2,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react';
import { uploadAsset } from '@/services/docStudioService';
import { STUDIO_TEMPLATES } from '@/config/studioTemplates';
import './docStudio.css';

const lowlight = createLowlight(common);

type EditorLike = NonNullable<ReturnType<typeof useEditor>>;

const SLASH_COMMANDS: { id: string; label: string; hint: string; icon: string; action: (e: EditorLike) => void }[] = [
  { id: 'h1', label: 'Heading 1', hint: 'Section title', icon: 'H1', action: e => e.chain().focus().toggleHeading({ level: 1 }).run() },
  { id: 'h2', label: 'Heading 2', hint: 'Sub-section', icon: 'H2', action: e => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { id: 'h3', label: 'Heading 3', hint: 'Minor heading', icon: 'H3', action: e => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { id: 'bullet', label: 'Bullet list', hint: 'Unordered points', icon: '•', action: e => e.chain().focus().toggleBulletList().run() },
  { id: 'ordered', label: 'Numbered list', hint: 'Steps in order', icon: '1.', action: e => e.chain().focus().toggleOrderedList().run() },
  { id: 'task', label: 'Checklist', hint: 'Track readiness', icon: '☑', action: e => e.chain().focus().toggleTaskList().run() },
  { id: 'quote', label: 'Callout / quote', hint: 'Highlight an ask', icon: '❝', action: e => e.chain().focus().toggleBlockquote().run() },
  { id: 'table', label: 'Table', hint: '3 × 3 with header', icon: '⊞', action: e => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { id: 'code', label: 'Code block', hint: 'Monospace text', icon: '</>', action: e => e.chain().focus().toggleCodeBlock().run() },
  { id: 'divider', label: 'Divider', hint: 'Horizontal rule', icon: '—', action: e => e.chain().focus().setHorizontalRule().run() },
];

export interface StudioEditorHandle {
  getMarkdown: () => string;
  getJson: () => Record<string, unknown>;
  setMarkdown: (markdown: string) => void;
  insertMarkdown: (markdown: string) => void;
  focus: () => void;
  isEmpty: () => boolean;
}

export interface StudioEditorProps {
  initialMarkdown?: string;
  readOnly?: boolean;
  placeholder?: string;
  /** Document id for asset uploads (images). */
  documentId?: string | null;
  scope?: string;
  onChange?: (markdown: string, json: Record<string, unknown>) => void;
  onUploadError?: (message: string) => void;
  className?: string;
}

function getMarkdownFromEditor(ed: EditorLike): string {
  const storage = ed.storage as unknown as { markdown?: { getMarkdown: () => string } };
  return storage.markdown?.getMarkdown() ?? '';
}

export const StudioEditor = forwardRef<StudioEditorHandle, StudioEditorProps>(function StudioEditor(
  {
    initialMarkdown = '',
    readOnly = false,
    placeholder,
    documentId,
    scope,
    onChange,
    onUploadError,
    className = '',
  },
  ref
) {
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [slashIndex, setSlashIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    editable: !readOnly,
    extensions: [
      StarterKit.configure({ codeBlock: false, link: false, underline: false }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Subscript,
      Superscript,
      TaskList,
      TaskItem.configure({ nested: true }),
      CodeBlockLowlight.configure({ lowlight }),
      Link.configure({ openOnClick: false, autolink: true, defaultProtocol: 'https' }),
      Placeholder.configure({
        placeholder: placeholder || 'Start writing, or type / for headings, lists, tables and more…',
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Image.configure({ inline: false, allowBase64: false }),
      CharacterCount,
      Markdown.configure({
        html: true,
        transformPastedText: true,
        transformCopiedText: true,
        breaks: false,
      }),
    ],
    content: initialMarkdown,
    onUpdate: ({ editor: ed }) => {
      onChangeRef.current?.(getMarkdownFromEditor(ed), ed.getJSON() as Record<string, unknown>);
      const { from } = ed.state.selection;
      const textBefore = ed.state.doc.textBetween(Math.max(0, from - 24), from, '\n');
      const slashMatch = textBefore.match(/(?:^|\s)\/([^\s/]*)$/);
      if (slashMatch) {
        setSlashOpen(true);
        setSlashFilter(slashMatch[1].toLowerCase());
        setSlashIndex(0);
      } else {
        setSlashOpen(false);
        setSlashFilter('');
      }
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  const insertImageFile = useCallback(
    async (file: File) => {
      if (!editor) return;
      try {
        const asset = await uploadAsset(file, documentId ?? undefined, scope);
        editor.chain().focus().setImage({ src: asset.url, alt: file.name }).run();
      } catch (err) {
        onUploadError?.(err instanceof Error ? err.message : 'Image upload failed');
      }
    },
    [editor, documentId, scope, onUploadError]
  );

  // Paste / drop images → upload as assets.
  useEffect(() => {
    if (!editor || readOnly) return;
    const dom = editor.view.dom;
    const onPaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            event.preventDefault();
            void insertImageFile(file);
          }
        }
      }
    };
    const onDrop = (event: DragEvent) => {
      const files = event.dataTransfer?.files;
      if (!files?.length) return;
      const images = Array.from(files).filter(f => f.type.startsWith('image/'));
      if (!images.length) return;
      event.preventDefault();
      images.forEach(f => void insertImageFile(f));
    };
    dom.addEventListener('paste', onPaste as EventListener);
    dom.addEventListener('drop', onDrop as EventListener);
    return () => {
      dom.removeEventListener('paste', onPaste as EventListener);
      dom.removeEventListener('drop', onDrop as EventListener);
    };
  }, [editor, readOnly, insertImageFile]);

  useImperativeHandle(ref, () => ({
    getMarkdown: () => (editor ? getMarkdownFromEditor(editor) : initialMarkdown),
    getJson: () => (editor ? (editor.getJSON() as Record<string, unknown>) : {}),
    setMarkdown: (markdown: string) => {
      editor?.commands.setContent(markdown, { emitUpdate: false });
    },
    insertMarkdown: (markdown: string) => {
      editor?.chain().focus().insertContent(markdown).run();
    },
    focus: () => editor?.commands.focus(),
    isEmpty: () => (editor ? editor.isEmpty : !initialMarkdown),
  }));

  const runSlashCommand = useCallback(
    (cmd: (typeof SLASH_COMMANDS)[number]) => {
      if (!editor) return;
      const { from } = editor.state.selection;
      const textBefore = editor.state.doc.textBetween(Math.max(0, from - 30), from, '\n');
      const match = textBefore.match(/(?:^|\s)\/([^\s/]*)$/);
      if (match) {
        const deleteFrom = from - match[0].length + (match[0].startsWith(' ') ? 1 : 0);
        editor.chain().focus().deleteRange({ from: deleteFrom, to: from }).run();
      }
      cmd.action(editor);
      setSlashOpen(false);
    },
    [editor]
  );

  const filteredCommands = SLASH_COMMANDS.filter(
    c => !slashFilter || c.label.toLowerCase().includes(slashFilter) || c.id.includes(slashFilter)
  );

  useEffect(() => {
    if (!editor || readOnly) return;
    const handler = (e: KeyboardEvent) => {
      if (!slashOpen || filteredCommands.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashIndex(i => (i + 1) % filteredCommands.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashIndex(i => (i - 1 + filteredCommands.length) % filteredCommands.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        runSlashCommand(filteredCommands[slashIndex]);
      } else if (e.key === 'Escape') {
        setSlashOpen(false);
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [editor, slashOpen, filteredCommands, slashIndex, runSlashCommand, readOnly]);

  if (!editor) return null;

  const setLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Link URL', prev ?? 'https://');
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  };

  const countStorage = (editor.storage as unknown as {
    characterCount?: { words?: () => number; characters?: () => number };
  }).characterCount;
  const words = countStorage?.words?.() ?? 0;
  const chars = countStorage?.characters?.() ?? 0;

  return (
    <div className={`studio-editor flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white ${className}`}>
      {!readOnly && (
        <div
          data-tour="studio-toolbar"
          className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50 px-2 py-1.5"
          role="toolbar"
          aria-label="Formatting"
        >
          <ToolbarButton title="Undo" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
            <Undo2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton title="Redo" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
            <Redo2 className="h-4 w-4" />
          </ToolbarButton>
          <Divider />
          <ToolbarButton title="Heading 1" active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
            <Heading1 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton title="Heading 2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
            <Heading2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton title="Heading 3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
            <Heading3 className="h-4 w-4" />
          </ToolbarButton>
          <Divider />
          <ToolbarButton title="Bold (Ctrl+B)" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton title="Italic (Ctrl+I)" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton title="Underline (Ctrl+U)" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
            <UnderlineIcon className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton title="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
            <Strikethrough className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton title="Highlight" active={editor.isActive('highlight')} onClick={() => editor.chain().focus().toggleHighlight({ color: '#fde68a' }).run()}>
            <Highlighter className="h-4 w-4" />
          </ToolbarButton>
          <Divider />
          <ToolbarButton title="Align left" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}>
            <AlignLeft className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton title="Align center" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}>
            <AlignCenter className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton title="Align right" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}>
            <AlignRight className="h-4 w-4" />
          </ToolbarButton>
          <Divider />
          <ToolbarButton title="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton title="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton title="Checklist" active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()}>
            <ListTodo className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton title="Callout / quote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
            <Quote className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton title="Code block" active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
            <Code className="h-4 w-4" />
          </ToolbarButton>
          <Divider />
          <ToolbarButton title="Link" active={editor.isActive('link')} onClick={setLink}>
            <Link2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton title="Insert table" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
            <Table2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton title="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
            <Minus className="h-4 w-4" />
          </ToolbarButton>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) void insertImageFile(file);
              e.target.value = '';
            }}
          />
          <ToolbarButton title="Insert image" onClick={() => fileInputRef.current?.click()}>
            <ImagePlus className="h-4 w-4" />
          </ToolbarButton>

          <label className="ml-auto flex items-center gap-1 text-xs text-slate-500">
            <span className="sr-only">Insert template</span>
            <select
              data-tour="studio-insert-template"
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 min-h-[32px]"
              defaultValue=""
              onChange={e => {
                const tpl = STUDIO_TEMPLATES.find(t => t.id === e.target.value);
                if (tpl?.markdown) editor.chain().focus().insertContent(tpl.markdown).run();
                e.target.value = '';
              }}
            >
              <option value="">Insert section from template…</option>
              {STUDIO_TEMPLATES.filter(t => t.markdown).map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div className="relative min-h-0 flex-1 overflow-auto">
        {!readOnly && editor.isActive('table') && (
          <div className="sticky top-0 z-10 flex flex-wrap gap-1 border-b border-sky-100 bg-sky-50 px-3 py-1 text-xs">
            <TableAction label="+ Row" onClick={() => editor.chain().focus().addRowAfter().run()} />
            <TableAction label="− Row" onClick={() => editor.chain().focus().deleteRow().run()} />
            <TableAction label="+ Column" onClick={() => editor.chain().focus().addColumnAfter().run()} />
            <TableAction label="− Column" onClick={() => editor.chain().focus().deleteColumn().run()} />
            <TableAction label="Toggle header row" onClick={() => editor.chain().focus().toggleHeaderRow().run()} />
            <TableAction label="Delete table" onClick={() => editor.chain().focus().deleteTable().run()} danger />
          </div>
        )}

        {!readOnly && (
          <BubbleMenu
            editor={editor}
            shouldShow={({ editor: ed, from, to }) => from !== to && !ed.isActive('image') && !ed.isActive('codeBlock')}
            className="flex gap-0.5 rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
          >
            <ToolbarButton title="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
              <Bold className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton title="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
              <Italic className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton title="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
              <UnderlineIcon className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton title="Highlight" active={editor.isActive('highlight')} onClick={() => editor.chain().focus().toggleHighlight({ color: '#fde68a' }).run()}>
              <Highlighter className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton title="Link" active={editor.isActive('link')} onClick={setLink}>
              <Link2 className="h-3.5 w-3.5" />
            </ToolbarButton>
          </BubbleMenu>
        )}

        {slashOpen && filteredCommands.length > 0 && !readOnly && (
          <div
            data-tour="studio-slash-menu"
            className="absolute left-4 top-2 z-20 w-64 rounded-lg border border-slate-200 bg-white py-1 shadow-xl"
            role="listbox"
            aria-label="Insert block"
          >
            {filteredCommands.map((cmd, idx) => (
              <button
                key={cmd.id}
                type="button"
                role="option"
                aria-selected={idx === slashIndex}
                className={`flex w-full items-center gap-3 px-3 py-1.5 text-left text-sm ${
                  idx === slashIndex ? 'bg-sky-50 text-sky-900' : 'text-slate-700 hover:bg-slate-50'
                }`}
                onMouseDown={e => {
                  e.preventDefault();
                  runSlashCommand(cmd);
                }}
              >
                <span className="w-7 text-center text-xs font-semibold text-slate-500">{cmd.icon}</span>
                <span className="flex-1">
                  <span className="block font-medium">{cmd.label}</span>
                  <span className="block text-[11px] text-slate-500">{cmd.hint}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        <EditorContent editor={editor} className="studio-editor-content" />
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 px-3 py-1 text-[11px] text-slate-500">
        <span>
          {words.toLocaleString()} words · {chars.toLocaleString()} characters
        </span>
        {!readOnly ? <span>Type / for blocks · Select text for quick formatting</span> : <span>Read only</span>}
      </div>
    </div>
  );
});

function Divider() {
  return <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden />;
}

function ToolbarButton({
  active,
  onClick,
  children,
  title,
  disabled,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={e => e.preventDefault()}
      onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-sm transition-colors disabled:opacity-40 ${
        active ? 'bg-[#07111f] text-white' : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
      }`}
    >
      {children}
    </button>
  );
}

function TableAction({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onMouseDown={e => e.preventDefault()}
      onClick={onClick}
      className={`rounded px-2 py-0.5 font-medium ${
        danger ? 'text-red-700 hover:bg-red-50' : 'text-sky-800 hover:bg-sky-100'
      }`}
    >
      {label}
    </button>
  );
}
