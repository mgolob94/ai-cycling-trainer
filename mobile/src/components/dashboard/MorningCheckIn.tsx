import { useEffect, useState } from 'react';
import { View, Pressable, StyleSheet, LayoutAnimation } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';

import { api, apiOrigin } from '../../services/api';
import { Text, Emoji } from '../ui';
import { spacing, radius, palette } from '../../theme/tokens';
import { useThemeColors } from '../../theme/useThemeColors';
import { useFeatureFlag } from '../../config/featureFlags';

// 1 (wrecked) .. 5 (great) — labels intentionally not shown (subtle widget).
const FEELINGS = ['😴', '😕', '😐', '😊', '⚡'];

const todayKey = () => new Date().toISOString().slice(0, 10);

/**
 * Subtle morning check-in. No mention of "recovery" or any metric — just "how
 * are you feeling?". Saves to recovery_scores.subjective_feeling, which quietly
 * adjusts today's plan in the background. Shown only 05:00–11:00, once a day,
 * until answered or dismissed.
 */
export default function MorningCheckIn() {
  const { colors, isDark } = useThemeColors();
  const enabled = useFeatureFlag('morning_checkin');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const hour = new Date().getHours();
    if (hour < 5 || hour >= 11) return;
    AsyncStorage.getItem(`checkin.${todayKey()}`).then((done) => {
      if (!done) setVisible(true);
    });
  }, [enabled]);

  const close = (markDone: boolean) => {
    if (markDone) AsyncStorage.setItem(`checkin.${todayKey()}`, '1').catch(() => {});
    LayoutAnimation.configureNext(LayoutAnimation.create(180, 'easeInEaseOut', 'opacity'));
    setVisible(false);
  };

  const submit = (feeling: number) => {
    close(true);
    api.post(`${apiOrigin}/recovery/check-in`, { feeling }).catch(() => {});
  };

  if (!visible) return null;
  const bg = isDark ? '#1A1A1A' : palette.slate100;

  return (
    <View style={[styles.card, { backgroundColor: bg }]}>
      <View style={styles.head}>
        <Text variant="caption" color={colors.textSecondary}>
          How are you feeling this morning?
        </Text>
        <Pressable onPress={() => close(true)} hitSlop={10} accessibilityLabel="Dismiss">
          <Feather name="x" size={16} color={colors.textTertiary} />
        </Pressable>
      </View>
      <View style={styles.row}>
        {FEELINGS.map((e, i) => (
          <Pressable key={e} onPress={() => submit(i + 1)} hitSlop={8} style={styles.emojiBtn} accessibilityLabel={`Feeling ${i + 1} of 5`}>
            <Emoji size={26}>{e}</Emoji>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, padding: spacing[4], gap: spacing[3] },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  emojiBtn: { flex: 1, alignItems: 'center', paddingVertical: spacing[1] },
});
