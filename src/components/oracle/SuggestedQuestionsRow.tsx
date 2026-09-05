/**
 * SuggestedQuestionsRow — the "you may ask" pills under a sent reading.
 * --------------------------------------------------------------------------
 * Presentation only: the questions themselves come from the stored
 * composition's `suggestedQuestions` (functions/src/oracle/suggestedQuestions.ts
 * — deterministic, diagnosis-derived, never invented here or by the model).
 *
 * A tap does exactly one thing: fills the seeker's message box with that
 * question's text. It never sends, never navigates, never calls the engine.
 * The existing pipeline — discussReading's `is_new_question`, or the
 * explicit "ask as new question" affordance — decides what happens next,
 * exactly as it would for anything the seeker typed by hand. See the header
 * comment on WatchOracleComposition.suggestedQuestions for why that's the
 * whole point: suggesting is not firing.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useColors } from '@theme/ThemeProvider';
import { useTypography } from '@theme/useTypography';
import { useTranslation } from '@i18n/I18nProvider';

interface SuggestedQuestionsRowProps {
  questions: readonly string[];
  onSelect: (question: string) => void;
}

const SuggestedQuestionsRow: React.FC<SuggestedQuestionsRowProps> = ({ questions, onSelect }) => {
  const colors = useColors();
  const typography = useTypography();
  const t = useTranslation();

  if (questions.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={[typography('caption'), styles.label, { color: colors.textFaint }]}>
        {t('oracleChat.suggestedQuestionsLabel')}
      </Text>
      <View style={styles.row}>
        {questions.map(question => (
          <Pressable
            key={question}
            onPress={() => onSelect(question)}
            style={({ pressed }) => [
              styles.chip,
              { borderColor: colors.borderAccent, opacity: pressed ? 0.7 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={question}
          >
            <Text style={[typography('caption'), { color: colors.goldBright }]}>{question}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 10,
  },
  label: {
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF08',
  },
});

export default SuggestedQuestionsRow;
