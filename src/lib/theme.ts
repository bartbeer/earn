// Single source of design tokens. Screens and components pull colors, spacing
// and typography from here rather than hardcoding values, so the "calm,
// modern, trustworthy" look (master spec section 29) stays consistent.

export const colors = {
  background: '#FAFAF8',
  surface: '#FFFFFF',
  border: '#E7E5E0',

  textPrimary: '#1A1D1A',
  textSecondary: '#6B7169',
  textMuted: '#9AA098',

  primary: '#2F9E6E',
  primaryPressed: '#25835A',
  primarySoft: '#E7F5EE',

  track: '#EEEDE8',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

// Minimum comfortable touch target (master spec section 31).
export const minTouchTarget = 44;

export const typography = {
  screenTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: colors.textPrimary,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: colors.textSecondary,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
  },
  primaryNumber: {
    fontSize: 36,
    fontWeight: '700' as const,
    color: colors.textPrimary,
  },
  taskName: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: colors.textPrimary,
  },
  taskAmount: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.textPrimary,
  },
  secondaryMeta: {
    fontSize: 13,
    fontWeight: '400' as const,
    color: colors.textSecondary,
  },
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
    color: colors.textPrimary,
  },
} as const;
