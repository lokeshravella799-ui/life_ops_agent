/**
 * LifeOps Voice Utilities
 * Core helpers for English-only Speech-to-Text, Text-to-Speech chunking,
 * Voice Activity Detection (VAD), and natural barge-in interruption.
 */

export type VoiceState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'interrupted'
  | 'error';

export interface VADConfig {
  energyThreshold: number; // 0.0 to 1.0 (conservatively tuned, default 0.18)
  gracePeriodMs: number; // Time window after TTS begins to avoid speaker-start echo (default 450ms)
  consecutiveFramesRequired: number; // Sustained voice activity count before triggering barge-in (default 3 frames ~60ms)
}

export const DEFAULT_VAD_CONFIG: VADConfig = {
  energyThreshold: 0.18,
  gracePeriodMs: 450,
  consecutiveFramesRequired: 3,
};

export const INTERRUPTION_COMMANDS = ['stop', 'listen to me', 'listen'] as const;

/**
 * Normalizes speech input and checks if it matches an explicit voice interruption command.
 * Case-insensitive, strips trailing punctuation.
 */
export function isInterruptionCommand(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const clean = text
    .trim()
    .toLowerCase()
    .replace(/[.,!?;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return (
    clean === 'stop' ||
    clean === 'listen to me' ||
    clean === 'listen' ||
    clean === 'stop please' ||
    clean === 'please stop'
  );
}

/**
 * Splits response text into natural, safe sentence chunks for continuous, reliable TTS playback.
 * Avoids Chrome 15-second speech synthesis timeout bug and enables immediate mid-response interruption.
 * Cleans markdown formatting, expands currency symbols to words.
 */
export function chunkTextForSpeech(text: string, maxChunkLength: number = 180): string[] {
  if (!text || typeof text !== 'string' || !text.trim()) return [];

  // Clean markdown formatting: bold, italic, backticks, list markers, headers
  const cleaned = text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*•]\s+/gm, '')
    .replace(/₹\s*([0-9,]+)/g, '$1 rupees')
    .replace(/₹/g, ' rupees ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!cleaned) return [];

  // Match sentences ending in punctuation (. ! ?) followed by whitespace or line end.
  const sentenceRegex = /[^.!?\n]+(?:[.!?\n]+|$)/g;
  const matches = cleaned.match(sentenceRegex) || [cleaned];
  const chunks: string[] = [];

  for (const m of matches) {
    const trimmed = m.trim();
    if (!trimmed) continue;

    if (trimmed.length <= maxChunkLength) {
      chunks.push(trimmed);
    } else {
      // Split overly long sentence by clauses or punctuation
      const subClauses = trimmed.split(/([,;:]\s+)/);
      let buffer = '';
      for (const clause of subClauses) {
        if ((buffer + clause).length > maxChunkLength && buffer.length > 0) {
          chunks.push(buffer.trim());
          buffer = clause;
        } else {
          buffer += clause;
        }
      }
      if (buffer.trim()) {
        chunks.push(buffer.trim());
      }
    }
  }

  return chunks.length > 0 ? chunks : [cleaned];
}

/**
 * Calculates normalized RMS audio energy from frequency/waveform byte array (0.0 to 1.0)
 */
export function calculateAudioEnergy(dataArray: Uint8Array): number {
  if (!dataArray || dataArray.length === 0) return 0;
  let sumSquares = 0;
  for (let i = 0; i < dataArray.length; i++) {
    // Center at 128 for 8-bit PCM byte data or normalize frequency bin
    const normalized = (dataArray[i] - 128) / 128;
    sumSquares += normalized * normalized;
  }
  const rms = Math.sqrt(sumSquares / dataArray.length);
  return Math.min(1.0, Math.max(0, rms * 2.0));
}

/**
 * Determines whether audio energy qualifies as barge-in voice interruption
 */
export function shouldTriggerBargeIn(
  energy: number,
  timeSinceSpeechStartMs: number,
  consecutiveActiveFrames: number,
  config: VADConfig = DEFAULT_VAD_CONFIG
): boolean {
  // Anti-echo protection: Disallow interruption during the immediate grace window
  if (timeSinceSpeechStartMs < config.gracePeriodMs) {
    return false;
  }

  // Energy must exceed threshold for sustained consecutive frames
  return (
    energy >= config.energyThreshold &&
    consecutiveActiveFrames >= config.consecutiveFramesRequired
  );
}

/**
 * Standard browser microphone constraints with hardware echo cancellation & noise suppression
 */
export const STANDARD_MICROPHONE_CONSTRAINTS: MediaStreamConstraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
};
