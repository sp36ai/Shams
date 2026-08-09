import { RKP_HOUSE_ROUTING, FULFILMENT_GHAR, routingFor } from '@astrology/rkp/houseRouting';
import { ALL_QUESTION_TYPES } from '@astrology/questions/topics';

/**
 * Conformance to the RKP specification as provided by the owner.
 *
 * These are not derived values and must not be "improved" to match another
 * system's table. An earlier version of this file took its numbers from the KP
 * engine's house matrix, which put finance on the 2nd and education on the 4th
 * — both wrong for RKP, and a hybrid of two engines besides. Pinned here so
 * that cannot happen quietly again.
 */
const SPEC: Readonly<Record<string, number>> = {
  health: 1, // identity, health, vitality
  lostitem: 2, // holdings
  property: 4, // property, vehicles, domestic peace
  education: 5, // examinations, study, speculation
  children: 5, // offspring
  legal: 6, // loans, disputes, adversaries
  enemies: 6,
  marriage: 7, // partner, contract
  business: 7, // partnership
  travel: 9, // long journeys
  spiritual: 9,
  career: 10, // profession, promotion, standing
  finance: 11, // realised gains, salary, wish fulfilled
  general: 1, // no stated subject → the querent
};

describe('RKP house routing conforms to the specification', () => {
  it('routes every topic to its specified Ghar', () => {
    for (const [topic, ghar] of Object.entries(SPEC)) {
      expect(routingFor(topic as never).ghar).toBe(ghar);
    }
  });

  it('reads realised gains from the 11th, not the 2nd', () => {
    // The 2nd holds what is already banked; the 11th is money arriving.
    expect(routingFor('finance').ghar).toBe(11);
    expect(routingFor('finance').ghar).not.toBe(2);
  });

  it('reads examinations from the 5th, not the 4th', () => {
    expect(routingFor('education').ghar).toBe(5);
    expect(routingFor('education').ghar).not.toBe(4);
  });

  it('covers every topic in the shared vocabulary', () => {
    for (const topic of ALL_QUESTION_TYPES) {
      expect(RKP_HOUSE_ROUTING[topic]).toBeDefined();
      expect(routingFor(topic).ghar).toBeGreaterThanOrEqual(1);
      expect(routingFor(topic).ghar).toBeLessThanOrEqual(12);
    }
    expect(Object.keys(RKP_HOUSE_ROUTING)).toHaveLength(ALL_QUESTION_TYPES.length);
  });

  it('carries no per-topic favourable or denying lists', () => {
    // RKP judges on the 1st / target / 11th triad. A per-topic table of
    // favourable and denying houses is the KP engine's structure, and adopting
    // its shape is how the two engines blended once before.
    for (const topic of ALL_QUESTION_TYPES) {
      expect(Object.keys(RKP_HOUSE_ROUTING[topic])).toEqual(['ghar']);
    }
  });

  it('fixes fulfilment on the 11th Ghar for every question', () => {
    expect(FULFILMENT_GHAR).toBe(11);
  });
});
