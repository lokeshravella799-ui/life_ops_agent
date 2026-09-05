import { PanelLeft, Zap, RefreshCw, Shield, LogIn, Sun, Moon } from 'lucide-react';
import { SignedIn, SignedOut, UserButton } from '@clerk/clerk-react';
import type { AgentState } from '../../types/agent';
import { useAuthModal } from '../auth/ClerkAuthProvider';

interface TopBarProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  state: AgentState;
  onReset: () => void;
  isCompactView?: boolean;
  activePersonaId?: string;
  onSwitchPersona?: (personaId: 'personal' | 'work') => void;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
  userLocation?: { displayName: string } | null;
  onRequestLocation?: () => void;
  locationPermission?: string;
  demoMode?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  sidebarOpen,
  onToggleSidebar,
  state,
  onReset,
  isCompactView = false,
  activePersonaId,
  onSwitchPersona,
  theme,
  onToggleTheme,
  userLocation,
  onRequestLocation,
  demoMode = false,
}) => {
  const { isClerkConfigured, openSignIn } = useAuthModal();

  return (
    <header className="relative z-10 w-full h-14 px-4 sm:px-6 flex items-center justify-between border-b border-slate-200 dark:border-white/5 bg-white/90 dark:bg-[#030306]/60 backdrop-blur-md">
      <div className="flex items-center gap-3">
        {/* Sidebar Toggle Button (Always visible on mobile, or when sidebar is closed on desktop) */}
        {(!sidebarOpen || isCompactView) && (
          <button
            onClick={onToggleSidebar}
            className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-zinc-900/80 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white transition-all shadow-sm group"
            title="Open Sidebar Menu"
          >
            <PanelLeft className="w-4 h-4 text-purple-600 dark:text-purple-400 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors" />
            <span className="hidden sm:inline text-xs font-medium pr-1">Workspace</span>
          </button>
        )}

        {/* Minimal logo on mobile or when sidebar closed */}
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-gradient-to-tr from-purple-600 to-cyan-400 p-[1px]">
            <div className="w-full h-full bg-slate-900 dark:bg-black rounded-[5px] flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
            </div>
          </div>
          <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-zinc-200">
            LifeOps <span className="text-cyan-600 dark:text-cyan-400 font-light">Agent</span>
          </span>
        </div>
      </div>

      {/* Right controls: Live State pill, Security info, Reset button, Clerk Auth */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Active Persona Switcher */}
        {activePersonaId && onSwitchPersona && (
          <div className="hidden sm:flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-zinc-900/90 border border-slate-200 dark:border-white/10 text-[11px] font-medium shadow-sm">
            <button
              type="button"
              onClick={() => onSwitchPersona('personal')}
              className={`px-2 py-0.5 rounded-md transition-all ${
                activePersonaId === 'personal'
                  ? 'bg-white dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/50 shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              Personal
            </button>
            <button
              type="button"
              onClick={() => onSwitchPersona('work')}
              className={`px-2 py-0.5 rounded-md transition-all ${
                activePersonaId === 'work'
                  ? 'bg-white dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-500/50 shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              Work
            </button>
          </div>
        )}

        {/* Active state pill */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-white/10 text-[11px] font-mono text-slate-700 dark:text-zinc-300 shadow-sm">
          <span
            className={`w-2 h-2 rounded-full ${
              state === 'listening'
                ? 'bg-red-400 animate-ping'
                : state === 'searching' || state === 'comparing' || state === 'processing'
                ? 'bg-cyan-400 animate-spin'
                : state === 'success'
                ? 'bg-emerald-400'
                : 'bg-purple-400 animate-pulse'
            }`}
          />
          <span className="capitalize font-medium text-slate-700 dark:text-zinc-200">{state}</span>
        </div>

        {/* Live Groq Model Indicator / Demo Mode Badge */}
        {demoMode ? (
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-500/30 text-[10px] text-amber-800 dark:text-amber-300 font-mono font-bold tracking-wider uppercase shadow-xs">
            <Zap className="w-3 h-3 text-amber-500 animate-pulse" />
            <span>Demo Mode Active</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/25 text-[10px] text-cyan-700 dark:text-cyan-300 font-mono font-medium tracking-wider shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span>Groq • openai/gpt-oss-120b</span>
          </div>
        )}

        {/* User Location Badge / Enable Location button */}
        {userLocation ? (
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-zinc-900/80 border border-slate-200 dark:border-white/10 text-[11px] font-medium text-slate-700 dark:text-zinc-200">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span className="truncate max-w-[140px]">{userLocation.displayName}</span>
          </div>
        ) : onRequestLocation ? (
          <button
            type="button"
            onClick={onRequestLocation}
            className="hidden sm:flex items-center gap-1 text-[11px] font-medium text-cyan-600 dark:text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 px-2 py-1 rounded-lg border border-cyan-500/20 transition-colors"
          >
            <span>Enable Location</span>
          </button>
        ) : null}

        {/* Safety Gate Indicator */}
        <div className="hidden md:flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/30 text-[10px] text-emerald-800 dark:text-emerald-300 font-mono">
          <Shield className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
          <span>Financial Guard Active</span>
        </div>

        {/* Theme Toggle Button */}
        {onToggleTheme && (
          <button
            type="button"
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            className="p-2 rounded-xl text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800/60 transition-colors"
          >
            {theme === 'light' ? (
              <Moon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            ) : (
              <Sun className="w-4 h-4 text-amber-400" />
            )}
          </button>
        )}

        {/* Reset button */}
        <button
          onClick={onReset}
          title="Reset to New Query"
          className="p-2 rounded-xl text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800/60 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        {/* Clerk Authentication Controls */}
        {isClerkConfigured ? (
          <div className="flex items-center pl-1">
            <SignedIn>
              <UserButton
                appearance={{
                  elements: {
                    userButtonAvatarBox: 'w-7 h-7 ring-2 ring-cyan-400/40 hover:ring-cyan-400 transition-all shadow-md',
                  },
                }}
              />
            </SignedIn>
            <SignedOut>
              <button
                onClick={openSignIn}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-950/80 to-purple-950/80 hover:from-cyan-900 hover:to-purple-900 border border-cyan-500/30 hover:border-cyan-400/70 text-xs font-medium text-cyan-200 hover:text-white transition-all shadow-sm shadow-cyan-950/30 group"
              >
                <LogIn className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
                <span>Sign In</span>
              </button>
            </SignedOut>
          </div>
        ) : (
          <div className="flex items-center pl-1">
            <button
              onClick={openSignIn}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-cyan-500/30 hover:border-cyan-400/60 text-xs font-medium text-zinc-300 hover:text-white transition-all shadow-sm group"
              title="Configure Clerk Authentication"
            >
              <LogIn className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
              <span>Sign In</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
