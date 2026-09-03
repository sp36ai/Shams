/**
 * OracleChat — WhatsApp-style conversational interface for the Shams Method
 *
 * FEATURES:
 * - Real-time message streaming (user prompts, oracle responses, status bubbles)
 * - Execution phase indicators (⚙️ CUSPS → 🌑 NODES → ⚔️ VETOES → 🔭 TRANSITS → ✨ VERDICT)
 * - Typing animation during calculation phases
 * - Auto-scroll to latest message
 * - Disabled input during loading (prevents duplicate queries)
 * - Expandable proof card link in verdict bubble
 *
 * SUBSCRIPTIONS:
 * - useOracleMessages(): Full message thread
 * - useExecutionPhase(): Phase indicator for status bubbles
 * - useIsLoading(): Input state control
 * - useCurrentQuery(): Pre-fill text input (optional)
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useOracleStore, ExecutionPhase, type Message } from '../stores/useOracleStore';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface OracleChatProps {
  onProofCardPress?: (payload: any) => void; // Callback when user taps "View Astrological Proof"
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export const OracleChat: React.FC<OracleChatProps> = ({ onProofCardPress }) => {
  const messages = useOracleStore((state) => state.messages);
  const executionPhase = useOracleStore((state) => state.executionPhase);
  const isLoading = useOracleStore((state) => state.isLoading);
  const currentQuery = useOracleStore((state) => state.currentQuery);
  const processOracleQuery = useOracleStore((state) => state.processOracleQuery);
  const enginePayload = useOracleStore((state) => state.enginePayload);

  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;

    const query = inputText.trim();
    setInputText('');

    // Submit to store (triggers processOracleQuery thunk)
    await processOracleQuery(query);
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* ─── Message Thread ─── */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            onProofCardPress={onProofCardPress}
            enginePayload={enginePayload}
          />
        )}
        contentContainerStyle={styles.messageList}
        scrollEnabled={true}
        nestedScrollEnabled={true}
      />

      {/* ─── Typing Indicator During Calculation ─── */}
      {isLoading && executionPhase !== ExecutionPhase.IDLE && (
        <TypingIndicator phase={executionPhase} />
      )}

      {/* ─── Input Area ─── */}
      <View style={styles.inputContainer}>
        <TextInput
          style={[styles.input, isLoading && styles.inputDisabled]}
          placeholder="Ask the Oracle..."
          placeholderTextColor="#999"
          value={inputText}
          onChangeText={setInputText}
          editable={!isLoading}
          multiline
          maxLength={500}
        />

        <TouchableOpacity
          style={[styles.sendButton, (isLoading || !inputText.trim()) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={isLoading || !inputText.trim()}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.sendButtonText}>→</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Individual message bubble
 */
interface MessageBubbleProps {
  message: Message;
  onProofCardPress?: (payload: any) => void;
  enginePayload: any;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onProofCardPress,
  enginePayload,
}) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  // Parse proof card link from verdict bubble
  const hasProofCard = message.content.includes('[View Astrological Proof]');
  const contentWithoutLink = message.content.replace('[View Astrological Proof]', '').trim();

  return (
    <View style={[styles.messageBubbleContainer, isSystem && styles.systemBubbleContainer]}>
      <View
        style={[
          styles.messageBubble,
          isUser && styles.userBubble,
          !isUser && !isSystem && styles.oracleBubble,
          isSystem && styles.systemBubble,
        ]}
      >
        <Text
          style={[
            styles.messageText,
            isUser && styles.userText,
            !isUser && !isSystem && styles.oracleText,
            isSystem && styles.systemText,
          ]}
        >
          {contentWithoutLink}
        </Text>

        {/* Proof Card Button */}
        {hasProofCard && enginePayload && (
          <TouchableOpacity
            style={styles.proofCardButton}
            onPress={() => onProofCardPress?.(enginePayload)}
          >
            <Text style={styles.proofCardButtonText}>📖 View Astrological Proof</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Phase Badge for Status Messages */}
      {isSystem && message.phase && (
        <Text style={styles.phaseBadge}>{getPhaseEmoji(message.phase)}</Text>
      )}
    </View>
  );
};

/**
 * Typing indicator showing current calculation phase
 */
interface TypingIndicatorProps {
  phase: ExecutionPhase;
}

const TypingIndicator: React.FC<TypingIndicatorProps> = ({ phase }) => {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length < 3 ? prev + '.' : ''));
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const phaseText = getPhaseText(phase);

  return (
    <View style={styles.typingContainer}>
      <View style={styles.typingBubble}>
        <Text style={styles.typingText}>
          {phaseText}
          {dots}
        </Text>
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getPhaseEmoji(phase: ExecutionPhase): string {
  const emojiMap: Record<ExecutionPhase, string> = {
    [ExecutionPhase.IDLE]: '⏸',
    [ExecutionPhase.CALCULATING_CUSPS]: '⚙️',
    [ExecutionPhase.RESOLVING_NODES]: '🌑',
    [ExecutionPhase.CHECKING_VETOES]: '⚔️',
    [ExecutionPhase.FINDING_TRANSITS]: '🔭',
    [ExecutionPhase.COMPOSING_VERDICT]: '✨',
    [ExecutionPhase.COMPLETE]: '🎯',
  };

  return emojiMap[phase] || '•';
}

function getPhaseText(phase: ExecutionPhase): string {
  const textMap: Record<ExecutionPhase, string> = {
    [ExecutionPhase.IDLE]: 'Ready',
    [ExecutionPhase.CALCULATING_CUSPS]: 'Extracting 6th House CSL',
    [ExecutionPhase.RESOLVING_NODES]: 'Resolving Rahu proxy array',
    [ExecutionPhase.CHECKING_VETOES]: 'Evaluating Sub-Lord veto chain',
    [ExecutionPhase.FINDING_TRANSITS]: 'Locking transit intersection',
    [ExecutionPhase.COMPOSING_VERDICT]: 'Composing final verdict',
    [ExecutionPhase.COMPLETE]: 'Complete',
  };

  return textMap[phase] || 'Processing';
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },

  messageList: {
    paddingHorizontal: 12,
    paddingVertical: 16,
  },

  // ─── Message Bubbles ───
  messageBubbleContainer: {
    marginVertical: 8,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },

  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },

  userBubble: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },

  oracleBubble: {
    backgroundColor: '#e0e0e0',
    borderBottomLeftRadius: 4,
  },

  systemBubbleContainer: {
    justifyContent: 'center',
    marginVertical: 12,
  },

  systemBubble: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    paddingHorizontal: 0,
  },

  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },

  userText: {
    color: '#fff',
    fontWeight: '500',
  },

  oracleText: {
    color: '#1a1a1a',
  },

  systemText: {
    color: '#666',
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
  },

  // ─── Proof Card ───
  proofCardButton: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
  },

  proofCardButtonText: {
    color: '#007AFF',
    fontSize: 13,
    fontWeight: '600',
  },

  phaseBadge: {
    fontSize: 18,
    marginLeft: 8,
    lineHeight: 24,
  },

  // ─── Typing Indicator ───
  typingContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },

  typingBubble: {
    backgroundColor: '#e0e0e0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
  },

  typingText: {
    color: '#666',
    fontSize: 14,
    minHeight: 20,
  },

  // ─── Input Area ───
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 8,
  },

  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    backgroundColor: '#f9f9f9',
  },

  inputDisabled: {
    opacity: 0.5,
    backgroundColor: '#f0f0f0',
  },

  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },

  sendButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
});

export default OracleChat;
