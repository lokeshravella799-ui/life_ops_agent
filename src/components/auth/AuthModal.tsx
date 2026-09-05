import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, Shield, Key, ArrowRight, UserCheck } from 'lucide-react';
import { SignIn, SignUp } from '@clerk/clerk-react';
import { useAuthModal } from './ClerkAuthProvider';

export const AuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    authModalMode,
    isClerkConfigured,
    closeAuthModal,
    openSignIn,
    openSignUp,
  } = useAuthModal();

  if (!isAuthModalOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeAuthModal}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-lg z-10 bg-white dark:bg-[#070712]/95 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl shadow-slate-300 dark:shadow-cyan-950/40 overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-white/5 flex items-center justify-between bg-slate-50 dark:bg-gradient-to-r dark:from-purple-950/30 dark:via-cyan-950/20 dark:to-transparent">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-purple-600 p-[1px]">
                <div className="w-full h-full bg-slate-900 dark:bg-black rounded-[7px] flex items-center justify-center">
                  <Zap className="w-4 h-4 text-cyan-400" />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white tracking-tight flex items-center gap-1.5">
                  LifeOps <span className="text-cyan-600 dark:text-cyan-400">Identity Gate</span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  {isClerkConfigured
                    ? authModalMode === 'signIn'
                      ? 'Sign in to access your synchronized agent preferences'
                      : 'Create your agent account with persistent memory'
                    : 'Clerk Authentication Setup Guide'}
                </p>
              </div>
            </div>

            <button
              onClick={closeAuthModal}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/5 transition-colors"
              title="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-4 sm:p-6 overflow-y-auto flex items-center justify-center flex-1">
            {isClerkConfigured ? (
              <div className="w-full flex flex-col items-center">
                {/* Switcher */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-zinc-900/90 rounded-xl border border-slate-200 dark:border-white/10 mb-5 text-xs font-medium">
                  <button
                    onClick={openSignIn}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      authModalMode === 'signIn'
                        ? 'bg-cyan-100 text-cyan-800 border border-cyan-300 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-500/40 shadow-sm'
                        : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    onClick={openSignUp}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      authModalMode === 'signUp'
                        ? 'bg-purple-100 text-purple-800 border border-purple-300 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-500/40 shadow-sm'
                        : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
                    }`}
                  >
                    Create Account
                  </button>
                </div>

                {/* Clerk Auth Component */}
                <div className="w-full flex justify-center">
                  {authModalMode === 'signIn' ? (
                    <SignIn routing="hash" />
                  ) : (
                    <SignUp routing="hash" />
                  )}
                </div>
              </div>
            ) : (
              /* Fallback Guide when Clerk publishable key is not set */
              <div className="w-full space-y-4 text-left">
                <div className="p-4 rounded-xl bg-cyan-50 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-500/20 flex items-start gap-3">
                  <Key className="w-5 h-5 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <p className="font-semibold text-cyan-800 dark:text-cyan-200">
                      Clerk Key Configuration Ready
                    </p>
                    <p className="text-slate-700 dark:text-zinc-300 leading-relaxed">
                      To activate live Clerk authentication, paste your publishable key into your root <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-black/60 rounded text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/30">.env</code> file:
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-black/70 border border-slate-200 dark:border-white/10 font-mono text-xs text-slate-800 dark:text-zinc-300 space-y-1">
                  <p className="text-slate-500 dark:text-zinc-500"># .env</p>
                  <p className="text-emerald-600 dark:text-emerald-400">VITE_CLERK_PUBLISHABLE_KEY=<span className="text-slate-500 dark:text-zinc-400">pk_test_...</span></p>
                  <p className="text-emerald-600 dark:text-emerald-400">CLERK_SECRET_KEY=<span className="text-slate-500 dark:text-zinc-400">sk_test_...</span></p>
                </div>

                <div className="space-y-2.5 text-xs text-slate-600 dark:text-zinc-400 pt-1">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span>Personalization profiles automatically sync per Clerk user ID</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    <span>Multi-turn memory & sandbox receipts isolated per account</span>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={closeAuthModal}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white font-medium text-xs shadow-md transition-all flex items-center gap-1.5"
                  >
                    <span>Continue as Guest</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
