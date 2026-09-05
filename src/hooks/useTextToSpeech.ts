import { useState, useEffect, useRef, useCallback } from 'react';
import { chunkTextForSpeech } from '../utils/voiceUtils';

export interface UseTextToSpeechOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  onChunkStart?: (chunk: string, index: number, total: number) => void;
  onError?: (error: any) => void;
}

export interface UseTextToSpeechReturn {
  isSpeaking: boolean;
  currentChunk: string;
  chunkIndex: number;
  totalChunks: number;
  isSupported: boolean;
  currentGeneration: number;
  speak: (text: string, generationId?: number) => boolean;
  stop: () => void;
  invalidateGeneration: () => number;
  primeSynthesizer: () => void;
}

export interface TTSChunkItem {
  text: string;
  generationId: number;
  index: number;
  total: number;
}

export function useTextToSpeech(options: UseTextToSpeechOptions = {}): UseTextToSpeechReturn {
  const {
    rate = 0.95,
    pitch = 1.0,
    volume = 1.0,
    onSpeechStart,
    onSpeechEnd,
    onChunkStart,
    onError,
  } = options;

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentChunk, setCurrentChunk] = useState('');
  const [chunkIndex, setChunkIndex] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [isSupported, setIsSupported] = useState(false);

  const availableVoicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const selectedVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const generationRef = useRef<number>(1);
  const speechQueueRef = useRef<TTSChunkItem[]>([]);
  const isSpeakingRef = useRef<boolean>(false);
  const keepAliveTimerRef = useRef<number | null>(null);
  // Persistent reference to active SpeechSynthesisUtterance objects to prevent V8 garbage collection
  const activeUtterancesRef = useRef<SpeechSynthesisUtterance[]>([]);

  // Resolves the best available natural English voice
  const resolvePreferredVoice = useCallback((voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null => {
    if (!voices || voices.length === 0) return null;

    const englishVoices = voices.filter(
      (v) => v.lang.startsWith('en-US') || v.lang.startsWith('en')
    );

    return (
      englishVoices.find((v) => v.name.includes('Natural') || v.name.includes('Online')) ||
      englishVoices.find((v) => v.name.includes('Google') && v.lang === 'en-US') ||
      englishVoices.find((v) => v.name.includes('Microsoft') && (v.name.includes('Jenny') || v.name.includes('David') || v.name.includes('Aria') || v.name.includes('Zira'))) ||
      englishVoices.find((v) => v.name.includes('Samantha')) ||
      englishVoices.find((v) => v.lang === 'en-US') ||
      englishVoices[0] ||
      null
    );
  }, []);

  // Check browser support and load available English voices
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setIsSupported(true);

      const updateVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        availableVoicesRef.current = voices;
        selectedVoiceRef.current = resolvePreferredVoice(voices);
      };

      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, [resolvePreferredVoice]);

  // Primes / unlocks speech synthesis during user gestures to bypass browser autoplay restrictions
  const primeSynthesizer = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.resume();
        const silent = new SpeechSynthesisUtterance('');
        silent.volume = 0;
        silent.rate = 2.0;
        window.speechSynthesis.speak(silent);
      } catch (err) {
        console.debug('Synthesizer priming notice:', err);
      }
    }
  }, []);

  // Chrome TTS Keepalive workaround: Chrome can pause speech after 14 seconds
  const startKeepAlive = useCallback(() => {
    if (keepAliveTimerRef.current) clearInterval(keepAliveTimerRef.current);
    keepAliveTimerRef.current = window.setInterval(() => {
      if (window.speechSynthesis && isSpeakingRef.current && window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 8000);
  }, []);

  const stopKeepAlive = useCallback(() => {
    if (keepAliveTimerRef.current) {
      clearInterval(keepAliveTimerRef.current);
      keepAliveTimerRef.current = null;
    }
  }, []);

  /**
   * Immediately stops and cancels all speech synthesis playback,
   * increments generation token to invalidate pending callbacks and queued chunks.
   */
  const invalidateGeneration = useCallback((): number => {
    generationRef.current += 1;
    const newGen = generationRef.current;
    speechQueueRef.current = [];
    isSpeakingRef.current = false;
    activeUtterancesRef.current = [];
    stopKeepAlive();

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
        window.speechSynthesis.resume();
      } catch (err) {
        console.warn('SpeechSynthesis cancel error', err);
      }
    }

    setIsSpeaking(false);
    setCurrentChunk('');
    setChunkIndex(0);
    setTotalChunks(0);
    return newGen;
  }, [stopKeepAlive]);

  const stop = invalidateGeneration;

  /**
   * Plays the next chunk in the queue sequentially with generation verification
   */
  const playNextChunk = useCallback(
    (gen: number) => {
      // Invalidation check: drop if generation token has changed or speaking stopped
      if (gen !== generationRef.current || !isSpeakingRef.current) {
        return;
      }

      if (speechQueueRef.current.length === 0) {
        // Entire response spoken
        isSpeakingRef.current = false;
        activeUtterancesRef.current = [];
        setIsSpeaking(false);
        setCurrentChunk('');
        stopKeepAlive();
        if (onSpeechEnd) onSpeechEnd();
        return;
      }

      const chunkItem = speechQueueRef.current.shift()!;
      // Verify chunk's own generation matches active generation
      if (chunkItem.generationId !== generationRef.current) {
        return;
      }

      setCurrentChunk(chunkItem.text);
      setChunkIndex(chunkItem.index);

      if (onChunkStart) {
        onChunkStart(chunkItem.text, chunkItem.index, chunkItem.total);
      }

      try {
        const utterance = new SpeechSynthesisUtterance(chunkItem.text);
        utterance.lang = 'en-US';
        utterance.rate = rate;
        utterance.pitch = pitch;
        utterance.volume = volume;

        // Dynamic voice resolution if not previously loaded
        let voice = selectedVoiceRef.current;
        if (!voice && typeof window !== 'undefined' && window.speechSynthesis) {
          const loadedVoices = window.speechSynthesis.getVoices();
          voice = resolvePreferredVoice(loadedVoices);
          if (voice) selectedVoiceRef.current = voice;
        }

        if (voice) {
          utterance.voice = voice;
        }

        // Retain utterance in active array to prevent V8 garbage collection
        activeUtterancesRef.current.push(utterance);

        utterance.onstart = () => {
          if (gen !== generationRef.current) {
            window.speechSynthesis.cancel();
            return;
          }
          if (chunkItem.index === 1 && onSpeechStart) {
            onSpeechStart();
          }
        };

        utterance.onend = () => {
          // Remove from active utterances
          activeUtterancesRef.current = activeUtterancesRef.current.filter((u) => u !== utterance);
          if (gen !== generationRef.current) return;
          // Play next chunk with slight pause (50ms) for natural cadence
          setTimeout(() => {
            if (gen === generationRef.current) {
              playNextChunk(gen);
            }
          }, 50);
        };

        utterance.onerror = (e: SpeechSynthesisErrorEvent) => {
          activeUtterancesRef.current = activeUtterancesRef.current.filter((u) => u !== utterance);
          // If canceled intentionally, ignore
          if (e.error === 'canceled' || e.error === 'interrupted') {
            return;
          }
          console.warn('TTS utterance error:', e.error);
          if (gen !== generationRef.current) return;

          if (onError) onError(e);
          // Try proceeding to next chunk if still in current generation
          setTimeout(() => {
            if (gen === generationRef.current) {
              playNextChunk(gen);
            }
          }, 50);
        };

        // Resume engine in case Chrome paused internal queue
        try {
          if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
          }
        } catch {}

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.error('Failed to create SpeechSynthesisUtterance', err);
        isSpeakingRef.current = false;
        activeUtterancesRef.current = [];
        setIsSpeaking(false);
        stopKeepAlive();
        if (onError) onError(err);
      }
    },
    [rate, pitch, volume, onSpeechStart, onSpeechEnd, onChunkStart, onError, stopKeepAlive, resolvePreferredVoice]
  );

  /**
   * Speaks the input text in clean, sequential sentence chunks.
   * If generationId is provided, validates that it matches generationRef.current.
   */
  const speak = useCallback(
    (text: string, targetGeneration?: number): boolean => {
      if (!text || typeof text !== 'string' || !text.trim()) return false;
      if (typeof window === 'undefined' || !window.speechSynthesis) return false;

      // 1. If explicit target generation is given, check if it's already stale
      if (targetGeneration !== undefined && targetGeneration !== generationRef.current) {
        console.info('TTS speak discarded: target generation is obsolete', {
          targetGeneration,
          current: generationRef.current,
        });
        return false;
      }

      // 2. If target generation is not provided, start a fresh generation
      let activeGen = targetGeneration;
      if (activeGen === undefined) {
        activeGen = invalidateGeneration();
      } else {
        // Cancel prior speech without incrementing generation again
        speechQueueRef.current = [];
        activeUtterancesRef.current = [];
        isSpeakingRef.current = false;
        stopKeepAlive();
        try {
          window.speechSynthesis.cancel();
          window.speechSynthesis.resume();
        } catch {}
      }

      // 3. Chunk text into clean sentences
      const chunks = chunkTextForSpeech(text);
      if (chunks.length === 0) return false;

      const taggedChunks: TTSChunkItem[] = chunks.map((c, idx) => ({
        text: c,
        generationId: activeGen!,
        index: idx + 1,
        total: chunks.length,
      }));

      speechQueueRef.current = [...taggedChunks];
      setTotalChunks(chunks.length);
      setChunkIndex(0);
      isSpeakingRef.current = true;
      setIsSpeaking(true);

      startKeepAlive();

      // Ensure speech synthesis is active and unpaused
      try {
        window.speechSynthesis.resume();
      } catch {}

      // Small delay to ensure browser speech engine has flushed prior cancel
      setTimeout(() => {
        if (activeGen === generationRef.current) {
          playNextChunk(activeGen!);
        }
      }, 40);

      return true;
    },
    [invalidateGeneration, startKeepAlive, playNextChunk, stopKeepAlive]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    isSpeaking,
    currentChunk,
    chunkIndex,
    totalChunks,
    isSupported,
    currentGeneration: generationRef.current,
    speak,
    stop,
    invalidateGeneration,
    primeSynthesizer,
  };
}
