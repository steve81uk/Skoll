type WeatherLayerOpacity = {
  cloud: number;
  precip: number;
  snow: number;
  wind: number;
  stream: number;
};

type WeatherLayerVisibility = {
  cloud: boolean;
  precip: boolean;
  snow: boolean;
  wind: boolean;
  stream: boolean;
};

interface WeatherLayerControlsProps {
  visible?: boolean;
  opacity: WeatherLayerOpacity;
  visibility: WeatherLayerVisibility;
  onOpacityChange: (next: WeatherLayerOpacity) => void;
  onVisibilityChange: (next: WeatherLayerVisibility) => void;
  className?: string;
}

export default function WeatherLayerControls({
  visible = true,
  opacity,
  visibility,
  onOpacityChange,
  onVisibilityChange,
  className,
}: WeatherLayerControlsProps) {
  if (!visible) return null;

  const setOpacity = (key: keyof WeatherLayerOpacity, value: number) => {
    onOpacityChange({ ...opacity, [key]: value });
  };

  const setVisible = (key: keyof WeatherLayerVisibility, value: boolean) => {
    onVisibilityChange({ ...visibility, [key]: value });
  };

  const rows: Array<{ key: keyof WeatherLayerOpacity; label: string }> = [
    { key: 'cloud', label: 'Clouds' },
    { key: 'precip', label: 'Radar/Precip' },
    { key: 'snow', label: 'Snow' },
    { key: 'wind', label: 'Wind Layer' },
    { key: 'stream', label: 'Wind Streams' },
  ];

  return (
    <div className={className ?? 'pointer-events-auto absolute bottom-24 left-4 z-[75] min-w-[260px] rounded border border-cyan-500/30 bg-black/65 px-3 py-2 text-cyan-100 backdrop-blur-sm'}>
      <div className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/80">Earth Weather Layers</div>
      <div className="mt-2 space-y-2">
        {rows.map((row) => (
          <div key={row.key} className="grid grid-cols-[auto,1fr,44px] items-center gap-2 text-[9px] uppercase tracking-[0.08em]">
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={visibility[row.key]}
                onChange={(event) => setVisible(row.key, event.currentTarget.checked)}
              />
              <span>{row.label}</span>
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={opacity[row.key]}
              onChange={(event) => setOpacity(row.key, Number(event.currentTarget.value))}
            />
            <span className="text-right">{Math.round(opacity[row.key] * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
