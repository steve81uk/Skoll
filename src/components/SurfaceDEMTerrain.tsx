import { useEffect, useMemo, useRef } from 'react';
import { useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import type { LocationPreset } from './LocationSwitcher';

interface SurfaceDEMTerrainProps {
  planetName: string | null;
  location: LocationPreset;
  visible?: boolean;
  onSamplerReady?: (sampler: (x: number, z: number) => number) => void;
}

const BASE_Y = -5;
const TERRAIN_SIZE = 420;
const GRID = 129;
const HEIGHT_ZOOM = 8;
const METERS_PER_SCENE_UNIT = 900;

function latLonToTile(lat: number, lon: number, zoom: number) {
  const latRad = (lat * Math.PI) / 180;
  const n = 2 ** zoom;
  const x = Math.floor(((lon + 180) / 360) * n);
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return { x, y };
}

function decodeTerrarium(r: number, g: number, b: number) {
  return r * 256 + g + b / 256 - 32768;
}

export default function SurfaceDEMTerrain({
  planetName,
  location,
  visible = true,
  onSamplerReady,
}: SurfaceDEMTerrainProps) {
  const isEarth = (planetName ?? 'Earth') === 'Earth';
  const texture = useLoader(THREE.TextureLoader, '/textures/8k_earth_daymap.jpg');
  const geom = useMemo(() => new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, GRID - 1, GRID - 1), []);
  const gridHeightsRef = useRef<Float32Array | null>(null);

  useEffect(() => {
    if (!visible || !isEarth) {
      onSamplerReady?.(() => BASE_Y);
      return;
    }

    let canceled = false;
    const { x, y } = latLonToTile(location.lat, location.lon, HEIGHT_ZOOM);
    const terrarium = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${HEIGHT_ZOOM}/${x}/${y}.png`;
    const src = `https://api.allorigins.win/raw?url=${encodeURIComponent(terrarium)}`;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (canceled) return;

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        onSamplerReady?.(() => BASE_Y);
        return;
      }

      ctx.drawImage(img, 0, 0);
      const pixels = ctx.getImageData(0, 0, img.width, img.height).data;

      const local = new Float32Array(GRID * GRID);
      const centerIndex = ((img.height >> 1) * img.width + (img.width >> 1)) * 4;
      const centerM = decodeTerrarium(pixels[centerIndex], pixels[centerIndex + 1], pixels[centerIndex + 2]);

      const pos = geom.attributes.position as THREE.BufferAttribute;
      for (let gy = 0; gy < GRID; gy++) {
        for (let gx = 0; gx < GRID; gx++) {
          const u = gx / (GRID - 1);
          const v = gy / (GRID - 1);
          const px = Math.floor(u * (img.width - 1));
          const py = Math.floor((1 - v) * (img.height - 1));
          const pidx = (py * img.width + px) * 4;
          const meters = decodeTerrarium(pixels[pidx], pixels[pidx + 1], pixels[pidx + 2]);
          const rel = (meters - centerM) / METERS_PER_SCENE_UNIT;
          const yScene = rel * 1.15;
          const i = gy * GRID + gx;
          local[i] = yScene;
          pos.setY(i, yScene);
        }
      }

      pos.needsUpdate = true;
      geom.computeVertexNormals();
      gridHeightsRef.current = local;

      onSamplerReady?.((worldX: number, worldZ: number) => {
        const half = TERRAIN_SIZE * 0.5;
        const u = THREE.MathUtils.clamp((worldX + half) / TERRAIN_SIZE, 0, 1);
        const v = THREE.MathUtils.clamp((worldZ + half) / TERRAIN_SIZE, 0, 1);
        const gx = u * (GRID - 1);
        const gy = (1 - v) * (GRID - 1);
        const x0 = Math.floor(gx);
        const y0 = Math.floor(gy);
        const x1 = Math.min(GRID - 1, x0 + 1);
        const y1 = Math.min(GRID - 1, y0 + 1);
        const tx = gx - x0;
        const ty = gy - y0;
        const arr = gridHeightsRef.current;
        if (!arr) return BASE_Y;

        const h00 = arr[y0 * GRID + x0];
        const h10 = arr[y0 * GRID + x1];
        const h01 = arr[y1 * GRID + x0];
        const h11 = arr[y1 * GRID + x1];
        const h0 = THREE.MathUtils.lerp(h00, h10, tx);
        const h1 = THREE.MathUtils.lerp(h01, h11, tx);
        return BASE_Y + THREE.MathUtils.lerp(h0, h1, ty);
      });
    };

    img.onerror = () => {
      if (!canceled) {
        onSamplerReady?.(() => BASE_Y);
      }
    };

    img.src = src;
    return () => {
      canceled = true;
    };
  }, [geom, isEarth, location.lat, location.lon, onSamplerReady, visible]);

  if (!visible) return null;

  return (
    <mesh position={[0, BASE_Y, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <primitive object={geom} attach="geometry" />
      <meshStandardMaterial
        map={texture}
        roughness={0.95}
        metalness={0.02}
      />
    </mesh>
  );
}
