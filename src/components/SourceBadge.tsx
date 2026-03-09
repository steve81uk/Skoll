type SourceBadgeProps = {
  label: string;
  url?: string;
};

export default function SourceBadge({ label, url }: SourceBadgeProps) {
  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center rounded border border-cyan-500/35 bg-cyan-500/8 px-1.5 py-0.5 text-[8px] uppercase tracking-[0.08em] text-cyan-200"
      >
        Source: {label}
      </a>
    );
  }

  return (
    <span className="inline-flex items-center rounded border border-cyan-500/35 bg-cyan-500/8 px-1.5 py-0.5 text-[8px] uppercase tracking-[0.08em] text-cyan-200">
      Source: {label}
    </span>
  );
}
