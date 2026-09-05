import React, { useState, useEffect } from 'react';
import type {
  UserPersonalizationProfile,
  RankingPriority,
  DepartureTimeWindow,
} from '../../types/agent';
import {
  fetchUserProfile,
  updateUserProfile,
  clearUserProfile,
  switchPersona,
  acceptStagedInference,
  rejectStagedInference,
  revertProfileEvolution,
} from '../../services/agentApi';
import {
  X,
  Sliders,
  Plus,
  Trash2,
  Clock,
  ShoppingBag,
  ShieldCheck,
  Check,
  Compass,
  Briefcase,
  User,
  History,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import type { SessionPreferences } from '../../types/agent';

interface PreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialProfile?: UserPersonalizationProfile | null;
  onProfileUpdated?: (profile: UserPersonalizationProfile) => void;
  activeSessionPreferences?: SessionPreferences | null;
}

export const PreferencesModal: React.FC<PreferencesModalProps> = ({
  isOpen,
  onClose,
  initialProfile,
  onProfileUpdated,
  activeSessionPreferences,
}) => {
  const [profile, setProfile] = useState<UserPersonalizationProfile | null>(initialProfile || null);
  const [newBrand, setNewBrand] = useState('');
  const [newExcludedBrand, setNewExcludedBrand] = useState('');
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  // Sync profile when opened or when initialProfile changes
  useEffect(() => {
    if (isOpen) {
      if (initialProfile) {
        setProfile(initialProfile);
      } else {
        fetchUserProfile()
          .then((p) => setProfile(p))
          .catch((err) => console.error('Failed to load profile:', err));
      }
    }
  }, [isOpen, initialProfile]);

  const showFeedback = (msg: string) => {
    setStatusFeedback(msg);
    setTimeout(() => setStatusFeedback(null), 3000);
  };

  const handleSwitchPersona = async (personaId: 'personal' | 'work') => {
    try {
      const res = await switchPersona(personaId);
      setProfile(res.profile);
      onProfileUpdated?.(res.profile);
      showFeedback(`Switched to ${personaId === 'work' ? 'Work' : 'Personal'} persona.`);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleAcceptInference = async (inferenceId: string) => {
    try {
      const res = await acceptStagedInference(inferenceId);
      setProfile(res.profile);
      onProfileUpdated?.(res.profile);
      showFeedback('Learned preference accepted into profile.');
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleRejectInference = async (inferenceId: string) => {
    try {
      const res = await rejectStagedInference(inferenceId);
      setProfile(res.profile);
      onProfileUpdated?.(res.profile);
      showFeedback('Learned preference dismissed.');
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleRevertEvolution = async (entryId: string) => {
    try {
      const res = await revertProfileEvolution(entryId);
      setProfile(res.profile);
      onProfileUpdated?.(res.profile);
      showFeedback('Profile change reverted successfully.');
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleAddPreferredBrand = async () => {
    const brand = newBrand.trim();
    if (!brand) return;
    try {
      const updated = await updateUserProfile({
        action: 'ADD_PREFERRED_BRAND',
        brand,
      });
      setProfile(updated);
      onProfileUpdated?.(updated);
      setNewBrand('');
      showFeedback(`Added "${brand}" to preferred brands.`);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleRemovePreferredBrand = async (brand: string) => {
    try {
      const updated = await updateUserProfile({
        action: 'REMOVE_PREFERRED_BRAND',
        brand,
      });
      setProfile(updated);
      onProfileUpdated?.(updated);
      showFeedback(`Removed "${brand}".`);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleAddExcludedBrand = async () => {
    const brand = newExcludedBrand.trim();
    if (!brand) return;
    try {
      const updated = await updateUserProfile({
        action: 'ADD_EXCLUDED_BRAND',
        brand,
      });
      setProfile(updated);
      onProfileUpdated?.(updated);
      setNewExcludedBrand('');
      showFeedback(`Added "${brand}" to excluded brands.`);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleRemoveExcludedBrand = async (brand: string) => {
    try {
      const updated = await updateUserProfile({
        action: 'REMOVE_EXCLUDED_BRAND',
        brand,
      });
      setProfile(updated);
      onProfileUpdated?.(updated);
      showFeedback(`Removed "${brand}".`);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleSetPriority = async (priority: RankingPriority) => {
    try {
      const updated = await updateUserProfile({
        action: 'SET_RANKING_PRIORITY',
        priority,
      });
      setProfile(updated);
      onProfileUpdated?.(updated);
      showFeedback(`Priority set to ${priority.replace('_', ' ')}.`);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleSetDepartureWindow = async (departureWindow: DepartureTimeWindow) => {
    try {
      const updated = await updateUserProfile({
        action: 'SET_DEPARTURE_WINDOW',
        departureWindow,
      });
      setProfile(updated);
      onProfileUpdated?.(updated);
      showFeedback(`Departure window set to ${departureWindow}.`);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Reset all your customization preferences to default?')) return;
    try {
      const updated = await clearUserProfile();
      setProfile(updated);
      onProfileUpdated?.(updated);
      showFeedback('All preferences reset to defaults.');
    } catch (err: any) {
      console.error(err);
    }
  };

  const priorityOptions: Array<{ id: RankingPriority; label: string; desc: string }> = [
    { id: 'balanced', label: 'Balanced', desc: 'Holistic multi-factor ranking' },
    { id: 'lowest_price', label: 'Lowest Price', desc: 'Maximizes savings & value' },
    { id: 'highest_quality', label: 'Highest Quality', desc: 'Emphasizes reviews & specs' },
    { id: 'fastest', label: 'Fastest', desc: 'Fastest delivery & early schedule' },
    { id: 'most_convenient', label: 'Most Convenient', desc: 'Direct routes & verified sellers' },
    { id: 'best_overall', label: 'Best Overall', desc: 'Top-tier weighted compromise' },
  ];

  const windowOptions: Array<{ id: DepartureTimeWindow; label: string; time: string }> = [
    { id: 'any', label: 'Any Time', time: 'All day' },
    { id: 'morning', label: 'Morning', time: '06:00 - 12:00' },
    { id: 'afternoon', label: 'Afternoon', time: '12:00 - 17:00' },
    { id: 'evening', label: 'Evening', time: '17:00 - 21:00' },
    { id: 'night', label: 'Night', time: '21:00 - 06:00' },
  ];

  const currentPriority = profile?.general?.rankingPriority || 'balanced';
  const currentDepartureWindow = profile?.travel?.preferredDepartureTimeWindow || 'any';
  const preferredBrands = profile?.shopping?.preferredBrands || [];
  const excludedBrands = profile?.shopping?.excludedBrands || [];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.2 }}
            className="bg-white dark:bg-[#0c0c18] border border-slate-200 dark:border-purple-500/30 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl shadow-slate-300 dark:shadow-purple-950/60 overflow-hidden ring-1 ring-slate-200 dark:ring-cyan-400/20"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900/30 dark:via-black dark:to-cyan-900/20">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-500/20 border border-purple-200 dark:border-purple-400/40 flex items-center justify-center text-purple-700 dark:text-purple-300">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    Personalization & Profiles
                    <span className="text-[10px] font-mono uppercase bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-500/40 px-2 py-0.5 rounded-full">
                      Active
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Customize ranking priorities and merchant preferences
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/20 transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm">
              {/* Feedback toast */}
              <AnimatePresence>
                {statusFeedback && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{statusFeedback}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Persona Switcher Tabs */}
              <div className="p-1 rounded-xl bg-slate-100 dark:bg-black/60 border border-slate-200 dark:border-white/10 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleSwitchPersona('personal')}
                  className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    (profile?.activePersonaId || 'personal') === 'personal'
                      ? 'bg-white dark:bg-gradient-to-r dark:from-purple-600/40 dark:to-cyan-500/40 text-purple-900 dark:text-white border border-slate-200 dark:border-cyan-400/40 shadow-sm dark:shadow-md dark:shadow-cyan-950/40'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                  }`}
                >
                  <User className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                  <span>Personal Persona</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchPersona('work')}
                  className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    profile?.activePersonaId === 'work'
                      ? 'bg-white dark:bg-gradient-to-r dark:from-purple-600/40 dark:to-indigo-500/40 text-purple-900 dark:text-white border border-slate-200 dark:border-purple-400/40 shadow-sm dark:shadow-md dark:shadow-purple-950/40'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                  }`}
                >
                  <Briefcase className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                  <span>Work Persona</span>
                </button>
              </div>

              {/* Active Session Context (Temporary Overrides) */}
              {activeSessionPreferences &&
                Boolean(
                  activeSessionPreferences.rankingPriority ||
                    activeSessionPreferences.preferredBrands?.length ||
                    activeSessionPreferences.bypassBrandPreferences ||
                    activeSessionPreferences.preferredDepartureTimeWindow ||
                    activeSessionPreferences.ignoreSavedPreferences
                ) && (
                  <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-950/40 via-purple-950/30 to-zinc-900 border border-cyan-500/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                        Active Session Context (Temporary)
                      </span>
                      <span className="text-[10px] font-mono text-zinc-400">
                        Current Conversation Only
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {activeSessionPreferences.rankingPriority && (
                        <span className="px-2.5 py-1 rounded-lg bg-cyan-900/40 border border-cyan-400/30 text-cyan-200">
                          Priority: <strong>{activeSessionPreferences.rankingPriority.replace('_', ' ')}</strong>
                        </span>
                      )}
                      {activeSessionPreferences.bypassBrandPreferences && (
                        <span className="px-2.5 py-1 rounded-lg bg-purple-900/40 border border-purple-400/30 text-purple-200">
                          Brand Priority Bypassed
                        </span>
                      )}
                      {activeSessionPreferences.preferredDepartureTimeWindow && (
                        <span className="px-2.5 py-1 rounded-lg bg-indigo-900/40 border border-indigo-400/30 text-indigo-200">
                          Departure: <strong>{activeSessionPreferences.preferredDepartureTimeWindow}</strong>
                        </span>
                      )}
                      {activeSessionPreferences.ignoreSavedPreferences && (
                        <span className="px-2.5 py-1 rounded-lg bg-amber-900/40 border border-amber-400/30 text-amber-200">
                          Saved Preferences Temporarily Ignored
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 font-light">
                      These session preferences take temporary precedence for your current searches without permanently modifying your profile below.
                    </p>
                  </div>
                )}

              {/* 1. General Ranking Priorities */}
              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-purple-700 dark:text-purple-300 flex items-center gap-1.5 mb-2.5">
                  <Compass className="w-3.5 h-3.5 text-pink-500 dark:text-pink-400" />
                  General Ranking Priority
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {priorityOptions.map((opt) => {
                    const isSelected = currentPriority === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleSetPriority(opt.id)}
                        className={`p-2.5 rounded-xl text-left border transition-all ${
                          isSelected
                            ? 'bg-purple-100 dark:bg-purple-950/60 border-purple-300 dark:border-purple-400 text-purple-950 dark:text-white shadow-sm dark:shadow-lg dark:shadow-purple-950/50'
                            : 'bg-slate-50 dark:bg-zinc-950/50 border-slate-200 dark:border-white/5 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 hover:border-slate-300 dark:hover:border-white/15'
                        }`}
                      >
                        <div className="text-xs font-semibold flex items-center justify-between">
                          <span>{opt.label}</span>
                          {isSelected && <Check className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />}
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5 leading-snug">{opt.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Shopping Brand Preferences */}
              <div className="space-y-4">
                <label className="text-xs font-mono uppercase tracking-wider text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                  Shopping Brand Preferences
                </label>

                {/* Preferred Brands */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-white/5 space-y-2.5">
                  <div className="text-xs font-medium text-slate-700 dark:text-zinc-300 flex items-center justify-between">
                    <span>Preferred Brands (Boosts Ranking)</span>
                    <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
                      {preferredBrands.length} active
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {preferredBrands.length === 0 ? (
                      <span className="text-xs text-slate-400 dark:text-zinc-500 italic">No preferred brands set.</span>
                    ) : (
                      preferredBrands.map((b) => (
                        <span
                          key={b}
                          className="inline-flex items-center gap-1 text-xs font-mono bg-cyan-100 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/30 px-2 py-0.5 rounded-md"
                        >
                          {b}
                          <button
                            type="button"
                            onClick={() => handleRemovePreferredBrand(b)}
                            className="hover:text-pink-500 dark:hover:text-pink-400 transition-colors ml-0.5"
                            title="Remove"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))
                    )}
                  </div>

                  {/* Add Preferred Brand Input */}
                  <div className="flex gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="e.g. ASUS, Apple, Sony"
                      value={newBrand}
                      onChange={(e) => setNewBrand(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddPreferredBrand()}
                      className="flex-1 bg-white dark:bg-black/60 border border-slate-300 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddPreferredBrand}
                      className="px-3 py-1.5 bg-cyan-100 hover:bg-cyan-200 dark:bg-cyan-950/80 dark:hover:bg-cyan-900/80 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/40 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                  </div>
                </div>

                {/* Excluded Brands */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-white/5 space-y-2.5">
                  <div className="text-xs font-medium text-slate-700 dark:text-zinc-300 flex items-center justify-between">
                    <span>Excluded Brands (Penalizes / Avoids)</span>
                    <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
                      {excludedBrands.length} active
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {excludedBrands.length === 0 ? (
                      <span className="text-xs text-slate-400 dark:text-zinc-500 italic">No excluded brands set.</span>
                    ) : (
                      excludedBrands.map((b) => (
                        <span
                          key={b}
                          className="inline-flex items-center gap-1 text-xs font-mono bg-pink-100 dark:bg-pink-950/60 text-pink-800 dark:text-pink-300 border border-pink-300 dark:border-pink-500/30 px-2 py-0.5 rounded-md"
                        >
                          {b}
                          <button
                            type="button"
                            onClick={() => handleRemoveExcludedBrand(b)}
                            className="hover:text-red-500 dark:hover:text-red-400 transition-colors ml-0.5"
                            title="Remove"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))
                    )}
                  </div>

                  {/* Add Excluded Brand Input */}
                  <div className="flex gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="e.g. HP, Acer"
                      value={newExcludedBrand}
                      onChange={(e) => setNewExcludedBrand(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddExcludedBrand()}
                      className="flex-1 bg-white dark:bg-black/60 border border-slate-300 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-pink-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddExcludedBrand}
                      className="px-3 py-1.5 bg-pink-100 hover:bg-pink-200 dark:bg-pink-950/80 dark:hover:bg-pink-900/80 text-pink-800 dark:text-pink-300 border border-pink-300 dark:border-pink-500/40 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Exclude
                    </button>
                  </div>
                </div>
              </div>

              {/* 3. Travel Departure Window */}
              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-purple-700 dark:text-purple-300 flex items-center gap-1.5 mb-2.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Travel Departure Window
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {windowOptions.map((win) => {
                    const isSelected = currentDepartureWindow === win.id;
                    return (
                      <button
                        key={win.id}
                        type="button"
                        onClick={() => handleSetDepartureWindow(win.id)}
                        className={`p-2.5 rounded-xl text-left border transition-all ${
                          isSelected
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-400 text-emerald-950 dark:text-white shadow-sm dark:shadow-lg dark:shadow-emerald-950/50'
                            : 'bg-slate-50 dark:bg-zinc-950/50 border-slate-200 dark:border-white/5 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 hover:border-slate-300 dark:hover:border-white/15'
                        }`}
                      >
                        <div className="text-xs font-semibold flex items-center justify-between">
                          <span>{win.label}</span>
                          {isSelected && <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />}
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">{win.time}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. Adaptive Learning: Staged Preferences */}
              {profile?.stagedInferences && profile.stagedInferences.length > 0 && (
                <div className="space-y-3">
                  <label className="text-xs font-mono uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    Adaptive Learning • Staged Preferences
                  </label>
                  <div className="space-y-2">
                    {profile.stagedInferences.map((inference) => (
                      <div
                        key={inference.id}
                        className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white">{inference.inferredValue}</span>
                            <span className="text-[10px] font-mono text-cyan-300 bg-cyan-900/60 px-1.5 py-0.5 rounded border border-cyan-400/30">
                              {Math.round(inference.confidence * 100)}% Confidence
                            </span>
                            <span className="text-[10px] font-mono text-zinc-400">
                              Status: {inference.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 mt-0.5">{inference.reason}</p>
                        </div>
                        {inference.status === 'STAGED' && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleAcceptInference(inference.id)}
                              className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-medium transition-colors"
                            >
                              Add to Profile
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectInference(inference.id)}
                              className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-[11px] transition-colors"
                            >
                              Dismiss
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 5. Profile Evolution Timeline & Rollback */}
              {profile?.evolutionHistory && profile.evolutionHistory.length > 0 && (
                <div className="space-y-3">
                  <label className="text-xs font-mono uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-purple-400" />
                    Evolution History & Auditable Rollback
                  </label>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 text-xs">
                    {profile.evolutionHistory.slice().reverse().map((entry) => (
                      <div
                        key={entry.id}
                        className="p-2.5 rounded-lg bg-zinc-950/40 border border-white/5 flex items-center justify-between gap-2"
                      >
                        <div className="space-y-0.5 truncate">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-purple-400 bg-purple-950/60 px-1.5 py-0.2 rounded border border-purple-500/20">
                              {entry.source.replace(/_/g, ' ')}
                            </span>
                            <span className="text-zinc-200 truncate">{entry.description}</span>
                          </div>
                          <div className="text-[10px] font-mono text-zinc-500">
                            {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </div>
                        </div>
                        {entry.revertible && (
                          <button
                            type="button"
                            onClick={() => handleRevertEvolution(entry.id)}
                            className="shrink-0 px-2 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-[10px] font-mono flex items-center gap-1 transition-colors border border-white/10"
                            title="Revert this change"
                          >
                            <RotateCcw className="w-2.5 h-2.5 text-amber-400" /> Revert
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Safety Guarantee Notice */}
              <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/20 text-xs text-zinc-400 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong className="text-purple-300">Strict Safety Guarantee:</strong> Preferences
                  strictly affect recommendation ranking and rationale. They never execute
                  transactions, never bypass explicit interactive confirmation, and never store
                  financial credentials.
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/40 flex items-center justify-between">
              <button
                type="button"
                onClick={handleClearAll}
                className="text-xs font-mono text-slate-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-pink-400 flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Reset Preferences
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-slate-300 dark:shadow-purple-950/40 transition-all"
              >
                Save & Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
