/**
 * OracleChatScreen — the oracle question/verdict conversation.
 * --------------------------------------------------------------------------
 * Reached from the home dashboard's "Ask Shams" button. Holds everything
 * that is specific to a single sitting with the oracle: the chat-style
 * message list, quick-reply chips, the composer, and the verdict/follow-up
 * logic. The home dashboard (OracleScreen) stays a lightweight status
 * surface — HORA/DAY LORD/QUESTIONS, quota, location, today's sky — and
 * never renders a conversation itself.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  ActivityIndicator,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { acquireLocation } from '@utils/acquireLocation';
import { withTimeout } from '@utils/withTimeout';
import crashlytics from '@react-native-firebase/crashlytics';
import auth from '@react-native-firebase/auth';
import { getAppCheckToken } from '../firebase/appCheck';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/types';

import { useColors, useTheme } from '@theme/ThemeProvider';
import { useTypography } from '@theme/useTypography';
import { useTranslation, useI18n } from '@i18n/I18nProvider';
import { useReadingsStore, type Reading } from '@stores/readingsStore';
import { useSettingsStore } from '@stores/settingsStore';
import { useQuotaStore, FREE_DAILY_LIMIT, TRIAL_DAILY_LIMIT } from '@stores/quotaStore';
import { useQuota } from '@hooks/useQuota';
import { useTimingStrip } from '@hooks/useTimingStrip';
import { classifyIntent } from '@hooks/useIntentClassifier';
import { classifyQuestion } from '@hooks/useQuestionGate';
import { askWatchOracle } from '../firebase/watchOracle';
import type { WatchState } from '@astrology/rkp/watchJudgment';
import StarfieldBackground from '@components/StarfieldBackground';
import { displayLonSidereal, PLANET_GLYPHS } from '@utils/siderealPositions';
import { getSignLordByLongitude } from '@astrology/primitives/rulingPlanets';
import AstroVerdictCard from '../components/oracle/AstroVerdictCard';
import RkpWatchCard from '../components/oracle/RkpWatchCard';
import RemedyProtocolCard from '../components/oracle/RemedyProtocolCard';
import CastingAstrolabe from '../components/oracle/CastingAstrolabe';
import type { AstroVerdictResult } from '../types/verdict';
import { selectRemedies, contextFromReading } from '../data/remedySelector';
import type { RenderedRemedy } from '../data/remedyRenderer';
import { INITIAL_CHIPS, FOLLOWUP_CHIPS } from '../data/oracleChips';

// ── Types ─────────────────────────────────────────────────────────────────────

type Sender = 'shams' | 'user';
type ConvStage = 'ready' | 'answered';

interface ChatMessage {
  id: string;
  sender: Sender;
  text: string;
  reading?: Reading;
  isUpgradeCta?: boolean;
  createdAt: string;
}

// ── Verdict JSON shape helpers ────────────────────────────────────────────────

interface VjTiming {
  window?: 'days' | 'weeks' | 'months' | 'years';
  range?: { min?: number; max?: number };
  activeDasha?: string;
  activeAntardasha?: string;
  activePratyantardasha?: string;
}

interface VjRemedy {
  planet?: string;
  action?: string;
  avoid?: string;
  zikr?: string;
  charity?: string;
}

interface VjShape {
  confidence?: number;
  timing?: VjTiming;
  remedy?: VjRemedy;
  moonSubLord?: { planet?: string; occupiedHouse?: number };
  rulingPlanets?: { dayLord?: string; horaLord?: string; minuteLord?: string };
}

// ── Reading → AstroVerdictResult mapper ───────────────────────────────────────

interface VjExtended extends VjShape {
  moonSubLord?: {
    planet?: string;
    occupiedHouse?: number;
    favHits?: number[];
    denHits?: number[];
  };
  rulingPlanets?: {
    dayLord?: string;
    horaLord?: string;
    ascSignLord?: string;
    ascStarLord?: string;
    moonSignLord?: string;
    moonStarLord?: string;
  };
  narration?: Partial<Record<'en' | 'ur' | 'hi', string>>;
  significators?: { favorable: string[]; denial: string[]; neutral: string[] };
  confirmedSignificators?: string[];
  deniedSignificators?: string[];
  reasoning?: Array<{ ruleId: string; description: string; weight: number }>;
  planetDegrees?: Record<string, number>;
  cuspDegrees?: Record<number, number>;
  cuspSigns?: Record<number, string>;
  planetChain?: Record<string, { manzilLord: string; subLord: string; subSubLord: string }>;
  /** KP horary number (1–249) — additive witness, see judgeHorary.ts docstring. */
  horaryNumber?: number;
  oracle?: {
    opening: string;
    interpretation: string;
    spiritual_layer: string;
    hidden_influence: string;
    timing?: string | null;
    warning?: string;
    remedy: {
      quran_verse?: string;
      asma?: string;
      dua?: string;
      zikr?: string;
      sadaqah?: string;
    };
    signature: string;
  };
}

function readingToAstroResult(reading: Reading): AstroVerdictResult {
  const vj = reading.verdictJson as VjExtended | null;
  const msl = vj?.moonSubLord;
  const rp = vj?.rulingPlanets;

  const houses: AstroVerdictResult['houses'] = [
    ...(msl?.favHits ?? []).map(h => ({ house: h, label: 'Fav', favorable: true })),
    ...(msl?.denHits ?? []).map(h => ({ house: h, label: 'Den', favorable: false })),
  ];

  const rulingPlanets: AstroVerdictResult['rulingPlanets'] = [];
  if (rp?.dayLord) {
    rulingPlanets.push({ planet: rp.dayLord, role: 'dayLord', matching: false });
  }
  if (rp?.horaLord) {
    rulingPlanets.push({ planet: rp.horaLord, role: 'horaLord', matching: false });
  }
  if (rp?.ascSignLord) {
    rulingPlanets.push({ planet: rp.ascSignLord, role: 'ascSignLord', matching: false });
  }
  if (rp?.ascStarLord) {
    rulingPlanets.push({ planet: rp.ascStarLord, role: 'ascStarLord', matching: false });
  }
  if (rp?.moonSignLord) {
    rulingPlanets.push({ planet: rp.moonSignLord, role: 'moonSignLord', matching: false });
  }
  if (rp?.moonStarLord) {
    rulingPlanets.push({ planet: rp.moonStarLord, role: 'moonStarLord', matching: false });
  }

  const narrative = vj?.narration?.[reading.questionLang] ?? vj?.narration?.en ?? '';

  return {
    mode: 'astro',
    verdict: reading.verdict,
    confidence: vj?.confidence ?? 0,
    subLord: msl?.planet ?? '—',
    subLordHouse: msl?.occupiedHouse ?? 0,
    houses,
    rulingPlanets,
    timing: vj?.timing?.window
      ? {
          window: vj.timing.window,
          range: { min: vj.timing.range?.min ?? 0, max: vj.timing.range?.max ?? 1 },
          activeDasha: vj.timing.activeDasha,
          activeAntardasha: vj.timing.activeAntardasha,
        }
      : undefined,
    remedy: vj?.remedy?.action
      ? {
          planet: vj.remedy.planet ?? '—',
          action: vj.remedy.action,
          avoid: vj.remedy.avoid ?? '',
          zikr: vj.remedy.zikr,
          charity: vj.remedy.charity,
        }
      : undefined,
    narrative,
    createdAt: reading.createdAt,
    category: reading.category,
    question: reading.question,
    significators: vj?.significators,
    confirmedSignificators: vj?.confirmedSignificators,
    deniedSignificators: vj?.deniedSignificators,
    reasoning: vj?.reasoning,
    planetDegrees: vj?.planetDegrees,
    cuspDegrees: vj?.cuspDegrees,
    cuspSigns: vj?.cuspSigns,
    planetChain: vj?.planetChain,
    oracle: vj?.oracle,
  };
}

// ── Followup response builders ────────────────────────────────────────────────

const ARABIC_PLANET_NAME: Record<string, string> = {
  Sun: 'Shams',
  Moon: 'al-Qamar',
  Mars: 'al-Mirrikh',
  Mercury: 'Utarid',
  Jupiter: 'Mushtari',
  Venus: 'Zuhra',
  Saturn: 'Zuhal',
  Rahu: "al-Ra's",
  Ketu: 'al-Dhanab',
};

function timingResponse(reading: Reading, lang: 'en' | 'ur' | 'hi'): string {
  const vj = reading.verdictJson as VjExtended | null;

  // Prefer oracle prose timing — already in oracle voice
  const oracleTiming = vj?.oracle?.timing;
  if (oracleTiming) {
    return oracleTiming;
  }

  const t = vj?.timing;
  if (!t) {
    return lang === 'ur'
      ? 'اس زائچے میں وقت کا تعین ممکن نہیں۔ جب چاند اپنی موجودہ منزل سے گزرے تو دوبارہ پوچھیں۔'
      : lang === 'hi'
        ? 'اس زائچے میں وقت واضح نہیں ہے۔'
        : 'The zaaiche does not name a day. Watch for the sign the celestial witnesses have described.';
  }
  const max = t.range?.max ?? 1;
  const win = t.window ?? 'weeks';
  const winLabel: Record<string, Record<'en' | 'ur' | 'hi', string>> = {
    days: { en: 'days', ur: 'دن', hi: 'दिन' },
    weeks: { en: 'weeks', ur: 'ہفتے', hi: 'सप्ताह' },
    months: { en: 'months', ur: 'مہینے', hi: 'महीने' },
    years: { en: 'years', ur: 'سال', hi: 'वर्ष' },
  };
  const wl = winLabel[win]?.[lang] ?? win;
  if (lang === 'ur') {
    return `آسمانی گواہ **${max} ${wl}** کی کھڑکی اشارہ کرتے ہیں۔\n\nستارے وقت کی کھڑکیاں دیتے ہیں، تقرریاں نہیں۔`;
  }
  if (lang === 'hi') {
    return `آسمانی گواہ **${max} ${wl}** کی کھڑکی اشارہ کرتے ہیں۔\n\nستارے وقت کی کھڑکیاں دیتے ہیں، تقرریاں نہیں۔`;
  }
  return `The celestial witnesses point to a window of **${max} ${wl}**.\n\nThe stars offer windows, not appointments.`;
}

function whyResponse(reading: Reading, lang: 'en' | 'ur' | 'hi'): string {
  const vj = reading.verdictJson as VjExtended | null;

  // Oracle interpretation is the best "why" answer — already in oracle voice
  const interpretation = vj?.oracle?.interpretation;
  if (interpretation) {
    return interpretation;
  }

  // Fallback: celestial witness description — no KP jargon
  const msl = vj?.moonSubLord;
  const rawPlanet = msl?.planet ?? '';
  const planet = ARABIC_PLANET_NAME[rawPlanet] ?? (rawPlanet || '—');
  const conf = vj?.confidence ?? 0;
  if (lang === 'ur') {
    return `فیصلہ **آسمانی گواہ ${planet}** کی شہادت پر منحصر ہے۔\n\nیقین: **${conf}%**`;
  }
  if (lang === 'hi') {
    return `یہ فیصلہ **آسمانی گواہ ${planet}** کی گواہی پر منحصر ہے۔\n\nیقین: **${conf}%**`;
  }
  return `The verdict rests on the testimony of **${planet}**, the celestial witness appointed to this zaaiche.\n\nConfidence: **${conf}%**`;
}

function remedyResponse(reading: Reading, lang: 'en' | 'ur' | 'hi'): string {
  const vj = reading.verdictJson as VjExtended | null;
  const oracleRemedy = vj?.oracle?.remedy;
  const verdictRemedy = vj?.remedy;

  if (!oracleRemedy && !verdictRemedy) {
    return lang === 'ur'
      ? 'اس زائچے کے لیے کوئی مخصوص علاج نہیں ملا۔'
      : lang === 'hi'
        ? 'اس زائچے کے لیے کوئی علاج نہیں ملا۔'
        : 'No specific remedy was given for this zaaiche.';
  }

  const lines: string[] = [];

  // Oracle remedy — primary (verse + asma + dua + zikr + sadaqah)
  if (oracleRemedy?.quran_verse) {
    lines.push(`📖 ${oracleRemedy.quran_verse}`);
  }
  if (oracleRemedy?.asma) {
    lines.push(`• ${oracleRemedy.asma}`);
  }
  if (oracleRemedy?.dua) {
    lines.push(`• ${oracleRemedy.dua}`);
  }
  if (oracleRemedy?.zikr) {
    lines.push(lang === 'ur' ? `• ذکر: *${oracleRemedy.zikr}*` : `• Zikr: *${oracleRemedy.zikr}*`);
  }
  if (oracleRemedy?.sadaqah) {
    lines.push(
      lang === 'ur' ? `• صدقہ: ${oracleRemedy.sadaqah}` : `• Sadaqah: ${oracleRemedy.sadaqah}`,
    );
  }

  // Verdict remedy — supplementary (planet-specific action + avoid)
  if (verdictRemedy?.action) {
    lines.push(`• ${verdictRemedy.action}`);
  }
  if (verdictRemedy?.avoid) {
    lines.push(
      lang === 'ur' ? `• پرہیز: ${verdictRemedy.avoid}` : `• Avoid: ${verdictRemedy.avoid}`,
    );
  }

  const header =
    lang === 'ur' ? 'علاج اور عمل:' : lang === 'hi' ? 'علاج اور عمل:' : 'Remedy & practice:';
  return `${header}\n\n${lines.join('\n')}`;
}

function elaborationResponse(reading: Reading, lang: 'en' | 'ur' | 'hi'): string {
  const vj = reading.verdictJson as VjExtended | null;
  const oracle = vj?.oracle;

  // spiritual_layer is the "deeper why" — designed for follow-up questions
  if (oracle?.spiritual_layer) {
    return oracle.spiritual_layer;
  }
  if (oracle?.hidden_influence) {
    return oracle.hidden_influence;
  }

  return (
    narrationForReading(reading) ||
    (lang === 'ur'
      ? 'اس زائچے کے بارے میں مزید تفصیل دستیاب نہیں۔'
      : lang === 'hi'
        ? 'اس زائچے کے بارے میں مزید جانکاری دستیاب نہیں۔'
        : 'No additional detail is available for this zaaiche.')
  );
}

// ── Narration extraction ──────────────────────────────────────────────────────

function narrationForReading(reading: Reading): string {
  const verdictJson = reading.verdictJson as {
    narration?: Partial<Record<'en' | 'ur' | 'hi', string>>;
  };
  const narration = verdictJson?.narration;
  if (narration === undefined) {
    return '';
  }
  return narration[reading.questionLang] ?? narration.en ?? '';
}

// ── Hidden Scroll formatter ───────────────────────────────────────────────────

function formatHiddenScroll(
  reading: Reading,
  seekerName: string | null,
  motherName: string | null,
  locationLabel: string | null,
): string {
  const vj = reading.verdictJson as VjExtended | null;
  const oracle = vj?.oracle;

  if (!oracle) {
    return narrationForReading(reading);
  }

  const lines: string[] = [];

  // ── Bismillah ──
  lines.push('بِسْمِ اللَّهِ الرَّحْمٰنِ الرَّحِيمِ');
  lines.push('');

  // ── Personalized scroll header ──
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const city = locationLabel ?? 'your location';

  if (seekerName) {
    if (motherName) {
      lines.push(
        `The Hidden Scroll has been opened in the name of ${seekerName}, born of the prayers of ${motherName}, at ${timeStr} in ${city}.`,
      );
    } else {
      lines.push(
        `The Hidden Scroll has been opened in the name of ${seekerName}, at ${timeStr} in ${city}.`,
      );
    }
  } else {
    lines.push(`The Hidden Scroll has been opened at ${timeStr} in ${city}.`);
  }
  if (vj?.horaryNumber !== undefined) {
    lines.push(`Horary №${vj.horaryNumber}.`);
  }
  lines.push('');

  // ── Disclaimer ──
  lines.push(
    'Know that the unseen belongs to Allah alone. What follows is a symbolic spiritual reflection in the style of Shams al-Asrār, not a claim of certain knowledge or prophecy.',
  );
  lines.push('');

  // ── The Unveiling ──
  lines.push('✧ The Unveiling');
  lines.push('');
  if (oracle.opening) {
    lines.push(oracle.opening);
  }
  if (oracle.interpretation) {
    lines.push('');
    lines.push(oracle.interpretation);
  }
  if (oracle.spiritual_layer) {
    lines.push('');
    lines.push(oracle.spiritual_layer);
  }
  if (oracle.hidden_influence) {
    lines.push('');
    lines.push(oracle.hidden_influence);
  }
  if (oracle.timing) {
    lines.push('');
    lines.push(oracle.timing);
  }

  // ── Spiritual Remedy ──
  const remedy = oracle.remedy;
  if (remedy) {
    lines.push('');
    lines.push('✧ Spiritual Remedy');

    if (remedy.quran_verse) {
      lines.push('');
      lines.push('Allah says:');
      lines.push(`> ${remedy.quran_verse}`);
    }
    if (remedy.dua) {
      lines.push('');
      lines.push('Recite daily:');
      lines.push(`> ${remedy.dua}`);
    }
    if (remedy.asma) {
      lines.push('');
      lines.push('Invoke the Divine Name:');
      lines.push(remedy.asma);
    }
    if (remedy.zikr) {
      lines.push('');
      lines.push(remedy.zikr);
    }
    if (remedy.sadaqah) {
      lines.push('');
      lines.push(remedy.sadaqah);
    }
  }

  // ── Signature ──
  lines.push('');
  lines.push(oracle.signature);

  return lines.join('\n');
}

// ── Engine ────────────────────────────────────────────────────────────────────

/**
 * Cap on the ID-token/App-Check diagnostic probes fired from the send-error
 * handler below. Those are native round-trips (token refresh, Play Integrity/
 * App Attest attestation) that can hang forever on some devices instead of
 * settling — see the withTimeout() call sites for the failure this guards
 * against.
 */
const DIAGNOSTIC_PROBE_TIMEOUT_MS = 8000;

/**
 * WatchState → the sacred-term verdict vocabulary the rest of the app already
 * speaks (History filters, badges, remedy context). The watch engine's own
 * `state` is authoritative; this is a display projection, not a re-judgment.
 */
const WATCH_STATE_TO_VERDICT: Readonly<Record<WatchState, Reading['verdict']>> = Object.freeze({
  FULFILLED: 'YES',
  MOVING: 'YES',
  DELAYED: 'DELAYED',
  BLOCKED: 'NO',
  REVERSING: 'CONDITIONAL',
  UNFORMED: 'UNCLEAR',
});

/**
 * The watch engine reports confidence as a band. Several call sites downstream
 * (remedy severity, the confidence bar) expect a 0–100 number, so the band is
 * projected onto one. Midpoints, not boundaries — this is for display and
 * bucketing only and never feeds back into judgment.
 */
const WATCH_CONFIDENCE_TO_NUMBER: Readonly<Record<string, number>> = Object.freeze({
  VERY_HIGH: 90,
  HIGH: 75,
  MODERATE: 55,
  LOW: 35,
  UNCERTAIN: 15,
});

/**
 * runEngine — RKP Watch is the engine.
 *
 * The KP horary path (askOracle) was retired here: it required a location the
 * watch frame does not need, it produced the verdict while the watch reading
 * was demoted to an optional attachment, and because both callables claim a
 * quota slot, running the pair charged the querent twice for one question.
 *
 * The engine still runs server-side only — no algorithm code ships in the APK.
 */
async function runEngine(args: {
  question: string;
  questionLang: 'en' | 'ur' | 'hi';
  seekerProfile?: 'clarity' | 'comfort' | 'action' | 'surrender';
}): Promise<Reading> {
  const { reading: watch } = await askWatchOracle({
    question: args.question,
    questionLang: args.questionLang,
    seekerProfile: args.seekerProfile,
  });

  const narration = watch.oracle?.narration ?? null;
  const prose = narration
    ? [narration.rkp_finding, narration.interpretation, narration.recommended_approach]
        .filter(s => s.length > 0)
        .join('\n\n')
    : '';

  const confidence = WATCH_CONFIDENCE_TO_NUMBER[watch.verdict.confidence] ?? 50;

  const reading: Reading = {
    id: watch.readingId,
    question: args.question,
    questionLang: args.questionLang,
    category: 'general',
    verdict: WATCH_STATE_TO_VERDICT[watch.verdict.state],
    createdAt: watch.computedAt,
    chartJson: {
      engine: 'rkpWatch',
      localMoment: watch.localMoment,
      window: watch.window,
      lagnaSignName: watch.lagnaSignName,
      lagnaRulerName: watch.lagnaRulerName,
    },
    verdictJson: {
      engine: 'rkpWatch',
      state: watch.verdict.state,
      confidence,
      confidenceBand: watch.verdict.confidence,
      narration: { en: prose, ur: prose, hi: prose },
    },
  };

  if (watch.oracle) {
    reading.watch_oracle = {
      verdict: watch.verdict,
      composition: watch.oracle,
      window: watch.window,
      lagnaSignName: watch.lagnaSignName,
      lagnaRulerName: watch.lagnaRulerName,
    };
  }

  return reading;
}

// ── OracleChatScreen ─────────────────────────────────────────────────────────

const OracleChatScreen: React.FC = () => {
  const { theme } = useTheme();
  const colors = useColors();
  const typography = useTypography();
  const t = useTranslation();
  const { lang } = useI18n();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  // Ask is now a persistent tab, not always a pushed screen — canGoBack() is
  // false when reached by tapping the tab directly, so the back arrow falls
  // back to switching to the Home tab instead of a no-op goBack().
  const tabNavigation = useNavigation<{ navigate: (screen: string) => void }>();

  const lastLocation = useSettingsStore(
    (s: ReturnType<typeof useSettingsStore.getState>) => s.lastLocation,
  );
  const seekerProfile = useSettingsStore(
    (s: ReturnType<typeof useSettingsStore.getState>) => s.seekerProfile,
  );
  const seekerName = useSettingsStore(
    (s: ReturnType<typeof useSettingsStore.getState>) => s.seekerName,
  );
  const motherName = useSettingsStore(
    (s: ReturnType<typeof useSettingsStore.getState>) => s.motherName,
  );

  const addReading = useReadingsStore(
    (s: ReturnType<typeof useReadingsStore.getState>) => s.addReading,
  );
  const readings = useReadingsStore(
    (s: ReturnType<typeof useReadingsStore.getState>) => s.readings,
  );
  const { canAsk, consumeOne, questionsLeft } = useQuota();

  const plan = useQuotaStore(s => s.plan);
  const trialActive = useQuotaStore(s => s.trialActive);
  const trialExpired = useQuotaStore(s => s.trialExpired);
  const questionsToday = useQuotaStore(s => s.questionsToday);
  const startTrial = useQuotaStore(s => s.startTrial);

  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [showNewQuestionModal, setShowNewQuestionModal] = useState(false);
  const [redirectMessage, setRedirectMessage] = useState<'conversational' | 'ambiguous' | null>(
    null,
  );

  // ── Threshold overlay — sacred crossing animation on entering the chat ─────
  const thresholdOpacity = useRef(new Animated.Value(0)).current;
  const thresholdScale = useRef(new Animated.Value(1.1)).current;
  const [thresholdVisible, setThresholdVisible] = useState(true);

  const runThreshold = useCallback(() => {
    setThresholdVisible(true);
    thresholdOpacity.setValue(0);
    thresholdScale.setValue(1.1);
    Animated.sequence([
      Animated.parallel([
        Animated.timing(thresholdOpacity, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(thresholdScale, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(400),
      Animated.timing(thresholdOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setThresholdVisible(false);
    });
  }, [thresholdOpacity, thresholdScale]);

  // Fire on mount — every time the seeker crosses into the chat
  useEffect(() => {
    try {
      runThreshold();
    } catch (err) {
      // The threshold overlay is pure ceremony — a failure here must never take
      // down the screen behind the "veil trembled" boundary. Report and continue.
      crashlytics().recordError(err instanceof Error ? err : new Error(String(err)));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Quota exhaustion timestamp — upgrade CTA appears only after 6 h ─────────
  const quotaExhaustedAt = useRef<number>(0);

  const initialGreeting: ChatMessage = useMemo(
    () => ({
      id: 'greet',
      sender: 'shams',
      text: t('oracle.welcomeMessage'),
      createdAt: new Date().toISOString(),
    }),
    [t],
  );

  const [messages, setMessages] = useState<ChatMessage[]>([initialGreeting]);
  const [input, setInput] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);

  const [stage, setStage] = useState<ConvStage>('ready');
  const [lastReading, setLastReading] = useState<Reading | null>(null);
  const [selectedRemedies, setSelectedRemedies] = useState<RenderedRemedy[]>([]);
  const listRef = useRef<FlatList<ChatMessage> | null>(null);

  // Active chips depend on conversation stage
  const activeChips: readonly string[] =
    stage === 'answered'
      ? (FOLLOWUP_CHIPS[lang] ?? FOLLOWUP_CHIPS.en)
      : (INITIAL_CHIPS[lang] ?? INITIAL_CHIPS.en);

  // "Ruling Planets Now" strip — day lord, hora lord, Moon, Moon's sign lord.
  // Shown only before the first question of this sitting is asked, matching
  // the ritual-chamber framing of the question screen.
  const { horaLord, dayLord } = useTimingStrip(lastLocation?.lon ?? 74.3587);
  const moonSignLord = getSignLordByLongitude(displayLonSidereal('Moon', Date.now()));
  const rulingPlanetsNow = [dayLord, horaLord, 'Moon', moonSignLord] as const;

  // ── Core send logic ─────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text || sendingRef.current) {
        return;
      }
      sendingRef.current = true;

      // Followup path — free, no quota
      if (stage === 'answered' && lastReading !== null) {
        // Cloud Function intent classifier — no API key needed on the client
        const recentMessages = messages.slice(0, 3).map(m => m.text);

        const intent = await classifyIntent({
          userMessage: text,
          lockedQuestion: lastReading.question,
          verdictDirection: lastReading.verdict,
          recentMessages,
        });

        // NEW_QUESTION with HIGH confidence → surface prompt, don't answer
        if (intent.class === 'NEW_QUESTION' && intent.confidence === 'HIGH') {
          setShowNewQuestionModal(true);
          sendingRef.current = false;
          return;
        }

        // All other intents → elaboration with intent-aware routing
        const userMsg: ChatMessage = {
          id: `u_${Date.now()}`,
          sender: 'user',
          text,
          createdAt: new Date().toISOString(),
        };
        setMessages(prev => [userMsg, ...prev]);

        setSending(true);
        await new Promise<void>(resolve => setTimeout(() => resolve(), 700));

        let responseText = '';
        if (intent.class === 'TIMING') {
          responseText = timingResponse(lastReading, lang);
        } else if (intent.class === 'CLARIFY') {
          responseText = whyResponse(lastReading, lang);
        } else if (intent.class === 'REMEDY') {
          responseText = remedyResponse(lastReading, lang);
        } else {
          responseText = elaborationResponse(lastReading, lang);
        }

        const shamsMsg: ChatMessage = {
          id: `s_fu_${Date.now()}`,
          sender: 'shams',
          text: responseText,
          createdAt: new Date().toISOString(),
        };
        setMessages(prev => [shamsMsg, ...prev]);
        setSending(false);
        sendingRef.current = false;
        return;
      }

      // ── Layer 1 — Question Intent Gate (pre-quota) ─────────────────────────
      // Runs before consumeOne(). CONVERSATIONAL and AMBIGUOUS return early with
      // a soft inline redirect — no quota burn, no modal, no error state.
      // API failure always defaults to VALID_HORARY so real questions are never blocked.
      const questionClass = await classifyQuestion(text);
      if (questionClass === 'CONVERSATIONAL') {
        setRedirectMessage('conversational');
        sendingRef.current = false;
        return;
      }
      if (questionClass === 'AMBIGUOUS') {
        setRedirectMessage('ambiguous');
        sendingRef.current = false;
        return;
      }
      // VALID_HORARY falls through — clear any previous redirect
      setRedirectMessage(null);

      // ── Engine path — paywall gate ──────────────────────────────────────────
      if (plan === 'free') {
        if (trialExpired) {
          navigation.navigate('Premium');
          sendingRef.current = false;
          return;
        }
        if (!trialActive) {
          startTrial();
        }
        if (questionsToday >= (trialActive ? TRIAL_DAILY_LIMIT : FREE_DAILY_LIMIT)) {
          if (quotaExhaustedAt.current === 0) {
            quotaExhaustedAt.current = Date.now();
          }
          setShowQuotaModal(true);
          sendingRef.current = false;
          return;
        }
      }

      const now = new Date().toISOString();

      // ── Opportunistic location — NEVER blocks a reading ────────────────────
      // The RKP Watch frame is location-invariant: the 5-minute bracket and the
      // planetary positions it judges are the same wherever the querent stands,
      // which is what lets a reading run the moment the app opens. Only the
      // ambient surfaces (hora strip, sky clock, and the location label on the
      // scroll) want coordinates.
      //
      // This used to be a hard gate that returned "location required" and threw
      // the question away. That dead-end belonged to the retired KP engine,
      // which needed cusps and therefore a place. Keep the fix attempt, drop
      // the block.
      if (lastLocation?.lat === undefined || lastLocation?.lon === undefined) {
        const liveCoords = await acquireLocation();
        if (liveCoords !== null) {
          useSettingsStore.getState().setLastLocation({
            lat: liveCoords.lat,
            lon: liveCoords.lon,
            label: null,
            capturedAt: Date.now(),
          });
        }
      }

      if (!consumeOne()) {
        if (quotaExhaustedAt.current === 0) {
          quotaExhaustedAt.current = Date.now();
        }
        setShowQuotaModal(true);
        sendingRef.current = false;
        return;
      }

      const userMsg: ChatMessage = {
        id: `u_${now}`,
        sender: 'user',
        text,
        createdAt: now,
      };
      setMessages(prev => [userMsg, ...prev]);
      setSending(true);

      // ── 60-second dedup guard — same question within one minute returns cache ──
      const minuteBucket = Math.floor(Date.now() / 60000);
      const dedupKey = `${text.trim().toLowerCase()}_${minuteBucket}`;
      const cachedReading = readings.find(r => {
        const rBucket = Math.floor(new Date(r.createdAt).getTime() / 60000);
        return `${r.question.trim().toLowerCase()}_${rBucket}` === dedupKey;
      });
      if (cachedReading) {
        setLastReading(cachedReading);
        setStage('answered');
        setMessages(prev => [
          {
            id: `s_cached_${Date.now()}`,
            sender: 'shams',
            text:
              formatHiddenScroll(
                cachedReading,
                seekerName,
                motherName,
                lastLocation?.label ?? null,
              ) ||
              narrationForReading(cachedReading) ||
              t('errors.unknown'),
            reading: cachedReading,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
        setSending(false);
        sendingRef.current = false;
        return;
      }

      try {
        const reading = await runEngine({
          question: text,
          questionLang: lang,
          seekerProfile: seekerProfile ?? undefined,
        });

        await addReading(reading);
        setLastReading(reading);
        setStage('answered');

        // Phase 3 — library-backed remedy selection. Fire-and-forget: never
        // awaited, never blocks render, selectionReason logged to Firestore by CF.
        {
          const vj = reading.verdictJson as { confidence?: number } | null;
          const confidence = vj?.confidence ?? 0;
          const severity: 'low' | 'moderate' | 'high' =
            confidence >= 70 ? 'low' : confidence >= 40 ? 'moderate' : 'high';
          const selCtx = contextFromReading({
            readingId: reading.id,
            verdict: reading.verdict,
            category: reading.category ?? 'general',
            severity,
            oracleSummary: narrationForReading(reading)?.slice(0, 200) ?? '',
            questionText: text,
            seekerProfile,
          });
          selectRemedies(selCtx)
            .then(result => setSelectedRemedies(result.selectedRemedies))
            .catch(() => undefined);
        }

        const shamsMsg: ChatMessage = {
          id: `s_${reading.id}`,
          sender: 'shams',
          text:
            formatHiddenScroll(reading, seekerName, motherName, lastLocation?.label ?? null) ||
            narrationForReading(reading) ||
            t('errors.unknown'),
          reading,
          createdAt: new Date().toISOString(),
        };
        setMessages(prev => [shamsMsg, ...prev]);
      } catch (err) {
        console.error('[OracleChatScreen] Engine error:', err);

        // consumeOne() already charged this attempt against the LOCAL quota
        // counter before the network call was made — this is a separate,
        // device-only tally from the server's own Firestore ledger (which
        // the Cloud Function refunds on its side for the same reason). No
        // reading came back, so give the local slot back too; otherwise a
        // string of failed attempts permanently exhausts the badge shown
        // here even once the server-side count is healthy again.
        useQuotaStore.getState().refundOne();

        let errText =
          'The scrolls of this moment have not opened their seal. Return at the next appointed hour.';

        // Firebase callable errors carry the real signal in `.code` — a
        // stable FunctionsErrorCode like 'resource-exhausted' or
        // 'unauthenticated' — never in `.message`, which is just the
        // developer-authored human text and never contains the code name.
        // Checking `.message` for those code strings (as this used to) only
        // ever matched the quota case, and only by coincidence: its message
        // happens to contain the word "quota". Every other real failure —
        // auth, rate limits, App Check, network — silently fell through to
        // the generic fallback below, which is what QA was seeing.
        const code =
          typeof err === 'object' && err !== null && 'code' in err
            ? String((err as { code: unknown }).code)
            : '';
        const message = err instanceof Error ? err.message.toLowerCase() : '';

        // DIAGNOSTIC — Cloud Functions' callable SDK rejects with the SAME
        // 'unauthenticated' code whether the ID token is missing/expired OR
        // the App Check token failed validation (askWatchOracle runs with
        // enforceAppCheck: true). The client cannot tell those apart from
        // `err.code` alone, and this ambiguity is exactly what was routing
        // real App Check/Play-Integrity failures into the "please sign in"
        // branch below even for signed-in users. Probe both token sources
        // independently right here, at the moment of failure — synchronously,
        // so the result can ride along in the SAME bubble the seeker already
        // knows to screenshot, instead of waiting on Crashlytics console
        // propagation. TEMPORARY: remove this whole block plus the debugSuffix
        // once App Check is confirmed healthy in production.
        let debugSuffix = '';
        // Set once the diagnostic below actually runs, so the branches after
        // it can trust the *measured* App Check state instead of re-deriving
        // it from the raw rejection message (see note below on why that
        // re-derivation never worked).
        let diagnosedAppCheckFailed = false;
        let diagnosedSignedIn = false;
        if (code === 'unauthenticated' || code === 'permission-denied') {
          // Both probes below are native module round-trips (ID token refresh,
          // Play Integrity/App Attest attestation) that can hang indefinitely
          // on some devices instead of ever resolving or rejecting. This whole
          // diagnostic sits inside the outer catch, ahead of the `finally`
          // that resets sendingRef.current — an unbounded await here means the
          // finally never runs and the Send button stays dead for the rest of
          // the sitting. Each is bounded so this block always settles — and
          // both are started before either is awaited, so the two 8s
          // timeouts run concurrently (worst case ~8s total) rather than
          // stacking into a ~16s wait if a device manages to hang on both.
          const idTokenPromise = auth()
            .currentUser?.getIdToken(true)
            .then(tok => (tok ? `ok(len=${tok.length})` : 'empty'))
            .catch(e => `FAILED: ${e instanceof Error ? e.message : String(e)}`);
          const idTokenStatusPromise =
            idTokenPromise === undefined
              ? Promise.resolve('no-current-user')
              : withTimeout(idTokenPromise, DIAGNOSTIC_PROBE_TIMEOUT_MS).then(v => v ?? 'TIMEOUT');
          // getAppCheckToken() no longer throws — it returns a typed result
          // so the real rejection reason (Play Integrity/attestation error,
          // etc.) reaches this bubble instead of collapsing into
          // "empty/undefined" the way it used to.
          const appCheckResultPromise = withTimeout(
            getAppCheckToken(true),
            DIAGNOSTIC_PROBE_TIMEOUT_MS,
          );

          const [idTokenStatus, appCheckResult] = await Promise.all([
            idTokenStatusPromise,
            appCheckResultPromise,
          ]);
          const appCheckStatus =
            appCheckResult === undefined
              ? 'TIMEOUT'
              : appCheckResult.ok
                ? `ok(len=${appCheckResult.token.length})`
                : `FAILED: ${appCheckResult.error}`;
          diagnosedSignedIn = auth().currentUser !== null;
          diagnosedAppCheckFailed = appCheckResult === undefined || !appCheckResult.ok;
          debugSuffix =
            `\n\n[debug] signedIn=${diagnosedSignedIn} ` +
            `idToken=${idTokenStatus} appCheck=${appCheckStatus}`;
          crashlytics().log(
            `[askWatchOracle unauthenticated] code=${code} message=${message} ${debugSuffix}`,
          );
          crashlytics().recordError(
            new Error(`askWatchOracle rejected: code=${code}${debugSuffix}`),
          );
        }

        if (code === 'resource-exhausted') {
          errText = message.includes('too many requests')
            ? 'The oracle needs a moment of quiet. Please wait briefly and ask again.'
            : 'The gate has closed for today. The oracle speaks three times a day to the free seeker.';
        } else if (
          message.includes('app-check') ||
          message.includes('app check') ||
          // The callable SDK collapses "missing/invalid App Check token" into
          // the SAME generic 'unauthenticated' rejection as "not signed in",
          // and its message text never actually contains "app-check" — so
          // that string check above never fired in practice. The synchronous
          // probe above just measured the real cause directly: trust it. A
          // signed-in user (valid idToken) hitting 'unauthenticated' with a
          // failed App Check probe is an App Check failure, not a sign-in
          // problem — telling them to "sign in" here was actively wrong and
          // unactionable, since they already are.
          (diagnosedSignedIn && diagnosedAppCheckFailed)
        ) {
          errText = 'The seal of verification is absent. Please reinstall and try again.';
        } else if (code === 'unauthenticated' || code === 'permission-denied') {
          errText = 'The oracle requires a known face. Please sign in to continue.';
        } else if (
          code === 'unavailable' ||
          code === 'deadline-exceeded' ||
          message.includes('network') ||
          message.includes('econnrefused')
        ) {
          errText =
            'The channel to the oracle is interrupted. Check your connection and try again.';
        }

        setMessages(prev => [
          {
            id: `s_err_${now}`,
            sender: 'shams',
            text: errText + debugSuffix,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
      } finally {
        setSending(false);
        sendingRef.current = false;
      }
    },
    [
      addReading,
      consumeOne,
      lang,
      lastLocation,
      lastReading,
      messages,
      motherName,
      navigation,
      plan,
      questionsToday,
      readings,
      seekerName,
      seekerProfile,
      stage,
      startTrial,
      t,
      trialActive,
      trialExpired,
    ],
  );

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) {
      return;
    }
    setInput('');
    await sendMessage(trimmed);
  }, [input, sending, sendMessage]);

  const handleChipPress = useCallback(
    (chip: string) => {
      sendMessage(chip);
    },
    [sendMessage],
  );

  const renderItem = useCallback(
    ({ item }: { item: ChatMessage }) => (
      <Bubble
        message={item}
        currentReadingId={lastReading?.id}
        selectedRemedies={selectedRemedies}
      />
    ),
    [lastReading?.id, selectedRemedies],
  );

  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.bg }]} edges={['top']}>
      {/* Threshold overlay — sacred crossing on chat entry and new question */}
      {thresholdVisible && (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              zIndex: 100,
              backgroundColor: theme.colors.bg,
              opacity: thresholdOpacity,
              transform: [{ scale: thresholdScale }],
              justifyContent: 'center',
              alignItems: 'center',
            },
          ]}
        >
          <Text
            style={{
              fontFamily: 'Amiri-Regular',
              fontSize: 32,
              color: colors.goldBright,
              letterSpacing: 2,
              marginBottom: 16,
            }}
          >
            {'بِسْمِ اللَّهِ'}
          </Text>
          <View
            style={{
              width: 1,
              height: 48,
              backgroundColor: colors.borderAccent,
              opacity: 0.6,
            }}
          />
          <Text
            style={[
              typography('caption'),
              {
                color: colors.textFaint,
                letterSpacing: 3,
                marginTop: 14,
                textTransform: 'uppercase',
                fontSize: 9,
              },
            ]}
          >
            {'The oracle awaits'}
          </Text>
        </Animated.View>
      )}

      {/* Animated starfield */}
      <StarfieldBackground starColor={colors.starfield} />

      {/* Header — back button + brand + live quota */}
      <View
        style={[styles.header, { borderColor: colors.border, backgroundColor: colors.surface }]}
      >
        <Pressable
          onPress={() =>
            navigation.canGoBack() ? navigation.goBack() : tabNavigation.navigate('Home')
          }
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={[typography('label'), { color: colors.accent, fontSize: 20 }]}>‹</Text>
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text
            style={[
              typography('caption'),
              { color: colors.goldBright, letterSpacing: 1.5, fontSize: 10, lineHeight: 12 },
            ]}
          >
            ORACLE
          </Text>
          <Text
            style={[
              typography('subheading'),
              { color: colors.text, marginTop: 1, fontSize: 15, lineHeight: 18 },
            ]}
          >
            SHAMS AL-ASRĀR
          </Text>
        </View>
        {questionsLeft !== Infinity && (
          <View
            style={[
              styles.quotaBadge,
              { borderColor: questionsLeft === 0 ? colors.negative : colors.borderAccent },
            ]}
          >
            <Text
              style={[
                typography('caption'),
                {
                  color: questionsLeft === 0 ? colors.negative : colors.textMuted,
                },
              ]}
            >
              {questionsLeft}/{trialActive ? TRIAL_DAILY_LIMIT : FREE_DAILY_LIMIT}
            </Text>
          </View>
        )}
      </View>

      {/* Ask Your Question — a slim single-line info strip, not a card. Shown
          before the first ask only; kept out of the way of the chat area
          below (which needs the room). */}
      {stage === 'ready' && (
        <View
          style={[
            styles.rulingPlanetsCard,
            { backgroundColor: colors.surface, borderColor: colors.borderAccent + '33' },
          ]}
        >
          <Text style={[typography('label'), { color: colors.text, fontSize: 13 }]}>
            {t('oracle.askQuestionTitle')}
          </Text>
          <View style={styles.rulingPlanetsRow}>
            {rulingPlanetsNow.map((planet, idx) => (
              <Text key={`${planet}-${idx}`} style={{ color: colors.accent, fontSize: 16 }}>
                {PLANET_GLYPHS[planet as keyof typeof PLANET_GLYPHS] ?? '✦'}
              </Text>
            ))}
          </View>
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <FlatList
          ref={listRef}
          style={styles.flex}
          data={messages}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          inverted
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />

        {/* Input area */}
        <View
          style={[
            styles.inputArea,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {/* Chips row */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsContent}
            style={styles.chipsRow}
            keyboardShouldPersistTaps="handled"
          >
            {activeChips.map(chip => (
              <Pressable
                key={chip}
                onPress={() => handleChipPress(chip)}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    backgroundColor: pressed ? colors.borderAccent + '22' : colors.bg,
                    borderColor: colors.border,
                  },
                ]}
                accessibilityRole="button"
              >
                <Text style={[typography('caption'), { color: colors.textMuted }]}>{chip}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Layer 1 gate redirect — inline, no quota burn */}
          {redirectMessage !== null && (
            <Text
              style={[
                typography('bodyItalic'),
                {
                  color: colors.goldBright,
                  fontSize: 12,
                  lineHeight: 18,
                  textAlign: 'center',
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  opacity: 0.85,
                },
              ]}
            >
              {redirectMessage === 'conversational'
                ? 'The oracle awaits a sincere question. What weighs on your heart?'
                : 'The stars hear your intent — but need more. Who or what does your question concern?'}
            </Text>
          )}

          {/* Composer */}
          <View style={styles.composer}>
            <TextInput
              testID="oracle-input"
              value={input}
              onChangeText={v => {
                setInput(v);
                if (redirectMessage !== null) {
                  setRedirectMessage(null);
                }
              }}
              placeholder={t('oracle.placeholder')}
              placeholderTextColor={colors.textFaint}
              style={[
                styles.composerInput,
                typography('body'),
                {
                  color: colors.text,
                  borderColor: inputFocused ? colors.borderAccent : colors.border,
                  borderWidth: inputFocused ? 1 : StyleSheet.hairlineWidth,
                },
              ]}
              multiline
              editable={!sending}
              returnKeyType="send"
              blurOnSubmit
              onSubmitEditing={handleSend}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              underlineColorAndroid="transparent"
            />
            <Pressable
              testID="oracle-send-btn"
              onPress={handleSend}
              disabled={sending || input.trim().length === 0 || !canAsk}
              style={({ pressed }: { pressed: boolean }) => [
                styles.sendBtn,
                {
                  backgroundColor:
                    input.trim().length === 0 || !canAsk ? colors.surfaceElevated : colors.primary,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('oracle.sendButton')}
            >
              {sending ? (
                <ActivityIndicator color={colors.textOnPrimary} />
              ) : (
                <Text
                  style={[
                    typography('button'),
                    { color: colors.textOnPrimary, textAlign: 'center' },
                  ]}
                >
                  {stage === 'ready' ? t('oracle.sealAskCta') : t('oracle.sendButton')}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      {sending && <CastingAstrolabe />}

      {/* Quota modal — spiritual rest, no immediate paywall */}
      <Modal
        transparent
        animationType="fade"
        visible={showQuotaModal}
        onRequestClose={() => setShowQuotaModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.surface, borderColor: colors.borderAccent },
            ]}
          >
            <Text
              style={[
                typography('caption'),
                {
                  color: colors.goldBright,
                  textAlign: 'center',
                  letterSpacing: 1.6,
                  marginBottom: 6,
                },
              ]}
            >
              الأفلاك ترتاح
            </Text>
            <Text
              style={[
                typography('subheading'),
                { color: colors.text, textAlign: 'center', marginBottom: 10 },
              ]}
            >
              The oracle rests
            </Text>
            <Text
              style={[
                typography('bodyItalic'),
                { color: colors.textMuted, textAlign: 'center', marginBottom: 24, lineHeight: 22 },
              ]}
            >
              {
                'The heavens have answered as many questions as the day allows. Return at Fajr — the stars remember.'
              }
            </Text>
            <Pressable
              testID="quota-modal-dismiss"
              onPress={() => setShowQuotaModal(false)}
              style={[
                styles.modalBtn,
                {
                  borderColor: colors.borderAccent,
                  borderWidth: StyleSheet.hairlineWidth,
                  marginBottom: 12,
                },
              ]}
              accessibilityRole="button"
            >
              <Text style={[typography('button'), { color: colors.text }]}>I understand</Text>
            </Pressable>
            {/* Upgrade link — shown only after 6 hours of exhaustion, never immediately */}
            {quotaExhaustedAt.current > 0 &&
              Date.now() - quotaExhaustedAt.current > 6 * 3600 * 1000 && (
                <Pressable
                  onPress={() => {
                    setShowQuotaModal(false);
                    navigation.navigate('Premium');
                  }}
                  accessibilityRole="button"
                >
                  <Text
                    style={[
                      typography('caption'),
                      {
                        color: colors.textFaint,
                        textAlign: 'center',
                        textDecorationLine: 'underline',
                      },
                    ]}
                  >
                    Unlock unlimited access
                  </Text>
                </Pressable>
              )}
          </View>
        </View>
      </Modal>

      {/* New question modal — verdict integrity protection */}
      <Modal
        transparent
        animationType="fade"
        visible={showNewQuestionModal}
        onRequestClose={() => setShowNewQuestionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[typography('subheading'), { color: colors.text, marginBottom: 8 }]}>
              {'New question detected'}
            </Text>
            <Text style={[typography('body'), { color: colors.textMuted, marginBottom: 24 }]}>
              {
                'This sounds like a new horary question. Each question needs its own chart for an accurate verdict.'
              }
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setShowNewQuestionModal(false)}
                style={[
                  styles.modalBtn,
                  { borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth },
                ]}
                accessibilityRole="button"
              >
                <Text style={[typography('button'), { color: colors.text }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowNewQuestionModal(false);
                  setStage('ready');
                  setLastReading(null);
                  setSelectedRemedies([]);
                  runThreshold();
                }}
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                accessibilityRole="button"
              >
                <Text style={[typography('button'), { color: colors.textOnPrimary }]}>
                  Ask New Question
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// ── Bubble ────────────────────────────────────────────────────────────────────

const Bubble: React.FC<{
  message: ChatMessage;
  currentReadingId?: string;
  selectedRemedies?: RenderedRemedy[];
}> = ({ message, currentReadingId, selectedRemedies }) => {
  const colors = useColors();
  const typography = useTypography();
  const t = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isUser = message.sender === 'user';

  const accentColor = isUser ? colors.chatUserBorder : colors.chatShamsBorder;
  const bubbleBg = isUser ? colors.chatUserBg : colors.chatShamsBg;

  // Render the Hidden Scroll format with Bismillah, ✧ headers, blockquotes, bold
  const renderText = (raw: string) => {
    const paragraphs = raw.split('\n');
    return (
      <View>
        {paragraphs.map((line, idx) => {
          // Empty line → small spacer
          if (line === '') {
            return <View key={idx} style={{ height: 8 }} />;
          }

          // Bismillah line — large gold Arabic
          if (line.startsWith('بِسْمِ')) {
            return (
              <Text
                key={idx}
                style={{
                  fontFamily: 'Amiri-Regular',
                  fontSize: 22,
                  color: accentColor,
                  textAlign: 'center',
                  lineHeight: 32,
                  marginBottom: 4,
                }}
              >
                {line}
              </Text>
            );
          }

          // Section header (✧ The Unveiling / ✧ Spiritual Remedy)
          if (line.startsWith('✧')) {
            return (
              <View
                key={idx}
                style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 10 }}
              >
                <View
                  style={{
                    flex: 1,
                    height: StyleSheet.hairlineWidth,
                    backgroundColor: accentColor,
                    opacity: 0.35,
                  }}
                />
                <Text
                  style={[
                    typography('label'),
                    {
                      color: accentColor,
                      marginHorizontal: 10,
                      letterSpacing: 1.2,
                      fontSize: 11,
                    },
                  ]}
                >
                  {line}
                </Text>
                <View
                  style={{
                    flex: 1,
                    height: StyleSheet.hairlineWidth,
                    backgroundColor: accentColor,
                    opacity: 0.35,
                  }}
                />
              </View>
            );
          }

          // Blockquote (> text)
          if (line.startsWith('> ')) {
            return (
              <View
                key={idx}
                style={{
                  borderLeftWidth: 2,
                  borderLeftColor: accentColor + '70',
                  paddingLeft: 12,
                  marginVertical: 4,
                }}
              >
                <Text
                  style={[
                    typography('body'),
                    { color: colors.textMuted, lineHeight: 22, fontStyle: 'italic' },
                  ]}
                >
                  {line.slice(2)}
                </Text>
              </View>
            );
          }

          // "Allah says:" / "Recite daily:" / "Invoke the Divine Name:" — small gold label
          if (
            line === 'Allah says:' ||
            line === 'Recite daily:' ||
            line === 'Invoke the Divine Name:'
          ) {
            return (
              <Text
                key={idx}
                style={[
                  typography('caption'),
                  { color: accentColor, letterSpacing: 0.8, marginTop: 4, marginBottom: 2 },
                ]}
              >
                {line}
              </Text>
            );
          }

          // Regular paragraph with **bold** support
          const parts = line.split(/(\*\*[^*]+\*\*)/g);
          return (
            <Text key={idx} style={[typography('body'), { color: colors.text, lineHeight: 22 }]}>
              {parts.map((part, i) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                  return (
                    <Text key={i} style={{ fontWeight: '700', color: colors.accent }}>
                      {part.slice(2, -2)}
                    </Text>
                  );
                }
                return <Text key={i}>{part}</Text>;
              })}
            </Text>
          );
        })}
      </View>
    );
  };

  return (
    <View style={[bubbleStyles.bubbleRow, { justifyContent: isUser ? 'flex-end' : 'flex-start' }]}>
      <View
        style={[
          bubbleStyles.bubble,
          {
            backgroundColor: bubbleBg,
            borderLeftWidth: isUser ? 0 : 3,
            borderRightWidth: isUser ? 3 : 0,
            borderLeftColor: accentColor,
            borderRightColor: accentColor,
            borderColor: colors.border,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderBottomWidth: StyleSheet.hairlineWidth,
          },
        ]}
      >
        {renderText(message.text)}
        {message.reading !== undefined && (
          <>
            {/* RKP Watch is the engine, so its card is the reading.
                AstroVerdictCard is retained ONLY to render KP readings taken
                before the engine changed — those are already in History and in
                MMKV, and must not become unreadable. New readings always carry
                watch_oracle and never reach that branch. */}
            {message.reading.watch_oracle ? (
              <View>
                <RkpWatchCard
                  window={message.reading.watch_oracle.window}
                  lagnaSignName={message.reading.watch_oracle.lagnaSignName}
                  lagnaRulerName={message.reading.watch_oracle.lagnaRulerName}
                  verdict={message.reading.watch_oracle.verdict}
                />
                <RemedyProtocolCard composition={message.reading.watch_oracle.composition} />
              </View>
            ) : (
              // Legacy KP reading (pre-engine-change). Read-only history.
              <AstroVerdictCard
                result={readingToAstroResult(message.reading)}
                selectedRemedies={
                  message.reading.id === currentReadingId ? selectedRemedies : undefined
                }
              />
            )}
          </>
        )}
        {message.isUpgradeCta === true && (
          <Pressable
            onPress={() => navigation.navigate('Premium')}
            style={({ pressed }) => [
              bubbleStyles.upgradeBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('oracle.upgradeCta')}
          >
            <Text style={[typography('button'), { color: colors.textOnPrimary }]}>
              {t('oracle.upgradeCta')}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  backBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  headerTitleWrap: {
    flex: 1,
  },
  quotaBadge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: '#FFFFFF0F',
  },
  rulingPlanetsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 2,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rulingPlanetsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  // Input area
  inputArea: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 6,
  },
  chipsRow: {
    marginBottom: 4,
  },
  chipsContent: {
    gap: 6,
    paddingRight: 4,
  },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#FFFFFF08',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  composerInput: {
    flex: 1,
    minWidth: 80,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: '#FFFFFF06',
  },
  sendBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    minHeight: 40,
    minWidth: 64,
    // Long CTA copy ("Seal & Ask the Oracle" and its Urdu/Hindi equivalents)
    // has no flex — without a cap it grows to fit the label on one line and
    // starves the flex:1 composerInput next to it down to an unreadable
    // sliver. Cap it so the label wraps onto 2 lines instead.
    maxWidth: '45%',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  modalCard: {
    borderRadius: 16,
    padding: 24,
    borderWidth: StyleSheet.hairlineWidth,
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
});

const bubbleStyles = StyleSheet.create({
  bubbleRow: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  bubble: {
    maxWidth: '85%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  upgradeBtn: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
});

export default OracleChatScreen;
