import type { TextStyle } from 'react-native';
import { BarlowCondensed_700Bold, BarlowCondensed_900Black } from '@expo-google-fonts/barlow-condensed';
import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';

import { colors } from './tokens';

// Athletic, Strava-inspired type system:
//   display — Barlow Condensed (big numbers, hero stats, titles): condensed,
//             earned-feeling, used by sports brands rather than SaaS.
//   sans    — DM Sans (body, labels): clean, not generic.
//   mono    — JetBrains Mono (live data / precise values).
export const fonts = {
  display: 'BarlowCondensed_700Bold',
  displayBlack: 'BarlowCondensed_900Black',
  sansRegular: 'DMSans_400Regular',
  sansMedium: 'DMSans_500Medium',
  sansSemibold: 'DMSans_600SemiBold',
  sansBold: 'DMSans_700Bold',
  monoRegular: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
  monoSemibold: 'JetBrainsMono_600SemiBold',
  monoBold: 'JetBrainsMono_700Bold',
} as const;

// Asset map handed to useFonts() in App.tsx. Keys must equal the family names.
export const fontAssets = {
  BarlowCondensed_700Bold,
  BarlowCondensed_900Black,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
  JetBrainsMono_700Bold,
};

// Text style presets. The weight-specific family carries the weight; fontWeight
// is kept to match the design spec and to inform the pre-load system fallback.
export const typography = {
  heading1: {
    fontFamily: fonts.display,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: colors.textPrimary,
  },
  heading2: {
    fontFamily: fonts.display,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: colors.textPrimary,
  },
  heading3: {
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.2,
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
    fontFamily: fonts.displayBlack,
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: -0.5,
    color: colors.textPrimary,
  },
  statMd: {
    fontFamily: fonts.display,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: colors.textPrimary,
  },
  statSm: {
    fontFamily: fonts.display,
    fontSize: 19,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  // Live / precise data values — monospace.
  data: {
    fontFamily: fonts.monoRegular,
    fontSize: 14,
    fontWeight: '400',
    color: colors.textPrimary,
  },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;
