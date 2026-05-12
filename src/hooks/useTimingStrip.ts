import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  horaLordAtMoment,
  dayLordAtMoment,
} from '@astrology/primitives/rulingPlanets';
import type { Planet } from '@astrology/types/chart';

const REFRESH_MS = 60_000;

export interface TimingStrip {
  horaLord: Planet;
  dayLord: Planet;
}

export function useTimingStrip(lonDeg: number): TimingStrip {
  const [horaLord, setHoraLord] = useState<Planet>(
    () => horaLordAtMoment(Date.now(), lonDeg) as Planet,
  );
  const [dayLord, setDayLord] = useState<Planet>(
    () => dayLordAtMoment(Date.now(), lonDeg) as Planet,
  );

  useFocusEffect(
    useCallback(() => {
      const refresh = () => {
        const now = Date.now();
        setHoraLord(horaLordAtMoment(now, lonDeg) as Planet);
        setDayLord(dayLordAtMoment(now, lonDeg) as Planet);
      };
      refresh();
      const id = setInterval(refresh, REFRESH_MS);
      return () => clearInterval(id);
    }, [lonDeg]),
  );

  return { horaLord, dayLord };
}
