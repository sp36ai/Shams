import { normalize360 } from './angles';
import { JD_J2000, JULIAN_CENTURY_DAYS } from './constants';
import type { JDtt } from './julianDay';

type SweAyanamsaFn = (jdUt: number, sidMode: number) => number;

const maybeSwe = (globalThis as { swe_get_ayanamsa_ut?: SweAyanamsaFn }).swe_get_ayanamsa_ut;

const swe_get_ayanamsa_ut: SweAyanamsaFn =
  typeof maybeSwe === 'function'
    ? maybeSwe
    : (jdUt: number, _sidMode: number) => {
        const T = (jdUt - JD_J2000) / JULIAN_CENTURY_DAYS;
        const arcsec = T * (5029.097 + T * (1.558 + T * -0.000344));
        return normalize360(23 + 51 / 60 + 11.31 / 3600 + arcsec / 3600);
      };

export function lahiriAyanamsa(jdtt: JDtt): number {
  return swe_get_ayanamsa_ut(jdtt, 1);
}

export function tropicalToSidereal(tropicalDeg: number, jdtt: JDtt): number {
  return normalize360(tropicalDeg - lahiriAyanamsa(jdtt));
}
