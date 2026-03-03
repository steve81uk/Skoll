import { useState, useEffect, useRef } from 'react';
import { Calendar, Clock, Play, Pause, RotateCcw, Zap } from 'lucide-react';
import eventsData from '../ml/space_weather_events.json';

// ─── CSS glitch keyframes (injected once) ───────────────────────────────────
const GLITCH_STYLE = `
  @keyframes skoll-glitch-x {
    0%,100%{ transform: translate(0,0)        clip-path:inset(0 0 90% 0) }
    10%     { transform: translate(-4px,1px)   clip-path:inset(15% 0 70% 0) }
    20%     { transform: translate( 4px,-1px)  clip-path:inset(50% 0 20% 0) }
    30%     { transform: translate(-2px,2px)   clip-path:inset(80% 0 5%  0) }
    40%     { transform: translate( 3px,0)     clip-path:inset(30% 0 60% 0) }
    50%     { transform: translate(-3px,-2px)  clip-path:inset(65% 0 10% 0) }
    60%     { transform: translate( 2px, 1px)  clip-path:inset(5%  0 80% 0) }
    70%,80% { transform: translate(0,0)        clip-path:inset(0 0 100% 0) }
  }
  @keyframes skoll-glitch-r {
    0%,100%{ transform: translate(0,0)        clip-path:inset(0 0 85% 0); filter:hue-rotate(0deg) }
    15%    { transform: translate(3px,0)      clip-path:inset(40% 0 40% 0); filter:hue-rotate(90deg) }
    35%    { transform: translate(-3px,1px)   clip-path:inset(70% 0 15% 0); filter:hue-rotate(180deg) }
    55%    { transform: translate(2px,-1px)   clip-path:inset(10% 0 75% 0); filter:hue-rotate(270deg) }
    75%,85%{ transform: translate(0,0)        clip-path:inset(0 0 100% 0); filter:hue-rotate(0deg) }
  }
  .skoll-glitch-wrap  { position:relative; }
  .skoll-glitch-wrap::before,
  .skoll-glitch-wrap::after {
    content: attr(data-text);
    position: absolute; inset: 0;
    overflow: hidden;
    pointer-events: none;
    opacity: 0.65;
  }
  .skoll-glitch-active     { animation: skoll-glitch-x 0.9s steps(1) infinite; }
  .skoll-glitch-active-r   { animation: skoll-glitch-r 1.3s steps(1) infinite; }
  .skoll-glitch-border     { animation: skoll-glitch-border 0.6s steps(1) infinite; }
  @keyframes skoll-glitch-border {
    0%,100%{ border-color: rgba(239,68,68,0.55); box-shadow:none }
    25%    { border-color: rgba(168,85,247,0.7);  box-shadow:0 0 12px rgba(168,85,247,0.4)   }
    50%    { border-color: rgba(34,211,238,0.5);  box-shadow:0 0 8px rgba(34,211,238,0.3)    }
    75%    { border-color: rgba(239,68,68,0.8);   box-shadow:0 0 18px rgba(239,68,68,0.5)    }
  }
  .skoll-reversal-banner {
    animation: skoll-glitch-border 0.6s steps(1) infinite;
  }
`;

function useGlitchStyle() {
  const injected = useRef(false);
  useEffect(() => {
    if (injected.current) return;
    injected.current = true;
    const el = document.createElement('style');
    el.textContent = GLITCH_STYLE;
    document.head.appendChild(el);
  }, []);
}

interface SpaceWeatherEvent {
  id: string;
  name: string;
  category: string;
  severity: string;
  impactDate: string;
  observationStart: string;
  description: string;
  kpIndex: number;
  solarWindSpeed: number;
  notes: string;
}

interface TimelineControlProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  isLive: boolean;
  onToggleLive: () => void;
  /** True when selectedEpochYear is in a geomagnetic reversal epoch */
  isReversal?: boolean;
}

export const TimelineControl = ({ currentDate, onDateChange, isLive, onToggleLive, isReversal = false }: TimelineControlProps) => {
  const [selectedEvent, setSelectedEvent] = useState<SpaceWeatherEvent | null>(null);
  const [showEventList, setShowEventList] = useState(false);
  const [timeSpeed, setTimeSpeed] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  useGlitchStyle();

  const events = eventsData.events as SpaceWeatherEvent[];

  // Time progression when playing
  useEffect(() => {
    if (!isPlaying || isLive) return;

    const interval = setInterval(() => {
      onDateChange(new Date(currentDate.getTime() + timeSpeed * 24 * 60 * 60 * 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, isLive, currentDate, timeSpeed, onDateChange]);

  const jumpToEvent = (event: SpaceWeatherEvent) => {
    setSelectedEvent(event);
    const startDate = new Date(event.observationStart);
    onDateChange(startDate);
    setShowEventList(false);
    if (isLive) onToggleLive(); // Switch from LIVE to historical
  };

  const jumpToImpact = () => {
    if (!selectedEvent) return;
    onDateChange(new Date(selectedEvent.impactDate));
  };

  const adjustDate = (days: number) => {
    onDateChange(new Date(currentDate.getTime() + days * 24 * 60 * 60 * 1000));
  };

  const adjustTime = (hours: number) => {
    onDateChange(new Date(currentDate.getTime() + hours * 60 * 60 * 1000));
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div
        className={[
          'glass-panel-intense transition-all duration-300',
          isCollapsed ? 'p-2' : 'min-w-[640px] p-3',
          'space-y-2',
          isReversal ? 'skoll-reversal-banner' : '',
        ].join(' ')}
      >
        {/* Magnetic reversal warning banner */}
        {isReversal && (
          <div
            className="flex items-center gap-2 px-2 py-1 rounded bg-red-500/10 border border-red-500/40 text-[9px] font-mono uppercase tracking-[0.16em] text-red-300 skoll-glitch-active"
            data-text="⚡ GEOMAGNETIC REVERSAL EPOCH — FIELD DESTABILISED"
          >
            <span className="animate-pulse">⚡</span>
            <span>Geomagnetic Reversal Epoch — Field Destabilised</span>
          </div>
        )}
        
        {/* Collapse/Expand Button */}
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="glass-button px-2 py-1 text-[9px] uppercase tracking-wider shrink-0"
            title={isCollapsed ? "Expand Timeline" : "Collapse Timeline"}
          >
            {isCollapsed ? '▲ Timeline' : '▼ Hide'}
          </button>
          
          {isCollapsed && (
            <div className="text-[9px] text-cyan-300 font-mono flex items-center gap-2">
              <span>{formatDate(currentDate)}</span>
              <span className="text-cyan-500">•</span>
              <span>{formatTime(currentDate)}</span>
              {selectedEvent && (
                <>
                  <span className="text-cyan-500">•</span>
                  <span className="text-amber-300">{selectedEvent.name}</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Full Timeline Controls - Hidden when collapsed */}
        {!isCollapsed && (
          <>
            {/* Event Selector */}
            <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEventList(!showEventList)}
            className="glass-button flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-wider"
          >
            <Zap size={12} />
            {selectedEvent ? selectedEvent.name : 'Select Historical Event'}
          </button>

          {selectedEvent && (
            <>
              <button
                onClick={jumpToImpact}
                className="glass-button px-2 py-1.5 text-[9px] uppercase tracking-wider text-amber-300 border-amber-400/30"
              >
                Jump to Impact
              </button>
              <div className="text-[8px] text-cyan-400/70 flex-1 truncate">
                {selectedEvent.description}
              </div>
            </>
          )}

          <button
            onClick={onToggleLive}
            className={`glass-button px-2 py-1.5 text-[9px] uppercase tracking-wider ${
              isLive ? 'text-green-300 border-green-400/40' : 'text-cyan-300'
            }`}
          >
            {isLive ? 'LIVE' : 'HISTORICAL'}
          </button>
        </div>

        {/* Event List Dropdown */}
        {showEventList && (
          <div className="absolute bottom-full mb-2 left-0 right-0 glass-panel max-h-[320px] overflow-y-auto">
            <div className="p-2 space-y-1">
              {events.map((event) => (
                <button
                  key={event.id}
                  onClick={() => jumpToEvent(event)}
                  className="w-full text-left px-3 py-2 rounded border border-cyan-500/20 hover:border-cyan-400/50 hover:bg-cyan-500/5 transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-bold text-cyan-200 uppercase tracking-wide">
                        {event.name}
                      </div>
                      <div className="text-[8px] text-cyan-400/70 mt-0.5">
                        {formatDate(new Date(event.impactDate))} • {event.category}
                      </div>
                    </div>
                    <div className="text-[9px] font-mono text-amber-300 shrink-0">
                      {event.severity}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Date & Time Controls */}
        <div className="grid grid-cols-[auto_1fr_auto] gap-2 items-center">
          {/* Date Display & Controls */}
          <div className="flex items-center gap-1.5">
            <Calendar size={14} className="text-cyan-400" />
            <div className="text-[11px] font-mono text-cyan-100 font-bold min-w-[90px]">
              {formatDate(currentDate)}
            </div>
          </div>

          {/* Date Navigation */}
          <div className="flex items-center gap-1 justify-center">
            <button
              onClick={() => adjustDate(-30)}
              className="glass-button px-2 py-1 text-[8px]"
              disabled={isLive}
            >
              -30d
            </button>
            <button
              onClick={() => adjustDate(-7)}
              className="glass-button px-2 py-1 text-[8px]"
              disabled={isLive}
            >
              -7d
            </button>
            <button
              onClick={() => adjustDate(-1)}
              className="glass-button px-2 py-1 text-[8px]"
              disabled={isLive}
            >
              -1d
            </button>
            
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="glass-button px-2 py-1"
              disabled={isLive}
            >
              {isPlaying ? <Pause size={12} /> : <Play size={12} />}
            </button>

            <button
              onClick={() => adjustDate(1)}
              className="glass-button px-2 py-1 text-[8px]"
              disabled={isLive}
            >
              +1d
            </button>
            <button
              onClick={() => adjustDate(7)}
              className="glass-button px-2 py-1 text-[8px]"
              disabled={isLive}
            >
              +7d
            </button>
            <button
              onClick={() => adjustDate(30)}
              className="glass-button px-2 py-1 text-[8px]"
              disabled={isLive}
            >
              +30d
            </button>
          </div>

          {/* Time Display */}
          <div className="flex items-center gap-1.5">
            <Clock size={14} className="text-cyan-400" />
            <div className="text-[11px] font-mono text-cyan-100 font-bold">
              {formatTime(currentDate)}
            </div>
          </div>
        </div>

        {/* Hour Controls & Playback Speed */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => adjustTime(-12)}
              className="glass-button px-2 py-1 text-[8px]"
              disabled={isLive}
            >
              -12h
            </button>
            <button
              onClick={() => adjustTime(-1)}
              className="glass-button px-2 py-1 text-[8px]"
              disabled={isLive}
            >
              -1h
            </button>
            <button
              onClick={() => adjustTime(1)}
              className="glass-button px-2 py-1 text-[8px]"
              disabled={isLive}
            >
              +1h
            </button>
            <button
              onClick={() => adjustTime(12)}
              className="glass-button px-2 py-1 text-[8px]"
              disabled={isLive}
            >
              +12h
            </button>
          </div>

          {isPlaying && (
            <div className="flex items-center gap-1">
              <span className="text-[8px] text-cyan-400/70 uppercase tracking-wider">Speed:</span>
              {[0.1, 0.5, 1, 2, 7, 30].map((speed) => (
                <button
                  key={speed}
                  onClick={() => setTimeSpeed(speed)}
                  className={`glass-button px-2 py-1 text-[8px] ${
                    timeSpeed === speed ? 'border-cyan-400 text-cyan-200' : 'text-cyan-400/50'
                  }`}
                >
                  {speed < 1 ? `${speed * 24}h` : `${speed}d`}/s
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => onDateChange(new Date())}
            className="glass-button px-2 py-1 text-[8px] flex items-center gap-1"
          >
            <RotateCcw size={10} />
            Now
          </button>
        </div>

        {/* Event Info Banner */}
        {selectedEvent && (
          <div className="border-t border-cyan-500/20 pt-2 mt-2">
            <div className="grid grid-cols-4 gap-3 text-center">
              <div>
                <div className="text-[7px] uppercase tracking-wider text-cyan-500/70">Severity</div>
                <div className="text-[10px] font-bold text-amber-300">{selectedEvent.severity}</div>
              </div>
              <div>
                <div className="text-[7px] uppercase tracking-wider text-cyan-500/70">KP Index</div>
                <div className="text-[10px] font-bold text-red-300">{selectedEvent.kpIndex}</div>
              </div>
              <div>
                <div className="text-[7px] uppercase tracking-wider text-cyan-500/70">Wind Speed</div>
                <div className="text-[10px] font-bold text-violet-300">{selectedEvent.solarWindSpeed} km/s</div>
              </div>
              <div>
                <div className="text-[7px] uppercase tracking-wider text-cyan-500/70">Category</div>
                <div className="text-[10px] font-bold text-cyan-300">{selectedEvent.category}</div>
              </div>
            </div>
            <div className="text-[8px] text-cyan-400/60 mt-2 italic">
              {selectedEvent.notes}
            </div>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
};
