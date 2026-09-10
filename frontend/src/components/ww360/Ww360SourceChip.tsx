import {
  WW360_SOURCE_LABEL,
  WW360_SOURCE_TONE,
  type Ww360SourceId,
} from './ww360SourceTokens';

export function Ww360SourceChip({ id }: { id: Ww360SourceId }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${WW360_SOURCE_TONE[id]}`}
    >
      {WW360_SOURCE_LABEL[id]}
    </span>
  );
}
