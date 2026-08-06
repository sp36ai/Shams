import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { msUntilNextHora } from '@astrology/primitives/rulingPlanets';

function format(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * "00:18:42 remaining" style countdown to the current hora's handoff.
 * Ticks every second, only while the screen is focused.
 */
export function useHoraCountdown(lonDeg: number): string {
  const [label, setLabel] = useState<string>(() => {
    try {
      return format(msUntilNextHora(Date.now(), lonDeg));
    } catch {
      return '00:00:00';
    }
  });

  useFocusEffect(
    useCallback(() => {
      const tick = () => {
        try {
          setLabel(format(msUntilNextHora(Date.now(), lonDeg)));
        } catch {
          /* transient compute failure — retain last good reading */
        }
      };
      tick();
      const id = setInterval(tick, 1000);
      return () => clearInterval(id);
    }, [lonDeg]),
  );

  return label;
}
