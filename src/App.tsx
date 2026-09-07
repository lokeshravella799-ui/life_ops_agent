import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  AgentState,
  ProductItem,
  HistoryItem,
  AgentThought,
  ExecutionPreparation,
  SandboxReceipt,
  ComparisonSummary,
  VerificationSummary,
  UserPersonalizationProfile,
  SessionPreferences,
  PreferenceConflict,
  ProactiveRelaxationOption,
  EffectivePreferences,
} from './types/agent';
import { recommendationToProductItem } from './types/agent';
import {
  mockAgentThoughts,
} from './services/mockData';
import { LifeOpsOrb } from './components/orb/LifeOpsOrb';
import { useVoiceRecorder } from './hooks/useVoiceRecorder';
import { useTextToSpeech } from './hooks/useTextToSpeech';
import { useTheme } from './hooks/useTheme';
import { Sidebar } from './components/sidebar/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { ChatInput } from './components/input/ChatInput';
import { AgentStatusPanel } from './components/agent/AgentStatusPanel';
import { ResultsPanel } from './components/results/ResultsPanel';
import { ConfirmationPanel } from './components/confirmation/ConfirmationPanel';
import { SuccessPanel } from './components/success/SuccessPanel';
import { ConversationalAnswerPanel } from './components/results/ConversationalAnswerPanel';
import { PreferencesModal } from './components/preferences/PreferencesModal';
import { AuthModal } from './components/auth/AuthModal';
import { LocationPermissionModal } from './components/location/LocationPermissionModal';
import { RazorpayCheckoutModal, type BookingDetails } from './components/payment/RazorpayCheckoutModal';
import { useUserLocation } from './hooks/useUserLocation';
import { useActiveUser } from './components/auth/ClerkAuthProvider';
import {
  sendAgentMessage,
  fetchUserProfile,
  switchPersona,
  acceptStagedInference,
  rejectStagedInference,
  fetchConversations,
  fetchConversationById,
  deleteConversation,
} from './services/agentApi';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, AlertCircle, MapPin } from 'lucide-react';

export function App() {
  // 0. Clerk Identity Synchronization
  const { userId: clerkUserId } = useActiveUser();

  // 1. Navigation & Layout state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeNavTab, setActiveNavTab] = useState('chat');
  const [isMobile, setIsMobile] = useState(false);
  const { theme, toggleTheme } = useTheme();

  // 2. Agent Workflow state
  const [conversationId, setConversationId] = useState<string>(() => `conv_${Date.now()}`);
  const [agentState, setAgentState] = useState<AgentState>('idle');
  const [activeQuery, setActiveQuery] = useState('');
  const [thoughts, setThoughts] = useState<AgentThought[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [pendingPreparation, setPendingPreparation] = useState<ExecutionPreparation | null>(null);
  const [executionReceipt, setExecutionReceipt] = useState<SandboxReceipt | undefined>(undefined);
  const [confirmedOrderId, setConfirmedOrderId] = useState('');
  const [conversationalResponse, setConversationalResponse] = useState<string | null>(null);
  const [aiAnalysisSummary, setAiAnalysisSummary] = useState<string | null>(null);
  const [comparisonSummary, setComparisonSummary] = useState<ComparisonSummary | undefined>();
  const [verificationSummary, setVerificationSummary] = useState<VerificationSummary | undefined>();
  const [hasMatches, setHasMatches] = useState(true);
  const [suggestedRelaxations, setSuggestedRelaxations] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isConfirmingBackend, setIsConfirmingBackend] = useState(false);
  const [selectingProductId, setSelectingProductId] = useState<string | undefined>();
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserPersonalizationProfile | null>(null);
  const [activePersonaId, setActivePersonaId] = useState<string>('personal');
  const [stagedInferences, setStagedInferences] = useState<import('./types/agent').StagedInference[]>([]);
  const [activeSessionPreferences, setActiveSessionPreferences] = useState<SessionPreferences | null>(null);
  const [effectivePreferences, setEffectivePreferences] = useState<EffectivePreferences | null>(null);
  const [preferenceConflicts, setPreferenceConflicts] = useState<PreferenceConflict[]>([]);
  const [relaxationOptions, setRelaxationOptions] = useState<ProactiveRelaxationOption[]>([]);

  // Location, Payment & Multi-turn Conversation additions
  const userLocationHook = useUserLocation();
  const [contextualRecommendations, setContextualRecommendations] = useState<string[]>([]);
  const [isRazorpayOpen, setIsRazorpayOpen] = useState(false);
  const [bookingForPayment, setBookingForPayment] = useState<BookingDetails | null>(null);
  const [detectedPickup, setDetectedPickup] = useState<string | undefined>();

  // Fetch persistent conversations from backend store
  const loadConversations = useCallback(async () => {
    try {
      const list = await fetchConversations(clerkUserId);
      if (list && list.length > 0) {
        // Only include conversations that actually have messages and are not seed placeholders
        const validList = list.filter(
          (c: any) =>
            ((c.messages && c.messages.length > 0) || (c.messageCount && c.messageCount > 0) || c.lastMessage) &&
            !c.id.startsWith('conv_seed_')
        );
        const items: HistoryItem[] = validList.map((c: any) => {
          const preview =
            c.lastMessage ||
            (c.messages && c.messages.length > 0
              ? c.messages[c.messages.length - 1].role === 'user'
                ? `You: ${c.messages[c.messages.length - 1].content}`
                : c.messages[c.messages.length - 1].content
              : '');

          const dateObj = new Date(c.updatedAt || c.createdAt);
          const isToday = new Date().toDateString() === dateObj.toDateString();
          const isYesterday = new Date(Date.now() - 86400000).toDateString() === dateObj.toDateString();
          const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const category = c.category || (isToday ? 'today' : isYesterday ? 'yesterday' : 'earlier');

          return {
            id: c.id,
            title: c.title || 'Conversation',
            type: (c.metadata?.category === 'bookings' || c.metadata?.bookingState ? 'booking' : 'chat') as any,
            category: category as any,
            subtitle: preview.slice(0, 60),
            date: isToday ? timeStr : isYesterday ? 'Yesterday' : dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' }),
            query: c.title || preview,
            amount: c.metadata?.bookingState?.amount,
            status: c.metadata?.bookingState ? 'Confirmed' : undefined,
          };
        });
        setHistoryItems(items);
      } else {
        setHistoryItems([]);
      }
    } catch (err) {
      console.warn('Failed to load conversations from backend:', err);
    }
  }, [clerkUserId]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);


  // Load personalization profile on mount / user change
  useEffect(() => {
    fetchUserProfile(clerkUserId)
      .then((p) => {
        setUserProfile(p);
        if (p?.activePersonaId) setActivePersonaId(p.activePersonaId);
        if (p?.stagedInferences) setStagedInferences(p.stagedInferences);
      })
      .catch((err) => console.error('Error fetching profile:', err));
  }, [clerkUserId]);

  const handleSelectNavTab = (tab: string) => {
    setActiveNavTab(tab);
    if (tab === 'preferences') {
      setIsPreferencesOpen(true);
    }
  };

  // Pipeline timers ref to prevent race conditions & ghost transitions
  const pipelineTimersRef = useRef<number[]>([]);
  const requestGenerationRef = useRef<number>(0);

  const clearPipelineTimers = useCallback(() => {
    pipelineTimersRef.current.forEach((id) => window.clearTimeout(id));
    pipelineTimersRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      clearPipelineTimers();
    };
  }, [clearPipelineTimers]);

  // 3. History state
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | undefined>();

  // Responsive breakpoint watcher
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // State synchronization refs to prevent stale closure issues in audio callbacks
  const productsRef = useRef<ProductItem[]>(products);
  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  const pendingPreparationRef = useRef<ExecutionPreparation | null>(pendingPreparation);
  useEffect(() => {
    pendingPreparationRef.current = pendingPreparation;
  }, [pendingPreparation]);

  const executionReceiptRef = useRef<SandboxReceipt | undefined>(executionReceipt);
  useEffect(() => {
    executionReceiptRef.current = executionReceipt;
  }, [executionReceipt]);

  const selectedProductRef = useRef<ProductItem | null>(selectedProduct);
  useEffect(() => {
    selectedProductRef.current = selectedProduct;
  }, [selectedProduct]);

  // Natural English Text-to-Speech Engine with chunking and immediate interruption
  const tts = useTextToSpeech({
    rate: 0.95,
    pitch: 1.0,
    volume: 1.0,
    onSpeechStart: () => {
      setAgentState('speaking');
    },
    onSpeechEnd: () => {
      setAgentState((curr) => {
        if (curr === 'speaking') {
          if (pendingPreparationRef.current) return 'confirmation';
          if (executionReceiptRef.current) return 'success';
          return 'results';
        }
        return curr;
      });
    },
    onError: (err) => {
      console.warn('LifeOps TTS error:', err);
      setAgentState((curr) => {
        if (curr === 'speaking') {
          if (pendingPreparationRef.current) return 'confirmation';
          if (executionReceiptRef.current) return 'success';
          return 'results';
        }
        return curr;
      });
    },
  });

  // Autonomous Agent workflow connected to backend agent core
  const runAgentWorkflow = useCallback(
    async (messageText: string) => {
      const cleanText = messageText.trim();
      if (!cleanText) return;

      // Invalidate previous TTS immediately and synchronize active generation token
      const targetGen = tts.invalidateGeneration();
      requestGenerationRef.current = targetGen;

      // Clear any pending pipeline stage timers to prevent race conditions
      clearPipelineTimers();

      // Only update active query if it's not a selection or confirmation command
      const lower = cleanText.toLowerCase();
      const isSelectionCmd = Boolean(
        lower.match(/^(option|item|#|select|choose|pick|i want|book|the\s+(first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th))/i)
      );
      const isConfirmCmd = Boolean(
        lower.match(/^(yes|confirm|proceed|authorize|accept|go ahead)/i)
      );
      const isCancelCmd = Boolean(
        lower.match(/^(cancel|don'?t|do not|abort|nevermind|stop)/i)
      );

      if (!isSelectionCmd && !isConfirmCmd && !isCancelCmd) {
        setActiveQuery(cleanText);
        setConversationalResponse(null);
        setPendingPreparation(null);
        setSelectedProduct(null);
        setExecutionReceipt(undefined);
        setConfirmedOrderId('');
        setIsConfirmingBackend(false);
        setSelectingProductId(undefined);
        setPreferenceConflicts([]);
        setRelaxationOptions([]);
      }

      setErrorMessage(undefined);

      // If user confirms, transition to processing immediately
      if (isConfirmCmd) {
        setAgentState('processing');
        setIsConfirmingBackend(true);
      } else if (!isSelectionCmd && !isCancelCmd) {
        setAgentState('thinking');
        setThoughts([]);
      }

      try {
        // Retrieve current browser location from userLocation hook if granted
        const locationData = userLocationHook.location
          ? {
              latitude: userLocationHook.location.latitude,
              longitude: userLocationHook.location.longitude,
              city: userLocationHook.location.city,
            }
          : undefined;

        // Send message to live backend agent endpoint (/api/agent/message) with active Clerk user ID and location
        const backendRes = await sendAgentMessage(cleanText, conversationId, clerkUserId, locationData);

        // Guard against race conditions: ignore response if a newer request began
        if (targetGen !== requestGenerationRef.current) {
          console.info('Discarding obsolete agent response', {
            targetGen,
            activeGen: requestGenerationRef.current,
          });
          return;
        }

        // Update conversation ID if backend generated/normalized one
        if (backendRes.conversationId && backendRes.conversationId !== conversationId) {
          setConversationId(backendRes.conversationId);
        }

        // Synchronize personalization profile and session context if returned by backend
        if (backendRes.userProfile) {
          setUserProfile(backendRes.userProfile);
        }
        if (backendRes.activePersonaId) {
          setActivePersonaId(backendRes.activePersonaId);
        }
        if (backendRes.stagedInferences) {
          setStagedInferences(backendRes.stagedInferences);
        }
        if (backendRes.activeSessionPreferences !== undefined) {
          setActiveSessionPreferences(backendRes.activeSessionPreferences);
        }
        if (backendRes.effectivePreferences !== undefined) {
          setEffectivePreferences(backendRes.effectivePreferences);
        }
        setPreferenceConflicts(backendRes.preferenceConflicts || []);
        setRelaxationOptions(backendRes.relaxationOptions || []);

        if (backendRes.contextualRecommendations) {
          setContextualRecommendations(backendRes.contextualRecommendations);
        }

        if (backendRes.requirements?.intent === 'BUS_SEARCH' || backendRes.requirements?.source) {
          setDetectedPickup(
            backendRes.requirements?.source ||
            userLocationHook.location?.displayName ||
            'Hyderabad, Telangana'
          );
        }

        // Refresh sidebar conversation list
        loadConversations();

        // Determine final speech text for natural English voice synthesis
        const speechText = backendRes.error || backendRes.message;
        if (speechText) {
          tts.speak(speechText, targetGen);
          setAgentState('speaking');
        }

        // 1. Handle Backend Error
        if (backendRes.error) {
          setErrorMessage(backendRes.error);
          if (productsRef.current.length === 0) {
            setConversationalResponse(backendRes.error);
          }
          setIsConfirmingBackend(false);
          setSelectingProductId(undefined);
          if (!speechText) {
            setAgentState(productsRef.current.length > 0 ? 'results' : 'error');
          }
          return;
        }

        // 2. Handle Clarification (including Preference Conflicts)
        if (backendRes.requiresClarification) {
          if (!backendRes.preferenceConflicts?.length) {
            setConversationalResponse(backendRes.message);
          }
          setThoughts([
            {
              id: 'clarify-1',
              step: backendRes.preferenceConflicts?.length ? 'Preference Conflict' : 'Clarification Needed',
              message: backendRes.message,
              time: '0.2s',
              status: 'active',
            },
          ]);
          setIsConfirmingBackend(false);
          setSelectingProductId(undefined);
          setErrorMessage(backendRes.message);
          if (!speechText) {
            setAgentState('results');
          }
          return;
        }

        // 3. Handle General Chat & Informational Queries
        if (
          backendRes.agentState?.intent === 'GENERAL_CHAT' ||
          (backendRes.message &&
            !backendRes.recommendations?.length &&
            !backendRes.executionPreparation &&
            !backendRes.executionReceipt)
        ) {
          setConversationalResponse(backendRes.message);
          setIsConfirmingBackend(false);
          setSelectingProductId(undefined);
          // Clear any previous domain results so general chat is isolated
          setProducts([]);
          setSelectedProduct(null);
          setPendingPreparation(null);
          setExecutionReceipt(undefined);
          setThoughts([]);
          setAgentState('results');
          return;
        }

        // 3b. Handle Preference Update
        if (backendRes.agentState?.intent === 'PREFERENCE_UPDATE') {
          setIsConfirmingBackend(false);
          setSelectingProductId(undefined);

          // If recommendations were re-ranked by updated preferences, update UI products
          if (backendRes.recommendations && backendRes.recommendations.length > 0) {
            const mapped = backendRes.recommendations.map(recommendationToProductItem);
            setProducts(mapped);
          }
          if (!speechText) {
            setAgentState(productsRef.current.length > 0 ? 'results' : 'idle');
          }
          return;
        }

        // 3c. Handle Persona Switch
        if (backendRes.agentState?.intent === 'PERSONA_SWITCH') {
          setIsConfirmingBackend(false);
          setSelectingProductId(undefined);
          if (backendRes.recommendations && backendRes.recommendations.length > 0) {
            const mapped = backendRes.recommendations.map(recommendationToProductItem);
            setProducts(mapped);
          }
          if (!speechText) {
            setAgentState(productsRef.current.length > 0 ? 'results' : 'idle');
          }
          return;
        }

        // 3d. Handle Feedback Submission
        if (backendRes.agentState?.intent === 'FEEDBACK_SUBMISSION') {
          setIsConfirmingBackend(false);
          setSelectingProductId(undefined);
          if (backendRes.recommendations && backendRes.recommendations.length > 0) {
            const mapped = backendRes.recommendations.map(recommendationToProductItem);
            setProducts(mapped);
          }
          if (!speechText) {
            setAgentState(productsRef.current.length > 0 ? 'results' : 'idle');
          }
          return;
        }

        // 4. Handle Cancellation
        if (
          backendRes.agentState?.phase === 'CANCELLED' ||
          backendRes.executionStatus === 'CANCELLED'
        ) {
          setPendingPreparation(null);
          setIsConfirmingBackend(false);
          setSelectingProductId(undefined);
          if (!speechText) {
            setAgentState(productsRef.current.length > 0 ? 'results' : 'idle');
          }
          return;
        }

        // 5. Handle Completed Sandbox Execution / Receipt (AFTER CONFIRMATION)
        if (backendRes.sandboxExecution || backendRes.executionReceipt) {
          const receipt = backendRes.executionReceipt;
          const sandboxId =
            receipt?.sandboxExecutionId ||
            (backendRes.sandboxExecution
              ? 'sandboxOrderId' in backendRes.sandboxExecution
                ? backendRes.sandboxExecution.sandboxOrderId
                : backendRes.sandboxExecution.bookingId
              : undefined) ||
            backendRes.executionId ||
            `SANDBOX-${Date.now()}`;

          setConfirmedOrderId(sandboxId);
          setExecutionReceipt(receipt);
          setPendingPreparation(null);
          setIsConfirmingBackend(false);
          setSelectingProductId(undefined);

          setThoughts([
            {
              id: 'sandbox-complete',
              step: 'SANDBOX SIMULATION COMPLETED',
              message: backendRes.message,
              time: '0.2s',
              status: 'completed',
            },
          ]);

          // Record in sidebar history with explicit Sandbox status
          const confirmedItemName =
            receipt?.selectedItem?.title ||
            selectedProduct?.name ||
            'LifeOps Option';
          const confirmedAmount =
            receipt?.costBreakdown?.total ??
            receipt?.total ??
            selectedProduct?.price ??
            0;

          const newHistoryItem: HistoryItem = {
            id: `h-pur-${Date.now()}`,
            title: confirmedItemName,
            type: 'purchase',
            category: 'purchases',
            subtitle: `Sandbox #${sandboxId}`,
            amount: confirmedAmount,
            status: 'Simulated',
            date: 'Just now',
            itemData: selectedProductRef.current || undefined,
            receipt,
          };
          setHistoryItems((prev) => [newHistoryItem, ...prev]);

          if (!speechText) {
            setAgentState('success');
          }
          return;
        }

        // 6. Handle Execution Preparation / Awaiting Confirmation
        if (
          (backendRes.confirmationRequired && backendRes.executionPreparation) ||
          backendRes.agentState?.phase === 'WAITING_FOR_CONFIRMATION' ||
          backendRes.executionStatus === 'AWAITING_CONFIRMATION'
        ) {
          const prep = backendRes.executionPreparation;
          if (prep) {
            setPendingPreparation(prep);

            // Synchronize selected product with backend preparation
            if (prep.item) {
              const matchedInList = productsRef.current.find(
                (p) => p.id === prep.item.id || p.name === prep.item.title
              );
              if (matchedInList) {
                setSelectedProduct(matchedInList);
              } else {
                setSelectedProduct({
                  id: prep.item.id || 'item-1',
                  name: prep.item.title || 'Selected Item',
                  brand: prep.provider?.name || 'Verified Provider',
                  price: prep.costBreakdown?.total ?? prep.item.price?.amount ?? 0,
                  originalPrice: prep.item.searchPrice ?? prep.costBreakdown?.total ?? 0,
                  rating: 4.8,
                  reviewCount: 120,
                  scores: {
                    performance: 9,
                    battery: 8,
                    value: 9,
                    aiMatch: 95,
                  },
                  isRecommended: true,
                  whyThisText: prep.confirmationGateMessage || 'Verified selection via LifeOps multi-provider engine',
                  image: 'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=800&auto=format&fit=crop&q=60',
                  provider: prep.provider?.name || 'Verified Provider',
                  deliveryDays: 'Standard Dispatch',
                  availability: prep.item.availability || 'In Stock (Verified)',
                  specs: {
                    cpu: prep.item.specifications?.cpu || 'Verified Spec',
                    gpu: prep.item.specifications?.gpu || 'Standard GPU',
                    ram: prep.item.specifications?.ram || '16GB',
                    storage: prep.item.specifications?.storage || '512GB SSD',
                    display: 'FHD Display',
                    batteryLife: 'Standard',
                    weight: 'Portable',
                    thermals: 'Standard',
                    ports: 'Type-C, HDMI',
                  },
                  pros: ['Verified provider listing', 'Awaiting confirmation gate approval'],
                  cons: ['Sandbox simulation only'],
                  verificationStatus: prep.verification?.status || 'VERIFIED',
                });
              }
            }
          }

          setIsConfirmingBackend(false);
          setSelectingProductId(undefined);
          setThoughts([
            {
              id: 'prep-active',
              step: 'AWAITING CONFIRMATION',
              message: backendRes.message,
              time: '0.3s',
              status: 'active',
            },
          ]);
          if (!speechText) {
            setAgentState('confirmation');
          }
          return;
        }

        // 7. Handle Search Recommendations & Multi-Provider Results
        if (backendRes.recommendations && backendRes.recommendations.length > 0) {
          setConversationalResponse(null);
          setAiAnalysisSummary(backendRes.message || null);
          const mappedProducts = backendRes.recommendations.map((rec, idx) =>
            recommendationToProductItem(rec, idx)
          );
          setProducts(mappedProducts);
          setComparisonSummary(backendRes.comparisonSummary);
          setVerificationSummary(backendRes.verificationSummary);
          setHasMatches(backendRes.hasMatches !== false);
          setSuggestedRelaxations(backendRes.suggestedRelaxations || []);
          setSelectingProductId(undefined);
          setIsConfirmingBackend(false);

          // Map plan steps from backend
          const dynamicThoughts: AgentThought[] =
            backendRes.plan?.steps.map((s, idx) => ({
              id: s.id,
              step: s.description || s.type,
              message:
                s.type === 'extract_requirements'
                  ? `Extracted intent: ${backendRes.agentState.intent}`
                  : s.type === 'search_products' || s.type === 'search_buses'
                  ? `Invoking provider adapter: ${backendRes.selectedTool || s.type}`
                  : s.description || s.type,
              time: `${(0.4 * (idx + 1)).toFixed(1)}s`,
              status: s.status === 'completed' ? 'completed' : 'active',
            })) || (mockAgentThoughts.laptop || []);

          setThoughts(dynamicThoughts);

          if (!speechText) {
            setAgentState('results');
          }
          return;
        }

        // 8. Handle No Matches or Empty Recommendations
        if (backendRes.hasMatches === false || (backendRes.recommendations && backendRes.recommendations.length === 0)) {
          setProducts([]);
          setHasMatches(false);
          setSuggestedRelaxations(backendRes.suggestedRelaxations || []);
          setConversationalResponse(backendRes.message);
          setIsConfirmingBackend(false);
          setSelectingProductId(undefined);
          if (!speechText) {
            setAgentState('results');
          }
          return;
        }

        // Default fallback: display response message
        setConversationalResponse(backendRes.message);
        setIsConfirmingBackend(false);
        setSelectingProductId(undefined);
        if (!speechText) {
          setAgentState(productsRef.current.length > 0 ? 'results' : 'idle');
        }
      } catch (err: any) {
        if (targetGen !== requestGenerationRef.current) return;
        console.error('Error connecting to LifeOps backend:', err);
        const msg =
          err?.message ||
          'Unable to connect to the backend agent service. Please ensure the server is running on port 3001.';
        tts.speak(msg, targetGen);
        setAgentState('error');
        setErrorMessage(msg);
        setConversationalResponse(null);
        setIsConfirmingBackend(false);
        setSelectingProductId(undefined);
      }
    },
    [conversationId, clearPipelineTimers, tts, clerkUserId, userLocationHook.location, loadConversations]
  );

  // Unified message dispatcher for typed and voice submissions
  const handleSendMessage = useCallback(
    (message: string) => {
      const clean = message?.trim();
      if (!clean) return;
      tts.primeSynthesizer();
      tts.stop();
      runAgentWorkflow(clean);
    },
    [tts, runAgentWorkflow]
  );

  // Voice recording hook with English speech recognition & manual-only interruption
  const {
    isListening,
    audioLevel,
    transcript,
    startListening,
    stopListening,
    cancelListening,
    resetTranscript,
  } = useVoiceRecorder({
    onSpeechComplete: (completedTranscript) => {
      if (completedTranscript) {
        handleSendMessage(completedTranscript);
      }
    },
  });

  // Authoritative LifeOps AI Orb and manual voice interaction handler
  const handleOrbInteraction = useCallback(() => {
    // Prime the synthesizer on user interaction to unlock audio / speech synthesis autoplay
    tts.primeSynthesizer();

    if (tts.isSpeaking || agentState === 'speaking') {
      tts.stop();
      cancelListening();
      const newGen = tts.invalidateGeneration();
      requestGenerationRef.current = newGen;
      clearPipelineTimers();
      resetTranscript();
      setAgentState('listening');
      startListening();
      return;
    }

    if (isListening) {
      stopListening();
    } else {
      clearPipelineTimers();
      cancelListening();
      const newGen = tts.invalidateGeneration();
      requestGenerationRef.current = newGen;
      resetTranscript();
      setAgentState('listening');
      startListening();
    }
  }, [tts, agentState, isListening, startListening, stopListening, cancelListening, resetTranscript, clearPipelineTimers]);

  const handleToggleVoice = handleOrbInteraction;

  // Reset to initial clean idle state
  const handleNewChat = () => {
    clearPipelineTimers();
    const newGen = tts.invalidateGeneration();
    requestGenerationRef.current = newGen;
    cancelListening();
    resetTranscript();
    setAgentState('idle');
    setActiveQuery('');
    setConversationalResponse(null);
    setAiAnalysisSummary(null);
    setThoughts([]);
    setProducts([]);
    setSelectedProduct(null);
    setPendingPreparation(null);
    setExecutionReceipt(undefined);
    setSelectedHistoryId(undefined);
    setErrorMessage(undefined);
    setComparisonSummary(undefined);
    setVerificationSummary(undefined);
    setHasMatches(true);
    setSuggestedRelaxations([]);
    setSelectingProductId(undefined);
    setConversationId(`conv_${Date.now()}`);
  };

  // Selection of a product option: send selection command to backend
  const handleSelectProduct = (product: ProductItem) => {
    setSelectedProduct(product);
    setSelectingProductId(product.id);
    const selectionCommand = `Option ${product.rank || 1}`;
    runAgentWorkflow(selectionCommand);
  };

  // Explicit confirmation: send affirmative confirmation to backend
  const handleConfirmPurchase = () => {
    runAgentWorkflow('Yes, confirm it');
  };

  // Cancellation: send cancellation to backend
  const handleCancelPreparation = () => {
    runAgentWorkflow('cancel it');
  };

  // Apply suggested relaxation by appending to search
  const handleApplyRelaxation = (relaxation: string) => {
    const updatedQuery = `${activeQuery} (adjusting: ${relaxation})`;
    runAgentWorkflow(updatedQuery);
  };

  // Switch active persona
  const handleSwitchPersona = async (personaId: 'personal' | 'work') => {
    try {
      const res = await switchPersona(personaId, clerkUserId);
      setUserProfile(res.profile);
      setActivePersonaId(personaId);
      runAgentWorkflow(`Switch to ${personaId} profile`);
    } catch (err) {
      console.error(err);
    }
  };

  // Accept a staged preference inference
  const handleAcceptInference = async (inferenceId: string) => {
    try {
      const res = await acceptStagedInference(inferenceId, clerkUserId);
      setUserProfile(res.profile);
      setStagedInferences(res.profile.stagedInferences || []);
      runAgentWorkflow('Yes, add to profile');
    } catch (err) {
      console.error(err);
    }
  };

  // Reject a staged preference inference
  const handleRejectInference = async (inferenceId: string) => {
    try {
      const res = await rejectStagedInference(inferenceId, clerkUserId);
      setUserProfile(res.profile);
      setStagedInferences(res.profile.stagedInferences || []);
      runAgentWorkflow("No, don't add to profile");
    } catch (err) {
      console.error(err);
    }
  };

  // Explicit user feedback on recommendations
  const handleSubmitFeedback = async (product: ProductItem, rating: 'positive' | 'negative', reason?: string) => {
    try {
      const brand = product.brand || product.name.split(' ')[0];
      const targetMsg = rating === 'positive'
        ? `Thumbs up on ${brand}`
        : `Thumbs down on ${brand}${reason ? ` - ${reason.toLowerCase().replace(/_/g, ' ')}` : ''}`;
      runAgentWorkflow(targetMsg);
    } catch (err) {
      console.error(err);
    }
  };

  // Delete individual history item
  const handleDeleteHistoryItem = async (item: HistoryItem) => {
    try {
      // Optimistically remove from list immediately
      setHistoryItems((prev) => prev.filter((h) => h.id !== item.id));

      // If the deleted conversation is the currently active one, reset to clean new chat
      if (selectedHistoryId === item.id || conversationId === item.id) {
        handleNewChat();
      }

      // If persistent conversation on backend, remove it
      if (!item.id.startsWith('h-pur-') && !item.id.startsWith('h-book-')) {
        await deleteConversation(item.id);
      }
    } catch (err) {
      console.error('Failed to delete history item:', err);
      loadConversations();
    }
  };

  // Handle history item click
  const handleSelectHistoryItem = async (item: HistoryItem) => {
    setSelectedHistoryId(item.id);
    setErrorMessage(undefined);

    if (item.category === 'purchases' || item.category === 'bookings' || item.type === 'purchase') {
      const sandboxId =
        item.receipt?.sandboxExecutionId ||
        item.subtitle?.replace('Sandbox #', '') ||
        `SANDBOX-${item.id}`;

      const productItem: ProductItem = item.itemData || {
        id: item.id,
        name: item.title,
        brand: item.type === 'booking' ? 'Verified Travel Operator' : 'Verified Merchant',
        price: item.amount || 0,
        originalPrice: item.amount || 0,
        rating: 4.8,
        reviewCount: 340,
        scores: { performance: 9, battery: 8, value: 9, aiMatch: 95 },
        isRecommended: true,
        whyThisText: 'Verified transaction history record',
        image:
          item.type === 'booking'
            ? 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&auto=format&fit=crop&q=60'
            : 'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=800&auto=format&fit=crop&q=60',
        provider:
          item.type === 'booking' ? 'Travel Booking Service' : 'Verified Store',
        deliveryDays: item.type === 'booking' ? 'Boarding 10:30 PM' : 'Tomorrow by 2:00 PM',
        availability: 'Confirmed (Verified)',
        specs: {
          item: item.title,
          status: 'Transaction archived',
        },
        pros: ['Payment verified in Razorpay Test Mode', 'Booking audit record preserved'],
        cons: [],
        verificationStatus: 'VERIFIED',
      };

      const receipt: SandboxReceipt = item.receipt || {
        receiptId: `SANDBOX-RCP-${item.id}`,
        executionId: sandboxId,
        sandboxOrderId: item.type !== 'booking' ? sandboxId : undefined,
        sandboxBookingId: item.type === 'booking' ? sandboxId : undefined,
        sandboxExecutionId: sandboxId,
        executionType: item.type === 'booking' ? 'BUS_BOOKING' : 'PRODUCT_ORDER',
        timestamp: new Date().toISOString(),
        provider: {
          id: item.type === 'booking' ? 'travel_service' : 'verified_store',
          name: item.type === 'booking' ? 'Travel Booking Service' : 'Verified Store',
        },
        selectedItem: {
          id: item.id,
          title: item.title,
          price: {
            amount: item.amount || 0,
            currency: 'INR',
          },
        },
        costBreakdown: {
          basePrice: item.amount || 0,
          taxes: 0,
          deliveryFee: 0,
          convenienceFee: 0,
          total: item.amount || 0,
          currency: 'INR',
        },
        total: item.amount || 0,
        currency: 'INR',
        executionStatus: 'COMPLETED',
        sandbox: true,
        confirmationTimestamp: new Date().toISOString(),
        completionTimestamp: new Date().toISOString(),
        safetyStatement:
          'DEMO MODE — Razorpay Test Mode transaction recorded successfully.',
        message: 'Demo transaction completed and verified.',
      };

      setExecutionReceipt(receipt);
      setConfirmedOrderId(sandboxId);
      setSelectedProduct(productItem);
      setAgentState('success');
      return;
    }

    // For conversation / chat item:
    try {
      setConversationId(item.id);
      const conv = await fetchConversationById(item.id);
      if (conv) {
        const msgs = conv.messages || [];
        const lastAssistant = [...msgs].reverse().find((m) => m.role === 'assistant');
        const lastUser = [...msgs].reverse().find((m) => m.role === 'user');

        if (lastUser) {
          setActiveQuery(lastUser.content);
        } else {
          setActiveQuery(conv.title);
        }

        if (lastAssistant) {
          setConversationalResponse(lastAssistant.content);
          if (lastAssistant.metadata?.recommendations) {
            setContextualRecommendations(lastAssistant.metadata.recommendations);
          }
          if (lastAssistant.metadata?.pickup) {
            setDetectedPickup(lastAssistant.metadata.pickup);
          }
        }

        setProducts([]);
        setPendingPreparation(null);
        setExecutionReceipt(undefined);
        setAgentState('results');
        return;
      }
    } catch (err) {
      console.warn('Could not fetch conversation details by ID, falling back:', err);
    }

    if (item.query) {
      runAgentWorkflow(item.query);
    }
  };

  // Razorpay Payment handlers
  const handleOpenRazorpay = (product?: ProductItem | null) => {
    const target = product || selectedProduct || products[0];
    setBookingForPayment({
      title: target ? target.name : (activeQuery || 'Bus to Chennai'),
      price: target ? target.price : 950,
      pickup: detectedPickup || userLocationHook.location?.displayName || 'Hyderabad, Telangana',
      destination: 'Chennai',
      dateTime: 'Tomorrow, 08:30 PM',
      busOperator: target ? target.brand : 'Orange Travels (A/C Sleeper)',
      seats: '14A (Window)',
    });
    setIsRazorpayOpen(true);
  };

  const handlePaymentSuccess = (result: {
    bookingId: string;
    paymentId: string;
    orderId: string;
    bookingDetails: BookingDetails;
  }) => {
    setIsRazorpayOpen(false);
    setConfirmedOrderId(result.bookingId);

    const receipt: SandboxReceipt = {
      receiptId: `RCP-${result.bookingId}`,
      executionId: result.orderId,
      sandboxOrderId: result.orderId,
      sandboxBookingId: result.bookingId,
      sandboxExecutionId: result.bookingId,
      executionType: 'BUS_BOOKING',
      timestamp: new Date().toISOString(),
      provider: {
        id: 'travel_service',
        name: result.bookingDetails.busOperator || 'Travel Operator',
      },
      selectedItem: {
        id: result.bookingId,
        title: result.bookingDetails.title,
        price: {
          amount: result.bookingDetails.price,
          currency: 'INR',
        },
      },
      costBreakdown: {
        basePrice: result.bookingDetails.price,
        taxes: 0,
        deliveryFee: 0,
        convenienceFee: 0,
        total: result.bookingDetails.price,
        currency: 'INR',
      },
      total: result.bookingDetails.price,
      currency: 'INR',
      executionStatus: 'COMPLETED',
      sandbox: true,
      confirmationTimestamp: new Date().toISOString(),
      completionTimestamp: new Date().toISOString(),
      safetyStatement:
        'RAZORPAY TEST TRANSACTION COMPLETED — Test payment verified successfully.',
      message: 'Booking confirmed and e-ticket issued in Demo Mode.',
    };

    setExecutionReceipt(receipt);
    setAgentState('success');

    const newBookingItem: HistoryItem = {
      id: result.bookingId,
      title: result.bookingDetails.title,
      type: 'booking',
      category: 'bookings',
      subtitle: `Booking #${result.bookingId} (${result.bookingDetails.pickup || 'Hyderabad'} → ${result.bookingDetails.destination || 'Chennai'})`,
      amount: result.bookingDetails.price,
      status: 'Confirmed',
      date: 'Just now',
      receipt,
    };
    setHistoryItems((prev) => [newBookingItem, ...prev]);

    const speech = `Booking Confirmed! Payment of ₹${result.bookingDetails.price} verified via Razorpay test mode. Your booking ID is ${result.bookingId}.`;
    const gen = tts.invalidateGeneration();
    requestGenerationRef.current = gen;
    tts.speak(speech, gen);
    loadConversations();
  };

  // Layout condition: Are we showing the split results view?
  // All results and text responses are displayed to the RIGHT, opposite to the history sidebar on the left!
  const isSplitView =
    Boolean(conversationalResponse) ||
    products.length > 0 ||
    pendingPreparation !== null ||
    executionReceipt !== undefined ||
    agentState === 'results' ||
    agentState === 'selection' ||
    agentState === 'confirmation' ||
    agentState === 'processing' ||
    agentState === 'success' ||
    agentState === 'thinking' ||
    agentState === 'searching' ||
    agentState === 'comparing' ||
    agentState === 'verifying' ||
    Boolean(activeQuery.trim());

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-[#030306] text-slate-900 dark:text-zinc-100 font-sans transition-colors duration-200">
      {/* 1. COLLAPSIBLE SIDEBAR */}
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        historyItems={historyItems}
        selectedHistoryId={selectedHistoryId}
        onSelectHistoryItem={handleSelectHistoryItem}
        onDeleteHistoryItem={handleDeleteHistoryItem}
        onNewChat={handleNewChat}
        activeNavTab={activeNavTab}
        onSelectNavTab={handleSelectNavTab}
        isMobile={isMobile}
      />

      {/* 2. MAIN AI OPERATING AREA */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Ambient background energy glows (Dark mode only) */}
        <div className="hidden dark:block absolute top-[-10%] left-[20%] w-[500px] h-[500px] rounded-full bg-purple-900/10 blur-[120px] pointer-events-none" />
        <div className="hidden dark:block absolute bottom-[-10%] right-[10%] w-[500px] h-[500px] rounded-full bg-cyan-900/10 blur-[140px] pointer-events-none" />

        {/* Top bar with mobile hamburger, theme toggle, location status, and demo mode badge */}
        <TopBar
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          state={agentState}
          onReset={handleNewChat}
          isCompactView={isSplitView}
          activePersonaId={activePersonaId}
          onSwitchPersona={handleSwitchPersona}
          theme={theme}
          onToggleTheme={toggleTheme}
          userLocation={userLocationHook.location}
          onRequestLocation={userLocationHook.resetPermission}
          locationPermission={userLocationHook.permissionStatus}
        />

        {/* Dynamic Content Area: Transitions between Central AI view and Split Results View */}
        <main className="flex-1 overflow-hidden relative flex flex-col">
          <AnimatePresence mode="wait">
            {/* ============================================================ */}
            {/* VIEW A: INITIAL SCREEN & IN-PROGRESS AGENT SEARCH PIPELINE   */}
            {/* ============================================================ */}
            {!isSplitView ? (
              <motion.div
                key="central-view"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.35 }}
                className="flex-1 flex flex-col items-center justify-between p-3 sm:p-6 max-w-3xl mx-auto w-full h-full overflow-hidden"
              >
                {/* Top spacer */}
                <div className="h-1 sm:h-2" />

                {/* Central AI Orb & Voice Interaction Area */}
                <div className="flex flex-col items-center justify-center my-auto w-full max-w-2xl">
                  <LifeOpsOrb
                    state={agentState}
                    audioLevel={audioLevel}
                    size="hero"
                    onClick={handleToggleVoice}
                  />

                  {/* Exactly 3 Horizontal Quick Recommendations */}
                  {agentState === 'idle' && !activeQuery && !conversationalResponse && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center max-w-xl mx-auto mt-4 px-2"
                    >
                      <div className="flex flex-row items-center justify-center gap-2.5 max-w-full overflow-x-auto no-scrollbar py-1">
                        {['Book me a bus', 'Find laptops', 'Explain C++'].map((tip, idx) => (
                          <button
                            key={tip}
                            id={`quick-tip-${idx}`}
                            type="button"
                            onClick={() => handleSendMessage(tip)}
                            className="text-xs font-semibold px-4 py-1.5 rounded-full bg-white hover:bg-purple-50 dark:bg-white/5 dark:hover:bg-white/10 text-slate-800 hover:text-purple-700 dark:text-zinc-300 dark:hover:text-cyan-300 border border-slate-300 dark:border-white/10 hover:border-purple-400 dark:hover:border-cyan-500/40 transition-all cursor-pointer shadow-xs hover:shadow-sm shrink-0 whitespace-nowrap"
                          >
                            {tip}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Error display with Retry */}
                  {agentState === 'error' && errorMessage && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="w-full max-w-lg mt-3 p-3.5 rounded-xl bg-red-950/70 border border-red-500/40 text-red-200 text-xs flex flex-col gap-2"
                    >
                      <div className="flex items-center gap-2 font-bold text-red-300 text-sm">
                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                        <span>Agent Notice / Connection Error</span>
                      </div>
                      <p className="leading-relaxed">{errorMessage}</p>
                      <div className="pt-1 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => runAgentWorkflow(activeQuery)}
                          className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold text-xs cursor-pointer transition-colors"
                        >
                          Retry Request
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Bottom Input Area: Centered, visible and accessible in viewport */}
                <div className="w-full max-w-2xl pb-2 sm:pb-4 mt-auto">
                  <ChatInput
                    onSendMessage={handleSendMessage}
                    isListening={isListening}
                    onToggleListening={handleToggleVoice}
                    isSpeaking={tts.isSpeaking}
                    onStopSpeaking={tts.stop}
                    disabled={false}
                    audioLevel={audioLevel}
                    transcript={transcript}
                  />
                </div>
              </motion.div>
            ) : (
              /* ============================================================ */
              /* VIEW B: 3-COLUMN LAYOUT (SIDEBAR + CENTER ORB + RIGHT CHAT)  */
              /* ============================================================ */
              <motion.div
                key="split-view"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden"
              >
                {/* 1. CENTER COLUMN: AI Orb & Voice Interaction Area */}
                <aside className="lg:w-80 xl:w-96 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-white/5 bg-white dark:bg-[#06060c]/80 backdrop-blur-xl p-4 sm:p-5 flex flex-col shrink-0 overflow-y-auto">
                  {/* Back to search button */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/5">
                    <button
                      onClick={handleNewChat}
                      className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-white transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                      <span>Start New Search</span>
                    </button>
                    <span className="text-[10px] font-mono text-purple-700 dark:text-purple-400 bg-purple-100 dark:bg-purple-950/60 px-2 py-0.5 rounded border border-purple-300 dark:border-purple-800/40">
                      AI Co-Pilot
                    </span>
                  </div>

                  {/* Compact Living AI Orb */}
                  <div className="py-4 flex flex-col items-center justify-center border-b border-slate-200 dark:border-white/5">
                    <LifeOpsOrb
                      state={agentState}
                      audioLevel={audioLevel}
                      size="compact"
                      onClick={handleToggleVoice}
                    />
                    <span className="text-[11px] font-mono text-zinc-400 mt-2 capitalize">
                      {agentState === 'speaking' ? 'Speaking Live Output' : isListening ? 'Listening...' : 'Active Co-Pilot'}
                    </span>
                  </div>

                  {/* Active Query & Agent Rationale Log */}
                  <div className="py-3 space-y-3 flex-1">
                    <div className="p-3 rounded-xl bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/5 text-xs shadow-sm">
                      <span className="text-[10px] font-mono text-slate-500 dark:text-zinc-500 uppercase block mb-1">
                        Active Directive
                      </span>
                      <p className="text-slate-800 dark:text-zinc-200 font-medium italic">
                        "{activeQuery || 'Autonomous Request'}"
                      </p>
                    </div>

                    {/* Dynamic Agent steps stream */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-mono text-slate-500 dark:text-zinc-500 uppercase tracking-wider block">
                        Agent Log Summary
                      </span>
                      <div className="space-y-1 text-xs text-slate-600 dark:text-zinc-400 font-mono">
                        <div className="flex items-center gap-2 p-1.5 rounded bg-slate-100 dark:bg-zinc-900/30 border border-slate-200/60 dark:border-transparent">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span className="text-slate-700 dark:text-zinc-300">
                            {products.length > 0
                              ? `${products.length} option(s) synthesized`
                              : 'Autonomous context preserved'}
                          </span>
                        </div>
                        {verificationSummary && (
                          <div className="flex items-center gap-2 p-1.5 rounded bg-slate-100 dark:bg-zinc-900/30 border border-slate-200/60 dark:border-transparent">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                            <span className="text-slate-700 dark:text-zinc-300">
                              {verificationSummary.verifiedCount} verified in real-time
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 p-1.5 rounded bg-slate-100 dark:bg-zinc-900/30 border border-slate-200/60 dark:border-transparent">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                          <span className="text-slate-700 dark:text-zinc-300">
                            {agentState === 'confirmation'
                              ? 'Awaiting explicit confirmation'
                              : agentState === 'processing'
                              ? 'Executing simulation in sandbox'
                              : agentState === 'success'
                              ? 'Transaction verified & completed'
                              : 'Consent guard armed'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </aside>

                {/* 2. RIGHT COLUMN: LifeOps AI Response Panel with Fixed Bottom Chat Composer */}
                <section className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-[#030306]/90 border-l border-slate-200 dark:border-white/5">
                  {/* Top Directive Header */}
                  <div className="shrink-0 px-5 py-3 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-white/70 dark:bg-[#070710]/80 backdrop-blur-md">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono">
                        LifeOps AI Response
                      </h3>
                      {activeQuery && (
                        <span className="text-[11px] text-slate-500 dark:text-zinc-400 truncate max-w-[200px] sm:max-w-xs font-light italic">
                          "{activeQuery}"
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleNewChat}
                        className="text-[11px] text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer flex items-center gap-1 font-mono"
                      >
                        <ArrowLeft className="w-3 h-3" />
                        <span>New Query</span>
                      </button>
                    </div>
                  </div>

                  {/* Independently Scrollable Conversation Area */}
                  <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                    {/* Bus booking location banner if active */}
                    {detectedPickup && (activeQuery.toLowerCase().includes('bus') || conversationalResponse?.toLowerCase().includes('pickup') || conversationalResponse?.toLowerCase().includes('bus')) && (
                      <div className="p-3.5 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 flex flex-wrap items-center justify-between gap-3 text-xs shadow-lg">
                        <div className="flex items-center gap-2.5">
                          <MapPin className="w-4 h-4 text-cyan-400 shrink-0 animate-pulse" />
                          <span className="text-zinc-300">
                            Pickup Point: <strong className="text-cyan-300 font-semibold">{detectedPickup}</strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => runAgentWorkflow(`Use pickup ${detectedPickup}`)}
                            className="px-3 py-1.5 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30 text-xs font-semibold cursor-pointer transition-colors shadow-xs"
                          >
                            Use Current Location
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const custom = window.prompt('Enter new pickup location:', 'Vijayawada');
                              if (custom) {
                                setDetectedPickup(custom);
                                runAgentWorkflow(`Book bus from ${custom} to Chennai`);
                              }
                            }}
                            className="px-3 py-1.5 rounded-xl bg-white/5 text-zinc-300 border border-white/10 hover:bg-white/10 text-xs font-medium cursor-pointer transition-colors shadow-xs"
                          >
                            Change Pickup
                          </button>
                        </div>
                      </div>
                    )}

                    {/* A. Conversational Text Response with EXACTLY 3 horizontal recommendations */}
                    {conversationalResponse &&
                      products.length === 0 &&
                      !pendingPreparation &&
                      !executionReceipt && (
                        <ConversationalAnswerPanel
                          answer={conversationalResponse}
                          activeQuery={activeQuery}
                          recommendations={contextualRecommendations}
                          isSpeaking={tts.isSpeaking}
                          onSpeakAgain={() => {
                            if (conversationalResponse) {
                              const newGen = tts.invalidateGeneration();
                              requestGenerationRef.current = newGen;
                              tts.speak(conversationalResponse, newGen);
                            }
                          }}
                          onStopSpeaking={tts.stop}
                          onNewSearch={handleNewChat}
                          onSelectSuggestion={(prompt) => runAgentWorkflow(prompt)}
                        />
                      )}

                    {/* B. Live Processing / Reasoning Panel */}
                    {(agentState === 'thinking' ||
                      agentState === 'searching' ||
                      agentState === 'comparing' ||
                      agentState === 'verifying' ||
                      agentState === 'processing') &&
                      !conversationalResponse &&
                      products.length === 0 &&
                      !pendingPreparation &&
                      !executionReceipt && (
                        <div className="max-w-2xl mx-auto py-12">
                          <AgentStatusPanel
                            state={agentState}
                            thoughts={thoughts}
                            activeQuery={activeQuery}
                          />
                        </div>
                      )}

                    {/* C. Product / Multi-Provider Recommendations */}
                    {(agentState === 'results' ||
                      ((agentState === 'speaking' ||
                        agentState === 'listening' ||
                        agentState === 'interrupted') &&
                        products.length > 0 &&
                        !pendingPreparation &&
                        !executionReceipt)) && (
                      <ResultsPanel
                        products={products}
                        onSelectProduct={handleSelectProduct}
                        onBackToSearch={handleNewChat}
                        selectedProduct={selectedProduct}
                        comparisonSummary={comparisonSummary}
                        hasMatches={hasMatches}
                        suggestedRelaxations={suggestedRelaxations}
                        activeQuery={activeQuery}
                        onApplyRelaxation={handleApplyRelaxation}
                        errorMessage={errorMessage}
                        selectingProductId={selectingProductId}
                        preferenceConflicts={preferenceConflicts}
                        relaxationOptions={relaxationOptions}
                        activeSessionPreferences={activeSessionPreferences}
                        effectivePreferences={effectivePreferences}
                        activePersonaId={activePersonaId}
                        stagedInferences={stagedInferences}
                        onSelectConflictOption={(label) => runAgentWorkflow(label)}
                        onRejectRelaxation={() => runAgentWorkflow('No, keep my constraints')}
                        onSwitchPersona={handleSwitchPersona}
                        onAcceptInference={handleAcceptInference}
                        onRejectInference={handleRejectInference}
                        onFeedback={handleSubmitFeedback}
                        aiAnalysisSummary={aiAnalysisSummary}
                      />
                    )}

                    {/* D. Confirmation Gate with Razorpay Integration */}
                    {(agentState === 'confirmation' ||
                      agentState === 'processing' ||
                      ((agentState === 'speaking' ||
                        agentState === 'listening' ||
                        agentState === 'interrupted') &&
                        pendingPreparation &&
                        !executionReceipt)) &&
                      selectedProduct && (
                        <ConfirmationPanel
                          product={selectedProduct}
                          preparation={pendingPreparation}
                          executionStatus={pendingPreparation?.status || 'AWAITING_CONFIRMATION'}
                          onConfirm={handleConfirmPurchase}
                          onCancel={handleCancelPreparation}
                          onPayWithRazorpay={() => handleOpenRazorpay(selectedProduct)}
                          isProcessing={isConfirmingBackend || agentState === 'processing'}
                        />
                      )}

                    {/* E. Success / Booking Receipt */}
                    {(agentState === 'success' ||
                      ((agentState === 'speaking' ||
                        agentState === 'listening' ||
                        agentState === 'interrupted') &&
                        executionReceipt)) &&
                      selectedProduct && (
                        <SuccessPanel
                          product={selectedProduct}
                          orderId={confirmedOrderId || 'LO-8440'}
                          receipt={executionReceipt}
                          onNewTask={handleNewChat}
                        />
                      )}

                    {/* F. Error Notice with Instant Retry */}
                    {agentState === 'error' && errorMessage && (
                      <div className="p-4 rounded-2xl bg-red-950/70 border border-red-500/40 text-red-200 text-xs space-y-2 shadow-xl">
                        <div className="flex items-center gap-2 text-red-300 font-bold text-sm">
                          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                          <span>Agent Notice / Connection Issue</span>
                        </div>
                        <p className="leading-relaxed text-zinc-300">{errorMessage}</p>
                        <div className="pt-2 flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => runAgentWorkflow(activeQuery)}
                            className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-pink-600 hover:brightness-110 text-white font-semibold text-xs transition-all cursor-pointer shadow-md"
                          >
                            Retry Request
                          </button>
                          <button
                            type="button"
                            onClick={handleNewChat}
                            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs transition-colors"
                          >
                            Reset
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Bottom spacer ensuring scroll never covers last message */}
                    <div className="h-6" />
                  </div>

                  {/* FIXED BOTTOM CHAT COMPOSER */}
                  <div className="shrink-0 p-3 sm:p-4 bg-white/95 dark:bg-[#070710]/95 backdrop-blur-xl border-t border-slate-200 dark:border-white/10 z-10 shadow-lg">
                    <ChatInput
                      onSendMessage={handleSendMessage}
                      isListening={isListening}
                      onToggleListening={handleToggleVoice}
                      isSpeaking={tts.isSpeaking}
                      onStopSpeaking={tts.stop}
                      audioLevel={audioLevel}
                      transcript={transcript}
                      disabled={agentState === 'processing'}
                    />
                  </div>
                </section>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* 3. USER CUSTOMIZATION & PERSONALIZATION MODAL */}
      <PreferencesModal
        isOpen={isPreferencesOpen}
        onClose={() => {
          setIsPreferencesOpen(false);
          if (activeNavTab === 'preferences') {
            setActiveNavTab('chat');
          }
        }}
        initialProfile={userProfile}
        onProfileUpdated={(updated) => {
          setUserProfile(updated);
          if (updated.activePersonaId) setActivePersonaId(updated.activePersonaId);
          if (updated.stagedInferences) setStagedInferences(updated.stagedInferences);
        }}
        activeSessionPreferences={activeSessionPreferences}
      />

      {/* 4. CLERK AUTHENTICATION MODAL */}
      <AuthModal />

      {/* 5. LOCATION PERMISSION MODAL */}
      <LocationPermissionModal
        isOpen={userLocationHook.showPermissionModal}
        isLocating={userLocationHook.isLocating}
        onAllow={userLocationHook.handleAllowLocation}
        onDismiss={userLocationHook.handleDismissLocation}
        error={userLocationHook.locationError}
      />

      {/* 6. RAZORPAY CHECKOUT MODAL */}
      {bookingForPayment && (
        <RazorpayCheckoutModal
          isOpen={isRazorpayOpen}
          onClose={() => setIsRazorpayOpen(false)}
          booking={bookingForPayment}
          conversationId={conversationId}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}

export default App;

