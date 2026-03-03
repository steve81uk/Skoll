import { useEffect, useState } from 'react';
import { getHistoricalMagneticModel } from '../ml/PredictiveEngine';
import { calculateMagneticOffset, fetchNorthMagneticPole } from '../services/WMMService';

interface DriftOffset {
  x: number;
  y: number;
  z: number;
}

export const useMagneticDrift = (planetName: string, currentDate: Date): DriftOffset => {
  const [driftOffset, setDriftOffset] = useState<DriftOffset>({ x: 0, y: 0, z: 0 });

  useEffect(() => {
    const compute = async () => {
      if (planetName === 'Earth') {
        const year = currentDate.getFullYear();

        if (year < 1990) {
          const model = getHistoricalMagneticModel(year, true);
          setDriftOffset({
            x: model.rotationMatrix[2][1] * 0.35,
            y: model.rotationMatrix[0][2] * 0.35,
            z: model.rotationMatrix[1][0] * 0.25,
          });
          return;
        }

        const live = await fetchNorthMagneticPole();
        const offset = calculateMagneticOffset(live.northPole);
        setDriftOffset({
          x: (live.northPole.lat - 90) * 0.01,
          y: live.northPole.lon * 0.0016,
          z: offset * 0.0009,
        });
        return;
      }

      if (planetName === 'Jupiter') {
        const driftPhase = Date.now() / 1_000_000;
        setDriftOffset({ x: Math.sin(driftPhase) * 0.1, y: Math.cos(driftPhase * 0.6) * 0.06, z: 0 });
        return;
      }

      setDriftOffset({ x: 0, y: 0, z: 0 });
    };

    void compute();
  }, [currentDate, planetName]);

  return driftOffset;
};
