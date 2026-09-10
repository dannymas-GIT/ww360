import React from 'react';
import { Layers } from 'lucide-react';
import { useKitchenSink } from '@/context/KitchenSinkContext';

export const KitchenSinkToggle: React.FC = () => {
  const { kitchenSink, setKitchenSink } = useKitchenSink();

  return (
    <label
      className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-base text-slate-200"
      data-tour="kitchen-sink-toggle"
    >
      <input
        type="checkbox"
        checked={kitchenSink}
        onChange={e => setKitchenSink(e.target.checked)}
        className="h-4 w-4 shrink-0 accent-sky-400"
      />
      <Layers className="h-4 w-4 shrink-0 text-sky-300" aria-hidden />
      <span>Kitchen Sink</span>
    </label>
  );
};
