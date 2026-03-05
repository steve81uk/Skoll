# Sköll Interactive QA Checklist

Date: 2026-03-05
Scope: Dock keyboard controls, side panel behavior, pin behavior, tooltip behavior, and non-overlay positioning.

## Verification Method

- Static code-path verification in `src/App.tsx`
- Runtime serve smoke check on `http://127.0.0.1:5173`
- Build/lint gates: `npm run lint`, `npm run build`

## Strict Checklist (Expected vs Actual)

| ID | Area | Expected | Actual | Status |
|---|---|---|---|---|
| 1 | Keyboard 1-6 | Pressing `1..6` toggles corresponding left dock tile panel | `keyHandler` maps `1..6` to `leftDockTiles[number-1]`, toggles open/close | PASS |
| 2 | Keyboard Shift+1-6 | Pressing `Shift+1..6` toggles corresponding right dock tile panel | `keyHandler` maps shifted numbers to `rightDockTiles[number-1]`, toggles open/close | PASS |
| 3 | Keyboard Esc | `Esc` closes dock panel and unpins panel | `Esc` sets `dockModalTileId` null and `dockModalPinned` false | PASS |
| 4 | Key handler cleanup | No leaked key listeners on re-render/unmount | `addEventListener('keydown')` has paired `removeEventListener('keydown')` in cleanup | PASS |
| 5 | Side anchoring left | Left icon click opens panel near left rail, lower than icons (not centered overlay) | Left click sets `dockModalSide='left'`; panel class uses fixed `top-28` + left offset | PASS |
| 6 | Side anchoring right | Right icon click opens panel near right rail, lower than icons (not centered overlay) | Right click sets `dockModalSide='right'`; panel class uses fixed `top-28` + right offset | PASS |
| 7 | No full-screen overlay | Panel should not render full-screen blocking layer | Removed `fixed inset-0` wrapper; panel renders as standalone fixed tile | PASS |
| 8 | Outside click close | Clicking outside panel closes when not pinned | `mousedown` listener closes unless target is inside panel or dock icon; strict cleanup present | PASS |
| 9 | Pin mode | Pinned panel should remain open across outside clicks | Outside-click close is bypassed when `dockModalPinned=true` | PASS |
| 10 | Tooltip behavior | Hovering icon shows tooltip; leaving icon clears tooltip | `onMouseEnter` sets `hoveredDock`; `onMouseLeave` clears it | PASS |
| 11 | Build/Lint safety | Refactor must compile and lint cleanly | `npm run lint` and `npm run build` both pass | PASS |
| 12 | Runtime serve | App shell should render with dock/HUD after refactor | Dev smoke confirms page responds and HUD text appears | PASS |

## Notes

- Snap buttons (`L/C/R`) were intentionally removed as part of this change so tiles always open beside their source icon rails and no longer center-overlay.
- Existing mission submenu overlay (quick-actions strip at top) remains independent from dock side tiles.

## Data-Focused Next Ideas

1. Add live ACE/DSCOVR IMF stream fusion for higher cadence Bz volatility alerts.
2. Add ESA SSA/Space-Track conjunction feed adapter into `HazardTelemetryModel` for per-orbit collision ops context.
3. Add GNSS TEC and ionosonde data adapters to quantify regional communication degradation probability.
4. Add an ensemble nowcast layer (NOAA + local Transformer summarizer + LSTM) with confidence decomposition per hazard type.
5. Add station-level impact cards (HF comms, power grid, aviation route risk) with location-specific thresholds.
