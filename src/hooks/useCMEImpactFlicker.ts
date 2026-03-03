import { useEffect, useState } from 'react';

export const useCMEImpactFlicker = (standoff: number, kp: number, suppressed = false) => {
  const [flickerClass, setFlickerClass] = useState('');

  useEffect(() => {
    if (suppressed) {
      setFlickerClass('');
      return;
    }

    const isCritical = standoff < 6.5 || kp > 7;

    if (!isCritical) {
      setFlickerClass('');
      return;
    }

    const interval = window.setInterval(() => {
      const glitchTypes = ['', 'animate-pulse', 'opacity-30', 'blur-[1px]', 'text-red-500'];
      const randomType = glitchTypes[Math.floor(Math.random() * glitchTypes.length)];
      setFlickerClass(randomType);
    }, 150);

    return () => window.clearInterval(interval);
  }, [standoff, kp, suppressed]);

  return flickerClass;
};
