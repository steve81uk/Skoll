/**
 * TerminalLogHUD — xterm.js WebSocket PM2 log viewer
 * Connects to ws://localhost:8080 and streams prediction + status messages.
 * FitAddon is used to prevent CSS text-spill.
 */
import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

interface TerminalLogHUDProps {
  visible: boolean;
  wsUrl?: string;
}

const XTERM_THEME = {
  background:   '#08090f',
  foreground:   '#b0c8d4',
  cursor:       '#38bdf8',
  cursorAccent: '#0a0e1a',
  black:        '#0a0e1a',
  brightBlack:  '#1e2233',
  red:          '#ff4f52',
  brightRed:    '#ff6b70',
  green:        '#00e87a',
  brightGreen:  '#38ffaa',
  yellow:       '#ffd166',
  brightYellow: '#ffe89a',
  blue:         '#38bdf8',
  brightBlue:   '#7dd3fc',
  magenta:      '#c084fc',
  brightMagenta:'#d8b4fe',
  cyan:         '#22d3ee',
  brightCyan:   '#67e8f9',
  white:        '#b0c8d4',
  brightWhite:  '#e2eff5',
  selectionBackground: 'rgba(56,189,248,0.25)',
};

function fmtTime(): string {
  return new Date().toISOString().slice(11, 23);
}

function colourLine(term: Terminal, raw: string) {
  // Try JSON first
  try {
    const obj = JSON.parse(raw);
    const type: string = obj.type ?? '';

    if (type === 'prediction') {
      const kp  = typeof obj.kp  === 'number' ? obj.kp.toFixed(2)  : '?';
      const dst = typeof obj.dst === 'number' ? obj.dst.toFixed(1) : '?';
      const conf = typeof obj.confidence === 'number'
        ? `${(obj.confidence * 100).toFixed(0)}%`
        : '?';
      term.writeln(
        `\x1b[2;37m[${fmtTime()}]\x1b[0m ` +
        `\x1b[1;36mPREDICT\x1b[0m ` +
        `Kp=\x1b[33m${kp}\x1b[0m  ` +
        `Dst=\x1b[35m${dst} nT\x1b[0m  ` +
        `conf=\x1b[32m${conf}\x1b[0m`,
      );
      return;
    }

    if (type === 'status') {
      const colour = obj.ok ? '32' : '31';
      term.writeln(
        `\x1b[2;37m[${fmtTime()}]\x1b[0m ` +
        `\x1b[1;${colour}mSTATUS\x1b[0m  ${obj.message ?? JSON.stringify(obj)}`,
      );
      return;
    }

    if (type === 'pong') {
      term.writeln(
        `\x1b[2;37m[${fmtTime()}]\x1b[0m \x1b[2;36mPONG\x1b[0m`,
      );
      return;
    }

    if (type === 'error') {
      term.writeln(
        `\x1b[2;37m[${fmtTime()}]\x1b[0m \x1b[1;31mERROR\x1b[0m  ${obj.message ?? raw}`,
      );
      return;
    }

    // Generic JSON — dim-print it
    term.writeln(
      `\x1b[2;37m[${fmtTime()}]\x1b[0m \x1b[2m${JSON.stringify(obj)}\x1b[0m`,
    );
  } catch {
    // Plain text fallback — detect severity keywords
    const low = raw.toLowerCase();
    if (low.includes('error') || low.includes('fatal') || low.includes('crash')) {
      term.writeln(`\x1b[2;37m[${fmtTime()}]\x1b[0m \x1b[31m${raw}\x1b[0m`);
    } else if (low.includes('warn')) {
      term.writeln(`\x1b[2;37m[${fmtTime()}]\x1b[0m \x1b[33m${raw}\x1b[0m`);
    } else {
      term.writeln(`\x1b[2;37m[${fmtTime()}]\x1b[0m ${raw}`);
    }
  }
}

export function TerminalLogHUD({ visible, wsUrl = 'ws://localhost:8080' }: TerminalLogHUDProps) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const termRef       = useRef<Terminal | null>(null);
  const fitRef        = useRef<FitAddon | null>(null);
  const wsRef         = useRef<WebSocket | null>(null);
  const mountedRef    = useRef(false);

  // ── Mount xterm once ───────────────────────────────────────────────────────
  useEffect(() => {
    if (mountedRef.current || !containerRef.current) return;
    mountedRef.current = true;

    const term = new Terminal({
      theme:           XTERM_THEME,
      fontFamily:      '"JetBrains Mono", "Cascadia Code", "Fira Code", monospace',
      fontSize:        11,
      lineHeight:      1.4,
      letterSpacing:   0.5,
      cursorStyle:     'block',
      cursorBlink:     true,
      scrollback:      2000,
      disableStdin:    true,
      allowTransparency: true,
    });

    const fit  = new FitAddon();
    const links = new WebLinksAddon();
    term.loadAddon(fit);
    term.loadAddon(links);

    term.open(containerRef.current);
    fit.fit();
    termRef.current = term;
    fitRef.current  = fit;

    // Welcome banner
    term.writeln('\x1b[1;36m╔══════════════════════════════════════════╗\x1b[0m');
    term.writeln('\x1b[1;36m║  SKÖLL-TRACK  ·  ML Server Log Stream   ║\x1b[0m');
    term.writeln('\x1b[1;36m╚══════════════════════════════════════════╝\x1b[0m');
    term.writeln(`\x1b[2mConnecting → ${wsUrl}\x1b[0m`);
    term.writeln('');

    // Resize observer — prevents CSS text-spill
    const ro = new ResizeObserver(() => {
      try { fit.fit(); } catch { /* ignore */ }
    });
    ro.observe(containerRef.current!);

    return () => {
      ro.disconnect();
      term.dispose();
      termRef.current  = null;
      fitRef.current   = null;
      mountedRef.current = false;
    };
  }, [wsUrl]);

  // ── WebSocket lifecycle (gated by visible) ─────────────────────────────────
  useEffect(() => {
    if (!visible || !termRef.current) return;
    const term = termRef.current;

    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let alive = true;

    function connect() {
      if (!alive) return;
      term.writeln(`\x1b[2;33m[${fmtTime()}] Connecting…\x1b[0m`);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        term.writeln(`\x1b[1;32m[${fmtTime()}] ● Connected to SKÖLL-ML\x1b[0m`);
        // Subscribe to broadcast stream
        ws.send(JSON.stringify({ type: 'subscribe' }));
      };

      ws.onmessage = (evt) => {
        colourLine(term, typeof evt.data === 'string' ? evt.data : String(evt.data));
      };

      ws.onerror = () => {
        term.writeln(`\x1b[31m[${fmtTime()}] WebSocket error\x1b[0m`);
      };

      ws.onclose = (ev) => {
        term.writeln(
          `\x1b[2;31m[${fmtTime()}] ✕ Disconnected (code ${ev.code}) — retry in 5 s\x1b[0m`,
        );
        if (alive) reconnectTimer = setTimeout(connect, 5000);
      };
    }

    connect();

    return () => {
      alive = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'unsubscribe' }));
        wsRef.current.close();
      }
      wsRef.current = null;
    };
  }, [visible, wsUrl]);

  return (
    <div
      style={{
        display:         visible ? 'flex' : 'none',
        flexDirection:   'column',
        width:           '100%',
        height:          '100%',
        minHeight:       '220px',
        background:      '#08090f',
        borderRadius:    '8px',
        border:          '1px solid rgba(56,189,248,0.18)',
        overflow:        'hidden',
        boxSizing:       'border-box',
      }}
    >
      {/* Title bar */}
      <div
        style={{
          display:         'flex',
          alignItems:      'center',
          gap:             '8px',
          padding:         '5px 10px',
          background:      'rgba(56,189,248,0.06)',
          borderBottom:    '1px solid rgba(56,189,248,0.12)',
          flexShrink:      0,
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#00e87a', display: 'inline-block' }} />
        <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#38bdf8', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
          ML Server · Live Log Stream
        </span>
        <span style={{ marginLeft: 'auto', fontFamily: 'monospace', fontSize: '9px', color: 'rgba(176,200,212,0.4)' }}>
          ws://localhost:8080
        </span>
      </div>

      {/* xterm container — flex-grow prevents text-spill */}
      <div
        ref={containerRef}
        style={{
          flex:            '1 1 auto',
          overflow:        'hidden',
          padding:         '4px 4px 0 4px',
          boxSizing:       'border-box',
        }}
      />
    </div>
  );
}

export default TerminalLogHUD;
