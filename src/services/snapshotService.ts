export interface SnapshotState {
  epoch: number;
  cameraPosition: [number, number, number];
  cameraTarget: [number, number, number];
  openPanels: string[];
  activeSimulation?: string;
  zoomStage: string;
}

export function encodeSnapshot(state: SnapshotState): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(state))));
}

export function decodeSnapshot(param: string): SnapshotState {
  const json = decodeURIComponent(escape(atob(param)));
  return JSON.parse(json) as SnapshotState;
}

export function buildSnapshotUrl(state: SnapshotState): string {
  const url = new URL(window.location.href);
  url.searchParams.set('snapshot', encodeSnapshot(state));
  return url.toString();
}

export async function captureCanvasScreenshot(): Promise<string | null> {
  const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
  if (!canvas) return null;
  return canvas.toDataURL('image/png');
}
