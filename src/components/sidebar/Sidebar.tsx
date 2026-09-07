import React, { useState } from 'react';
import type { HistoryItem } from '../../types/agent';
import { SidebarHistory } from './SidebarHistory';
import {
  Plus,
  PanelLeftClose,
  Sparkles,
  History,
  ShoppingBag,
  Calendar,
  Settings,
  User,
  Sliders,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthModal, useActiveUser } from '../auth/ClerkAuthProvider';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  historyItems: HistoryItem[];
  selectedHistoryId?: string;
  onSelectHistoryItem: (item: HistoryItem) => void;
  onDeleteHistoryItem?: (item: HistoryItem) => void;
  onNewChat: () => void;
  activeNavTab: string;
  onSelectNavTab: (tab: string) => void;
  isMobile?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onToggle,
  historyItems,
  selectedHistoryId,
  onSelectHistoryItem,
  onDeleteHistoryItem,
  onNewChat,
  activeNavTab,
  onSelectNavTab,
  isMobile = false,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'all' | 'purchases' | 'bookings'>('all');

  const filteredHistory = historyItems.filter((item) => {
    if (activeSubTab === 'purchases') return item.type === 'purchase';
    if (activeSubTab === 'bookings') return item.type === 'booking';
    return true;
  });

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white dark:bg-[#07070c]/95 border-r border-slate-200 dark:border-white/5 backdrop-blur-2xl text-slate-700 dark:text-zinc-300 select-none shadow-sm">
      {/* 1. TOP HEADER: Logo & Collapse Button */}
      <div className="p-4 pb-3 border-b border-slate-200 dark:border-white/5 flex items-center justify-between">
        <div
          onClick={onNewChat}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 via-pink-600 to-cyan-500 p-[1.5px] shadow-md shadow-purple-900/20 group-hover:shadow-cyan-900/30 transition-shadow">
            <div className="w-full h-full bg-slate-900 dark:bg-[#030306] rounded-[7px] flex items-center justify-center">
              <Zap className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
            </div>
            {/* Pulsing indicator */}
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#07070c] animate-pulse" />
          </div>

          <div>
            <h1 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5 leading-none">
              LifeOps <span className="text-cyan-600 dark:text-cyan-400 font-light">Agent</span>
            </h1>
            <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono tracking-wider uppercase">
              Personal AI OS
            </span>
          </div>
        </div>

        {/* Collapse Button */}
        <button
          onClick={onToggle}
          title="Collapse Sidebar"
          className="p-1.5 rounded-lg text-slate-400 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800/60 transition-colors"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* 2. ACTION: New Chat Button */}
      <div className="p-3">
        <button
          onClick={onNewChat}
          className="w-full relative group overflow-hidden rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-gradient-to-r dark:from-purple-600/20 dark:via-pink-600/20 dark:to-cyan-600/20 dark:hover:from-purple-600/30 dark:hover:via-pink-600/30 dark:hover:to-cyan-600/30 border border-purple-200 dark:border-purple-500/30 hover:border-purple-300 dark:hover:border-cyan-400/50 p-2.5 flex items-center justify-center gap-2 transition-all duration-300 shadow-sm"
        >
          <Plus className="w-4 h-4 text-purple-600 dark:text-cyan-300 group-hover:rotate-90 transition-transform duration-300" />
          <span className="text-xs font-semibold text-purple-950 dark:text-zinc-100 tracking-wide">
            New Session
          </span>
          <span className="ml-auto text-[10px] font-mono text-slate-500 dark:text-zinc-400 bg-white dark:bg-zinc-900/60 px-1.5 py-0.5 rounded border border-slate-200 dark:border-white/5">
            Ctrl+K
          </span>
        </button>
      </div>

      {/* 3. MAIN NAVIGATION */}
      <div className="px-3 py-1 space-y-0.5">
        <button
          onClick={() => {
            onSelectNavTab('chat');
            setActiveSubTab('all');
          }}
          className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeNavTab === 'chat' && activeSubTab === 'all'
              ? 'bg-purple-100/70 dark:bg-zinc-800/80 text-purple-900 dark:text-cyan-300 border border-purple-300 dark:border-cyan-500/20 font-semibold'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800/40'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
          <span>Active Workspace</span>
        </button>

        <button
          onClick={() => {
            onSelectNavTab('history');
            setActiveSubTab('all');
          }}
          className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeNavTab === 'history' && activeSubTab === 'all'
              ? 'bg-purple-100/70 dark:bg-zinc-800/80 text-purple-900 dark:text-cyan-300 border border-purple-300 dark:border-cyan-500/20 font-semibold'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800/40'
          }`}
        >
          <History className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-400" />
          <span>History & Activity</span>
        </button>

        <div className="grid grid-cols-2 gap-1 pt-1">
          <button
            onClick={() => {
              onSelectNavTab('purchases');
              setActiveSubTab('purchases');
            }}
            className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
              activeSubTab === 'purchases'
                ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800/40'
            }`}
          >
            <ShoppingBag className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            <span>Purchases</span>
          </button>

          <button
            onClick={() => {
              onSelectNavTab('bookings');
              setActiveSubTab('bookings');
            }}
            className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
              activeSubTab === 'bookings'
                ? 'bg-cyan-100 dark:bg-cyan-950/40 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/30'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800/40'
            }`}
          >
            <Calendar className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
            <span>Bookings</span>
          </button>
        </div>
      </div>

      <div className="h-px bg-slate-200 dark:bg-white/5 my-2 mx-3" />

      {/* 4. ACTIVITY & CONVERSATION HISTORY */}
      <div className="flex-1 overflow-y-auto px-2">
        <SidebarHistory
          items={filteredHistory}
          selectedId={selectedHistoryId}
          onSelectItem={(item) => {
            onSelectHistoryItem(item);
            if (isMobile) onToggle();
          }}
          onDeleteItem={onDeleteHistoryItem}
        />
      </div>

      {/* 5. FOOTER: Status, Profile & Settings */}
      <div className="p-3 border-t border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-[#050508]/80 space-y-2">
        {/* Safety & Sandbox Status badge */}
        <div className="flex items-center justify-between px-2 py-1 rounded bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-white/5 text-[10px] text-slate-500 dark:text-zinc-400 font-mono shadow-xs">
          <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="w-3 h-3" />
            <span>Safety Gate Armed</span>
          </div>
          <span className="text-slate-400 dark:text-zinc-500">v2.4-agent</span>
        </div>

        {/* User Profile Bar */}
        <SidebarUserProfile onSelectNavTab={onSelectNavTab} />
      </div>
    </div>
  );

  // Desktop sidebar rendering with smooth transition
  if (!isMobile) {
    return (
      <aside
        className={`relative z-20 h-screen shrink-0 transition-all duration-300 ease-in-out ${
          isOpen ? 'w-72' : 'w-0'
        } overflow-hidden`}
      >
        <div className="w-72 h-full">{sidebarContent}</div>
      </aside>
    );
  }

  // Mobile drawer overlay
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onToggle}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 240 }}
            className="relative w-80 max-w-[85vw] h-full z-10"
          >
            {sidebarContent}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

interface SidebarUserProfileProps {
  onSelectNavTab: (tab: string) => void;
}

const SidebarUserProfile: React.FC<SidebarUserProfileProps> = ({ onSelectNavTab }) => {
  const { openSignIn } = useAuthModal();
  const { isSignedIn, user } = useActiveUser();

  const displayName = isSignedIn && user ? user.fullName || user.firstName || 'Agent Operator' : 'Guest Operator';
  const emailOrTier = isSignedIn && user ? user.primaryEmailAddress?.emailAddress || 'Authenticated' : 'Autonomous Guest';
  const avatarUrl = isSignedIn && user ? user.imageUrl : undefined;

  return (
    <div className="flex items-center justify-between pt-1">
      <div
        onClick={!isSignedIn ? openSignIn : undefined}
        className={`flex items-center gap-2 ${!isSignedIn ? 'cursor-pointer group' : ''}`}
        title={!isSignedIn ? 'Click to Sign In with Clerk' : undefined}
      >
        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-purple-500 to-cyan-400 p-[1px] shrink-0">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-slate-100 dark:bg-zinc-900 rounded-full flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-slate-600 dark:text-zinc-200 group-hover:text-purple-600 dark:group-hover:text-cyan-400 transition-colors" />
            </div>
          )}
        </div>
        <div className="text-left max-w-[120px] truncate">
          <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200 leading-tight truncate group-hover:text-purple-600 dark:group-hover:text-white transition-colors">
            {displayName}
          </p>
          <p className="text-[10px] text-cyan-600 dark:text-cyan-400/80 font-mono truncate">
            {isSignedIn ? 'Synced Identity' : emailOrTier}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onSelectNavTab('preferences')}
          title="Preferences"
          className="p-1.5 rounded-lg text-slate-400 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-800/60 transition-colors"
        >
          <Sliders className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onSelectNavTab('settings')}
          title="Settings"
          className="p-1.5 rounded-lg text-slate-400 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-800/60 transition-colors"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
