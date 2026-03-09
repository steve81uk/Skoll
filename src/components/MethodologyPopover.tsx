import { useState } from 'react';

type MethodologyPopoverProps = {
  title: string;
  methodology: string;
};

export default function MethodologyPopover({ title, methodology }: MethodologyPopoverProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="h-5 w-5 rounded-full border border-cyan-500/40 bg-black/50 text-[10px] text-cyan-200"
        title="Methodology"
      >
        i
      </button>
      {open && (
        <div className="absolute right-0 top-6 z-[120] w-[min(360px,70vw)] rounded border border-cyan-500/30 bg-black/90 p-2 text-[9px] uppercase tracking-[0.08em] text-cyan-100">
          <div className="mb-1 text-[8px] tracking-[0.12em] text-cyan-400/80">{title} Methodology</div>
          <div className="normal-case tracking-normal text-[11px] leading-relaxed text-cyan-100/90">{methodology}</div>
        </div>
      )}
    </div>
  );
}
