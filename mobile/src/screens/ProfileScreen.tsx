import { useEffect, useRef, useState } from 'react';
import { View, Switch, Pressable, StyleSheet, Platform, Alert, ScrollView, Modal } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import Constants from 'expo-constants';

import type { AppStackParamList } from '../navigation/types';

import { useAuthStore } from '../store/useAuthStore';
import { api, apiOrigin } from '../services/api';
import {
  getSettings,
  setRemindersEnabled,
  scheduleDailyReminder,
  type NotificationSettings,
} from '../services/notifications';
import { Text, Card, SectionHeader, Button, Emoji } from '../components/ui';
import { useKnowledgeLevel } from '../context/KnowledgeLevelContext';
import type { KnowledgeLevel } from '../services/userLevel';
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

const LEVELS: KnowledgeLevel[] = ['beginner', 'intermediate', 'advanced'];
const LEVEL_META: Record<KnowledgeLevel, { label: string; desc: string }> = {
  beginner: { label: 'Beginner', desc: 'Plain language only' },
  intermediate: { label: 'Recreational', desc: 'Plain language + numbers on tap' },
  advanced: { label: 'Advanced', desc: 'Numbers by default' },
};

export default function ProfileScreen() {
  const clearSession = useAuthStore((state) => state.clearSession);
  const { colors, isDark, mode, setMode } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();

  // Dev-only: 5 quick taps on the version opens Dev Tools.
  const versionTaps = useRef<{ count: number; first: number }>({ count: 0, first: 0 });
  const onVersionTap = () => {
    if (!__DEV__) return;
    const now = Date.now();
    const t = versionTaps.current;
    if (now - t.first > 2000) {
      t.count = 1;
      t.first = now;
    } else {
      t.count += 1;
    }
    if (t.count >= 5) {
      t.count = 0;
      navigation.navigate('DevTools' as never);
    }
  };
  const appVersion = Constants.expoConfig?.version ?? '0.1.0';
  const { level, setLevel } = useKnowledgeLevel();
  const insets = useSafeAreaInsets();

  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [levelModalOpen, setLevelModalOpen] = useState(false);
  const [pendingLevel, setPendingLevel] = useState<KnowledgeLevel>(level);

  const openLevelModal = () => {
    setPendingLevel(level);
    setLevelModalOpen(true);
  };
  const saveLevel = () => {
    setLevel(pendingLevel); // AsyncStorage + Supabase + live UI refresh
    setLevelModalOpen(false);
  };

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

        {/* Data display */}
        <View style={styles.section}>
          <SectionHeader title="DATA DISPLAY" />
          <Card variant="default" padding={spacing[4]}>
            <Pressable style={styles.row} onPress={openLevelModal}>
              <Text variant="body" color={colors.textPrimary}>
                Data display
              </Text>
              <View style={styles.rowRight}>
                <Text variant="body" color={palette.indigo600}>
                  {LEVEL_META[level].label}
                </Text>
                <Feather name="chevron-right" size={18} color={palette.slate400} />
              </View>
            </Pressable>
          </Card>
          <View style={styles.hintRow}>
            <Emoji size={13}>💡</Emoji>
            <Text variant="caption" color={colors.textSecondary} style={styles.flex}>
              Whenever you see ⓘ, tap it for an explanation of the term.
            </Text>
          </View>
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

        <View style={styles.section}>
          <SectionHeader title="NOTIFICATIONS" />
          <Card variant="default" padding={spacing[4]}>
            <Pressable style={styles.row} onPress={() => navigation.navigate('NotificationSettings')}>
              <Text variant="body" color={colors.textPrimary}>
                Notification settings
              </Text>
              <Feather name="chevron-right" size={18} color={palette.slate400} />
            </Pressable>
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

        <Pressable onPress={onVersionTap} hitSlop={8} style={styles.version}>
          <Text variant="caption" color={colors.textTertiary}>
            Version {appVersion}
          </Text>
        </Pressable>
      </ScrollView>

      {/* Data-display level picker */}
      <Modal visible={levelModalOpen} transparent animationType="slide" onRequestClose={() => setLevelModalOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setLevelModalOpen(false)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: (insets.bottom || 12) + spacing[4] }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            <Text variant="heading3" color={colors.textPrimary}>
              How we show your data
            </Text>

            <View style={styles.optionsList}>
              {LEVELS.map((l) => {
                const sel = pendingLevel === l;
                return (
                  <Pressable key={l} style={styles.optionRow} onPress={() => setPendingLevel(l)}>
                    <View style={[styles.radio, { borderColor: sel ? palette.indigo600 : colors.border }]}>
                      {sel ? <View style={styles.radioDot} /> : null}
                    </View>
                    <View style={styles.flex}>
                      <Text variant="body" color={colors.textPrimary} style={styles.optionTitle}>
                        {LEVEL_META[l].label}
                      </Text>
                      <Text variant="caption" color={colors.textSecondary}>
                        {LEVEL_META[l].desc}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <Text variant="caption" color={colors.textSecondary}>
              Current level: {LEVEL_META[level].label}
            </Text>
            <Text variant="caption" color={colors.textTertiary} style={styles.infoText}>
              The app automatically advances your level as it notices you exploring the details.
            </Text>

            <Button label="Save" variant="primary" onPress={saveLevel} style={styles.saveBtn} />
          </Pressable>
        </Pressable>
      </Modal>
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
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingHorizontal: spacing[1] },
  flex: { flex: 1 },

  actions: { gap: spacing[3], marginTop: spacing[4] },
  version: { alignItems: 'center', marginTop: spacing[5] },

  backdrop: { flex: 1, backgroundColor: 'rgba(13,13,12,0.45)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    gap: spacing[3],
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: radius.full, marginBottom: spacing[2] },
  optionsList: { gap: spacing[1] },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[3] },
  radio: { width: 22, height: 22, borderRadius: radius.full, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: radius.full, backgroundColor: palette.indigo600 },
  optionTitle: { fontWeight: '600' },
  infoText: { lineHeight: 18 },
  saveBtn: { marginTop: spacing[2] },
});
