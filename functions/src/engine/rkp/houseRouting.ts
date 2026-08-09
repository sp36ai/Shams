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
 * One Ghar per topic. RKP judges on the triad — the querent (1st), the matter
 * (this Ghar), and fulfilment (11th) — so there is deliberately no per-topic
 * table of favourable and denying houses here. That structure belongs to the
 * KP engine, and importing its shape was how a hybrid crept in once already.
 */

import type { QuestionType } from '../questions/topics';
import { ALL_QUESTION_TYPES } from '../questions/topics';
import type { HouseNumber } from './nomenclature';

export interface GharRouting {
  /** The Ghar the matter is judged from. */
  readonly ghar: HouseNumber;
}

/**
 * Ghars that undo a matter wherever it sits — the classical houses of loss and
 * undoing. RKP applies these universally rather than per topic: the spec judges
 * on the 1st / target / 11th triad plus malefic affliction, not on a
 * topic-by-topic table of favourable and denying houses.
 */
export const DENYING_GHARS: readonly HouseNumber[] = Object.freeze([8, 12]);

/**
 * The 11th Ghar — Bait-ul-Raja, the house of gains and answered desire —
 * decides whether a matter actually materialises, whatever its own Ghar says.
 * It is therefore consulted for every question and is not listed per topic.
 */
export const FULFILMENT_GHAR: HouseNumber = 11;

export const RKP_HOUSE_ROUTING: Readonly<Record<QuestionType, GharRouting>> = Object.freeze({
  // Bait-ul-Izzat — profession, promotion, launching a venture.
  career: { ghar: 10 },
  // Bait-ul-Zaujah — the partner, and the contract binding two parties.
  marriage: { ghar: 7 },
  // Bait-ul-Raja — realised gains, salary, the wish granted. Money ARRIVING
  // is read here, not from the 2nd, which holds what is already banked.
  finance: { ghar: 11 },
  // Bait-ul-Nafs — the body itself.
  health: { ghar: 1 },
  // Bait-ul-Arz — land, dwelling, vehicles, the peace of the home.
  property: { ghar: 4 },
  // Bait-ul-Safar — the long journey.
  travel: { ghar: 9 },
  // Bait-ul-Marz — debt, dispute, the adversary across the table.
  legal: { ghar: 6 },
  // Bait-ul-Awlad — examinations, study, speculation. The house of what the
  // mind produces, not the house of the home that shelters the student.
  education: { ghar: 5 },
  // A venture is a partnership before it is a profession.
  business: { ghar: 7 },
  // Bait-ul-Awlad — offspring.
  children: { ghar: 5 },
  // What is lost is read from the house of holdings.
  lostitem: { ghar: 2 },
  // The open adversary shares the house of dispute.
  enemies: { ghar: 6 },
  // The road outward is also the road inward.
  spiritual: { ghar: 9 },
  // With no stated subject, the matter is read from the querent themselves.
  general: { ghar: 1 },
});

/** Routing for a topic. Every topic has one, so this never returns undefined. */
export function routingFor(qType: QuestionType): GharRouting {
  return RKP_HOUSE_ROUTING[qType];
}

/** Every topic the RKP engine can route. Mirrors the shared vocabulary. */
export const ROUTABLE_TOPICS: readonly QuestionType[] = ALL_QUESTION_TYPES;
