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
  // 4.6:1 on white was AA-borderline at caption size; #6B7A8F lifts
  // muted captions to ~5.6:1 without losing the "secondary" feel.
  textMuted: '#6B7A8F',
  success: '#10B981',
  danger: '#EF4444',
  dangerTint: '#FFF1F1', // soft danger background — error pills, destructive surfaces
  dangerBorder: '#FFD4D4', // matching border for dangerTint surfaces
  white: '#FFFFFF',
  border: '#D9F0EC', // subtle teal-tinted dividers; reads as warm grey
  cardBackground: '#FFFFFF',
  mapOverlay: 'rgba(244, 251, 250, 0.95)',
  // Pickup-pin uses the brand teal so the marker reads as ours, not
  // borrowed from Yandex/Bolt. The dark colour is reserved for the
  // stem (Yandex-style "needle") and the pictogram inside the badge —
  // both need to read on the deep teal background.
  pickupBadge: '#14B8A6',
  pickupDark: '#0F2937',
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
