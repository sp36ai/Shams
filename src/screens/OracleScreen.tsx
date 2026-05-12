/**
 * OracleScreen — primary RKP question surface.
 *
 * New in this version:
 *   - Context-sensitive quick-reply chips (initial / followup sets)
 *   - Followup conversation handler (timing / why / remedy / new question)
 *   - Enhanced VerdictCard: timing window, remedy, chart data strip
 *   - Animated StarfieldBackground
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { askOracle as callOracleFunction } from '../firebase/oracle';
import StarfieldBackground from '@components/StarfieldBackground';
import AstroVerdictCard from '../components/oracle/AstroVerdictCard';
import WatchVerdictCard from '../components/oracle/WatchVerdictCard';
import type { AstroVerdictResult } from '../types/verdict';

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
  mantra?: string;
  charity?: string;
}

interface VjShape {
  confidence?: number;
  timing?: VjTiming;
  remedy?: VjRemedy;
  moonSubLord?: { planet?: string; occupiedHouse?: number };
  rulingPlanets?: { dayLord?: string; horaLord?: string; minuteLord?: string };
}

function asVj(raw: unknown): VjShape | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  return raw as VjShape;
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
  planetDegrees?: Record<string, number>;
  cuspDegrees?: Record<number, number>;
  cuspSigns?: Record<number, string>;
  planetChain?: Record<string, { nakshatraLord: string; subLord: string; subSubLord: string }>;
  oracle?: {
    opening: string;
    interpretation: string;
    spiritual_layer: string;
    hidden_influence: string;
    timing: string;
    warning?: string;
    remedy: {
      quran_verse?: string;
      translation?: string;
      name_of_allah?: string;
      dua?: string;
      zikr?: string;
      charity?: string;
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
          mantra: vj.remedy.mantra,
          charity: vj.remedy.charity,
        }
      : undefined,
    narrative,
    createdAt: reading.createdAt,
    category: reading.category,
    significators: vj?.significators,
    confirmedSignificators: vj?.confirmedSignificators,
    deniedSignificators: vj?.deniedSignificators,
    planetDegrees: vj?.planetDegrees,
    cuspDegrees: vj?.cuspDegrees,
    cuspSigns: vj?.cuspSigns,
    planetChain: vj?.planetChain,
    oracle: vj?.oracle,
  };
}

// ── Chips per language ────────────────────────────────────────────────────────

const INITIAL_CHIPS: Record<'en' | 'ur' | 'hi', readonly string[]> = {
  en: [
    'Will I succeed?',
    'Career & livelihood',
    'Marriage & love',
    'Finance',
    'Health',
    'Travel',
    'Legal matter',
    'Lost item',
  ],
  ur: [
    'کیا میں کامیاب ہوں گا؟',
    'نوکری اور روزگار',
    'شادی اور رشتہ',
    'مالی معاملہ',
    'صحت',
    'سفر',
    'قانونی تنازع',
    'گمشدہ چیز',
  ],
  hi: [
    'क्या मैं सफल होऊंगा?',
    'करियर',
    'विवाह और प्रेम',
    'वित्त',
    'स्वास्थ्य',
    'यात्रा',
    'कानूनी मामला',
    'खोई वस्तु',
  ],
};

const FOLLOWUP_CHIPS: Record<'en' | 'ur' | 'hi', readonly string[]> = {
  en: ['When will it happen?', 'Why this verdict?', 'What remedy?', 'New question'],
  ur: ['کب ہوگا؟', 'یہ فیصلہ کیوں؟', 'علاج کیا ہے؟', 'نیا سوال'],
  hi: ['कब होगा?', 'यह निर्णय क्यों?', 'उपाय क्या है?', 'नया सवाल'],
};

// ── Followup intent detection ─────────────────────────────────────────────────

type FollowupIntent = 'timing' | 'why' | 'remedy' | 'new' | 'none';

function detectIntent(text: string): FollowupIntent {
  const q = text.toLowerCase();
  if (
    q.includes('new') ||
    q.includes('نیا') ||
    q.includes('नया') ||
    q.includes('another') ||
    q.includes('again')
  ) {
    return 'new';
  }
  if (
    q.includes('when') ||
    q.includes('timing') ||
    q.includes('how long') ||
    q.includes('کب') ||
    q.includes('وقت') ||
    q.includes('कब') ||
    q.includes('समय')
  ) {
    return 'timing';
  }
  if (
    q.includes('why') ||
    q.includes('reason') ||
    q.includes('کیوں') ||
    q.includes('क्यों') ||
    q.includes('because')
  ) {
    return 'why';
  }
  if (
    q.includes('remedy') ||
    q.includes('علاج') ||
    q.includes('उपाय') ||
    q.includes('mantra') ||
    q.includes('what should') ||
    q.includes('what to do')
  ) {
    return 'remedy';
  }
  return 'none';
}

// ── Followup response builders ────────────────────────────────────────────────

function timingResponse(reading: Reading, lang: 'en' | 'ur' | 'hi'): string {
  const vj = asVj(reading.verdictJson);
  const t = vj?.timing;
  if (!t) {
    return 'The timing data is not available for this reading.';
  }
  const max = t.range?.max ?? 1;
  const win = t.window ?? 'weeks';
  const md = t.activeDasha ?? '—';
  const ad = t.activeAntardasha ?? '—';
  const winLabel: Record<string, Record<'en' | 'ur' | 'hi', string>> = {
    days: { en: 'days', ur: 'دن', hi: 'दिन' },
    weeks: { en: 'weeks', ur: 'ہفتے', hi: 'सप्ताह' },
    months: { en: 'months', ur: 'مہینے', hi: 'महीने' },
    years: { en: 'years', ur: 'سال', hi: 'वर्ष' },
  };
  const wl = winLabel[win]?.[lang] ?? win;
  if (lang === 'ur') {
    return `حرکت **${max} ${wl}** کے اندر متوقع ہے۔\n\nفعال مہادشا: **${md}** · انتردشا: **${ad}**\n\nستارے وقت کی کھڑکیاں دیتے ہیں، تقرریاں نہیں۔`;
  }
  if (lang === 'hi') {
    return `**${max} ${wl}** के भीतर प्रगति अपेक्षित है।\n\nसक्रिय महादशा: **${md}** · अंतर्दशा: **${ad}**\n\nतारे खिड़कियाँ देते हैं, नियुक्तियाँ नहीं।`;
  }
  return `Movement is expected within **${max} ${wl}**.\n\nActive Mahādashā: **${md}** · Antardashā: **${ad}**\n\nThe stars offer windows, not appointments.`;
}

function whyResponse(reading: Reading, lang: 'en' | 'ur' | 'hi'): string {
  const vj = asVj(reading.verdictJson);
  const msl = vj?.moonSubLord;
  const planet = msl?.planet ?? '—';
  const house = msl?.occupiedHouse ?? '—';
  const conf = vj?.confidence ?? 0;
  if (lang === 'ur') {
    return `فیصلہ **چاند کے ذیلی مالک ${planet}** پر منحصر ہے جو گھر **${house}** میں ہے۔\n\nیقین: **${conf}%** · RKP کا پانچ مرحلہ الگورتھم استعمال کیا گیا۔`;
  }
  if (lang === 'hi') {
    return `यह निर्णय **चंद्र के उप-स्वामी ${planet}** पर निर्भर है जो घर **${house}** में स्थित है।\n\nविश्वास: **${conf}%** · RKP पांच-चरण एल्गोरिदम।`;
  }
  return `The verdict rests on **Moon's Sub-Lord ${planet}**, which occupies house **${house}**.\n\nConfidence: **${conf}%** — derived from the RKP 5-step algorithm.`;
}

function remedyResponse(reading: Reading, lang: 'en' | 'ur' | 'hi'): string {
  const vj = asVj(reading.verdictJson);
  const r = vj?.remedy;
  if (!r) {
    return lang === 'ur'
      ? 'اس پڑھائی کے لیے کوئی مخصوص علاج نہیں ملا۔'
      : lang === 'hi'
        ? 'इस पठन के लिए कोई विशिष्ट उपाय नहीं मिला।'
        : 'No specific remedy found for this reading.';
  }
  const lines: string[] = [];
  if (r.action) {
    lines.push(`• ${r.action}`);
  }
  if (r.avoid) {
    lines.push(
      lang === 'ur'
        ? `• پرہیز: ${r.avoid}`
        : lang === 'hi'
          ? `• परहेज: ${r.avoid}`
          : `• Avoid: ${r.avoid}`,
    );
  }
  if (r.mantra) {
    lines.push(
      lang === 'ur'
        ? `• منتر: *${r.mantra}*`
        : lang === 'hi'
          ? `• मंत्र: *${r.mantra}*`
          : `• Mantra: *${r.mantra}*`,
    );
  }
  if (r.charity) {
    lines.push(
      lang === 'ur'
        ? `• دان: ${r.charity}`
        : lang === 'hi'
          ? `• दान: ${r.charity}`
          : `• Charity: ${r.charity}`,
    );
  }
  const header =
    lang === 'ur'
      ? `**${r.planet ?? ''}** کے لیے علاج:`
      : lang === 'hi'
        ? `**${r.planet ?? ''}** के लिए उपाय:`
        : `Remedy for **${r.planet ?? ''}**:`;
  return `${header}\n\n${lines.join('\n')}`;
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

// ── Engine ────────────────────────────────────────────────────────────────────

async function runEngine(args: {
  question: string;
  questionLang: 'en' | 'ur' | 'hi';
  lat: number | null;
  lon: number | null;
  locationRequiredText: string;
}): Promise<Reading> {
  const now = new Date().toISOString();

  if (args.lat === null || args.lon === null) {
    return {
      id: `r_${now}`,
      question: args.question,
      questionLang: args.questionLang,
      category: 'general',
      verdict: 'UNCLEAR',
      createdAt: now,
      chartJson: { phase: 'no-location', moment: now },
      verdictJson: {
        verdict: 'UNCLEAR',
        confidence: 0,
        reasoning: [],
        narration: {
          en: args.locationRequiredText,
          ur: args.locationRequiredText,
          hi: args.locationRequiredText,
        },
      },
    };
  }

  // Engine runs server-side only — zero algorithm code in the APK.
  const { reading } = await callOracleFunction({
    question: args.question,
    questionLang: args.questionLang,
    lat: args.lat,
    lon: args.lon,
  });

  return reading;
}

// ── OracleScreen ──────────────────────────────────────────────────────────────

const OracleScreen: React.FC = () => {
  const { theme } = useTheme();
  const colors = useColors();
  const typography = useTypography();
  const t = useTranslation();
  const { lang } = useI18n();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const lastLocation = useSettingsStore(
    (s: ReturnType<typeof useSettingsStore.getState>) => s.lastLocation,
  );
  const addReading = useReadingsStore(
    (s: ReturnType<typeof useReadingsStore.getState>) => s.addReading,
  );
  const { canAsk, consumeOne, questionsLeft } = useQuota();

  const plan = useQuotaStore(s => s.plan);
  const trialActive = useQuotaStore(s => s.trialActive);
  const trialExpired = useQuotaStore(s => s.trialExpired);
  const questionsToday = useQuotaStore(s => s.questionsToday);
  const startTrial = useQuotaStore(s => s.startTrial);

  const [showQuotaModal, setShowQuotaModal] = useState(false);

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
  const [sending, setSending] = useState(false);
  const [stage, setStage] = useState<ConvStage>('ready');
  const [lastReading, setLastReading] = useState<Reading | null>(null);
  const listRef = useRef<FlatList<ChatMessage> | null>(null);

  const lonDegForTiming = lastLocation?.lon ?? 74.3587;
  const { horaLord, dayLord } = useTimingStrip(lonDegForTiming);

  // Active chips depend on conversation stage
  const activeChips: readonly string[] =
    stage === 'answered'
      ? (FOLLOWUP_CHIPS[lang] ?? FOLLOWUP_CHIPS.en)
      : (INITIAL_CHIPS[lang] ?? INITIAL_CHIPS.en);

  // ── Core send logic ─────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text || sending) {
        return;
      }

      // Followup path — free, no quota
      if (stage === 'answered' && lastReading !== null) {
        const intent = detectIntent(text);

        if (intent === 'new') {
          // Reset to ready; let new question fall through to engine below
          setStage('ready');
          setLastReading(null);
          // Fall through to engine run below
        } else if (intent !== 'none') {
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
          if (intent === 'timing') {
            responseText = timingResponse(lastReading, lang);
          } else if (intent === 'why') {
            responseText = whyResponse(lastReading, lang);
          } else if (intent === 'remedy') {
            responseText = remedyResponse(lastReading, lang);
          }

          const shamsMsg: ChatMessage = {
            id: `s_fu_${Date.now()}`,
            sender: 'shams',
            text: responseText,
            createdAt: new Date().toISOString(),
          };
          setMessages(prev => [shamsMsg, ...prev]);
          setSending(false);
          return;
        }
        // intent === 'none' while answered: treat as new question — fall through
      }

      // ── Engine path — paywall gate ──────────────────────────────────────────
      if (plan === 'free') {
        if (trialExpired) {
          navigation.navigate('Premium');
          return;
        }
        if (!trialActive) {
          startTrial();
        }
        if (questionsToday >= (trialActive ? TRIAL_DAILY_LIMIT : FREE_DAILY_LIMIT)) {
          setShowQuotaModal(true);
          return;
        }
      }

      const now = new Date().toISOString();
      const userMsg: ChatMessage = {
        id: `u_${now}`,
        sender: 'user',
        text,
        createdAt: now,
      };
      setMessages(prev => [userMsg, ...prev]);
      setSending(true);

      if (!consumeOne()) {
        const quotaMsg: ChatMessage = {
          id: `quota_${Date.now()}`,
          sender: 'shams',
          text: t('oracle.quotaExhausted'),
          isUpgradeCta: true,
          createdAt: new Date().toISOString(),
        };
        setMessages(prev => [quotaMsg, ...prev]);
        setSending(false);
        return;
      }

      try {
        const reading = await runEngine({
          question: text,
          questionLang: lang,
          lat: lastLocation?.lat ?? null,
          lon: lastLocation?.lon ?? null,
          locationRequiredText: t('errors.locationRequired'),
        });

        await addReading(reading);
        setLastReading(reading);
        setStage('answered');

        const shamsMsg: ChatMessage = {
          id: `s_${reading.id}`,
          sender: 'shams',
          text: narrationForReading(reading) || t('errors.unknown'),
          reading,
          createdAt: new Date().toISOString(),
        };
        setMessages(prev => [shamsMsg, ...prev]);
      } catch (err) {
        const errText = err instanceof Error ? err.message : t('errors.unknown');
        setMessages(prev => [
          {
            id: `s_err_${now}`,
            sender: 'shams',
            text: errText,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
      } finally {
        setSending(false);
      }
    },
    [addReading, canAsk, consumeOne, lang, lastLocation, lastReading, navigation, plan,
     questionsToday, sending, stage, startTrial, t, trialActive, trialExpired],
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
    ({ item }: { item: ChatMessage }) => <Bubble message={item} />,
    [],
  );

  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

  const locationLabel =
    lastLocation === null
      ? t('errors.locationRequired')
      : `${lastLocation.lat.toFixed(2)}, ${lastLocation.lon.toFixed(2)}`;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.bg }]} edges={['top']}>
      {/* Animated starfield */}
      <StarfieldBackground starColor={colors.starfield} />

      {/* Header */}
      <View style={[styles.header, { borderColor: colors.border }]}>
        <Text style={[typography('subheading'), { color: colors.text }]}>
          {t('oracle.headerTitle')}
        </Text>
        <View style={styles.headerRight}>
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
                {questionsLeft}/{FREE_DAILY_LIMIT}
              </Text>
            </View>
          )}
          <View style={[styles.locationChip, { borderColor: colors.borderAccent }]}>
            <Text style={[typography('caption'), { color: colors.textMuted }]} numberOfLines={1}>
              {locationLabel}
            </Text>
          </View>
        </View>
      </View>

      {/* Timing strip — hora + day lord; taps into Sky State */}
      <Pressable
        onPress={() => navigation.navigate('SkyState')}
        style={[
          styles.timingStrip,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Open Sky State timing panel"
      >
        <Text style={[typography('caption'), { color: colors.textFaint, fontSize: 9 }]}>HORA</Text>
        <Text
          style={[typography('label'), { color: colors.accent, marginLeft: 4, marginRight: 16 }]}
        >
          {horaLord}
        </Text>
        <Text style={[typography('caption'), { color: colors.textFaint, fontSize: 9 }]}>DAY</Text>
        <Text style={[typography('label'), { color: colors.accent, marginLeft: 4 }]}>
          {dayLord}
        </Text>
        <Text
          style={[
            typography('caption'),
            { color: colors.textMuted, marginLeft: 'auto', fontSize: 10 },
          ]}
        >
          Sky State ›
        </Text>
      </Pressable>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <FlatList
          ref={listRef}
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

          {/* Composer */}
          <View style={styles.composer}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder={t('oracle.placeholder')}
              placeholderTextColor={colors.textFaint}
              style={[styles.composerInput, typography('body'), { color: colors.text }]}
              multiline
              editable={!sending}
              returnKeyType="send"
              blurOnSubmit
              onSubmitEditing={handleSend}
              underlineColorAndroid="transparent"
            />
            <Pressable
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
                <Text style={[typography('button'), { color: colors.textOnPrimary }]}>
                  {t('oracle.sendButton')}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Quota modal — soft wall for daily limit */}
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
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text
              style={[typography('subheading'), { color: colors.text, marginBottom: 8 }]}
            >
              {"Today's questions used"}
            </Text>
            <Text
              style={[
                typography('body'),
                { color: colors.textMuted, marginBottom: 24 },
              ]}
            >
              {'Come back tomorrow, or unlock unlimited access.'}
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setShowQuotaModal(false)}
                style={[
                  styles.modalBtn,
                  { borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth },
                ]}
                accessibilityRole="button"
              >
                <Text style={[typography('button'), { color: colors.text }]}>
                  Tomorrow
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowQuotaModal(false);
                  navigation.navigate('Premium');
                }}
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                accessibilityRole="button"
              >
                <Text style={[typography('button'), { color: colors.textOnPrimary }]}>
                  Unlock Now
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

const Bubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const colors = useColors();
  const typography = useTypography();
  const t = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isUser = message.sender === 'user';
  const [showWatch, setShowWatch] = useState(false);

  const accentColor = isUser ? colors.chatUserBorder : colors.chatShamsBorder;
  const bubbleBg = isUser ? colors.chatUserBg : colors.chatShamsBg;

  // Bold formatting — **text** → bold
  const renderText = (raw: string) => {
    const parts = raw.split(/(\*\*[^*]+\*\*)/g);
    return (
      <Text style={[typography('body'), { color: colors.text }]}>
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
  };

  return (
    <View style={[styles.bubbleRow, { justifyContent: isUser ? 'flex-end' : 'flex-start' }]}>
      <View
        style={[
          styles.bubble,
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
          showWatch ? (
            <WatchVerdictCard
              result={readingToAstroResult(message.reading)}
              onSwitchMode={() => setShowWatch(false)}
            />
          ) : (
            <AstroVerdictCard
              result={readingToAstroResult(message.reading)}
              onSwitchMode={() => setShowWatch(true)}
            />
          )
        )}
        {message.isUpgradeCta === true && (
          <Pressable
            onPress={() => navigation.navigate('Premium')}
            style={({ pressed }) => [
              styles.upgradeBtn,
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quotaBadge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  locationChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    maxWidth: '55%',
  },
  timingStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
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
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  // Input area
  inputArea: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 8,
  },
  chipsRow: {
    marginBottom: 6,
  },
  chipsContent: {
    gap: 6,
    paddingRight: 4,
  },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  composerInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sendBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    minHeight: 40,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
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

export default OracleScreen;
