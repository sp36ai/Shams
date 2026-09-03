/**
 * useOracleStore — Zustand store for the Oracle conversational interface
 *
 * ARCHITECTURE:
 * - `messages[]`: Pure chat state (user prompts, Oracle bubbles, status indicators)
 * - `enginePayload`: Silent `WatchReading` object (subscribed only by proof cards) —
 *   the exact reading returned by askWatchOracle, verbatim. No client-side
 *   reshaping or invented fields: RKP calculates, Oracle composes, UI displays.
 * - `executionPhase`: Enum driving progressive disclosure (typing indicators)
 *
 * The store acts as a TEMPORAL SHOCK ABSORBER:
 *   Real engine: near-instantaneous
 *   Perceived effort: 600-1200ms per phase (artificial delays for UX)
 *
 * FLOW:
 *   User Query → askWatchOracle() → RKP Watch Engine (server) → WatchReading
 *   → Zustand thunk spools phases → Status bubbles pushed → Final verdict bubble
 *
 * NOTE ON SCOPE: an earlier draft of this store fabricated a client-side
 * "UnifiedShamsJudgment" payload (CSL/Star-Lord/Sub-Lord chains, Vimshottari
 * Dasha timing, invented zodiac transit degrees) modeled on a KP-style engine
 * that was never real — see project history. That fabricated engine has been
 * removed. This store now carries only the actual `WatchReading` the server
 * returns, including its real `transitCoordinates` (Sun/Moon/Lagna sign +
 * degree, derived from the same chart the verdict itself was judged from —
 * see `transitCoordinatesOf` in `watchChart.ts`) for a future zodiac
 * animation. Still nothing invented client-side.
 */

import { create } from 'zustand';
import { askWatchOracle } from '../firebase/watchOracle';
import type { WatchReading } from '../firebase/watchOracle';

// ─────────────────────────────────────────────────────────────────────────────
// Types & Enums
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Execution phases, narrating the RKP Watch Engine's actual stages:
 * pick the Ghar frame for this moment, place the real sidereal planets in it,
 * weigh ruler dignity and relation, check for obstruction, compose the verdict.
 */
export enum ExecutionPhase {
  IDLE = 'IDLE',
  SELECTING_GHAR = 'SELECTING_GHAR',
  PLACING_PLANETS = 'PLACING_PLANETS',
  WEIGHING_DIGNITY = 'WEIGHING_DIGNITY',
  CHECKING_OBSTRUCTION = 'CHECKING_OBSTRUCTION',
  COMPOSING_VERDICT = 'COMPOSING_VERDICT',
  COMPLETE = 'COMPLETE',
}

/**
 * A single message in the conversational thread
 */
export interface Message {
  id: string;
  role: 'user' | 'oracle' | 'system'; // system = status bubble
  content: string;
  timestamp: number;
  phase?: ExecutionPhase; // Set for status messages
}

/**
 * The complete Oracle store state
 */
export interface OracleState {
  // ─── Conversational State ───
  messages: Message[];
  currentQuery: string;

  // ─── Engine Payload (Silent) ───
  /** The verbatim WatchReading from askWatchOracle. Subscribed only by proof cards. */
  enginePayload: WatchReading | null;
  engineError: string | null;

  // ─── Execution Control ───
  executionPhase: ExecutionPhase;
  isLoading: boolean;

  // ─── History & Persistence ───
  queryHistory: Array<{
    id: string;
    query: string;
    verdict: string;
    timestamp: number;
  }>;
}

/**
 * Store actions
 */
export interface OracleActions {
  // Chat management
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  setCurrentQuery: (query: string) => void;
  clearMessages: () => void;

  // Engine integration
  setEnginePayload: (payload: WatchReading) => void;
  setEngineError: (error: string | null) => void;

  // Execution control
  setExecutionPhase: (phase: ExecutionPhase) => void;
  setIsLoading: (loading: boolean) => void;

  // History
  addToHistory: (query: string, verdict: string) => void;

  // Async orchestration
  processOracleQuery: (query: string) => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Zustand Store
// ─────────────────────────────────────────────────────────────────────────────

export const useOracleStore = create<OracleState & OracleActions>((set, get) => ({
  // ─── Initial State ───
  messages: [],
  currentQuery: '',
  enginePayload: null,
  engineError: null,
  executionPhase: ExecutionPhase.IDLE,
  isLoading: false,
  queryHistory: [],

  // ─── Chat Management ───
  addMessage: message => {
    const newMessage: Message = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    set(state => ({
      messages: [...state.messages, newMessage],
    }));
  },

  setCurrentQuery: query => {
    set({ currentQuery: query });
  },

  clearMessages: () => {
    set({ messages: [] });
  },

  // ─── Engine Integration ───
  setEnginePayload: payload => {
    set({ enginePayload: payload, engineError: null });
  },

  setEngineError: error => {
    set({ engineError: error });
  },

  // ─── Execution Control ───
  setExecutionPhase: phase => {
    set({ executionPhase: phase });
  },

  setIsLoading: loading => {
    set({ isLoading: loading });
  },

  // ─── History ───
  addToHistory: (query, verdict) => {
    set(state => ({
      queryHistory: [
        ...state.queryHistory,
        {
          id: `hist_${Date.now()}`,
          query,
          verdict,
          timestamp: Date.now(),
        },
      ],
    }));
  },

  // ─── Async Orchestration: Progressive Disclosure ───
  /**
   * Process an Oracle query with simulated progressive disclosure
   *
   * FLOW:
   * 1. Add user message to chat
   * 2. Set loading + phase to SELECTING_GHAR
   * 3. Push status bubbles with artificial delays (temporal shock absorber)
   * 4. Call the real RKP Watch Engine via askWatchOracle
   * 5. Store the verbatim WatchReading
   * 6. Final verdict bubble, composed from the server's own narration
   */
  processOracleQuery: async (query: string) => {
    // Step 1: Add user message
    get().addMessage({
      role: 'user',
      content: query,
    });

    // Step 2: Begin loading sequence
    set({
      isLoading: true,
      currentQuery: query,
      executionPhase: ExecutionPhase.SELECTING_GHAR,
    });

    try {
      // Step 3: Progressive disclosure status bubbles.
      // These narrate the RKP Watch Engine's real stages — the engine itself
      // runs server-side and returns well before this sequence finishes;
      // the delays exist purely so the UI doesn't feel instantaneous/hollow.

      get().addMessage({
        role: 'system',
        content: '🕐 Selecting the Ghar for this moment...',
        phase: ExecutionPhase.SELECTING_GHAR,
      });

      await new Promise<void>(resolve => setTimeout(resolve, 600));

      set({ executionPhase: ExecutionPhase.PLACING_PLANETS });
      get().addMessage({
        role: 'system',
        content: '🪐 Placing the real sidereal planets...',
        phase: ExecutionPhase.PLACING_PLANETS,
      });

      await new Promise<void>(resolve => setTimeout(resolve, 800));

      set({ executionPhase: ExecutionPhase.WEIGHING_DIGNITY });
      get().addMessage({
        role: 'system',
        content: '⚖️ Weighing ruler dignity and relation...',
        phase: ExecutionPhase.WEIGHING_DIGNITY,
      });

      await new Promise<void>(resolve => setTimeout(resolve, 700));

      set({ executionPhase: ExecutionPhase.CHECKING_OBSTRUCTION });
      get().addMessage({
        role: 'system',
        content: '🔍 Checking for obstruction...',
        phase: ExecutionPhase.CHECKING_OBSTRUCTION,
      });

      await new Promise<void>(resolve => setTimeout(resolve, 700));

      set({ executionPhase: ExecutionPhase.COMPOSING_VERDICT });
      get().addMessage({
        role: 'system',
        content: '✨ Composing the verdict...',
        phase: ExecutionPhase.COMPOSING_VERDICT,
      });

      await new Promise<void>(resolve => setTimeout(resolve, 500));

      // ─── CALL THE REAL RKP WATCH ENGINE (server-side) ───
      const result = await askWatchOracle({
        question: query,
        questionLang: 'en',
        seekerProfile: 'action',
      });

      // ─── Store the verbatim reading ───
      get().setEnginePayload(result.reading);

      // ─── Compose final verdict bubble from the server's own narration ───
      const oracleText =
        result.reading.oracle?.narration ??
        `${result.reading.verdict.state} — ${result.reading.verdict.targetRulerName} governs this matter.`;

      const verdictText = `${oracleText}\n\n[View Astrological Proof]`;

      get().addMessage({
        role: 'oracle',
        content: verdictText,
      });

      // ─── Add to history ───
      get().addToHistory(query, result.reading.verdict.state);

      // ─── Complete ───
      set({
        executionPhase: ExecutionPhase.COMPLETE,
        isLoading: false,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      set({
        engineError: errorMsg,
        isLoading: false,
        executionPhase: ExecutionPhase.IDLE,
      });

      get().addMessage({
        role: 'system',
        content: `❌ Error: ${errorMsg}`,
      });
    }
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// Selectors (for optimization and clarity)
// ─────────────────────────────────────────────────────────────────────────────

export const useOracleMessages = () => useOracleStore(state => state.messages);
export const useEnginePayload = () => useOracleStore(state => state.enginePayload);
export const useExecutionPhase = () => useOracleStore(state => state.executionPhase);
export const useIsLoading = () => useOracleStore(state => state.isLoading);
export const useQueryHistory = () => useOracleStore(state => state.queryHistory);
export const useCurrentQuery = () => useOracleStore(state => state.currentQuery);
/** Real Sun/Moon/Lagna position from the latest reading, for a future zodiac animation. */
export const useTransitCoordinates = () =>
  useOracleStore(state => state.enginePayload?.transitCoordinates ?? null);
