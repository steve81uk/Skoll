import { useCallback, useEffect, useRef, useState } from 'react';

export type DockSide = 'left' | 'right';
export type CommandMenuAnchor = { insetBlockStart: number; insetInlineStart: number };

interface UseDockSystemOptions {
  controlBarHeight: number;
  leftDockTiles: Array<{ id: string }>;
  rightDockTiles: Array<{ id: string }>;
  menuGroups: Record<string, string[]>;
  allToolIds: string[];
}

export interface UseDockSystemReturn {
  // ── read ──────────────────────────────────────────────────────────────────
  dockModalTileId: string | null;
  dockModalSide: DockSide;
  openMenuId: string | null;
  commandMenuAnchor: CommandMenuAnchor | null;
  activeSubTileId: string;
  selectedTileId: string;
  dockPanelRef: React.RefObject<HTMLDivElement | null>;
  // ── write ─────────────────────────────────────────────────────────────────
  openDockPanel: (tileId: string, side: DockSide) => void;
  closeDockPanel: () => void;
  /** Opens the palette to the 'all-tools' group (used by dock ⊕ More buttons). */
  openCommandPalette: (rawAnchor: CommandMenuAnchor, initialTileId?: string) => void;
  /** Toggles a named group open/closed (used by top-bar shortcut buttons). */
  toggleCommandGroup: (groupId: string, rawAnchor: CommandMenuAnchor) => void;
  closeCommandPalette: () => void;
  setActiveSubTileId: React.Dispatch<React.SetStateAction<string>>;
  setSelectedTileId: React.Dispatch<React.SetStateAction<string>>;
}

// Clamps the floating command palette to stay within the visible viewport.
function clampCommandMenuAnchor(anchor: CommandMenuAnchor, barHeight: number): CommandMenuAnchor {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const gutter = 8;
  const panelWidth = Math.min(vw * 0.92, 720);
  const panelHeight = Math.round(vh * 0.7);
  const topGutter = barHeight + 8;
  const maxTop = Math.max(topGutter, vh - panelHeight - gutter);
  const maxLeft = Math.max(gutter, vw - panelWidth - gutter);
  return {
    insetBlockStart: Math.min(maxTop, Math.max(topGutter, anchor.insetBlockStart)),
    insetInlineStart: Math.min(maxLeft, Math.max(gutter, anchor.insetInlineStart)),
  };
}

export function useDockSystem({
  controlBarHeight,
  leftDockTiles,
  rightDockTiles,
  menuGroups,
  allToolIds,
}: UseDockSystemOptions): UseDockSystemReturn {
  const [dockModalTileId, setDockModalTileId] = useState<string | null>(null);
  const [dockModalSide, setDockModalSide] = useState<DockSide>('left');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [commandMenuAnchor, setCommandMenuAnchor] = useState<CommandMenuAnchor | null>(null);
  const [activeSubTileId, setActiveSubTileId] = useState<string>('mission-core');
  const [selectedTileId, setSelectedTileId] = useState<string>('mission-core');
  const dockPanelRef = useRef<HTMLDivElement | null>(null);

  // ── actions ───────────────────────────────────────────────────────────────

  const closeDockPanel = useCallback(() => {
    setDockModalTileId(null);
  }, []);

  const openDockPanel = useCallback((tileId: string, side: DockSide) => {
    setSelectedTileId(tileId);
    setDockModalSide(side);
    setDockModalTileId((prev) => (prev === tileId ? null : tileId));
  }, []);

  const closeCommandPalette = useCallback(() => {
    setOpenMenuId(null);
    setCommandMenuAnchor(null);
  }, []);

  const openCommandPalette = useCallback(
    (rawAnchor: CommandMenuAnchor, initialTileId?: string) => {
      setOpenMenuId('all-tools');
      setCommandMenuAnchor(clampCommandMenuAnchor(rawAnchor, controlBarHeight));
      setActiveSubTileId(initialTileId ?? allToolIds[0] ?? 'mission-core');
    },
    [allToolIds, controlBarHeight],
  );

  const toggleCommandGroup = useCallback(
    (groupId: string, rawAnchor: CommandMenuAnchor) => {
      setOpenMenuId((prev) => {
        const next = prev === groupId ? null : groupId;
        if (next === null) {
          setCommandMenuAnchor(null);
        } else {
          setCommandMenuAnchor(clampCommandMenuAnchor(rawAnchor, controlBarHeight));
          setActiveSubTileId((currentTile) => {
            const groupIds = menuGroups[groupId] ?? [];
            return groupIds.length > 0 ? groupIds[0] : currentTile;
          });
        }
        return next;
      });
    },
    [controlBarHeight, menuGroups],
  );

  // ── effects ───────────────────────────────────────────────────────────────

  // Close the dock panel when the user clicks anywhere outside of it.
  useEffect(() => {
    if (!dockModalTileId) return;

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (dockPanelRef.current?.contains(target)) return;
      if ((event.target as HTMLElement | null)?.closest('.skoll-dock-button')) return;
      setDockModalTileId(null);
    };

    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [dockModalTileId]);

  // Keep the floating command palette inside the viewport when the window resizes.
  useEffect(() => {
    if (!openMenuId || !commandMenuAnchor) return;

    const clampOnResize = () => {
      setCommandMenuAnchor((prev) => {
        if (!prev) return prev;
        const next = clampCommandMenuAnchor(prev, controlBarHeight);
        const changed =
          Math.abs(next.insetBlockStart - prev.insetBlockStart) > 2 ||
          Math.abs(next.insetInlineStart - prev.insetInlineStart) > 2;
        return changed ? next : prev;
      });
    };

    window.addEventListener('resize', clampOnResize);
    return () => window.removeEventListener('resize', clampOnResize);
  }, [commandMenuAnchor, controlBarHeight, openMenuId]);

  // Number keys 1–6 open left dock tiles; Shift+1–6 open right dock tiles.
  // Escape closes whatever is open.
  useEffect(() => {
    const keyHandler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (event.key === 'Escape') {
        setDockModalTileId(null);
        setOpenMenuId(null);
        setCommandMenuAnchor(null);
        return;
      }

      const number = Number(event.key);
      if (Number.isNaN(number) || number < 1 || number > 6) return;

      if (event.shiftKey) {
        const tile = rightDockTiles[number - 1];
        if (!tile) return;
        setSelectedTileId(tile.id);
        setDockModalSide('right');
        setDockModalTileId((prev) => (prev === tile.id ? null : tile.id));
        return;
      }

      const tile = leftDockTiles[number - 1];
      if (!tile) return;
      setSelectedTileId(tile.id);
      setDockModalSide('left');
      setDockModalTileId((prev) => (prev === tile.id ? null : tile.id));
    };

    window.addEventListener('keydown', keyHandler);
    return () => window.removeEventListener('keydown', keyHandler);
  }, [leftDockTiles, rightDockTiles]);

  // When the command palette switches to a new group, reset to the first item
  // in that group if the current selection is no longer in scope.
  useEffect(() => {
    if (!openMenuId) return;
    const groupIds = menuGroups[openMenuId] ?? [];
    if (groupIds.length > 0 && !groupIds.includes(activeSubTileId)) {
      setActiveSubTileId(groupIds[0]);
    }
  }, [activeSubTileId, menuGroups, openMenuId]);

  return {
    dockModalTileId,
    dockModalSide,
    openMenuId,
    commandMenuAnchor,
    activeSubTileId,
    selectedTileId,
    dockPanelRef,
    openDockPanel,
    closeDockPanel,
    openCommandPalette,
    toggleCommandGroup,
    closeCommandPalette,
    setActiveSubTileId,
    setSelectedTileId,
  };
}
