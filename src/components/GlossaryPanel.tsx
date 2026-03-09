import glossary from '../data/glossary.json';
import MethodologyPopover from './MethodologyPopover';

export default function GlossaryPanel() {
  const entries = Object.values(glossary as Record<string, {
    name: string;
    quick: string;
    full: string;
    formula: string;
    history: string;
    context: string;
    citation: string;
  }>);

  return (
    <div className="space-y-2 text-cyan-100">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.14em]">Educational Glossary</div>
        <MethodologyPopover title="Tooltip Tiers" methodology="Tier 1 quick definitions are concise. Tier 2 expands with formula, history, context, and citation for transparent scientific literacy." />
      </div>
      <div className="max-h-[240px] space-y-1 overflow-y-auto pr-1 wolf-scroll">
        {entries.map((e) => (
          <details key={e.name} className="rounded border border-cyan-500/30 bg-black/30 px-2 py-1">
            <summary className="cursor-pointer text-[9px] uppercase tracking-[0.1em]">{e.name}: {e.quick}</summary>
            <div className="mt-1 space-y-1 text-[9px] text-cyan-100/90">
              <div><b>What:</b> {e.full}</div>
              <div><b>How:</b> {e.formula}</div>
              <div><b>History:</b> {e.history}</div>
              <div><b>Context:</b> {e.context}</div>
              <div><b>Citation:</b> {e.citation}</div>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
