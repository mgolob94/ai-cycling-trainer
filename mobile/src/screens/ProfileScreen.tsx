import { useEffect, useState } from 'react';
import { View, Switch, Pressable, StyleSheet, Platform, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';

import { useAuthStore } from '../store/useAuthStore';
import { api, apiOrigin } from '../services/api';
import {
  getSettings,
  setRemindersEnabled,
  scheduleDailyReminder,
  type NotificationSettings,
} from '../services/notifications';
import { Text, Card, SectionHeader, Button } from '../components/ui';
import { palette, spacing, radius } from '../theme/tokens';
import { useTheme, type ThemeMode } from '../theme/useTheme';

function formatTime(hour: number, minute: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  const m = minute.toString().padStart(2, '0');
  const period = hour < 12 ? 'AM' : 'PM';
  return `${h}:${m} ${period}`;
}

const THEME_OPTIONS: { mode: ThemeMode; label: string }[] = [
  { mode: 'auto', label: 'Auto' },
  { mode: 'light', label: 'Light' },
  { mode: 'dark', label: 'Dark' },
];

export default function ProfileScreen() {
  const clearSession = useAuthStore((state) => state.clearSession);
  const { colors, isDark, mode, setMode } = useTheme();

  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [refreshingAll, setRefreshingAll] = useState(false);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  const refreshAllAnalyses = async () => {
    setRefreshingAll(true);
    try {
      await api.delete(`${apiOrigin}/cache/invalidate`, { data: { all: true } });
      Alert.alert('Analyses cleared', 'All AI analyses will regenerate the next time you open them.');
    } catch {
      Alert.alert('Could not refresh', 'Please try again.');
    } finally {
      setRefreshingAll(false);
    }
  };

  const handleToggle = async (enabled: boolean) => {
    if (!settings) return;
    const ok = await setRemindersEnabled(enabled, settings.hour, settings.minute);
    if (!ok) {
      Alert.alert(
        'Notifications disabled',
        'Enable notifications for this app in your device settings to get workout reminders.'
      );
      return;
    }
    setSettings({ ...settings, enabled });
  };

  const handleTimeChange = async (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS !== 'ios') setShowPicker(false);
    if (event.type === 'dismissed' || !date || !settings) return;
    const hour = date.getHours();
    const minute = date.getMinutes();
    setSettings({ ...settings, hour, minute });
    if (settings.enabled) await scheduleDailyReminder(hour, minute);
  };

  const pickerDate = (() => {
    const d = new Date();
    if (settings) d.setHours(settings.hour, settings.minute, 0, 0);
    return d;
  })();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text variant="heading2" color={colors.textPrimary}>
          Profile
        </Text>
        <Text variant="body" color={colors.textSecondary}>
          Age, weight, fitness level, goal, and your Strava connection live here.
        </Text>

        {/* Appearance */}
        <View style={styles.section}>
          <SectionHeader title="APPEARANCE" />
          <Card variant="default" padding={spacing[1]}>
            <View style={styles.segment}>
              {THEME_OPTIONS.map((opt) => {
                const active = mode === opt.mode;
                return (
                  <Pressable
                    key={opt.mode}
                    style={[styles.segmentItem, active && { backgroundColor: colors.textPrimary }]}
                    onPress={() => setMode(opt.mode)}
                  >
                    <Text variant="caption" color={active ? colors.background : colors.textSecondary} style={styles.segmentText}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>
        </View>

        {/* Reminders */}
        <View style={styles.section}>
          <SectionHeader title="WORKOUT REMINDERS" />
          <Card variant="default" padding={spacing[4]}>
            <View style={styles.row}>
              <Text variant="body" color={colors.textPrimary}>
                Daily reminder
              </Text>
              <Switch
                value={settings?.enabled ?? false}
                onValueChange={handleToggle}
                trackColor={{ false: colors.border, true: palette.slate900 }}
                thumbColor="#fff"
                disabled={!settings}
              />
            </View>
            <Pressable
              style={[styles.row, styles.rowBorder, { borderTopColor: colors.borderSubtle }, !settings?.enabled && styles.rowDisabled]}
              disabled={!settings?.enabled}
              onPress={() => setShowPicker(true)}
            >
              <Text variant="body" color={colors.textPrimary}>
                Reminder time
              </Text>
              <Text variant="body" color={palette.indigo600}>
                {settings ? formatTime(settings.hour, settings.minute) : '—'}
              </Text>
            </Pressable>
            {showPicker ? (
              <DateTimePicker
                value={pickerDate}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleTimeChange}
                themeVariant={isDark ? 'dark' : 'light'}
              />
            ) : null}
          </Card>
        </View>

        <View style={styles.actions}>
          <Button
            label={refreshingAll ? 'Refreshing…' : 'Refresh all analyses'}
            variant="secondary"
            loading={refreshingAll}
            onPress={refreshAllAnalyses}
          />
          <Button label="Sign out" variant="danger" onPress={clearSession} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: spacing[5], gap: spacing[4], paddingBottom: spacing[10] },
  section: { gap: spacing[3], marginTop: spacing[2] },

  segment: { flexDirection: 'row', gap: spacing[1] },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.sm },
  segmentText: { fontWeight: '600', textTransform: 'none', letterSpacing: 0, fontSize: 13 },

  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing[3] },
  rowBorder: { borderTopWidth: 1 },
  rowDisabled: { opacity: 0.4 },

  actions: { gap: spacing[3], marginTop: spacing[4] },
});
