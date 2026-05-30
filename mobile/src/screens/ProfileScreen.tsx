import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';

import { useAuthStore } from '../store/useAuthStore';
import { api, apiOrigin } from '../services/api';
import {
  getSettings,
  setRemindersEnabled,
  scheduleDailyReminder,
  type NotificationSettings,
} from '../services/notifications';
import { colors, spacing, radius, fontSize } from '../theme';

function formatTime(hour: number, minute: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  const m = minute.toString().padStart(2, '0');
  const period = hour < 12 ? 'AM' : 'PM';
  return `${h}:${m} ${period}`;
}

export default function ProfileScreen() {
  const clearSession = useAuthStore((state) => state.clearSession);

  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [refreshingAll, setRefreshingAll] = useState(false);

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

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

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
    // On Android the picker is a one-shot dialog; close it after a selection.
    if (Platform.OS !== 'ios') setShowPicker(false);
    if (event.type === 'dismissed' || !date || !settings) return;

    const hour = date.getHours();
    const minute = date.getMinutes();
    setSettings({ ...settings, hour, minute });

    // Reschedule immediately if reminders are already on.
    if (settings.enabled) {
      await scheduleDailyReminder(hour, minute);
    }
  };

  const pickerDate = (() => {
    const d = new Date();
    if (settings) {
      d.setHours(settings.hour, settings.minute, 0, 0);
    }
    return d;
  })();

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.container}>
        <Text style={styles.heading}>Profile</Text>
        <Text style={styles.body}>
          Age, weight, fitness level, goal, and your Strava connection live here.
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Workout reminders</Text>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Daily reminder</Text>
            <Switch
              value={settings?.enabled ?? false}
              onValueChange={handleToggle}
              trackColor={{ false: colors.surfaceAlt, true: colors.primary }}
              thumbColor="#fff"
              disabled={!settings}
            />
          </View>

          <TouchableOpacity
            style={[styles.row, styles.rowBorderTop, !settings?.enabled && styles.rowDisabled]}
            activeOpacity={0.7}
            disabled={!settings?.enabled}
            onPress={() => setShowPicker(true)}
          >
            <Text style={styles.rowLabel}>Reminder time</Text>
            <Text style={styles.rowValue}>
              {settings ? formatTime(settings.hour, settings.minute) : '—'}
            </Text>
          </TouchableOpacity>

          {showPicker ? (
            <DateTimePicker
              value={pickerDate}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleTimeChange}
              themeVariant="dark"
            />
          ) : null}
        </View>

        <TouchableOpacity
          style={[styles.refreshAll, refreshingAll && styles.refreshAllDisabled]}
          activeOpacity={0.8}
          disabled={refreshingAll}
          onPress={refreshAllAnalyses}
        >
          <Text style={styles.refreshAllText}>
            {refreshingAll ? 'Refreshing…' : 'Refresh all analyses'}
          </Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.signOut} activeOpacity={0.7} onPress={clearSession}>
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: spacing.lg },
  heading: { color: colors.text, fontSize: fontSize.xl, fontWeight: '800' },
  body: { color: colors.textMuted, fontSize: fontSize.md, marginTop: spacing.xs, lineHeight: 22 },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: '700',
    letterSpacing: 1,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  rowBorderTop: { borderTopWidth: 1, borderTopColor: colors.border },
  rowDisabled: { opacity: 0.4 },
  rowLabel: { color: colors.text, fontSize: fontSize.md },
  rowValue: { color: colors.primary, fontSize: fontSize.md, fontWeight: '600' },
  refreshAll: {
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  refreshAllDisabled: { opacity: 0.5 },
  refreshAllText: { color: colors.primary, fontSize: fontSize.md, fontWeight: '600' },
  footer: { flex: 1, justifyContent: 'flex-end' },
  signOut: { paddingVertical: 14, alignItems: 'center' },
  signOutText: { color: colors.danger, fontSize: fontSize.md, fontWeight: '600' },
});
