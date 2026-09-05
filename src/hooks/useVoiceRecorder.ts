import { useState, useEffect, useRef, useCallback } from 'react';
import {
  isInterruptionCommand,
  STANDARD_MICROPHONE_CONSTRAINTS,
} from '../utils/voiceUtils';

export interface UseVoiceRecorderOptions {
  onSpeechComplete?: (query: string) => void;
  isSpeaking?: boolean;
}

export interface VoiceRecorderReturn {
  isListening: boolean;
  audioLevel: number; // 0 to 1
  transcript: string;
  isMicAvailable: boolean;
  startListening: () => Promise<void>;
  stopListening: () => void;
  cancelListening: () => void;
  toggleListening: () => void;
  resetTranscript: () => void;
}

export function useVoiceRecorder(
  optionsOrOnSpeechComplete?: ((query: string) => void) | UseVoiceRecorderOptions
): VoiceRecorderReturn {
  // Normalize options
  const options: UseVoiceRecorderOptions =
    typeof optionsOrOnSpeechComplete === 'function'
      ? { onSpeechComplete: optionsOrOnSpeechComplete }
      : optionsOrOnSpeechComplete || {};

  const { onSpeechComplete } = options;

  const [isListening, setIsListening] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [isMicAvailable, setIsMicAvailable] = useState(true);

  // References for state and callbacks to prevent stale closure in async handlers
  const isListeningRef = useRef<boolean>(false);
  const currentTranscriptRef = useRef<string>('');
  const ignoreNextSubmissionRef = useRef<boolean>(false);
  const hasSubmittedRef = useRef<boolean>(false);

  const onSpeechCompleteRef = useRef(onSpeechComplete);
  onSpeechCompleteRef.current = onSpeechComplete;

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const syntheticIntervalRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);

  const submitFinalSpeech = useCallback((query: string) => {
    if (hasSubmittedRef.current) return;
    const clean = query.trim();
    const shouldIgnore =
      ignoreNextSubmissionRef.current || isInterruptionCommand(clean);
    ignoreNextSubmissionRef.current = false;

    if (clean && !shouldIgnore) {
      hasSubmittedRef.current = true;
      if (onSpeechCompleteRef.current) {
        onSpeechCompleteRef.current(clean);
      }
    }
  }, []);

  const cleanupAudioResources = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch {}
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current) {
      try {
        audioContextRef.current.close().catch(() => {});
      } catch {}
      audioContextRef.current = null;
    }

    if (syntheticIntervalRef.current) {
      clearInterval(syntheticIntervalRef.current);
      syntheticIntervalRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  // Setup English Web Speech API
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          // If not actively listening, ignore any stray results
          if (!isListeningRef.current) return;

          let currentText = '';
          for (let i = 0; i < event.results.length; i++) {
            currentText += event.results[i][0].transcript;
          }
          const clean = currentText.trim();

          // In standard listening mode: check if user said "Stop" or "Listen to me" to discard
          if (isInterruptionCommand(clean)) {
            setTranscript('');
            currentTranscriptRef.current = '';
            ignoreNextSubmissionRef.current = true;
            return;
          }

          setTranscript(clean);
          currentTranscriptRef.current = clean;
        };

        recognition.onend = () => {
          // If listening mode was active, finalize speech safely without duplicate fires
          if (isListeningRef.current) {
            setIsListening(false);
            isListeningRef.current = false;
            cleanupAudioResources();

            const finalQuery = currentTranscriptRef.current.trim();
            if (finalQuery) {
              submitFinalSpeech(finalQuery);
            }
            setTranscript('');
            currentTranscriptRef.current = '';
          }
        };

        recognition.onerror = (e: any) => {
          // Ignore graceful aborted errors
          if (e.error === 'aborted' || e.error === 'no-speech') {
            return;
          }
          console.warn('SpeechRecognition error:', e.error);
        };

        recognitionRef.current = recognition;
      } catch (err) {
        console.warn('SpeechRecognition initialization error', err);
      }
    }
  }, [submitFinalSpeech, cleanupAudioResources]);

  const startSyntheticAudio = useCallback(() => {
    let t = 0;
    const interval = window.setInterval(() => {
      t += 0.15;
      const base = Math.sin(t * 1.8) * 0.3 + Math.sin(t * 3.4) * 0.2 + Math.cos(t * 0.9) * 0.15;
      const noise = (Math.random() - 0.5) * 0.15;
      const normalized = Math.max(0.15, Math.min(0.95, 0.45 + base + noise));
      setAudioLevel(normalized);
    }, 40);
    syntheticIntervalRef.current = interval;
  }, []);

  /**
   * Starts microphone stream with echo cancellation and audio level analysis loop
   */
  const acquireMicrophoneStream = useCallback(async () => {
    if (mediaStreamRef.current) return true;

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        let stream: MediaStream;
        try {
          // Hardware echo cancellation and noise suppression
          stream = await navigator.mediaDevices.getUserMedia(STANDARD_MICROPHONE_CONSTRAINTS);
        } catch {
          // Fallback to basic audio constraint if specific constraints are unsupported
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }

        mediaStreamRef.current = stream;

        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        audioContextRef.current = ctx;

        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.75;
        source.connect(analyser);
        analyserRef.current = analyser;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const updateAudio = () => {
          if (!isListeningRef.current) {
            setAudioLevel(0);
            return;
          }

          analyser.getByteFrequencyData(dataArray);

          // Calculate energy for visual level indicator
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const avg = sum / bufferLength;
          const level = Math.min(1, Math.max(0.05, Math.pow(avg / 110, 1.25)));
          setAudioLevel(level);

          animFrameRef.current = requestAnimationFrame(updateAudio);
        };

        updateAudio();
        setIsMicAvailable(true);
        return true;
      }
    } catch (err) {
      console.warn('Microphone acquisition error:', err);
      setIsMicAvailable(false);
      return false;
    }

    return false;
  }, []);

  const startListening = useCallback(async () => {
    // Reset transcript buffers cleanly before starting new listening session
    setTranscript('');
    currentTranscriptRef.current = '';
    ignoreNextSubmissionRef.current = false;
    hasSubmittedRef.current = false;
    setIsListening(true);
    isListeningRef.current = true;

    // Start Web Speech recognition if supported, cleanly restarting to drop prior turn buffer
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // Safe ignore
      }
      try {
        recognitionRef.current.start();
      } catch {
        // May already be active
      }
    }

    const acquired = await acquireMicrophoneStream();
    if (!acquired) {
      startSyntheticAudio();
    }
  }, [acquireMicrophoneStream, startSyntheticAudio]);

  const stopListening = useCallback(() => {
    if (!isListeningRef.current) return;
    setIsListening(false);
    isListeningRef.current = false;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }

    cleanupAudioResources();

    const final = currentTranscriptRef.current.trim() || transcript.trim();
    if (final) {
      submitFinalSpeech(final);
    }

    setTranscript('');
    currentTranscriptRef.current = '';
  }, [cleanupAudioResources, transcript, submitFinalSpeech]);

  const cancelListening = useCallback(() => {
    ignoreNextSubmissionRef.current = true;
    hasSubmittedRef.current = true;
    setIsListening(false);
    isListeningRef.current = false;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
    }

    cleanupAudioResources();
    setTranscript('');
    currentTranscriptRef.current = '';
  }, [cleanupAudioResources]);

  const toggleListening = useCallback(() => {
    if (isListeningRef.current) {
      stopListening();
    } else {
      startListening();
    }
  }, [startListening, stopListening]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    currentTranscriptRef.current = '';
    hasSubmittedRef.current = false;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (syntheticIntervalRef.current) clearInterval(syntheticIntervalRef.current);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    };
  }, []);

  return {
    isListening,
    audioLevel,
    transcript,
    isMicAvailable,
    startListening,
    stopListening,
    cancelListening,
    toggleListening,
    resetTranscript,
  };
}
