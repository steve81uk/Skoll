/**
 * PanelDescription.tsx — Accessible "What is this?" disclosure for every data panel
 *
 * Wraps any panel header row and adds a small help button (keyboard accessible)
 * that expands an in-panel description.  The description includes:
 *
 *   • What this panel shows (plain English, no jargon)
 *   • What the numbers / axes mean
 *   • Why it matters for space-weather operations
 *   • Optionally: live context string updated from real data
 *
 * Usage:
 *   <PanelDescription id="lstm-graph" title="LSTM Kp Forecast">
 *     <PanelDescription.Section heading="What this shows">
 *       The AI model's 24-hour prediction of the Kp index…
 *     </PanelDescription.Section>
 *   </PanelDescription>
 *
 * Or shorthand with the `summary`, `axes`, and `whyItMatters` props:
 *   <PanelDescription
 *     id="goes-flux"
 *     title="GOES X-ray Flux"
 *     summary="Real-time X-ray energy emitted by the Sun…"
 *     axes="Y-axis: flux (W/m²) log scale; X-axis: past 4 hours"
 *     whyItMatters="Flares above M-class can black out HF radio…"
 *   />
 */

import { useState, useId, type ReactNode } from 'react';

interface PanelDescriptionSection {
  heading: string;
  children: ReactNode;
}

function Section({ heading, children }: PanelDescriptionSection) {
  return (
    <div className="mb-2 last:mb-0">
      <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-cyan-400/80">{heading}</p>
      <p className="text-[10px] leading-relaxed text-slate-300">{children}</p>
    </div>
  );
}

interface PanelDescriptionProps {
  /** Unique ID used for aria-describedby wiring — must be stable across renders */
  id: string;
  /** Panel title shown in the button label, e.g. "LSTM Kp Forecast" */
  title: string;
  /** Optional shorthand: one-sentence "what this shows" */
  summary?: string;
  /** Optional shorthand: plain description of axes and units */
  axes?: string;
  /** Optional shorthand: why this data matters */
  whyItMatters?: string;
  /** Optional: a live context string from real data (e.g. "Current Kp: 6.2 — Strong Storm") */
  live?: string | null;
  /** Optional: custom sections instead of / in addition to simple props */
  children?: ReactNode;
  /** Visual size of the trigger — default 'sm' */
  size?: 'xs' | 'sm';
}

/**
 * PanelDescription — renders a "?" trigger button + expandable description region.
 *
 * Returns the trigger element only.  Content expands in-place below the trigger.
 * For larger panels you may want to place the trigger in the panel header row.
 */
export function PanelDescription({
  id,
  title,
  summary,
  axes,
  whyItMatters,
  live,
  children,
  size = 'sm',
}: PanelDescriptionProps) {
  const [open, setOpen] = useState(false);
  const descId = useId();
  const regionId = `${id}-help-region`;

  const hasContent = summary || axes || whyItMatters || children;
  if (!hasContent) return null;

  const sizeClass = size === 'xs'
    ? 'h-3.5 w-3.5 text-[7px]'
    : 'h-4 w-4 text-[8px]';

  return (
    <span className="inline-flex flex-col items-start gap-0">
      {/* Trigger — small "?" button */}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={regionId}
        aria-label={`${open ? 'Hide' : 'Show'} description for ${title}`}
        onClick={() => setOpen((p) => !p)}
        className={`inline-flex items-center justify-center rounded-full border border-cyan-500/30 bg-cyan-500/10 font-bold text-cyan-400 transition-colors hover:border-cyan-400/60 hover:bg-cyan-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${sizeClass}`}
        title={`About ${title}`}
      >
        ?
      </button>

      {/* Expandable description region */}
      {open && (
        <div
          id={regionId}
          role="region"
          aria-labelledby={descId}
          className="mt-1.5 w-64 max-w-[min(90vw,18rem)] rounded-lg border border-cyan-500/20 bg-black/80 p-3 shadow-xl backdrop-blur-sm"
          style={{ zIndex: 200 }}
        >
          {/* Region heading (visually hidden but accessible) */}
          <p
            id={descId}
            className="mb-2 border-b border-cyan-500/20 pb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-200"
          >
            About: {title}
          </p>

          {/* Live data context badge */}
          {live && (
            <div
              role="status"
              aria-live="polite"
              className="mb-2 flex items-center gap-1 rounded border border-cyan-400/25 bg-cyan-400/8 px-2 py-1 text-[9px] text-cyan-300"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" aria-hidden />
              <span>{live}</span>
            </div>
          )}

          {/* Shorthand props rendered as sections */}
          {summary && <Section heading="What this shows">{summary}</Section>}
          {axes && <Section heading="Reading the values">{axes}</Section>}
          {whyItMatters && <Section heading="Why it matters">{whyItMatters}</Section>}

          {/* Custom children (additional Section elements) */}
          {children}

          {/* Close button */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-2 w-full rounded border border-slate-700/50 bg-white/5 py-1 text-[9px] text-slate-400 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400"
            aria-label={`Close description for ${title}`}
          >
            Close
          </button>
        </div>
      )}
    </span>
  );
}

// Attach Section as a static property for ergonomic JSX usage
PanelDescription.Section = Section;
