import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Send, Volume2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isListening: boolean;
  onToggleListening: () => void;
  disabled?: boolean;
  audioLevel?: number;
  transcript?: string;
  isCompact?: boolean;
  isSpeaking?: boolean;
  onStopSpeaking?: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  isListening,
  onToggleListening,
  disabled = false,
  audioLevel = 0,
  transcript = '',
  isCompact = false,
  isSpeaking = false,
  onStopSpeaking,
}) => {
  const [inputVal, setInputVal] = useState('');

  // Update input text with speech transcript if listening
  useEffect(() => {
    if (isListening && transcript) {
      setInputVal(transcript);
    }
  }, [isListening, transcript]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputVal.trim() || disabled) return;
    onSendMessage(inputVal.trim());
    setInputVal('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className={`w-full max-w-2xl mx-auto px-4 ${isCompact ? 'py-2' : 'py-4'}`}>
      {/* Speaking Active Banner */}
      <AnimatePresence>
        {isSpeaking && !isListening && (
          <motion.div
            initial={{ opacity: 0, y: 10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: 10, height: 0 }}
            className="mb-3 p-3 rounded-2xl bg-gradient-to-r from-cyan-950/70 via-purple-950/60 to-pink-950/70 border border-cyan-500/40 backdrop-blur-xl flex items-center justify-between gap-4 shadow-lg shadow-cyan-950/50"
          >
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300">
                <Volume2 className="w-3.5 h-3.5 animate-pulse" />
              </span>
              <span className="text-xs sm:text-sm font-medium text-cyan-200">
                🔊 LifeOps is speaking... (Tap Orb to interrupt)
              </span>
            </div>

            {onStopSpeaking && (
              <button
                type="button"
                onClick={onStopSpeaking}
                className="px-2.5 py-1 text-[11px] font-semibold text-white bg-cyan-700/80 hover:bg-cyan-600 rounded-lg transition-colors shadow-sm"
              >
                Interrupt
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Listening Waveform Bar */}
      <AnimatePresence>
        {isListening && (
          <motion.div
            initial={{ opacity: 0, y: 10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: 10, height: 0 }}
            className="mb-3 p-3 rounded-2xl bg-gradient-to-r from-purple-950/70 via-pink-950/60 to-cyan-950/70 border border-purple-500/40 backdrop-blur-xl flex items-center justify-between gap-4 shadow-lg shadow-purple-950/50"
          >
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              <span className="text-xs font-medium text-purple-200">
                🎤 Listening... Speak naturally
              </span>
            </div>

            {/* Audio reactive wave equalizer bars */}
            <div className="flex items-center gap-1 h-5">
              {[...Array(9)].map((_, i) => {
                const height = Math.max(
                  4,
                  Math.sin((i + 1) * 0.7 + audioLevel * 8) * 16 * (0.3 + audioLevel * 0.7)
                );
                return (
                  <div
                    key={i}
                    className="w-1 bg-gradient-to-t from-pink-500 to-cyan-400 rounded-full transition-all duration-75"
                    style={{ height: `${height}px` }}
                  />
                );
              })}
            </div>

            <button
              type="button"
              onClick={onToggleListening}
              className="px-2.5 py-1 text-[11px] font-semibold text-white bg-red-600/80 hover:bg-red-500 rounded-lg transition-colors"
            >
              Done Speaking
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Input Bar */}
      <form
        onSubmit={handleSubmit}
        className="relative flex items-center bg-white dark:bg-[#0d0d18]/90 border border-slate-300 dark:border-white/10 hover:border-purple-400 dark:hover:border-purple-500/40 focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-500/20 rounded-2xl p-1.5 backdrop-blur-2xl transition-all shadow-xl shadow-slate-900/8 dark:shadow-black/60"
      >
        {/* Prominent Futuristic Microphone Button */}
        <button
          type="button"
          onClick={() => {
            if (isSpeaking && onStopSpeaking) {
              onStopSpeaking();
              onToggleListening();
            } else {
              onToggleListening();
            }
          }}
          disabled={disabled}
          title={isSpeaking ? 'Interrupt Speech' : isListening ? 'Stop Listening' : 'Voice Input'}
          className={`relative p-3 rounded-xl flex items-center justify-center transition-all duration-300 group ${
            isListening
              ? 'bg-red-500 text-white shadow-lg shadow-red-500/40 scale-105 animate-pulse'
              : isSpeaking
              ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/40 animate-pulse'
              : 'bg-purple-100 dark:bg-gradient-to-tr dark:from-purple-600/20 dark:to-cyan-600/20 text-purple-700 dark:text-cyan-300 hover:text-purple-900 dark:hover:text-white hover:bg-purple-200 dark:hover:from-purple-600 dark:hover:to-cyan-500 shadow-sm'
          }`}
        >
          {isListening ? (
            <MicOff className="w-5 h-5" />
          ) : isSpeaking ? (
            <Volume2 className="w-5 h-5" />
          ) : (
            <Mic className="w-5 h-5 group-hover:scale-110 transition-transform" />
          )}

          {/* Subtle neon ring highlight around microphone */}
          {!isListening && !isSpeaking && (
            <span className="absolute inset-0 rounded-xl border border-purple-300 dark:border-cyan-400/30 pointer-events-none" />
          )}
        </button>

        {/* Text Input */}
        <input
          id="chat-input-field"
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Tell LifeOps what you need..."
          className="flex-1 bg-transparent px-4 py-2.5 text-sm sm:text-base text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none font-normal"
        />

        {/* Send Button */}
        <button
          id="chat-submit-btn"
          type="submit"
          disabled={!inputVal.trim() || disabled}
          className={`p-3 rounded-xl flex items-center justify-center transition-all duration-200 ${
            inputVal.trim() && !disabled
              ? 'bg-gradient-to-r from-purple-600 to-cyan-500 text-white shadow-lg shadow-cyan-500/30 hover:brightness-110 active:scale-95'
              : 'bg-slate-100 dark:bg-zinc-800/50 text-slate-400 dark:text-zinc-500 cursor-not-allowed'
          }`}
          title="Send query"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
