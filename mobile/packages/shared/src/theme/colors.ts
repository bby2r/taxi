export const ClientColors = {
  // Cream background instead of clinical grey — warmer, less "app-store
  // template" feel. Card surfaces sit on top in pure white for clean
  // contrast.
  background: '#FBF8F2',
  primary: '#0F766E', // deep teal — distinctive vs the Yandex / Bolt yellow-green palette
  primaryDark: '#134E4A',
  accent: '#F97316', // warm orange for secondary CTAs / hero badges
  dark: '#111827',
  darkSecondary: '#374151',
  textPrimary: '#111827',
  textSecondary: '#4B5563',
  textMuted: '#9CA3AF',
  success: '#10B981',
  danger: '#EF4444',
  white: '#FFFFFF',
  border: '#E5E7EB',
  cardBackground: '#FFFFFF',
  // Soft tint used for inline hero blocks (price chip, region pill etc.)
  primaryTint: '#CCFBF1',
  accentTint: '#FED7AA',
  mapOverlay: 'rgba(255,255,255,0.95)',
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
