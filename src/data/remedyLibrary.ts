// ── Canonical tag vocabulary — 18 tags, derived bottom-up from the 38 remedies ──

export type RemedyTag =
  // Obstruction family
  | 'OBSTRUCTION'
  | 'DELAY'
  | 'STAGNATION'
  // Control family
  | 'FORCING'
  | 'ATTACHMENT'
  | 'HASTE'
  // Inner disorder family
  | 'RESTLESSNESS'
  | 'ANXIETY'
  | 'DISTRACTION'
  // Relational family
  | 'CONFLICT'
  | 'ESTRANGEMENT'
  // Spiritual family
  | 'SPIRITUAL_NEGLECT'
  | 'DOUBT'
  // Loss family
  | 'GRIEF'
  | 'SUPPRESSION'
  // Ego family
  | 'PRIDE'
  // Material family
  | 'MATERIAL_ANXIETY'
  // Arrival family
  | 'ABUNDANCE';

export type RemedyCategory =
  | 'salawat'
  | 'dua'
  | 'istikhara'
  | 'sadaqa'
  | 'fasting'
  | 'quran'
  | 'dhikr'
  | 'charity'
  | 'night_prayer'
  | 'silence'
  | 'tawbah';

export type EffectDimension =
  | 'spiritual_clearing'
  | 'calming'
  | 'emotional_release'
  | 'surrender'
  | 'trust_building'
  | 'reconciliation'
  | 'activation'
  | 'grounding'
  | 'clarity'
  | 'opening'
  | 'humility'
  | 'comfort'
  | 'patience'
  | 'gratitude';

export type RemedyIntensity = 'gentle' | 'moderate' | 'deep';

export type SpiritualState =
  | 'restless'
  | 'hopeful'
  | 'remorseful'
  | 'uncertain'
  | 'grieving'
  | 'proud'
  | 'anxious'
  | 'grateful';

export interface TaggedRemedy {
  id: string;
  category: RemedyCategory;
  themeTags: RemedyTag[];
  themeNotes: string[];
  effectDimension: EffectDimension;
  intensity: RemedyIntensity;
}

export const REMEDY_LIBRARY: TaggedRemedy[] = [
  // ── SALAWAT ────────────────────────────────────────────────────────────────
  {
    id: 'salawat_01',
    category: 'salawat',
    themeTags: ['OBSTRUCTION', 'STAGNATION', 'SPIRITUAL_NEGLECT'],
    themeNotes: ['blocked path', 'spiritual disconnection'],
    effectDimension: 'spiritual_clearing',
    intensity: 'gentle',
  },
  {
    id: 'salawat_02',
    category: 'salawat',
    themeTags: ['ANXIETY', 'RESTLESSNESS', 'DOUBT'],
    themeNotes: ['inner noise', 'scattered energy'],
    effectDimension: 'calming',
    intensity: 'gentle',
  },
  {
    id: 'salawat_03',
    category: 'salawat',
    themeTags: ['GRIEF', 'SUPPRESSION', 'SPIRITUAL_NEGLECT'],
    themeNotes: ['heavy heart', 'unexpressed feeling'],
    effectDimension: 'emotional_release',
    intensity: 'gentle',
  },

  // ── DUA ────────────────────────────────────────────────────────────────────
  {
    id: 'dua_01',
    category: 'dua',
    themeTags: ['OBSTRUCTION', 'DELAY', 'FORCING'],
    themeNotes: ['blocked progress', 'forcing outcomes'],
    effectDimension: 'surrender',
    intensity: 'moderate',
  },
  {
    id: 'dua_02',
    category: 'dua',
    themeTags: ['ANXIETY', 'MATERIAL_ANXIETY', 'DOUBT'],
    themeNotes: ['provision concern', 'scarcity fear'],
    effectDimension: 'trust_building',
    intensity: 'moderate',
  },
  {
    id: 'dua_03',
    category: 'dua',
    themeTags: ['CONFLICT', 'ESTRANGEMENT', 'PRIDE'],
    themeNotes: ['relational rupture', 'ego in conflict'],
    effectDimension: 'reconciliation',
    intensity: 'moderate',
  },
  {
    id: 'dua_04',
    category: 'dua',
    themeTags: ['GRIEF', 'GRIEF', 'SUPPRESSION'], // source had LOSS — normalised to GRIEF (not in 18-tag vocab)
    themeNotes: ['loss', 'emotional suppression'],
    effectDimension: 'emotional_release',
    intensity: 'gentle',
  },
  {
    id: 'dua_05',
    category: 'dua',
    themeTags: ['STAGNATION', 'DELAY', 'SPIRITUAL_NEGLECT'],
    themeNotes: ['recurring obstruction', 'lack of movement'],
    effectDimension: 'activation',
    intensity: 'moderate',
  },

  // ── ISTIKHARA ──────────────────────────────────────────────────────────────
  {
    id: 'istikhara_01',
    category: 'istikhara',
    themeTags: ['DOUBT', 'ATTACHMENT', 'FORCING'],
    themeNotes: ['uncertainty', 'attachment to outcome'],
    effectDimension: 'surrender',
    intensity: 'deep',
  },
  {
    id: 'istikhara_02',
    category: 'istikhara',
    themeTags: ['DOUBT', 'RESTLESSNESS', 'DISTRACTION'],
    themeNotes: ['scattered decision-making', 'inner noise'],
    effectDimension: 'clarity',
    intensity: 'deep',
  },

  // ── SADAQA ─────────────────────────────────────────────────────────────────
  {
    id: 'sadaqa_01',
    category: 'sadaqa',
    themeTags: ['OBSTRUCTION', 'MATERIAL_ANXIETY', 'STAGNATION'],
    themeNotes: ['blocked provision', 'material concern'],
    effectDimension: 'opening',
    intensity: 'moderate',
  },
  {
    id: 'sadaqa_02',
    category: 'sadaqa',
    themeTags: ['GRIEF', 'ESTRANGEMENT', 'SUPPRESSION'],
    themeNotes: ['loss of connection', 'unexpressed grief'],
    effectDimension: 'emotional_release',
    intensity: 'moderate',
  },
  {
    id: 'sadaqa_03',
    category: 'sadaqa',
    themeTags: ['PRIDE', 'CONFLICT', 'FORCING'],
    themeNotes: ['ego obstruction', 'forcing resolution'],
    effectDimension: 'humility',
    intensity: 'moderate',
  },
  {
    id: 'sadaqa_04',
    category: 'sadaqa',
    themeTags: ['MATERIAL_ANXIETY', 'DELAY', 'DOUBT'],
    themeNotes: ['scarcity fear', 'provision delay'],
    effectDimension: 'trust_building',
    intensity: 'gentle',
  },

  // ── FASTING ────────────────────────────────────────────────────────────────
  {
    id: 'fasting_01',
    category: 'fasting',
    themeTags: ['RESTLESSNESS', 'DISTRACTION', 'FORCING'],
    themeNotes: ['scattered energy', 'haste'],
    effectDimension: 'grounding',
    intensity: 'deep',
  },
  {
    id: 'fasting_02',
    category: 'fasting',
    themeTags: ['PRIDE', 'ATTACHMENT', 'SPIRITUAL_NEGLECT'],
    themeNotes: ['ego', 'spiritual drift'],
    effectDimension: 'humility',
    intensity: 'deep',
  },
  {
    id: 'fasting_03',
    category: 'fasting',
    themeTags: ['GRIEF', 'SUPPRESSION', 'DOUBT'],
    themeNotes: ['heavy heart', 'spiritual doubt'],
    effectDimension: 'emotional_release',
    intensity: 'deep',
  },

  // ── QURAN ──────────────────────────────────────────────────────────────────
  {
    id: 'quran_01',
    category: 'quran',
    themeTags: ['ANXIETY', 'RESTLESSNESS', 'DOUBT'],
    themeNotes: ['inner noise', 'worry'],
    effectDimension: 'calming',
    intensity: 'gentle',
  },
  {
    id: 'quran_02',
    category: 'quran',
    themeTags: ['OBSTRUCTION', 'STAGNATION', 'SPIRITUAL_NEGLECT'],
    themeNotes: ['blocked path', 'disconnection'],
    effectDimension: 'spiritual_clearing',
    intensity: 'gentle',
  },
  {
    id: 'quran_03',
    category: 'quran',
    themeTags: ['GRIEF', 'GRIEF', 'ESTRANGEMENT'], // source had LOSS — normalised to GRIEF (not in 18-tag vocab)
    themeNotes: ['loss', 'isolation'],
    effectDimension: 'comfort',
    intensity: 'gentle',
  },
  {
    id: 'quran_04',
    category: 'quran',
    themeTags: ['MATERIAL_ANXIETY', 'DOUBT', 'DELAY'],
    themeNotes: ['provision concern', 'waiting'],
    effectDimension: 'trust_building',
    intensity: 'gentle',
  },

  // ── DHIKR ──────────────────────────────────────────────────────────────────
  {
    id: 'dhikr_01',
    category: 'dhikr',
    themeTags: ['RESTLESSNESS', 'ANXIETY', 'DISTRACTION'],
    themeNotes: ['scattered energy', 'inner noise'],
    effectDimension: 'grounding',
    intensity: 'gentle',
  },
  {
    id: 'dhikr_02',
    category: 'dhikr',
    themeTags: ['GRIEF', 'SUPPRESSION', 'SPIRITUAL_NEGLECT'],
    themeNotes: ['heavy heart', 'spiritual drift'],
    effectDimension: 'comfort',
    intensity: 'gentle',
  },
  {
    id: 'dhikr_03',
    category: 'dhikr',
    themeTags: ['OBSTRUCTION', 'DELAY', 'DOUBT'],
    themeNotes: ['blocked path', 'waiting period'],
    effectDimension: 'patience',
    intensity: 'gentle',
  },
  {
    id: 'dhikr_04',
    category: 'dhikr',
    themeTags: ['ABUNDANCE', 'SPIRITUAL_NEGLECT'],
    themeNotes: ['gratitude anchoring', 'arrival state'],
    effectDimension: 'gratitude',
    intensity: 'gentle',
  },

  // ── CHARITY ────────────────────────────────────────────────────────────────
  {
    id: 'charity_01',
    category: 'charity',
    themeTags: ['MATERIAL_ANXIETY', 'OBSTRUCTION', 'STAGNATION'],
    themeNotes: ['provision blockage', 'material stagnation'],
    effectDimension: 'opening',
    intensity: 'moderate',
  },
  {
    id: 'charity_02',
    category: 'charity',
    themeTags: ['PRIDE', 'ESTRANGEMENT', 'CONFLICT'],
    themeNotes: ['ego softening', 'relational repair'],
    effectDimension: 'humility',
    intensity: 'moderate',
  },
  {
    id: 'charity_03',
    category: 'charity',
    themeTags: ['GRIEF', 'GRIEF', 'SUPPRESSION'], // source had LOSS — normalised to GRIEF (not in 18-tag vocab)
    themeNotes: ['grief in action', 'transforming loss'],
    effectDimension: 'emotional_release',
    intensity: 'moderate',
  },
  {
    id: 'gratitude_04',
    category: 'charity',
    themeTags: ['ABUNDANCE', 'SPIRITUAL_NEGLECT'],
    themeNotes: ['answered prayer', 'gratitude for arrival'],
    effectDimension: 'gratitude',
    intensity: 'gentle',
  },

  // ── NIGHT PRAYER ───────────────────────────────────────────────────────────
  {
    id: 'night_prayer_01',
    category: 'night_prayer',
    themeTags: ['SPIRITUAL_NEGLECT', 'DOUBT', 'STAGNATION'],
    themeNotes: ['spiritual drift', 'disconnection'],
    effectDimension: 'spiritual_clearing',
    intensity: 'deep',
  },
  {
    id: 'night_prayer_02',
    category: 'night_prayer',
    themeTags: ['ANXIETY', 'RESTLESSNESS', 'GRIEF'],
    themeNotes: ['night worry', 'sleepless restlessness'],
    effectDimension: 'calming',
    intensity: 'deep',
  },
  {
    id: 'night_prayer_03',
    category: 'night_prayer',
    themeTags: ['OBSTRUCTION', 'FORCING', 'ATTACHMENT'],
    themeNotes: ['blocked outcome', 'forcing resolution'],
    effectDimension: 'surrender',
    intensity: 'deep',
  },

  // ── SILENCE ────────────────────────────────────────────────────────────────
  {
    id: 'silence_01',
    category: 'silence',
    themeTags: ['DISTRACTION', 'RESTLESSNESS', 'FORCING'],
    themeNotes: ['inner noise', 'compulsive action'],
    effectDimension: 'grounding',
    intensity: 'moderate',
  },
  {
    id: 'silence_02',
    category: 'silence',
    themeTags: ['CONFLICT', 'PRIDE', 'HASTE'],
    themeNotes: ['reactive speech', 'ego in conflict'],
    effectDimension: 'humility',
    intensity: 'moderate',
  },
  {
    id: 'silence_03',
    category: 'silence',
    themeTags: ['GRIEF', 'SUPPRESSION', 'ESTRANGEMENT'],
    themeNotes: ['sitting with loss', 'unexpressed feeling'],
    effectDimension: 'comfort',
    intensity: 'moderate',
  },

  // ── TAWBAH ─────────────────────────────────────────────────────────────────
  {
    id: 'tawbah_01',
    category: 'tawbah',
    themeTags: ['PRIDE', 'SPIRITUAL_NEGLECT', 'OBSTRUCTION'],
    themeNotes: ['ego blocking', 'spiritual negligence'],
    effectDimension: 'spiritual_clearing',
    intensity: 'deep',
  },
  {
    id: 'tawbah_02',
    category: 'tawbah',
    themeTags: ['CONFLICT', 'ESTRANGEMENT', 'SUPPRESSION'],
    themeNotes: ['relational rupture', 'unresolved wrong'],
    effectDimension: 'reconciliation',
    intensity: 'deep',
  },
  {
    id: 'tawbah_03',
    category: 'tawbah',
    themeTags: ['DOUBT', 'GRIEF', 'SPIRITUAL_NEGLECT'],
    themeNotes: ['spiritual doubt', 'disconnection from faith'],
    effectDimension: 'trust_building',
    intensity: 'deep',
  },
];

export const REMEDY_COUNT = REMEDY_LIBRARY.length;
