// Ambient backdrop for the signed-in app shell. A soft, pattern-free aurora
// (adapted from the Aceternity "Aurora Background" idea, rebuilt in pure CSS —
// no shadcn/cn): a top emerald spotlight plus slow-drifting emerald/teal light
// blobs, so the frosted-glass content cards float on a living surface instead
// of a flat fill. No grid/dot texture. Fixed behind everything,
// non-interactive, respects prefers-reduced-motion.
export default function AmbientBackground() {
  return (
    <div aria-hidden="true" className="as-ambient">
      <style>{`
        .as-ambient {
          position: fixed; inset: 0; z-index: 0; overflow: hidden;
          pointer-events: none;
          background:
            radial-gradient(62% 42% at 50% -10%, rgba(8,154,112,0.16), transparent 62%),
            radial-gradient(50% 45% at 100% 100%, rgba(13,140,130,0.12), transparent 60%),
            hsl(var(--background));
        }
        /* slow-drifting aurora light */
        .as-ambient::before {
          content: ''; position: absolute; inset: -30%;
          background:
            radial-gradient(40% 34% at 14% 22%, rgba(6,145,105,0.26), transparent 60%),
            radial-gradient(36% 32% at 88% 16%, rgba(13,140,130,0.22), transparent 60%),
            radial-gradient(44% 40% at 76% 82%, rgba(6,145,105,0.16), transparent 62%),
            radial-gradient(30% 32% at 22% 90%, rgba(194,116,11,0.09), transparent 60%);
          filter: blur(40px);
          animation: as-drift 28s ease-in-out infinite alternate;
        }
        @keyframes as-drift {
          0%   { transform: translate3d(0,0,0) scale(1); }
          50%  { transform: translate3d(-3%, 2.5%, 0) scale(1.08); }
          100% { transform: translate3d(3%, -2.5%, 0) scale(1.04); }
        }
        @media (prefers-reduced-motion: reduce) {
          .as-ambient::before { animation: none; }
        }
      `}</style>
    </div>
  );
}
