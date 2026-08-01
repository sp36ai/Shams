import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { horaLordAtMoment, dayLordAtMoment } from '@astrology/primitives/rulingPlanets';
import type { Planet } from '@astrology/types/chart';

const REFRESH_MS = 60_000;

// The timing strip is a decorative header readout, never on the critical path.
// A throw from the ruling-planet maths (bad longitude, unexpected input) must
// never take down the screen that mounts this hook — the whole Oracle surface
// dropped to the "veil trembled" boundary once because a background effect on
// it threw. Fall back to a neutral planet and keep the last good value rather
// than propagating the error.
const FALLBACK_LORD: Planet = 'Sun';

function safeLord(fn: (momentMs: number, lonDeg: number) => Planet, lonDeg: number): Planet {
  try {
    return fn(Date.now(), lonDeg);
  } catch {
    return FALLBACK_LORD;
  }
}

export interface TimingStrip {
  horaLord: Planet;
  dayLord: Planet;
}

export function useTimingStrip(lonDeg: number): TimingStrip {
  const [horaLord, setHoraLord] = useState<Planet>(() => safeLord(horaLordAtMoment, lonDeg));
  const [dayLord, setDayLord] = useState<Planet>(() => safeLord(dayLordAtMoment, lonDeg));

  useFocusEffect(
    useCallback(() => {
      const refresh = () => {
        // Keep the previous value on a compute failure — never surface a throw
        // out of this focus effect, which would crash the host screen.
        try {
          const now = Date.now();
          setHoraLord(horaLordAtMoment(now, lonDeg));
          setDayLord(dayLordAtMoment(now, lonDeg));
        } catch {
          /* transient compute failure — retained last good reading */
        }
      };
      refresh();
      const id = setInterval(refresh, REFRESH_MS);
      return () => clearInterval(id);
    }, [lonDeg]),
  );

  return { horaLord, dayLord };
}
