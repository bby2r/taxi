// Client palette built from the Alif logo, but leaning into the aqua /
// teal stroke as the lead colour instead of the violet "A" — most taxi
// brands camp on yellow (Yandex), green (Bolt) or black (Uber), so a
// rich teal lead reads as distinctive at a glance and pairs naturally
// with the warm coral accent for energy. The brand violet stays as a
// small accent token for recognition. Background is a whisper-mint
// off-white that keeps the screen warm despite the cool primary.
export const ClientColors = {
  background: '#F4FBFA', // whisper-mint off-white — cozy halo around cards
  surfaceMuted: '#E8F6F4', // chip / pill backgrounds, region selector hover
  primary: '#14B8A6', // brand aqua-teal — main CTAs, active states
  primaryDark: '#0F8F80',
  primaryTint: '#CCFBF1', // soft mint — price-chip backgrounds, badges
  secondary: '#FF7B1A', // brand coral — secondary CTAs for warm energy
  secondaryDark: '#E0610A',
  secondaryTint: '#FFE7D2',
  accent: '#6C2BD9', // brand violet kept as small accent (badges, special pills)
  accentTint: '#EDE3FF',
  dark: '#0F2937', // cool dark with a slight teal tinge for cohesion
  darkSecondary: '#334155',
  textPrimary: '#0F2937',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  success: '#10B981',
  danger: '#EF4444',
  dangerTint: '#FFF1F1', // soft danger background — error pills, destructive surfaces
  dangerBorder: '#FFD4D4', // matching border for dangerTint surfaces
  white: '#FFFFFF',
  border: '#D9F0EC', // subtle teal-tinted dividers; reads as warm grey
  cardBackground: '#FFFFFF',
  mapOverlay: 'rgba(244, 251, 250, 0.95)',
  // Pickup pin palette — Yandex-Go-style yellow badge with a dark
  // pictogram. Kept here so other map markers can reuse the duo.
  pickupYellow: '#FFCE2B',
  pickupDark: '#1E1B2E',
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
