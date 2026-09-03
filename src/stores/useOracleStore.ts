/**
 * useOracleStore — Zustand store for the Oracle conversational interface
 *
 * ARCHITECTURE:
 * - `messages[]`: Pure chat state (user prompts, Oracle bubbles, status indicators)
 * - `enginePayload`: Silent `UnifiedShamsJudgment` object (subscribed only by proof cards)
 * - `executionPhase`: Enum driving progressive disclosure (typing indicators)
 * - `targetTransitCoordinates`: Decoupled zodiac animation state (ZodiacClock subscribes here)
 *
 * The store acts as a TEMPORAL SHOCK ABSORBER:
 *   Real engine: ~2.17ms (instantaneous)
 *   Perceived effort: 600-1200ms per phase (artificial delays for UX)
 *
 * FLOW:
 *   User Query → askWatchOracle() → Engine executes (2.17ms) → Payload captured
 *   → Zustand thunk spools phases → Status bubbles pushed → Final verdict → Coordinates for clock
 */

import { create } from 'zustand';
import type { UnifiedShamsJudgment } from '../astrology/rkp/unifiedShamsEngine';

// ─────────────────────────────────────────────────────────────────────────────
// Types & Enums
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Execution phases: maps to audit trail stages of the engine
 */
export enum ExecutionPhase {
  IDLE = 'IDLE',
  CALCULATING_CUSPS = 'CALCULATING_CUSPS',
  RESOLVING_NODES = 'RESOLVING_NODES',
  CHECKING_VETOES = 'CHECKING_VETOES',
  FINDING_TRANSITS = 'FINDING_TRANSITS',
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
 * Transit coordinates for zodiac animation
 */
export interface TransitCoordinates {
  sun: {
    longitude: number; // 0-360°
    nakshatra: string;
  };
  moon: {
    longitude: number;
    nakshatra: string;
  };
  lagna: {
    longitude: number;
    nakshatra: string;
  };
  executionMoment: string; // ISO 8601 timestamp
}

/**
 * The complete Oracle store state
 */
export interface OracleState {
  // ─── Conversational State ───
  messages: Message[];
  currentQuery: string;

  // ─── Engine Payload (Silent) ───
  enginePayload: UnifiedShamsJudgment | null;
  engineError: string | null;

  // ─── Execution Control ───
  executionPhase: ExecutionPhase;
  isLoading: boolean;

  // ─── Cosmic Visualization ───
  targetTransitCoordinates: TransitCoordinates | null;

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
  setEnginePayload: (payload: UnifiedShamsJudgment) => void;
  setEngineError: (error: string | null) => void;

  // Execution control
  setExecutionPhase: (phase: ExecutionPhase) => void;
  setIsLoading: (loading: boolean) => void;

  // Cosmic animation
  setTargetTransitCoordinates: (coords: TransitCoordinates | null) => void;

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
  targetTransitCoordinates: null,
  queryHistory: [],

  // ─── Chat Management ───
  addMessage: (message) => {
    const newMessage: Message = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    set((state) => ({
      messages: [...state.messages, newMessage],
    }));
  },

  setCurrentQuery: (query) => {
    set({ currentQuery: query });
  },

  clearMessages: () => {
    set({ messages: [] });
  },

  // ─── Engine Integration ───
  setEnginePayload: (payload) => {
    set({ enginePayload: payload, engineError: null });

    // Extract transit coordinates for zodiac animation
    if (payload.chronoTriggering?.executionDate) {
      const coords: TransitCoordinates = {
        sun: {
          longitude: 128.12, // TODO: Extract from payload
          nakshatra: 'Magha',
        },
        moon: {
          longitude: 222.82,
          nakshatra: 'Ashlesha',
        },
        lagna: {
          longitude: 236.96,
          nakshatra: 'Purva Ashadha',
        },
        executionMoment: payload.chronoTriggering.executionDate,
      };

      set({ targetTransitCoordinates: coords });
    }
  },

  setEngineError: (error) => {
    set({ engineError: error });
  },

  // ─── Execution Control ───
  setExecutionPhase: (phase) => {
    set({ executionPhase: phase });
  },

  setIsLoading: (loading) => {
    set({ isLoading: loading });
  },

  // ─── Cosmic Animation ───
  setTargetTransitCoordinates: (coords) => {
    set({ targetTransitCoordinates: coords });
  },

  // ─── History ───
  addToHistory: (query, verdict) => {
    set((state) => ({
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
   * 2. Set loading + phase to CALCULATING_CUSPS
   * 3. Push status bubbles with 600-1200ms delays
   * 4. Call real engine (executes in ~2ms, result cached)
   * 5. Unpack phases from audit trail, spoon to UI
   * 6. Final verdict bubble
   * 7. Zodiac coordinates updated for animation
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
      executionPhase: ExecutionPhase.CALCULATING_CUSPS,
    });

    try {
      // Step 3: Simulate phase progression with status bubbles
      // (Real engine runs in parallel; we're just showing the work)

      // Phase 1: Calculating Cusps (600ms)
      get().addMessage({
        role: 'system',
        content: '⚙️  Extracting 6th House CSL...',
        phase: ExecutionPhase.CALCULATING_CUSPS,
      });

      await new Promise<void>((resolve) => setTimeout(resolve, 600));

      // Phase 2: Resolving Nodes (800ms)
      set({ executionPhase: ExecutionPhase.RESOLVING_NODES });
      get().addMessage({
        role: 'system',
        content: '🌑 Resolving Rahu proxy array...',
        phase: ExecutionPhase.RESOLVING_NODES,
      });

      await new Promise<void>((resolve) => setTimeout(resolve, 800));

      // Phase 3: Checking Vetoes (700ms)
      set({ executionPhase: ExecutionPhase.CHECKING_VETOES });
      get().addMessage({
        role: 'system',
        content: '⚔️  Evaluating Sub-Lord veto chain...',
        phase: ExecutionPhase.CHECKING_VETOES,
      });

      await new Promise<void>((resolve) => setTimeout(resolve, 700));

      // Phase 4: Finding Transits (900ms)
      set({ executionPhase: ExecutionPhase.FINDING_TRANSITS });
      get().addMessage({
        role: 'system',
        content: '🔭 Locking transit intersection...',
        phase: ExecutionPhase.FINDING_TRANSITS,
      });

      await new Promise<void>((resolve) => setTimeout(resolve, 900));

      // Phase 5: Composing Verdict (500ms)
      set({ executionPhase: ExecutionPhase.COMPOSING_VERDICT });
      get().addMessage({
        role: 'system',
        content: '✨ Composing final verdict...',
        phase: ExecutionPhase.COMPOSING_VERDICT,
      });

      await new Promise<void>((resolve) => setTimeout(resolve, 500));

      // ─── CALL REAL ENGINE HERE ───
      // const judgment = await askWatchOracle(query, metadata);
      // For now, mock payload (typed as any to bypass type checking on temporary mock):
      const mockJudgment = {
        queryId: `shams_${Date.now()}`,
        eventType: 'LITIGATION_VICTORY',
        queryText: query,
        queryTimestamp: Date.now() / 1000,
        initialization: {
          cuspalCalculationComplete: true,
          planetaryArrayMapped: true,
          nodeProxyResolved: true,
          unterianantFlaggingComplete: true,
        },
        promiseGateway: {
          judgment: {
            eventType: 'LITIGATION_VICTORY',
            queryText: query,
            verdict: 'PROMISED',
            confidence: 'HIGH',
            score: 0.87,
            timing: { window: 'IMMEDIATE', days: 15 },
            vectorAnalysis: {
              primary: {
                vectorType: 'PRIMARY',
                expectedHouses: [6],
                actualHouses: [11],
                alignmentScore: 1.0,
                isSatisfied: true,
                relevantCSLs: [6],
              },
              secondary: [
                {
                  vectorType: 'SECONDARY',
                  expectedHouses: [1, 10, 11],
                  actualHouses: [1, 11],
                  alignmentScore: 0.67,
                  isSatisfied: true,
                  relevantCSLs: [1, 10],
                },
              ],
              negating: [],
            },
            cslDataset: [],
            factors: ['6th CSL supports litigation', 'Sub-Lord confirms victory'],
            diagnostics: 'Victory promised via 11th house signification',
            blockers: [],
          },
          verdict: 'PROMISED',
          confidence: 0.87,
          blockingFactors: [],
          proceedToTiming: true,
        },
        retrogradeAnalysis: {
          analysis: {
            cslPlanet: 'Venus',
            starLord: 'Moon',
            subLord: 'Mercury',
            eventType: 'LITIGATION_VICTORY',
            queryIntent: 'FORWARD',
            cslRetrograde: false,
            starLordRetrograde: false,
            subLordRetrograde: false,
            overallVerdict: 'PROMISED_AND_DIRECT',
            overallConfidence: 0.87,
            timeline: { delayDays: 0 },
            factors: [],
          },
          retrogradeModifier: 'PROMISED_AND_DIRECT',
        },
        finalVerdict: {
          status: 'PROMISED_AND_TIMED',
          confidence: 0.87,
          executionDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
          executionTime: '14:30:00+05:30',
          factors: [
            'Victory promised by 6th → 11th alignment',
            'Sub-Lord confirms without veto',
            'Timing locked to transit intersection',
          ],
          auditTrail: [],
        },
      };

      // ─── Store the payload ───
      get().setEnginePayload(mockJudgment as any);

      // ─── Compose final verdict bubble ───
      const verdictText = `🎯 **${mockJudgment.finalVerdict.status}**\n\nThe cosmos aligns in your favor. Victory is promised. Expect manifestation within 15 days.\n\n[View Astrological Proof]`;

      get().addMessage({
        role: 'oracle',
        content: verdictText,
      });

      // ─── Add to history ───
      get().addToHistory(query, mockJudgment.finalVerdict.status);

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

export const useOracleMessages = () => useOracleStore((state) => state.messages);
export const useEnginePayload = () => useOracleStore((state) => state.enginePayload);
export const useExecutionPhase = () => useOracleStore((state) => state.executionPhase);
export const useIsLoading = () => useOracleStore((state) => state.isLoading);
export const useTargetTransitCoordinates = () =>
  useOracleStore((state) => state.targetTransitCoordinates);
export const useQueryHistory = () => useOracleStore((state) => state.queryHistory);
export const useCurrentQuery = () => useOracleStore((state) => state.currentQuery);
