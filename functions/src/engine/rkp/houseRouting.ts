/**
 * RKP house routing — which Ghar answers which question.
 * --------------------------------------------------------------------------
 * THE RKP ENGINE'S OWN RULES. It does not read the KP engine's house matrix,
 * and the KP engine does not read this. The two are independent calculation
 * systems: RKP judges a watch-selected frame, KP judges the true horizon, and
 * a reading comes from one system or the other — never from a blend of both.
 *
 * The only thing the two share is the neutral subject vocabulary in
 * questions/topics.ts, which is a word list, not astrology.
 *
 * The assignments below are the classical significations of the twelve Ghars,
 * which is why several coincide with what other horary branches use — the 10th
 * has governed standing and profession for as long as the houses have been
 * counted. Agreement on a classical signification is not a dependency.
 *
 * Structure per topic:
 *   ghar       the Ghar the matter is read from
 *   supporting Ghars whose involvement strengthens the matter
 *   denying    Ghars whose involvement undermines it
 */

import type { QuestionType } from '../questions/topics';
import { ALL_QUESTION_TYPES } from '../questions/topics';
import type { HouseNumber } from './nomenclature';

export interface GharRouting {
  /** The Ghar the matter is judged from. */
  readonly ghar: HouseNumber;
  /** Ghars whose support carries the matter. */
  readonly supporting: readonly HouseNumber[];
  /** Ghars whose involvement denies it. */
  readonly denying: readonly HouseNumber[];
}

/**
 * The 11th Ghar — Bait-ul-Raja, the house of gains and answered desire —
 * decides whether a matter actually materialises, whatever its own Ghar says.
 * It is therefore consulted for every question and is not listed per topic.
 */
export const FULFILMENT_GHAR: HouseNumber = 11;

export const RKP_HOUSE_ROUTING: Readonly<Record<QuestionType, GharRouting>> = Object.freeze({
  // Bait-ul-Izzat — standing, honour, profession.
  career: { ghar: 10, supporting: [6, 11], denying: [5, 8, 12] },
  // Bait-ul-Zaujah — the partner, and the contract that binds two parties.
  marriage: { ghar: 7, supporting: [2, 11], denying: [6, 8, 12] },
  // Bait-ul-Maal — accumulated wealth and what is already held.
  finance: { ghar: 2, supporting: [6, 11], denying: [8, 12] },
  // Bait-ul-Nafs — the body itself; vitality is read from the querent's Ghar.
  health: { ghar: 1, supporting: [5, 11], denying: [6, 8, 12] },
  // Bait-ul-Arz — land, dwelling, and the peace of the home.
  property: { ghar: 4, supporting: [2, 11], denying: [8, 12] },
  // Bait-ul-Safar — the long journey and the fortune that attends it.
  travel: { ghar: 9, supporting: [3, 12], denying: [] },
  // Bait-ul-Marz — dispute, debt, and the adversary across the table.
  legal: { ghar: 6, supporting: [11], denying: [8, 12] },
  // Learning read from the seat of the home that shelters it.
  education: { ghar: 4, supporting: [9, 11], denying: [8, 12] },
  // A venture is a partnership before it is a profession.
  business: { ghar: 7, supporting: [10, 11], denying: [6, 8, 12] },
  // Bait-ul-Awlad — offspring and the creative issue of the self.
  children: { ghar: 5, supporting: [2, 11], denying: [1, 4, 10] },
  // What is lost is read from the Ghar of holdings, not of loss.
  lostitem: { ghar: 2, supporting: [4, 11], denying: [8, 12] },
  // The open adversary shares the Ghar of dispute.
  enemies: { ghar: 6, supporting: [11], denying: [8, 12] },
  // Bait-ul-Safar again — the road outward is also the road inward.
  spiritual: { ghar: 9, supporting: [5, 12], denying: [6, 8] },
  // With no stated subject, the matter is read from the querent themselves.
  general: { ghar: 1, supporting: [11], denying: [8, 12] },
});

/** Routing for a topic. Every topic has one, so this never returns undefined. */
export function routingFor(qType: QuestionType): GharRouting {
  return RKP_HOUSE_ROUTING[qType];
}

/** Every topic the RKP engine can route. Mirrors the shared vocabulary. */
export const ROUTABLE_TOPICS: readonly QuestionType[] = ALL_QUESTION_TYPES;
