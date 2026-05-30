import type { TextStyle } from 'react-native';
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
} from '@expo-google-fonts/outfit';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';

import { colors } from './tokens';

// Custom fonts ship one static face per weight, so each weight is its own
// family name. "GeneralSans" maps to Outfit (General Sans isn't on Google
// Fonts — Outfit is the approved fallback). "JetBrainsMono" is used for
// numbers, stats, and power values.
export const fonts = {
  sansRegular: 'Outfit_400Regular',
  sansMedium: 'Outfit_500Medium',
  sansSemibold: 'Outfit_600SemiBold',
  sansBold: 'Outfit_700Bold',
  monoRegular: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
  monoSemibold: 'JetBrainsMono_600SemiBold',
  monoBold: 'JetBrainsMono_700Bold',
} as const;

// Asset map handed to useFonts() in App.tsx. Keys must equal the family names
// referenced above.
export const fontAssets = {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
  JetBrainsMono_700Bold,
};

// Text style presets. The weight-specific family carries the weight; fontWeight
// is kept to match the design spec and to inform the pre-load system fallback.
export const typography = {
  heading1: {
    fontFamily: fonts.sansBold,
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.8,
    color: colors.textPrimary,
  },
  heading2: {
    fontFamily: fonts.sansSemibold,
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: -0.5,
    color: colors.textPrimary,
  },
  heading3: {
    fontFamily: fonts.sansSemibold,
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.3,
    color: colors.textPrimary,
  },
  bodyLarge: {
    fontFamily: fonts.sansRegular,
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 26,
    color: colors.textPrimary,
  },
  body: {
    fontFamily: fonts.sansRegular,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 23,
    color: colors.textPrimary,
  },
  caption: {
    fontFamily: fonts.sansRegular,
    fontSize: 13,
    fontWeight: '400',
    color: colors.textSecondary,
  },
  label: {
    fontFamily: fonts.sansSemibold,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  stat: {
    fontFamily: fonts.monoBold,
    fontSize: 38,
    fontWeight: '700',
    letterSpacing: -1,
    color: colors.textPrimary,
  },
  statMd: {
    fontFamily: fonts.monoSemibold,
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: -0.5,
    color: colors.textPrimary,
  },
  statSm: {
    fontFamily: fonts.monoMedium,
    fontSize: 17,
    fontWeight: '500',
    color: colors.textPrimary,
  },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;
