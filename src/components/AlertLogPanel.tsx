import MethodologyPopover from './MethodologyPopover';
import SourceBadge from './SourceBadge';
import type { TriggeredAlert } from '../services/alertEngine';

interface Props {
  alerts: TriggeredAlert[];
}

export default function AlertLogPanel({ alerts }: Props) {
  return (
    <div className="space-y-2 text-cyan-100">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.14em]">Alert Log</div>
        <MethodologyPopover title="Alert Rules" methodology="Threshold and cooldown rules evaluate live telemetry streams each update cycle. Severity reflects operational urgency, not guaranteed impact." />
      </div>
      <SourceBadge label="Rule Engine / NOAA feeds" />
      <div className="max-h-[220px] space-y-1 overflow-y-auto pr-1 wolf-scroll">
        {alerts.length === 0 && <div className="text-[9px] uppercase tracking-[0.08em] text-cyan-200/70">No active alerts</div>}
        {alerts.map((alert) => (
          <div
            key={`${alert.id}-${alert.ts}`}
            className={`rounded border-l-4 px-2 py-1 text-[9px] uppercase tracking-[0.08em] ${alert.severity === 'critical' ? 'border-red-500 bg-red-500/10' : alert.severity === 'warning' ? 'border-amber-400 bg-amber-500/10' : 'border-cyan-400 bg-cyan-500/10'}`}
          >
            <div>{alert.message}</div>
            <div className="text-[8px] opacity-75">{new Date(alert.ts).toISOString().replace('T', ' ').slice(0, 19)} UTC</div>
          </div>
        ))}
      </div>
    </div>
  );
}
