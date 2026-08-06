import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { displayLonSidereal, nakshatraName, signName, moonPhase } from '@utils/siderealPositions';
import { computeMoonVoidOfCourse, type VoidOfCourseResult } from '@utils/voidOfCourseMoon';
import { computeSunTimes, type SunTimes } from '@utils/sunTimes';

const REFRESH_MS = 60_000;

export interface SkyExtras {
  moonSign: string;
  moonNakshatra: string;
  moonPhaseFull: string;
  voidOfCourse: VoidOfCourseResult;
  sunTimes: SunTimes | null;
}

function compute(latDeg: number, lonDeg: number): SkyExtras {
  const now = Date.now();
  const moonLon = displayLonSidereal('Moon', now);
  return {
    moonSign: signName(moonLon),
    moonNakshatra: nakshatraName(moonLon),
    moonPhaseFull: moonPhase(now),
    voidOfCourse: computeMoonVoidOfCourse(now),
    sunTimes: computeSunTimes(now, latDeg, lonDeg),
  };
}

/**
 * Home dashboard's "extra" sky readouts — Moon sign/nakshatra/phase, void-of-
 * course status, and sunrise/sunset. Refreshes every 60s, only while the
 * screen is focused (mirrors useTimingStrip's cadence/battery tradeoff).
 * A compute failure degrades to the last good reading rather than crashing
 * the home surface — same defensive pattern as useTimingStrip.
 */
export function useSkyExtras(latDeg: number, lonDeg: number): SkyExtras {
  const [extras, setExtras] = useState<SkyExtras>(() => {
    try {
      return compute(latDeg, lonDeg);
    } catch {
      return {
        moonSign: '—',
        moonNakshatra: '—',
        moonPhaseFull: '—',
        voidOfCourse: { isVoid: false, signExitMs: Date.now() },
        sunTimes: null,
      };
    }
  });

  useFocusEffect(
    useCallback(() => {
      const refresh = () => {
        try {
          setExtras(compute(latDeg, lonDeg));
        } catch {
          /* transient compute failure — retain last good reading */
        }
      };
      refresh();
      const id = setInterval(refresh, REFRESH_MS);
      return () => clearInterval(id);
    }, [latDeg, lonDeg]),
  );

  return extras;
}
