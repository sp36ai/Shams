import {
  bracketFromMinute,
  directionOfHouse,
  houseOfSign,
  lagnaFromMinute,
  localMinuteFromIso,
  rotateHouses,
  signOfHouse,
  watchWindowFromIso,
} from '@astrology/rkp/watchGrid';
import { SIGN_META, type HouseNumber } from '@astrology/rkp/nomenclature';
import type { SignIndex } from '@astrology/types/chart';

describe('bracket selection', () => {
  it('maps each 5-minute bracket to its sign', () => {
    expect(lagnaFromMinute(0)).toBe(1); // Hamal
    expect(lagnaFromMinute(4)).toBe(1);
    expect(lagnaFromMinute(5)).toBe(2); // Saur — boundary is half-open
    expect(lagnaFromMinute(13)).toBe(3); // Jauza
    expect(lagnaFromMinute(55)).toBe(12); // Hoot
    expect(lagnaFromMinute(59)).toBe(12);
  });

  it('covers all twelve signs exactly once across the hour', () => {
    const seen = new Set<SignIndex>();
    for (let m = 0; m < 60; m += 1) {
      seen.add(lagnaFromMinute(m));
    }
    expect(seen.size).toBe(12);
  });

  it('gives every bracket exactly five minutes', () => {
    const counts = new Map<number, number>();
    for (let m = 0; m < 60; m += 1) {
      const b = bracketFromMinute(m);
      counts.set(b, (counts.get(b) ?? 0) + 1);
    }
    expect([...counts.values()]).toEqual(Array(12).fill(5));
  });

  it('rejects out-of-range minutes rather than silently clamping', () => {
    expect(() => bracketFromMinute(60)).toThrow(RangeError);
    expect(() => bracketFromMinute(-1)).toThrow(RangeError);
  });
});

describe('local minute extraction', () => {
  it('reads the querent local minute, not the runtime timezone minute', () => {
    // 11:13 on a wrist in IST. Date.getMinutes() on a UTC server would give 43
    // and select the wrong bracket entirely.
    expect(localMinuteFromIso('2026-08-08T11:13:00+05:30')).toBe(13);
    expect(lagnaFromMinute(localMinuteFromIso('2026-08-08T11:13:00+05:30'))).toBe(3);
  });

  it('handles the 45-minute offset zones', () => {
    // Nepal (+05:45) — another case where the minute field genuinely shifts.
    expect(localMinuteFromIso('2026-08-08T11:58:00+05:45')).toBe(58);
    expect(lagnaFromMinute(58)).toBe(12);
  });

  it('accepts Z and offset-free forms', () => {
    expect(localMinuteFromIso('2026-08-08T11:13:00Z')).toBe(13);
    expect(localMinuteFromIso('2026-08-08T11:13:00')).toBe(13);
  });

  it('throws on a string with no time component', () => {
    expect(() => localMinuteFromIso('2026-08-08')).toThrow(RangeError);
  });
});

describe('house rotation', () => {
  it('rotates signs sequentially from the lagna', () => {
    // Sartan (4) lagna → 1st Sartan, 2nd Asad, 3rd Sunbula … 12th Jauza
    const houses = rotateHouses(4);
    expect(houses[0]).toBe(4);
    expect(houses[1]).toBe(5);
    expect(houses[2]).toBe(6);
    expect(houses[11]).toBe(3);
  });

  it('always produces twelve distinct signs', () => {
    for (let lagna = 1 as SignIndex; lagna <= 12; lagna = (lagna + 1) as SignIndex) {
      expect(new Set(rotateHouses(lagna)).size).toBe(12);
    }
  });

  it('signOfHouse and houseOfSign are inverses for every lagna', () => {
    for (let lagna = 1; lagna <= 12; lagna += 1) {
      for (let house = 1; house <= 12; house += 1) {
        const sign = signOfHouse(lagna as SignIndex, house as HouseNumber);
        expect(houseOfSign(lagna as SignIndex, sign)).toBe(house);
      }
    }
  });

  it('directions follow the sign on the house, not the house number', () => {
    // Jadi (10) is a Khaki/South sign wherever it lands.
    const lagna = 1 as SignIndex; // Hamal lagna → Jadi sits on the 10th
    expect(signOfHouse(lagna, 10)).toBe(10);
    expect(directionOfHouse(lagna, 10)).toBe('South');
    expect(SIGN_META[10].direction).toBe('South');
  });
});

describe('watch window', () => {
  it('reports the bracket span containing the moment', () => {
    const w = watchWindowFromIso('2026-08-08T11:13:00+05:30');
    expect(w).toMatchObject({
      bracket: 2,
      minute: 13,
      startMinute: 10,
      endMinute: 15,
      lagnaSign: 3,
    });
  });
});
