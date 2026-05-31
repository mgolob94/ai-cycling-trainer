import { useEffect, useState } from 'react';
import { View, Switch, Pressable, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as Notifications from 'expo-notifications';

import { Text, Card, SectionHeader } from '../components/ui';
import { palette, spacing, radius } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

const PREFS_KEY = 'notif.prefs';
const QUIET_KEY = 'notif.quietHours';

const CATEGORIES: { key: string; label: string; defaultOn: boolean }[] = [
  { key: 'morning_readiness', label: 'Morning readiness', defaultOn: true },
  { key: 'workout_reminder', label: 'Workout reminders', defaultOn: true },
  { key: 'milestone', label: 'Milestones & records', defaultOn: true },
  { key: 'weekly_review', label: 'Weekly review', defaultOn: true },
  { key: 'monthly_review', label: 'Monthly review', defaultOn: true },
  { key: 'inactivity', label: 'Inactivity nudges', defaultOn: false }, // most sensitive — off by default
];

function fmt(h: number, m: number): string {
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export default function NotificationSettingsScreen() {
  const { colors, isDark } = useTheme();
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [quiet, setQuiet] = useState({ startHour: 22, endHour: 7 });
  const [picker, setPicker] = useState<null | 'start' | 'end'>(null);

  useEffect(() => {
    (async () => {
      const [p, q] = await Promise.all([AsyncStorage.getItem(PREFS_KEY), AsyncStorage.getItem(QUIET_KEY)]);
      const base: Record<string, boolean> = {};
      CATEGORIES.forEach((c) => (base[c.key] = c.defaultOn));
      setPrefs(p ? { ...base, ...JSON.parse(p) } : base);
      if (q) setQuiet(JSON.parse(q));
    })();
  }, []);

  const toggle = (key: string, value: boolean) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next)).catch(() => {});
  };

  const onQuiet = (which: 'start' | 'end') => (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS !== 'ios') setPicker(null);
    if (event.type === 'dismissed' || !date) return;
    const next = { ...quiet, [which === 'start' ? 'startHour' : 'endHour']: date.getHours() };
    setQuiet(next);
    AsyncStorage.setItem(QUIET_KEY, JSON.stringify(next)).catch(() => {});
  };

  const test = async (label: string) => {
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Test — ' + label, body: 'This is how this notification will look.' },
      trigger: null,
    });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['bottom']}>
      <View style={styles.container}>
        <SectionHeader title="NOTIFICATIONS" />
        <Card variant="default" padding={spacing[4]}>
          {CATEGORIES.map((c, i) => (
            <View key={c.key} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.borderSubtle }]}>
              <Pressable onPress={() => test(c.label)} hitSlop={6} style={styles.flex}>
                <Text variant="body" color={colors.textPrimary}>
                  {c.label}
                </Text>
                <Text variant="caption" color={colors.accent}>
                  Send a test
                </Text>
              </Pressable>
              <Switch
                value={prefs[c.key] ?? c.defaultOn}
                onValueChange={(v) => toggle(c.key, v)}
                trackColor={{ false: colors.border, true: palette.slate900 }}
                thumbColor="#fff"
              />
            </View>
          ))}
        </Card>

        <SectionHeader title="QUIET HOURS" />
        <Card variant="default" padding={spacing[4]}>
          <Pressable style={styles.row} onPress={() => setPicker('start')}>
            <Text variant="body" color={colors.textPrimary}>
              From
            </Text>
            <Text variant="body" color={colors.accent}>
              {fmt(quiet.startHour, 0)}
            </Text>
          </Pressable>
          <Pressable style={[styles.row, { borderTopWidth: 1, borderTopColor: colors.borderSubtle }]} onPress={() => setPicker('end')}>
            <Text variant="body" color={colors.textPrimary}>
              To
            </Text>
            <Text variant="body" color={colors.accent}>
              {fmt(quiet.endHour, 0)}
            </Text>
          </Pressable>
          {picker ? (
            <DateTimePicker
              value={(() => {
                const d = new Date();
                d.setHours(picker === 'start' ? quiet.startHour : quiet.endHour, 0, 0, 0);
                return d;
              })()}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onQuiet(picker)}
              themeVariant={isDark ? 'dark' : 'light'}
            />
          ) : null}
        </Card>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: spacing[5], gap: spacing[3] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing[3] },
  flex: { flex: 1, gap: 2 },
});
