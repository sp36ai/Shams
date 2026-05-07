import { z } from 'zod';

/**
 * Shared Planet Names enum based on RKP constants.
 */
const PlanetNameSchema = z.enum([
  'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'
]);

/**
 * Schema for individual planetary data within a chart.
 */
const PlanetDataSchema = z.object({
  longitude: z.number().min(0).max(360),
  signLord: PlanetNameSchema,
  starLord: PlanetNameSchema,
  subLord: PlanetNameSchema,
  isRetrograde: z.boolean(),
});

/**
 * Schema for house cusp details.
 */
const CuspDetailSchema = z.object({
  number: z.number().int().min(1).max(12),
  longitude: z.number().min(0).max(360),
  signLord: PlanetNameSchema,
  starLord: PlanetNameSchema,
  subLord: PlanetNameSchema,
});

/**
 * Zod Schema for Chart validation.
 * Ensures the high-fidelity input required by the RKP engine.
 */
export const ChartSchema = z.object({
  momentUtc: z.string().datetime(),
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    tzOffsetHours: z.number(),
  }),
  planets: z.record(PlanetNameSchema, PlanetDataSchema),
  cusps: z.array(CuspDetailSchema).length(12),
  rulingPlanets: z.array(PlanetNameSchema).min(3).max(5),
  engineVersion: z.string(),
  metadata: z.object({
    horaryNumber: z.number().int().optional(),
  }).optional(),
});

/**
 * Zod Schema for Verdict validation.
 * Ensures the output contract is met before sending to the client.
 */
export const VerdictSchema = z.object({
  readingId: z.string().uuid(),
  verdict: z.enum(['YES', 'NO', 'CONDITIONAL', 'DELAYED', 'UNCLEAR']),
  confidence: z.number().min(0).max(100),
  category: z.string(),
  narration: z.object({
    en: z.string(),
    ur: z.string(),
    hi: z.string(),
  }),
  reasoning: z.array(z.object({
    ruleId: z.string(),
    weight: z.number(),
    description: z.string(),
  })),
  timing: z.object({
    window: z.enum(['days', 'weeks', 'months', 'years']),
    range: z.object({
      min: z.number(),
      max: z.number(),
    }),
    activeDasha: PlanetNameSchema,
    activeAntardasha: PlanetNameSchema,
    activePratyantardasha: PlanetNameSchema,
  }),
  remedy: z.object({
    planet: PlanetNameSchema,
  }).passthrough(), //passthrough allowed for remedy metadata
  computedAt: z.string().datetime(),
});

/**
 * Zod Schema for ClassifiedQuestion validation.
 */
export const ClassifiedQuestionSchema = z.object({
  text: z.string().min(1),
  qType: z.enum([
    'career', 'marriage', 'finance', 'health', 'property', 'travel',
    'business', 'legal', 'children', 'education', 'lostitem',
    'enemies', 'spiritual', 'general'
  ]),
  lang: z.enum(['en', 'ur', 'hi']),
});
