export type RemedyCategory =
  | 'reflection'
  | 'prayer'
  | 'gratitude'
  | 'charity'
  | 'service'
  | 'patience'
  | 'reconciliation'
  | 'study'
  | 'self_discipline';

export type SpiritualState =
  | 'restless'
  | 'fearful'
  | 'confused'
  | 'discouraged'
  | 'hopeful'
  | 'remorseful'
  | 'grateful'
  | 'uncertain';

export type EffectDimension = 'internal' | 'behavioral' | 'relational' | 'spiritual';

export type RemedyDifficulty = 'easy' | 'moderate' | 'challenging';

export interface Remedy {
  id: string;
  title: string;
  category: RemedyCategory;
  difficulty: RemedyDifficulty;
  duration: string;
  effectDimension: EffectDimension;
  themeAlignment: string[];
  spiritualStateFit: SpiritualState[];
}

export const REMEDY_LIBRARY: Remedy[] = [
  // ── REFLECTION ─────────────────────────────────────────────────────────────
  {
    id: 'reflection_01',
    title: 'A Practice of Deliberate Stillness',
    category: 'reflection',
    difficulty: 'easy',
    duration: '10 minutes daily',
    effectDimension: 'internal',
    themeAlignment: ['patience', 'delay', 'obstruction', 'impatience'],
    spiritualStateFit: ['restless', 'uncertain'],
  },
  {
    id: 'reflection_02',
    title: 'Honest Self-Inventory',
    category: 'reflection',
    difficulty: 'moderate',
    duration: '20 minutes, once this week',
    effectDimension: 'internal',
    themeAlignment: ['confusion', 'hidden obstacles', 'self-deception', 'indecision'],
    spiritualStateFit: ['confused', 'uncertain', 'remorseful'],
  },
  {
    id: 'reflection_03',
    title: 'Writing What Cannot Be Spoken',
    category: 'reflection',
    difficulty: 'easy',
    duration: '15 minutes daily for 3 days',
    effectDimension: 'internal',
    themeAlignment: ['emotional suppression', 'grief', 'unexpressed feeling', 'loss'],
    spiritualStateFit: ['discouraged', 'fearful', 'confused'],
  },
  {
    id: 'reflection_04',
    title: 'Tracing the Pattern Backward',
    category: 'reflection',
    difficulty: 'moderate',
    duration: 'One sitting, 30 minutes',
    effectDimension: 'internal',
    themeAlignment: ['repeating cycles', 'karmic delay', 'recurring obstruction'],
    spiritualStateFit: ['discouraged', 'uncertain', 'confused'],
  },
  {
    id: 'reflection_05',
    title: 'Sitting With the Unknown',
    category: 'reflection',
    difficulty: 'challenging',
    duration: '15 minutes daily',
    effectDimension: 'internal',
    themeAlignment: ['uncertainty', 'waiting', 'ambiguity', 'hidden outcome'],
    spiritualStateFit: ['fearful', 'uncertain', 'restless'],
  },

  // ── PRAYER ─────────────────────────────────────────────────────────────────
  {
    id: 'prayer_01',
    title: 'Salat al-Hajah — The Prayer of Need',
    category: 'prayer',
    difficulty: 'easy',
    duration: 'Two rakats, whenever need is felt',
    effectDimension: 'spiritual',
    themeAlignment: ['unmet desire', 'longing', 'petition', 'hope deferred'],
    spiritualStateFit: ['hopeful', 'uncertain', 'discouraged'],
  },
  {
    id: 'prayer_02',
    title: 'Night Vigil — Tahajjud',
    category: 'prayer',
    difficulty: 'challenging',
    duration: 'Last third of the night, 3 consecutive nights',
    effectDimension: 'spiritual',
    themeAlignment: ['crisis', 'urgent petition', 'despair', 'severe obstruction'],
    spiritualStateFit: ['fearful', 'discouraged', 'remorseful'],
  },
  {
    id: 'prayer_03',
    title: 'Istikharah — Seeking Divine Guidance',
    category: 'prayer',
    difficulty: 'easy',
    duration: 'Two rakats before sleep',
    effectDimension: 'spiritual',
    themeAlignment: ['decision', 'crossroads', 'indecision', 'two paths'],
    spiritualStateFit: ['confused', 'uncertain', 'hopeful'],
  },
  {
    id: 'prayer_04',
    title: 'Salawat as Daily Anchor',
    category: 'prayer',
    difficulty: 'easy',
    duration: '100 repetitions daily',
    effectDimension: 'spiritual',
    themeAlignment: ['anxiety', 'worry', 'fear', 'inner noise'],
    spiritualStateFit: ['restless', 'fearful', 'uncertain'],
  },
  {
    id: 'prayer_05',
    title: 'Dua of Surrender',
    category: 'prayer',
    difficulty: 'moderate',
    duration: 'After Fajr, 7 days',
    effectDimension: 'spiritual',
    themeAlignment: ['control', 'forcing outcomes', 'resistance', 'attachment'],
    spiritualStateFit: ['restless', 'fearful', 'remorseful'],
  },

  // ── GRATITUDE ──────────────────────────────────────────────────────────────
  {
    id: 'gratitude_01',
    title: 'Gratitude for What Has Already Arrived',
    category: 'gratitude',
    difficulty: 'easy',
    duration: 'Before sleep, 7 nights',
    effectDimension: 'internal',
    themeAlignment: ['impatience', 'ingratitude', 'delay', 'longing'],
    spiritualStateFit: ['restless', 'discouraged', 'uncertain'],
  },
  {
    id: 'gratitude_02',
    title: 'Naming the Unseen Blessings',
    category: 'gratitude',
    difficulty: 'easy',
    duration: '5 minutes after Fajr, 3 days',
    effectDimension: 'internal',
    themeAlignment: ['ingratitude', 'scarcity mindset', 'hidden blessing'],
    spiritualStateFit: ['discouraged', 'fearful', 'uncertain'],
  },
  {
    id: 'gratitude_03',
    title: 'Gratitude Expressed Aloud to Another',
    category: 'gratitude',
    difficulty: 'moderate',
    duration: 'Once this week',
    effectDimension: 'relational',
    themeAlignment: ['isolation', 'pride', 'relational distance', 'unexpressed care'],
    spiritualStateFit: ['remorseful', 'discouraged', 'hopeful'],
  },

  // ── CHARITY ────────────────────────────────────────────────────────────────
  {
    id: 'charity_01',
    title: 'Sadaqah as Opening',
    category: 'charity',
    difficulty: 'easy',
    duration: 'Any amount, given today',
    effectDimension: 'behavioral',
    themeAlignment: ['obstruction', 'blocked path', 'stagnation', 'material concern'],
    spiritualStateFit: ['restless', 'uncertain', 'hopeful'],
  },
  {
    id: 'charity_02',
    title: 'Feeding Someone Who Is Hungry',
    category: 'charity',
    difficulty: 'easy',
    duration: 'Once this week',
    effectDimension: 'behavioral',
    themeAlignment: ['material anxiety', 'scarcity fear', 'provision', 'livelihood'],
    spiritualStateFit: ['fearful', 'discouraged', 'uncertain'],
  },
  {
    id: 'charity_03',
    title: 'Anonymous Giving',
    category: 'charity',
    difficulty: 'moderate',
    duration: 'Once, without disclosure',
    effectDimension: 'behavioral',
    themeAlignment: ['pride', 'reputation concern', 'ego', 'control'],
    spiritualStateFit: ['remorseful', 'restless', 'hopeful'],
  },

  // ── SERVICE ────────────────────────────────────────────────────────────────
  {
    id: 'service_01',
    title: 'An Act of Service Without Expectation',
    category: 'service',
    difficulty: 'easy',
    duration: 'Once this week',
    effectDimension: 'behavioral',
    themeAlignment: ['attachment to outcome', 'control', 'forcing', 'impatience'],
    spiritualStateFit: ['restless', 'uncertain', 'hopeful'],
  },
  {
    id: 'service_02',
    title: 'Helping Someone Carry a Burden',
    category: 'service',
    difficulty: 'easy',
    duration: 'Once this week, unprompted',
    effectDimension: 'relational',
    themeAlignment: ['isolation', 'self-focus', 'grief', 'heavy heart'],
    spiritualStateFit: ['discouraged', 'confused', 'remorseful'],
  },
  {
    id: 'service_03',
    title: 'Visiting One Who Is Alone',
    category: 'service',
    difficulty: 'moderate',
    duration: 'Once this week',
    effectDimension: 'relational',
    themeAlignment: ['isolation', 'loneliness', 'relational rupture', 'distance'],
    spiritualStateFit: ['remorseful', 'discouraged', 'hopeful'],
  },
  {
    id: 'service_04',
    title: 'Teaching What You Know',
    category: 'service',
    difficulty: 'moderate',
    duration: 'One hour, when opportunity arises',
    effectDimension: 'relational',
    themeAlignment: ['knowledge', 'purpose', 'contribution', 'meaning'],
    spiritualStateFit: ['uncertain', 'hopeful', 'grateful'],
  },

  // ── PATIENCE ───────────────────────────────────────────────────────────────
  {
    id: 'patience_01',
    title: 'Completing One Thing Before Moving to the Next',
    category: 'patience',
    difficulty: 'moderate',
    duration: 'One full day',
    effectDimension: 'behavioral',
    themeAlignment: ['scattered energy', 'impatience', 'restlessness', 'distraction'],
    spiritualStateFit: ['restless', 'confused', 'uncertain'],
  },
  {
    id: 'patience_02',
    title: 'Deliberate Slowing of Daily Movement',
    category: 'patience',
    difficulty: 'easy',
    duration: 'One full day, practiced consciously',
    effectDimension: 'behavioral',
    themeAlignment: ['haste', 'forcing', 'rushing outcomes', 'impatience'],
    spiritualStateFit: ['restless', 'fearful', 'uncertain'],
  },
  {
    id: 'patience_03',
    title: 'Holding the Tongue Before Responding',
    category: 'patience',
    difficulty: 'challenging',
    duration: '3 days, in difficult conversations',
    effectDimension: 'relational',
    themeAlignment: ['conflict', 'anger', 'relational tension', 'hasty speech'],
    spiritualStateFit: ['restless', 'remorseful', 'fearful'],
  },
  {
    id: 'patience_04',
    title: 'Fasting as a School of Restraint',
    category: 'patience',
    difficulty: 'challenging',
    duration: 'One voluntary fast',
    effectDimension: 'internal',
    themeAlignment: ['desire', 'impulse', 'craving', 'attachment', 'self-control'],
    spiritualStateFit: ['restless', 'remorseful', 'uncertain'],
  },

  // ── RECONCILIATION ─────────────────────────────────────────────────────────
  {
    id: 'reconciliation_01',
    title: 'Sending Peace to One Who Has Wronged You',
    category: 'reconciliation',
    difficulty: 'challenging',
    duration: 'Once, in private',
    effectDimension: 'relational',
    themeAlignment: ['resentment', 'estrangement', 'broken relationship', 'conflict'],
    spiritualStateFit: ['remorseful', 'fearful', 'discouraged'],
  },
  {
    id: 'reconciliation_02',
    title: 'Offering an Apology Without Conditions',
    category: 'reconciliation',
    difficulty: 'challenging',
    duration: 'When the time feels right',
    effectDimension: 'relational',
    themeAlignment: ['guilt', 'rupture', 'harm caused', 'unspoken wrong'],
    spiritualStateFit: ['remorseful', 'fearful', 'discouraged'],
  },
  {
    id: 'reconciliation_03',
    title: 'Releasing a Grievance in Prayer',
    category: 'reconciliation',
    difficulty: 'moderate',
    duration: 'Once, with sincerity',
    effectDimension: 'spiritual',
    themeAlignment: ['resentment', 'unforgiveness', 'bitterness', 'old wound'],
    spiritualStateFit: ['remorseful', 'discouraged', 'fearful'],
  },

  // ── STUDY ──────────────────────────────────────────────────────────────────
  {
    id: 'study_01',
    title: 'Reading One Page of Sacred Text Daily',
    category: 'study',
    difficulty: 'easy',
    duration: '10 minutes daily',
    effectDimension: 'spiritual',
    themeAlignment: ['spiritual drift', 'disconnection', 'doubt', 'confusion'],
    spiritualStateFit: ['confused', 'uncertain', 'discouraged'],
  },
  {
    id: 'study_02',
    title: 'Contemplating One Ayah for a Full Day',
    category: 'study',
    difficulty: 'moderate',
    duration: 'One full day, returning to the verse',
    effectDimension: 'spiritual',
    themeAlignment: ['meaning', 'direction', 'purpose', 'guidance sought'],
    spiritualStateFit: ['confused', 'uncertain', 'hopeful'],
  },
  {
    id: 'study_03',
    title: 'Seeking Knowledge From Someone Wiser',
    category: 'study',
    difficulty: 'moderate',
    duration: 'One conversation, this week',
    effectDimension: 'relational',
    themeAlignment: ['pride', 'isolation', 'confusion', 'needing counsel'],
    spiritualStateFit: ['confused', 'uncertain', 'remorseful'],
  },
  {
    id: 'study_04',
    title: 'Memorizing a Du\'a of Protection',
    category: 'study',
    difficulty: 'easy',
    duration: '5 minutes daily until memorized',
    effectDimension: 'spiritual',
    themeAlignment: ['fear', 'anxiety', 'vulnerability', 'protection sought'],
    spiritualStateFit: ['fearful', 'uncertain', 'restless'],
  },

  // ── SELF-DISCIPLINE ────────────────────────────────────────────────────────
  {
    id: 'self_discipline_01',
    title: 'Rising for Fajr for Seven Consecutive Days',
    category: 'self_discipline',
    difficulty: 'challenging',
    duration: '7 days',
    effectDimension: 'behavioral',
    themeAlignment: ['spiritual negligence', 'drift', 'disconnection', 'lack of structure'],
    spiritualStateFit: ['discouraged', 'remorseful', 'uncertain'],
  },
  {
    id: 'self_discipline_02',
    title: 'One Day Without Complaint',
    category: 'self_discipline',
    difficulty: 'moderate',
    duration: 'One full day',
    effectDimension: 'behavioral',
    themeAlignment: ['ingratitude', 'frustration', 'bitterness', 'resistance'],
    spiritualStateFit: ['restless', 'discouraged', 'remorseful'],
  },
  {
    id: 'self_discipline_03',
    title: 'Removing One Distraction for One Week',
    category: 'self_discipline',
    difficulty: 'moderate',
    duration: '7 days',
    effectDimension: 'behavioral',
    themeAlignment: ['scattered energy', 'distraction', 'avoidance', 'escapism'],
    spiritualStateFit: ['confused', 'restless', 'uncertain'],
  },
  {
    id: 'self_discipline_04',
    title: 'Keeping a Promise Made to Yourself',
    category: 'self_discipline',
    difficulty: 'moderate',
    duration: 'One commitment, followed through',
    effectDimension: 'internal',
    themeAlignment: ['broken intention', 'weak resolve', 'self-trust', 'integrity'],
    spiritualStateFit: ['remorseful', 'discouraged', 'uncertain'],
  },
  {
    id: 'self_discipline_05',
    title: 'Eating With Intention for Three Days',
    category: 'self_discipline',
    difficulty: 'easy',
    duration: '3 days',
    effectDimension: 'behavioral',
    themeAlignment: ['body neglect', 'heedlessness', 'self-care', 'discipline'],
    spiritualStateFit: ['restless', 'discouraged', 'uncertain'],
  },

  // ── GRATEFUL STATE ANCHORS ─────────────────────────────────────────────────
  // Grateful users need deepening practices, not corrective ones.
  {
    id: 'gratitude_04',
    title: 'Sharing Your Good Fortune With Another',
    category: 'charity',
    difficulty: 'easy',
    duration: 'Once this week',
    effectDimension: 'relational',
    themeAlignment: ['abundance', 'blessing received', 'good news', 'arrival'],
    spiritualStateFit: ['grateful', 'hopeful'],
  },
  {
    id: 'study_05',
    title: 'Deepening Into What Is Already Working',
    category: 'study',
    difficulty: 'moderate',
    duration: '30 minutes of reflection',
    effectDimension: 'internal',
    themeAlignment: ['confirmation', 'success', 'answered prayer', 'forward movement'],
    spiritualStateFit: ['grateful', 'hopeful'],
  },
];

/** Total remedy count — used in tests and analytics. */
export const REMEDY_COUNT = REMEDY_LIBRARY.length;
