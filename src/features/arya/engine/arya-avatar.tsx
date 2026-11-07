'use client';

interface AryaAvatarProps {
  /** Whether Arya is actively listening/thinking/speaking, vs. idle. Drives the
   *  pulse ring and the open-mouth "talking" animation — one unified "active"
   *  visual covers all three busy states rather than four subtly different
   *  faces, which would be a lot of design surface for little real benefit. */
  active?: boolean;
  size?: number;
}

/** Arya's illustrated face — replaces the old bare mic icon everywhere Arya
 *  appears (the fixed voice-assistant widget, the Speak screen). Pure inline
 *  SVG, no image asset to ship. Mirrored in eccare-mobile's AryaAvatar.tsx
 *  with the same coordinates/colors via react-native-svg. */
export function AryaAvatar({ active = false, size = 64 }: AryaAvatarProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" role="img" aria-label="Arya">
      {active && (
        <circle cx="48" cy="48" r="46" fill="none" stroke="#854F0B" strokeWidth={2} opacity={0.5} className="arya-pulse-ring" />
      )}
      <circle cx="48" cy="48" r="44" fill="#E1F2F4" />
      <path d="M48 20 C33 20 26 32 26 46 C26 62 34 74 48 74 C62 74 70 62 70 46 C70 32 63 20 48 20 Z" fill="#3C2A1E" />
      <ellipse cx="48" cy="52" rx="19" ry="22" fill="#F0C9A0" />
      <path
        d="M29 46 C29 32 37 24 48 24 C59 24 67 32 67 46 L67 40 C67 40 60 34 48 34 C36 34 29 40 29 40 Z"
        fill="#3C2A1E"
      />
      <circle cx="40" cy="52" r="2.6" fill="#3C2A1E" />
      <circle cx="56" cy="52" r="2.6" fill="#3C2A1E" />
      <path
        d="M40 62 Q48 68 56 62"
        fill="none"
        stroke="#854F0B"
        strokeWidth={2.5}
        strokeLinecap="round"
        className={active ? 'arya-mouth-closed' : undefined}
        opacity={active ? undefined : 1}
      />
      {active && <ellipse cx="48" cy="64" rx="5" ry="3.5" fill="#854F0B" className="arya-mouth-open" />}
      <style>{`
        @keyframes arya-pulse { 0% { transform: scale(1); opacity: 0.5; } 100% { transform: scale(1.18); opacity: 0; } }
        .arya-pulse-ring { transform-origin: 48px 48px; animation: arya-pulse 1.4s ease-out infinite; }
        @keyframes arya-talk { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        .arya-mouth-closed { animation: arya-talk 0.6s ease-in-out infinite reverse; }
        .arya-mouth-open { animation: arya-talk 0.6s ease-in-out infinite; }
      `}</style>
    </svg>
  );
}
