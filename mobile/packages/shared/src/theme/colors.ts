// Client palette built from the AIYL logo: deep violet "A", aqua/teal
// counter-stroke, warm coral accent. Background lifts the violet with a
// whisper-lavender off-white so the screen reads warm and inviting
// despite the cool primary hues — pure clinical white would have made
// the purple feel cold.
export const ClientColors = {
  background: '#FAF7FF', // whisper-lavender off-white — cozy halo around cards
  surfaceMuted: '#F2EDFB', // chip / pill backgrounds, region selector hover
  primary: '#6C2BD9', // deep brand violet — main CTAs, active states
  primaryDark: '#4B1BA0',
  primaryTint: '#EDE3FF', // soft lavender — price-chip backgrounds, badges
  secondary: '#27B6C0', // brand aqua — secondary actions, info chips
  secondaryDark: '#168F98',
  secondaryTint: '#DEF6F8',
  accent: '#FF7B1A', // brand coral — hero highlights, ride-now CTA
  accentTint: '#FFE7D2',
  dark: '#1E1B2E', // text on light surface; lifted slightly toward violet for cohesion
  darkSecondary: '#3C3553',
  textPrimary: '#1E1B2E',
  textSecondary: '#5E5773',
  textMuted: '#A19AB8',
  success: '#10B981',
  danger: '#EF4444',
  white: '#FFFFFF',
  border: '#ECE7F4', // subtle violet-tinted dividers; reads as warm grey
  cardBackground: '#FFFFFF',
  mapOverlay: 'rgba(255, 253, 255, 0.95)',
} as const;

export const DriverColors = {
  background: '#1F2937',
  backgroundSecondary: '#111827',
  primary: '#FBBF24',
  primaryDark: '#D97706',
  textPrimary: '#FFFFFF',
  textSecondary: '#D1D5DB',
  textMuted: '#9CA3AF',
  success: '#10B981',
  danger: '#EF4444',
  cardBackground: '#374151',
  border: '#4B5563',
  white: '#FFFFFF',
} as const;
