/**
 * TipTap image extension with drag-to-resize handles for Document Studio.
 *
 * Size and float are stored in markdown alt text (`![caption|width=60|float=left](url)`).
 */
import React, { useCallback, useRef, useState } from 'react';
import Image from '@tiptap/extension-image';
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import {
  composeImageAlt,
  splitImageAlt,
  type ImageFloat,
  MAX_IMAGE_WIDTH_PCT,
  MIN_IMAGE_WIDTH_PCT,
} from './imageAlt';

export function clampImageWidthPct(pct: number): number {
  return Math.min(MAX_IMAGE_WIDTH_PCT, Math.max(MIN_IMAGE_WIDTH_PCT, Math.round(pct)));
}

const HANDLES: Array<{ corner: string; dir: 1 | -1 }> = [
  { corner: 'nw', dir: -1 },
  { corner: 'ne', dir: 1 },
  { corner: 'sw', dir: -1 },
  { corner: 'se', dir: 1 },
];

function floatClass(float: ImageFloat | null | undefined): string {
  if (float === 'left') return ' doc-image-float-left';
  if (float === 'right') return ' doc-image-float-right';
  return '';
}

function ResizableImageView({ node, updateAttributes, selected, editor, getPos }: NodeViewProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [dragPct, setDragPct] = useState<number | null>(null);

  const selectNode = useCallback(() => {
    if (!editor.isEditable) return;
    const pos = typeof getPos === 'function' ? getPos() : null;
    if (typeof pos === 'number') {
      editor.commands.setNodeSelection(pos);
    }
  }, [editor, getPos]);

  const savedPct = (node.attrs.widthPct as number | null) ?? null;
  const float = (node.attrs.float as ImageFloat | null) ?? 'none';
  const effectivePct = dragPct ?? savedPct;
  const isFloated = float === 'left' || float === 'right';

  const startResize = useCallback(
    (dir: 1 | -1) => (e: React.PointerEvent<HTMLSpanElement>) => {
      if (!editor.isEditable) return;
      e.preventDefault();
      e.stopPropagation();

      const wrap = wrapRef.current;
      const img = wrap?.querySelector('img');
      const parent = wrap?.parentElement;
      if (!wrap || !img || !parent) return;

      const parentStyle = window.getComputedStyle(parent);
      const totalWidth =
        parent.clientWidth -
        parseFloat(parentStyle.paddingLeft || '0') -
        parseFloat(parentStyle.paddingRight || '0');
      if (!totalWidth) return;

      const startX = e.clientX;
      const startWidth = img.getBoundingClientRect().width;
      let latestPct = clampImageWidthPct((startWidth / totalWidth) * 100);

      const onMove = (ev: PointerEvent) => {
        const delta = (ev.clientX - startX) * dir * 2;
        latestPct = clampImageWidthPct(((startWidth + delta) / totalWidth) * 100);
        setDragPct(latestPct);
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        setDragPct(null);
        updateAttributes({ widthPct: latestPct });
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [editor, updateAttributes]
  );

  return (
    <NodeViewWrapper
      ref={wrapRef}
      className={`doc-image-resizer${selected ? ' doc-image-resizer-selected' : ''}${floatClass(float)}`}
      style={
        effectivePct
          ? { width: `${effectivePct}%`, margin: isFloated ? undefined : '0.75rem auto' }
          : isFloated
            ? undefined
            : { margin: '0.75rem auto' }
      }
      data-width-pct={effectivePct ?? undefined}
      data-float={float !== 'none' ? float : undefined}
    >
      <img
        src={node.attrs.src}
        alt={node.attrs.alt || ''}
        title={node.attrs.title || undefined}
        className="doc-editor-image rounded border border-slate-200"
        draggable
        data-drag-handle
        onClick={selectNode}
      />
      {selected && editor.isEditable && (
        <>
          {HANDLES.map(({ corner, dir }) => (
            <span
              key={corner}
              className={`doc-image-resize-handle doc-image-resize-handle-${corner}`}
              onPointerDown={startResize(dir)}
            />
          ))}
          <span className="doc-image-resize-badge">{Math.round(effectivePct ?? 100)}%</span>
        </>
      )}
    </NodeViewWrapper>
  );
}

export const DocResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      alt: {
        default: null,
        parseHTML: (element: HTMLElement) => splitImageAlt(element.getAttribute('alt')).alt || null,
      },
      widthPct: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const data = element.getAttribute('data-width-pct');
          if (data) {
            const parsed = parseInt(data, 10);
            if (Number.isFinite(parsed) && parsed > 0) return clampImageWidthPct(parsed);
          }
          return splitImageAlt(element.getAttribute('alt')).width;
        },
        renderHTML: (attributes: { widthPct?: number | null }) =>
          attributes.widthPct
            ? {
                'data-width-pct': String(attributes.widthPct),
                style: `width: ${attributes.widthPct}%`,
              }
            : {},
      },
      float: {
        default: 'none',
        parseHTML: (element: HTMLElement) => {
          const data = element.getAttribute('data-float');
          if (data === 'left' || data === 'right') return data;
          const fromAlt = splitImageAlt(element.getAttribute('alt')).float;
          return fromAlt === 'none' ? 'none' : fromAlt;
        },
        renderHTML: (attributes: { float?: ImageFloat | null }) => {
          if (attributes.float === 'left' || attributes.float === 'right') {
            return { 'data-float': attributes.float, class: `doc-image-float-${attributes.float}` };
          }
          return {};
        },
      },
    };
  },

  addStorage() {
    return {
      markdown: {
        serialize(
          state: {
            write: (text: string) => void;
            closeBlock?: (node: unknown) => void;
            esc?: (text: string) => string;
          },
          node: {
            attrs: {
              src?: string;
              alt?: string | null;
              title?: string | null;
              widthPct?: number | null;
              float?: ImageFloat | null;
            };
          }
        ) {
          const caption = splitImageAlt(node.attrs.alt || '').alt;
          const escaped =
            typeof state.esc === 'function'
              ? state.esc(caption)
              : caption.replace(/[[\]]/g, '\\$&');
          const alt = composeImageAlt(
            escaped,
            node.attrs.widthPct ?? null,
            node.attrs.float ?? 'none'
          );
          const src = (node.attrs.src || '').replace(/[()]/g, '\\$&');
          const title = node.attrs.title
            ? ` "${String(node.attrs.title).replace(/"/g, '\\"')}"`
            : '';
          state.write(`![${alt}](${src}${title})`);
          state.closeBlock?.(node);
        },
        parse: {},
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },
});

export default DocResizableImage;
