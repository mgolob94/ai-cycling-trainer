import { useState } from 'react';
import { View, Modal, Pressable, TextInput, StyleSheet, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Feather } from '@expo/vector-icons';

import { api, type ApiResponse } from '../../services/api';
import { Text, Card, Button, Emoji } from '../ui';
import { spacing, radius } from '../../theme/tokens';
import { useThemeColors } from '../../theme/useThemeColors';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Called after the event (or "no event") is saved + phase recomputed. */
  onSaved?: () => void;
}

const WEEK_MS = 7 * 24 * 3600 * 1000;
const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/** Compute the phase breakdown for a given weeks-to-event count. */
function phasePlan(weeksToEvent: number) {
  const taper = Math.min(3, weeksToEvent);
  const peak = Math.max(0, Math.min(5, weeksToEvent - 3));
  const build = Math.max(0, Math.min(8, weeksToEvent - 8));
  const base = Math.max(0, weeksToEvent - 16);
  return { base, build, peak, taper };
}

export default function EventSetup({ visible, onClose, onSaved }: Props) {
  const { colors } = useThemeColors();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState('');
  const [date, setDate] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setStep(1);
    setName('');
    setDate(null);
    setShowPicker(false);
  };
  const close = () => {
    reset();
    onClose();
  };

  const weeksToEvent = date ? Math.ceil((date.getTime() - Date.now()) / WEEK_MS) : 0;
  const tooSoon = !!date && weeksToEvent < 3;
  const tooFar = !!date && weeksToEvent > 52;

  const saveEvent = async (payload: { target_event_name: string | null; target_event_date: string | null }) => {
    setSaving(true);
    try {
      await api.post<ApiResponse<unknown>>('/plans/event', payload);
      onSaved?.();
      close();
    } catch {
      // best-effort; close anyway
      close();
    } finally {
      setSaving(false);
    }
  };

  const onPickDate = (e: DateTimePickerEvent, d?: Date) => {
    if (Platform.OS !== 'ios') setShowPicker(false);
    if (e.type === 'dismissed' || !d) return;
    setDate(d);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close} presentationStyle="pageSheet">
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Text variant="bodyLarge" style={styles.bold}>
            {step === 1 ? 'What are you training for?' : step === 2 ? 'Event details' : 'Your plan'}
          </Text>
          <Pressable onPress={close} hitSlop={12}>
            <Feather name="x" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          {step === 1 ? (
            <>
              <Card variant="default" onPress={() => setStep(2)} style={styles.choice}>
                <Emoji size={28}>🏁</Emoji>
                <Text variant="bodyLarge" style={styles.bold}>
                  I have a specific event
                </Text>
                <Text variant="caption" color={colors.textSecondary}>
                  Gran Fondo, race, sportif — give us a date and we'll build backwards from it.
                </Text>
              </Card>
              <Card variant="default" onPress={() => saveEvent({ target_event_name: null, target_event_date: null })} style={styles.choice}>
                <Emoji size={28}>📈</Emoji>
                <Text variant="bodyLarge" style={styles.bold}>
                  I want to get fitter
                </Text>
                <Text variant="caption" color={colors.textSecondary}>
                  No event? No problem. We'll progress you through the season automatically.
                </Text>
              </Card>
            </>
          ) : null}

          {step === 2 ? (
            <View style={styles.form}>
              <Text variant="caption" color={colors.textSecondary}>
                Event name
              </Text>
              <TextInput
                style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.surfaceRaised }]}
                placeholder="e.g. Gran Fondo Žiri"
                placeholderTextColor={colors.textTertiary}
                value={name}
                onChangeText={setName}
              />

              <Text variant="caption" color={colors.textSecondary} style={styles.mt}>
                Event date
              </Text>
              <Pressable
                style={[styles.input, styles.dateField, { backgroundColor: colors.surfaceRaised }]}
                onPress={() => setShowPicker(true)}
              >
                <Text variant="body" color={date ? colors.textPrimary : colors.textTertiary}>
                  {date ? date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'Pick a date'}
                </Text>
                <Feather name="calendar" size={18} color={colors.textTertiary} />
              </Pressable>
              {showPicker ? (
                <DateTimePicker
                  value={date ?? new Date(Date.now() + 12 * WEEK_MS)}
                  mode="date"
                  minimumDate={new Date()}
                  onChange={onPickDate}
                />
              ) : null}

              {tooSoon ? (
                <Text variant="caption" color={colors.warning} style={styles.mt}>
                  That's under 3 weeks away — there's only time to taper, not to build.
                </Text>
              ) : null}
              {tooFar ? (
                <Text variant="caption" color={colors.warning} style={styles.mt}>
                  That's over a year out — consider setting it closer to the date.
                </Text>
              ) : null}

              <Button label="Continue" variant="primary" size="lg" disabled={!date || tooFar} onPress={() => setStep(3)} style={styles.mtLg} />
            </View>
          ) : null}

          {step === 3 && date ? (
            <View style={styles.form}>
              <Text variant="body" color={colors.textSecondary}>
                Based on your event date ({date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}), you have{' '}
                <Text variant="body" color={colors.textPrimary} style={styles.bold}>
                  {weeksToEvent} weeks
                </Text>
                . Your plan:
              </Text>

              {(() => {
                const p = phasePlan(weeksToEvent);
                const rows = [
                  { emoji: '📗', label: 'Base', weeks: p.base },
                  { emoji: '📘', label: 'Build', weeks: p.build },
                  { emoji: '📙', label: 'Peak', weeks: p.peak },
                  { emoji: '📕', label: 'Taper', weeks: p.taper },
                ].filter((r) => r.weeks > 0);
                return (
                  <Card variant="tinted" style={styles.preview}>
                    {rows.map((r) => (
                      <View key={r.label} style={styles.previewRow}>
                        <Emoji size={18}>{r.emoji}</Emoji>
                        <Text variant="body" color={colors.textPrimary} style={styles.flex}>
                          {r.label}
                        </Text>
                        <Text variant="body" color={colors.textSecondary}>
                          {r.weeks} {r.weeks === 1 ? 'week' : 'weeks'}
                        </Text>
                      </View>
                    ))}
                  </Card>
                );
              })()}

              <Text variant="caption" color={colors.textTertiary}>
                The coach generates a specific plan for your phase every week.
              </Text>

              <Button
                label="Start training →"
                variant="primary"
                size="lg"
                loading={saving}
                onPress={() => saveEvent({ target_event_name: name.trim() || 'My event', target_event_date: date.toISOString().slice(0, 10) })}
                style={styles.mtLg}
              />
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[5], paddingVertical: spacing[4] },
  bold: { fontWeight: '700' },
  body: { padding: spacing[5], gap: spacing[4] },
  choice: { gap: spacing[2], alignItems: 'flex-start' },
  form: { gap: spacing[2] },
  input: { borderRadius: radius.md, paddingHorizontal: spacing[4], paddingVertical: 12, fontSize: 15 },
  dateField: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mt: { marginTop: spacing[3] },
  mtLg: { marginTop: spacing[5] },
  preview: { gap: spacing[3], marginTop: spacing[2] },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  flex: { flex: 1 },
});
