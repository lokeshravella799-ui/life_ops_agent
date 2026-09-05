import React from 'react';
import { MapPin, ShieldAlert, Loader2, Navigation } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface LocationPermissionModalProps {
  isOpen: boolean;
  isLocating: boolean;
  onAllow: () => void;
  onDismiss: () => void;
  error?: string | null;
}

export const LocationPermissionModal: React.FC<LocationPermissionModalProps> = ({
  isOpen,
  isLocating,
  onAllow,
  onDismiss,
  error,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          transition={{ duration: 0.25 }}
          className="w-full max-w-md bg-slate-900/95 border border-cyan-500/30 rounded-2xl p-6 shadow-2xl shadow-cyan-950/40 relative overflow-hidden text-zinc-100"
        >
          {/* Ambient Glow */}
          <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />

          {/* Icon Header */}
          <div className="flex items-center gap-3.5 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-md shadow-cyan-900/30">
              <MapPin className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                Enable Location Access
              </h3>
              <span className="text-[11px] font-mono text-cyan-400 uppercase tracking-wider">
                Precision Geo-Assistance
              </span>
            </div>
          </div>

          {/* Body Text */}
          <p className="text-sm text-zinc-300 leading-relaxed mb-4">
            LifeOps needs your location to provide nearby services, pickup points, buses, bookings and location-based assistance.
          </p>

          <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-2 mb-5 text-xs text-zinc-400">
            <div className="flex items-center gap-2 text-cyan-300 font-mono text-[11px]">
              <Navigation className="w-3.5 h-3.5 shrink-0" />
              <span>Automatic bus pickup & direct route routing</span>
            </div>
            <div className="flex items-center gap-2 text-purple-300 font-mono text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
              <span>Explicit privacy consent — never collected silently</span>
            </div>
          </div>

          {/* Error Notice */}
          {error && (
            <div className="p-3 mb-4 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onDismiss}
              disabled={isLocating}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              Not Now
            </button>
            <button
              type="button"
              onClick={onAllow}
              disabled={isLocating}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 shadow-lg shadow-cyan-900/30 transition-all cursor-pointer flex items-center gap-2"
            >
              {isLocating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Requesting...</span>
                </>
              ) : (
                <>
                  <Navigation className="w-3.5 h-3.5" />
                  <span>Allow Location</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
