/**
 * SKÖLL-TRACK — WEB SPEECH API AUTO-MODES
 * Voice command engine using SpeechRecognition.
 * Supported commands:
 *  "go live"                 → switch to live mode
 *  "historical [mode]"       → switch to historical
 *  "zoom to [planet]"        → focus camera on planet
 *  "show diagnostics"        → open diagnostics tile
 *  "mission [core]"          → open mission tile
 *  "forecast radar"          → open radar tile
 *  "fireball tracker"        → open fireball tile
 *  "surface [mode]"          → switch to surface view
 *  "heliocentric [mode]"     → switch to heliocentric view
 *  "stop listening"          → self-disable
 */

import { useEffect, useRef, useCallback, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
type SpeechAction =
  | { type: 'SET_LIVE' }
  | { type: 'SET_HISTORICAL' }
  | { type: 'ZOOM_TO'; planet: string }
  | { type: 'OPEN_TILE'; tileId: string }
  | { type: 'SET_VIEW'; view: 'HELIOCENTRIC' | 'SURFACE' }
  | { type: 'SET_LOCATION'; locationName: string };

interface SpeechCommandHandlers {
  onAction: (action: SpeechAction) => void;
}

interface SpeechCommandControls {
  supported: boolean;
  listening: boolean;
  lastTranscript: string;
  lastCommand: string | null;
  toggle: () => void;
  start: () => void;
  stop: () => void;
}

// ─── Planet name aliases ──────────────────────────────────────────────────────
const PLANET_ALIASES: Record<string, string> = {
  mercury: 'Mercury', venus: 'Venus', earth: 'Earth', mars: 'Mars',
  jupiter: 'Jupiter', saturn: 'Saturn', uranus: 'Uranus', neptune: 'Neptune',
  pluto: 'Pluto', moon: 'Moon', io: 'Io', europa: 'Europa',
  titan: 'Titan', sun: 'Sun',
};

// ─── Command parser ───────────────────────────────────────────────────────────
function parseCommand(transcript: string): { action: SpeechAction | null; label: string } {
  const t = transcript.toLowerCase().trim();

  if (t.includes('go live') || t.includes('live mode') || t === 'live')
    return { action: { type: 'SET_LIVE' }, label: 'Go Live' };

  if (t.includes('historical'))
    return { action: { type: 'SET_HISTORICAL' }, label: 'Historical Mode' };

  if (t.includes('surface'))
    return { action: { type: 'SET_VIEW', view: 'SURFACE' }, label: 'Surface Mode' };

  if (t.includes('heliocentric') || t.includes('solar system') || t.includes('orbit view'))
    return { action: { type: 'SET_VIEW', view: 'HELIOCENTRIC' }, label: 'Heliocentric Mode' };

  if (t.includes('show diagnostics') || t.includes('diagnostics'))
    return { action: { type: 'OPEN_TILE', tileId: 'diagnostics' }, label: 'Diagnostics' };

  if (t.includes('forecast radar') || t.includes('radar'))
    return { action: { type: 'OPEN_TILE', tileId: 'forecast-radar' }, label: 'Forecast Radar' };

  if (t.includes('fireball'))
    return { action: { type: 'OPEN_TILE', tileId: 'fireball' }, label: 'Fireball Tracker' };

  if (t.includes('mission'))
    return { action: { type: 'OPEN_TILE', tileId: 'mission-core' }, label: 'Mission Core' };

  if (t.includes('hangar'))
    return { action: { type: 'OPEN_TILE', tileId: 'hangar' }, label: 'Hangar Uplink' };

  if (t.includes('oracle'))
    return { action: { type: 'OPEN_TILE', tileId: 'oracle' }, label: 'Oracle Archive' };

  if (t.includes('health') || t.includes('neural'))
    return { action: { type: 'OPEN_TILE', tileId: 'health' }, label: 'Neural Health' };

  if (t.includes('deep space') || t.includes('network link') || t.includes('dsn'))
    return { action: { type: 'OPEN_TILE', tileId: 'dsn-live' }, label: 'DSN Live Link' };

  if (t.includes('data alchemist') || t.includes('alchemist'))
    return { action: { type: 'OPEN_TILE', tileId: 'data-alchemist' }, label: 'Data Alchemist' };

  if (t.includes('kessler') || t.includes('debris field'))
    return { action: { type: 'OPEN_TILE', tileId: 'kessler-net' }, label: 'Kessler Net' };

  if (t.includes('magnetic grid') || t.includes('imf grid') || t.includes('intermagnet'))
    return { action: { type: 'OPEN_TILE', tileId: 'magnetic-grid' }, label: 'Magnetic Grid' };

  if (t.includes('lstm') || t.includes('prediction') || t.includes('neural forecast'))
    return { action: { type: 'OPEN_TILE', tileId: 'lstm-forecast' }, label: 'LSTM Forecast' };

  if (t.includes('noaa') || t.includes('space weather feed'))
    return { action: { type: 'OPEN_TILE', tileId: 'noaa-feed' }, label: 'NOAA Feed' };

  // Location setter: "set location cambridge", "location london", "go to new york"
  const locMatch = t.match(/(?:set location|location|go to|move to)\s+([a-z\s]+)/);
  if (locMatch) {
    const place = locMatch[1].trim();
    const KNOWN_PLACES = ['cambridge', 'london', 'new york', 'tokyo',
      'sydney', 'tromso', 'tromsø', 'reykjavik', 'anchorage', 'paris',
      'berlin', 'toronto', 'chicago', 'los angeles', 'hong kong', 'dubai'];
    const match = KNOWN_PLACES.find((p) => place.startsWith(p));
    if (match) return { action: { type: 'SET_LOCATION', locationName: match }, label: `Location → ${match}` };
  }

  // Zoom to planet: "zoom to mars", "focus mars", "track saturn"
  const zoomMatch = t.match(/(?:zoom to|focus|track|go to|show)\s+(\w+)/);
  if (zoomMatch) {
    const planet = PLANET_ALIASES[zoomMatch[1].toLowerCase()];
    if (planet) return { action: { type: 'ZOOM_TO', planet }, label: `Zoom → ${planet}` };
  }

  return { action: null, label: '' };
}

// ─── Type guard for the Web Speech API (not in all TS libs) ──────────────────
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useSpeechCommands({ onAction }: SpeechCommandHandlers): SpeechCommandControls {
  const recRef = useRef<SpeechRecognitionInstance | null>(null);
  const [listening, setListening]       = useState(false);
  const [lastTranscript, setTranscript] = useState('');
  const [lastCommand, setLastCommand]   = useState<string | null>(null);
  const onActionRef = useRef(onAction);
  useEffect(() => { onActionRef.current = onAction; }, [onAction]);

  const SpeechCtor: SpeechRecognitionCtor | undefined =
    (window as unknown as { SpeechRecognition?: SpeechRecognitionCtor }).SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor }).webkitSpeechRecognition;

  const supported = typeof SpeechCtor !== 'undefined';

  const stop = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    if (!SpeechCtor) return;
    try {
      const rec = new SpeechCtor();
      rec.continuous      = true;
      rec.interimResults  = false;
      rec.lang            = 'en-US';
      recRef.current      = rec;

      rec.onresult = (ev: SpeechRecognitionEvent) => {
        const transcript = Array.from(ev.results)
          .map((r) => r[0].transcript)
          .join(' ');
        setTranscript(transcript);

        const { action, label } = parseCommand(transcript);
        if (action) {
          setLastCommand(label);
          onActionRef.current(action);
          // Auto-clear last command display after 3 s
          setTimeout(() => setLastCommand(null), 3000);
        }

        // Self-stop on "stop listening"
        if (transcript.toLowerCase().includes('stop listening')) stop();
      };

      rec.onerror = (ev: SpeechRecognitionErrorEvent) => {
        if (ev.error !== 'no-speech') setListening(false);
      };

      rec.onend = () => {
        // Auto-restart loop while listening flag is set
        if (recRef.current) {
          try { recRef.current.start(); } catch { setListening(false); }
        }
      };

      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [SpeechCtor, stop]);

  const toggle = useCallback(() => {
    if (listening) {
      recRef.current = null; // prevent auto-restart in onend
      stop();
    } else {
      start();
    }
  }, [listening, start, stop]);

  useEffect(() => {
    return () => {
      const rec = recRef.current;
      recRef.current = null;
      (rec as { abort?: () => void } | null)?.abort?.();
    };
  }, []);

  return { supported, listening, lastTranscript, lastCommand, toggle, start, stop };
}

export type { SpeechAction };
