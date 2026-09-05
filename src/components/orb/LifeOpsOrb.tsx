import React, { useEffect, useRef, useState } from 'react';
import type { AgentState } from '../../types/agent';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Mic, Volume2 } from 'lucide-react';

interface LifeOpsOrbProps {
  state: AgentState;
  audioLevel?: number; // 0 to 1
  size?: 'hero' | 'compact' | 'micro';
  statusTextOverride?: string;
  onClick?: () => void;
  className?: string;
}

interface Particle {
  x: number;
  y: number;
  angle: number;
  distance: number;
  speed: number;
  size: number;
  alpha: number;
  color: string;
}

const ORB_DIMENSIONS = {
  hero: { width: 260, height: 260, ringRadius: 78, ringWidth: 12 },
  compact: { width: 160, height: 160, ringRadius: 48, ringWidth: 8 },
  micro: { width: 90, height: 90, ringRadius: 28, ringWidth: 5 },
} as const;

export const LifeOpsOrb: React.FC<LifeOpsOrbProps> = ({
  state,
  audioLevel = 0,
  size = 'hero',
  statusTextOverride,
  onClick,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rotationAngleRef = useRef(0);
  const pulsePhaseRef = useRef(0);
  const [isHovered, setIsHovered] = useState(false);

  // Size dimensions
  const dimensions = ORB_DIMENSIONS[size] || ORB_DIMENSIONS.hero;

  // Status message logic based on current state
  const getStatusText = (): string => {
    // Only accept short operational status overrides (<= 40 chars) - never full answers or paragraphs
    if (statusTextOverride && statusTextOverride.length <= 40 && !statusTextOverride.includes('\n')) {
      return statusTextOverride;
    }
    switch (state) {
      case 'idle':
        return 'Talk to LifeOps';
      case 'listening':
        return 'Listening...';
      case 'speaking':
        return 'LifeOps is speaking';
      case 'interrupted':
        return 'Listening...';
      case 'thinking':
        return 'Thinking...';
      case 'searching':
        return 'Searching live providers...';
      case 'comparing':
        return 'Comparing your options...';
      case 'verifying':
        return 'Verifying results...';
      case 'results':
        return 'Options ready';
      case 'selection':
        return 'Analyzing choice...';
      case 'confirmation':
        return 'Awaiting your confirmation';
      case 'processing':
        return 'Simulating sandbox execution...';
      case 'success':
        return 'Sandbox simulation complete';
      case 'error':
        return 'Unable to process';
      default:
        return 'LifeOps Ready';
    }
  };

  const getSubStatusText = (): string => {
    switch (state) {
      case 'idle':
        return 'Ask anything — products, bookings, or daily tasks';
      case 'listening':
        return 'Speak naturally or tap send';
      case 'speaking':
        return 'Tap Orb to interrupt';
      case 'interrupted':
        return 'Listening... Speak your request';
      case 'thinking':
        return 'Decomposing structured requirements...';
      case 'searching':
        return 'Querying active provider adapters...';
      case 'comparing':
        return 'Multi-criteria ranking & scoring...';
      case 'verifying':
      case 'results':
        return 'Verified recommendation matches found';
      case 'confirmation':
        return 'Explicit consent required before execution';
      case 'processing':
        return 'Deterministic simulation sandbox active';
      case 'success':
        return 'Sandbox receipt generated & ready';
      default:
        return '';
    }
  };

  // Initialize particles
  useEffect(() => {
    const particleCount = size === 'hero' ? 42 : size === 'compact' ? 24 : 12;
    const colors = ['#a855f7', '#ec4899', '#06b6d4', '#3b82f6', '#f43f5e', '#ffffff'];
    const newParticles: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      newParticles.push({
        x: 0,
        y: 0,
        angle: Math.random() * Math.PI * 2,
        distance: dimensions.ringRadius + (Math.random() * 24 - 12),
        speed: (Math.random() * 0.02 + 0.008) * (Math.random() > 0.5 ? 1 : -1),
        size: Math.random() * 2.5 + 1.2,
        alpha: Math.random() * 0.7 + 0.3,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    particlesRef.current = newParticles;
  }, [size, dimensions.ringRadius]);

  // Main canvas animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high-DPI retina display
    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    ctx.scale(dpr, dpr);

    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;

    const render = () => {
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      // State-specific animation velocity and intensities
      let rotSpeed = 0.012;
      let pulseSpeed = 0.03;
      let glowMultiplier = 1;
      let waveAmplitude = 0;

      switch (state) {
        case 'idle':
          rotSpeed = 0.008;
          pulseSpeed = 0.025;
          glowMultiplier = 1;
          break;
        case 'listening':
          rotSpeed = 0.015;
          pulseSpeed = 0.08;
          glowMultiplier = 1.35 + audioLevel * 0.8;
          waveAmplitude = 6 * (0.3 + audioLevel * 0.8);
          break;
        case 'speaking':
          rotSpeed = 0.022;
          pulseSpeed = 0.06;
          glowMultiplier = 1.45;
          waveAmplitude = 5.5;
          break;
        case 'interrupted':
          rotSpeed = 0.02;
          pulseSpeed = 0.09;
          glowMultiplier = 1.4;
          waveAmplitude = 6;
          break;
        case 'thinking':
          rotSpeed = 0.035;
          pulseSpeed = 0.07;
          glowMultiplier = 1.4;
          break;
        case 'searching':
          rotSpeed = 0.045;
          pulseSpeed = 0.09;
          glowMultiplier = 1.5;
          break;
        case 'comparing':
          rotSpeed = 0.03;
          pulseSpeed = 0.08;
          glowMultiplier = 1.45;
          break;
        case 'verifying':
          rotSpeed = 0.025;
          pulseSpeed = 0.06;
          glowMultiplier = 1.4;
          break;
        case 'processing':
          rotSpeed = 0.06;
          pulseSpeed = 0.12;
          glowMultiplier = 1.6;
          break;
        case 'success':
          rotSpeed = 0.012;
          pulseSpeed = 0.04;
          glowMultiplier = 1.6;
          break;
        case 'error':
          rotSpeed = 0.006;
          glowMultiplier = 0.8;
          break;
        default:
          rotSpeed = 0.012;
          break;
      }

      rotationAngleRef.current += rotSpeed;
      pulsePhaseRef.current += pulseSpeed;

      const currentPulse = Math.sin(pulsePhaseRef.current);
      const radiusMod =
        state === 'listening' || state === 'interrupted'
          ? (audioLevel - 0.2) * 12
          : state === 'speaking'
          ? Math.sin(pulsePhaseRef.current * 1.5) * 4
          : currentPulse * (size === 'hero' ? 3.5 : 1.8);
      const effectiveRadius = Math.max(15, dimensions.ringRadius + radiusMod);

      // 1. OUTER AMBIENT GLOW (Radial Bloom)
      const glowGrad = ctx.createRadialGradient(
        centerX,
        centerY,
        effectiveRadius * 0.5,
        centerX,
        centerY,
        effectiveRadius * 1.6
      );

      if (state === 'error') {
        glowGrad.addColorStop(0, 'rgba(239, 68, 68, 0)');
        glowGrad.addColorStop(0.7, 'rgba(239, 68, 68, 0.25)');
        glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else if (state === 'success') {
        glowGrad.addColorStop(0, 'rgba(6, 182, 212, 0)');
        glowGrad.addColorStop(0.65, 'rgba(16, 185, 129, 0.35)');
        glowGrad.addColorStop(0.85, 'rgba(168, 85, 247, 0.25)');
        glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else {
        glowGrad.addColorStop(0, 'rgba(139, 92, 246, 0)');
        glowGrad.addColorStop(
          0.6,
          `rgba(168, 85, 247, ${0.18 * glowMultiplier})`
        );
        glowGrad.addColorStop(
          0.8,
          `rgba(236, 72, 153, ${0.16 * glowMultiplier})`
        );
        glowGrad.addColorStop(
          0.95,
          `rgba(6, 182, 212, ${0.12 * glowMultiplier})`
        );
        glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      }

      ctx.save();
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, effectiveRadius * 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 2. MAIN NEON RING WITH ROTATING GRADIENT
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotationAngleRef.current);

      // Create Conic Gradient for the Ring
      // Stops: Purple -> Fuchsia -> Pink -> Cyan -> Electric Blue -> Violet
      const conicGrad = ctx.createConicGradient(0, 0, 0);
      if (state === 'error') {
        conicGrad.addColorStop(0, '#ef4444');
        conicGrad.addColorStop(0.5, '#dc2626');
        conicGrad.addColorStop(0.8, '#a855f7');
        conicGrad.addColorStop(1, '#ef4444');
      } else {
        conicGrad.addColorStop(0.0, '#9333ea'); // Deep violet
        conicGrad.addColorStop(0.2, '#c084fc'); // Light purple
        conicGrad.addColorStop(0.38, '#ec4899'); // Hot pink / magenta
        conicGrad.addColorStop(0.55, '#f43f5e'); // Rose
        conicGrad.addColorStop(0.72, '#06b6d4'); // Neon cyan
        conicGrad.addColorStop(0.88, '#3b82f6'); // Electric blue
        conicGrad.addColorStop(1.0, '#9333ea'); // Loop back
      }

      // Draw dynamic multi-segment torus with soft wave oscillation
      ctx.beginPath();
      const segments = 120;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        let r = effectiveRadius;

        if (waveAmplitude > 0) {
          // Harmonic audio wave displacement
          const wave =
            Math.sin(theta * 6 + pulsePhaseRef.current * 4) * 0.6 +
            Math.cos(theta * 10 - pulsePhaseRef.current * 2) * 0.4;
          r += wave * waveAmplitude;
        }

        const px = Math.cos(theta) * r;
        const py = Math.sin(theta) * r;

        if (i === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.closePath();

      ctx.strokeStyle = conicGrad;
      ctx.lineWidth = dimensions.ringWidth;
      ctx.lineCap = 'round';
      ctx.shadowColor =
        state === 'error'
          ? 'rgba(239, 68, 68, 0.8)'
          : state === 'success'
          ? 'rgba(34, 211, 238, 0.9)'
          : 'rgba(236, 72, 153, 0.85)';
      ctx.shadowBlur = 24 * glowMultiplier;
      ctx.stroke();

      // Sharp Core Line for high-tech definition
      ctx.lineWidth = Math.max(2, dimensions.ringWidth * 0.28);
      ctx.strokeStyle = '#ffffff';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ffffff';
      ctx.globalAlpha = 0.65;
      ctx.stroke();
      ctx.globalAlpha = 1.0;

      ctx.restore();

      // 3. SECONDARY RESONANCE RING (Inner counter-rotating dotted arc)
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(-rotationAngleRef.current * 0.8);
      ctx.beginPath();
      ctx.arc(0, 0, effectiveRadius - dimensions.ringWidth * 0.9, 0, Math.PI * 2);
      ctx.setLineDash([4, 12]);
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.restore();

      // 4. INNER DARK CENTER VOID
      // Dark/black center with subtle radial depth
      ctx.save();
      const innerVoidRadius = Math.max(5, effectiveRadius - dimensions.ringWidth * 0.7);
      const innerGrad = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        innerVoidRadius
      );
      const isLightMode = typeof document !== 'undefined' && document.documentElement.classList.contains('light');
      if (isLightMode) {
        innerGrad.addColorStop(0, '#ffffff');
        innerGrad.addColorStop(0.7, '#f8fafc');
        innerGrad.addColorStop(1, 'rgba(241, 245, 249, 0.98)');
      } else {
        innerGrad.addColorStop(0, '#030306');
        innerGrad.addColorStop(0.75, '#05050a');
        innerGrad.addColorStop(1, 'rgba(10, 10, 18, 0.95)');
      }

      ctx.fillStyle = innerGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, innerVoidRadius, 0, Math.PI * 2);
      ctx.fill();

      // Inner voice waveform or audio center ripples when listening
      if (state === 'listening' && size !== 'micro') {
        const audioVisualRadius = Math.min(
          innerVoidRadius - 6,
          20 + audioLevel * (innerVoidRadius * 0.6)
        );
        ctx.beginPath();
        ctx.arc(centerX, centerY, audioVisualRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(6, 182, 212, ${0.4 + audioLevel * 0.5})`;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(centerX, centerY, Math.max(3, audioVisualRadius * 0.5), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(236, 72, 153, ${0.4 + audioLevel * 0.5})`;
        ctx.fill();
      }

      ctx.restore();

      // 5. ORBITING PARTICLES & SPARKS
      ctx.save();
      const particleSpeedFactor =
        state === 'thinking' || state === 'searching' || state === 'processing'
          ? 2.2
          : state === 'listening'
          ? 1.5
          : 1.0;

      particlesRef.current.forEach((p) => {
        p.angle += p.speed * particleSpeedFactor;
        const currentDist =
          effectiveRadius +
          Math.sin(pulsePhaseRef.current + p.angle * 2) * (size === 'hero' ? 14 : 7);
        const px = centerX + Math.cos(p.angle) * currentDist;
        const py = centerY + Math.sin(p.angle) * currentDist;

        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha * (0.6 + glowMultiplier * 0.35);
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.fill();
      });
      ctx.restore();

      // 6. SWEEPING LIGHT BEACON on state changes
      if (
        (state === 'searching' || state === 'comparing' || state === 'processing') &&
        size !== 'micro'
      ) {
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(rotationAngleRef.current * 1.8);
        const flareDist = effectiveRadius;
        const flareGrad = ctx.createRadialGradient(flareDist, 0, 0, flareDist, 0, 18);
        flareGrad.addColorStop(0, '#ffffff');
        flareGrad.addColorStop(0.3, '#22d3ee');
        flareGrad.addColorStop(0.8, 'rgba(168, 85, 247, 0.4)');
        flareGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = flareGrad;
        ctx.beginPath();
        ctx.arc(flareDist, 0, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      animFrameIdRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [state, audioLevel, size]);

  return (
    <div
      className={`relative flex flex-col items-center justify-center select-none ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      {/* Canvas Orb Element */}
      <div
        className="relative cursor-pointer transition-transform duration-500 ease-out"
        style={{
          transform: isHovered ? 'scale(1.03)' : 'scale(1)',
          width: dimensions.width,
          height: dimensions.height,
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ width: dimensions.width, height: dimensions.height }}
          className="block drop-shadow-[0_0_50px_rgba(168,85,247,0.3)]"
        />

        {/* Center icon badge for micro/compact modes */}
        {size === 'micro' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          </div>
        )}
      </div>

      {/* State label & feedback (shown when size is hero or compact) */}
      {size !== 'micro' && (
        <div className="mt-4 flex flex-col items-center text-center px-4 max-w-sm pointer-events-none">
          <AnimatePresence mode="wait">
            <motion.div
              key={state + (statusTextOverride || '')}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className="flex items-center gap-2"
            >
              {state === 'speaking' ? (
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400">
                  <Volume2 className="w-3 h-3 animate-pulse" />
                </span>
              ) : state === 'listening' || state === 'interrupted' ? (
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-red-500/20 text-red-400">
                  <Mic className="w-3 h-3 animate-pulse" />
                </span>
              ) : state === 'thinking' || state === 'searching' || state === 'comparing' ? (
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400">
                  <Sparkles className="w-3 h-3 animate-spin" />
                </span>
              ) : state === 'success' ? (
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400">
                  <Volume2 className="w-3 h-3" />
                </span>
              ) : null}

              <h2
                className={`font-semibold tracking-wide ${
                  size === 'hero' ? 'text-2xl sm:text-3xl' : 'text-lg sm:text-xl'
                } ${
                  state === 'error'
                    ? 'text-red-500 dark:text-red-400'
                    : state === 'success'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-900 dark:text-zinc-100'
                }`}
              >
                {getStatusText()}
              </h2>
            </motion.div>
          </AnimatePresence>

          {size === 'hero' && (
            <motion.p
              key={`sub-${state}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.3 }}
              className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mt-1.5 font-medium dark:font-light"
            >
              {getSubStatusText()}
            </motion.p>
          )}
        </div>
      )}
    </div>
  );
};
