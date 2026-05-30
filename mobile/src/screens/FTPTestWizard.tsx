import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Animated,
  Dimensions,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { api, apiOrigin, ApiResponse } from '../services/api';
import type { AppStackParamList } from '../navigation/types';
import { lightColors, spacing, radius, fontSize } from '../theme';

const { width } = Dimensions.get('window');

type TestKey = 'ramp' | '20min';

interface TestOption {
  key: TestKey;
  name: string;
  duration: string;
  difficulty: string;
  forWho: string;
  stars: number;
  timeline: { label: string; detail: string }[];
}

const TEST_OPTIONS: TestOption[] = [
  {
    key: 'ramp',
    name: 'Ramp test',
    duration: '20–30 min',
    difficulty: 'Easier',
    forWho: 'For beginners',
    stars: 3,
    timeline: [
      { label: 'Warm-up', detail: '5 min easy' },
      { label: 'Steps', detail: 'From 100 W, +20 W every minute to failure' },
      { label: 'Cool-down', detail: '5 min easy' },
    ],
  },
  {
    key: '20min',
    name: '20-minute test',
    duration: '~60 min',
    difficulty: 'Harder',
    forWho: 'For experienced',
    stars: 5,
    timeline: [
      { label: 'Warm-up', detail: '10 min + 3x 1 min hard' },
      { label: 'Rest', detail: '5 min easy' },
      { label: 'Main effort', detail: '20 min all-out' },
      { label: 'Cool-down', detail: '10 min easy' },
    ],
  },
];

const CHECKLIST = [
  'Do you have a power meter?',
  'Are you well rested?',
  'Did you eat 2–3 h before the test?',
];

interface TestResult {
  new_ftp: number;
  previous_ftp: number | null;
  change_watts: number | null;
  change_percent: number | null;
  w_per_kg: number | null;
  test_quality: 'good' | 'questionable';
}

function riderCategory(wkg: number | null): string {
  if (wkg == null) return '';
  if (wkg < 2.0) return 'Recreational rider';
  if (wkg < 3.0) return 'Fitness rider';
  if (wkg < 4.0) return 'Amateur/athlete';
  if (wkg < 5.0) return 'Advanced amateur';
  return 'Elite rider';
}

function recommendation(result: TestResult): string {
  const change = result.change_watts ?? 0;
  if (result.previous_ftp == null) {
    return 'Based on your test, I recommend building your base with Zone 2 rides.';
  }
  if (change > 3) {
    return `Based on your test, I recommend gradually increasing load — you gained +${change} W!`;
  }
  if (change < -3) {
    return 'Based on your test, I recommend a recovery week, then base rides.';
  }
  return 'Based on your test, I recommend a block of threshold intervals for new gains.';
}

function Stars({ count }: { count: number }) {
  return <Text style={styles.stars}>{'★'.repeat(count)}{'☆'.repeat(5 - count)}</Text>;
}

export default function FTPTestWizard() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState<TestKey | null>(null);
  const [checked, setChecked] = useState([false, false, false]);

  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [displayFtp, setDisplayFtp] = useState(0);

  const [wprime, setWprime] = useState(20000);
  const [savingWprime, setSavingWprime] = useState(false);

  const translateX = useRef(new Animated.Value(0)).current;

  const goTo = (next: number) => {
    Animated.timing(translateX, { toValue: -width, duration: 140, useNativeDriver: true }).start(() => {
      setStep(next);
      translateX.setValue(width);
      Animated.timing(translateX, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    });
  };

  const allChecked = checked.every(Boolean);
  const selectedOption = TEST_OPTIONS.find((t) => t.key === selected);

  // Step 3: auto-run analysis (sync → latest ride → analyze).
  useEffect(() => {
    if (step !== 3 || result || analyzing || !selected) return;
    (async () => {
      setAnalyzing(true);
      setAnalyzeError(null);
      try {
        await api.post(`${apiOrigin}/sync/strava`).catch(() => {});
        const { data: latest } = await api.get<ApiResponse<{ strava_id: string } | null>>('/rides/latest');
        const stravaId = latest.data?.strava_id;
        if (!stravaId) throw new Error('No ride found to analyze.');
        const { data } = await api.post<ApiResponse<TestResult>>(`${apiOrigin}/ftp/test/analyze`, {
          test_type: selected,
          strava_activity_id: stravaId,
        });
        if (data.data) setResult(data.data);
      } catch (e: unknown) {
        const msg =
          (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          (e instanceof Error ? e.message : 'Analysis failed.');
        setAnalyzeError(msg);
      } finally {
        setAnalyzing(false);
      }
    })();
  }, [step, result, analyzing, selected]);

  // Animated count-up of the new FTP.
  useEffect(() => {
    if (!result) return;
    const target = result.new_ftp;
    const start = result.previous_ftp ?? 0;
    const startTime = Date.now();
    const dur = 900;
    const id = setInterval(() => {
      const t = Math.min(1, (Date.now() - startTime) / dur);
      setDisplayFtp(Math.round(start + (target - start) * t));
      if (t >= 1) clearInterval(id);
    }, 30);
    return () => clearInterval(id);
  }, [result]);

  const startTest = () => {
    goTo(3);
    Linking.openURL('strava://').catch(() => Linking.openURL('https://www.strava.com'));
  };

  const regeneratePlan = async () => {
    try {
      await api.post('/plans/generate');
      navigation.navigate('Dashboard');
    } catch {
      goTo(4);
    }
  };

  const saveWprime = async () => {
    setSavingWprime(true);
    try {
      await api.patch('/users/me', { w_prime_total: Math.round(wprime) });
      navigation.navigate('Dashboard');
    } catch {
      // ignore — best effort
    } finally {
      setSavingWprime(false);
    }
  };

  const batteryFill = (wprime - 10000) / 20000; // 0..1

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Progress bar */}
      <View style={styles.progressRow}>
        {[1, 2, 3, 4].map((s) => (
          <View key={s} style={[styles.progressSeg, s <= step && styles.progressSegActive]} />
        ))}
      </View>

      <Animated.View style={[styles.flex, { transform: [{ translateX }] }]}>
        <ScrollView contentContainerStyle={styles.container}>
          {/* STEP 1 — selection */}
          {step === 1 ? (
            <>
              <Text style={styles.title}>Choose a test</Text>
              {TEST_OPTIONS.map((opt) => {
                const active = selected === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.testCard, active && styles.testCardActive]}
                    activeOpacity={0.85}
                    onPress={() => setSelected(opt.key)}
                  >
                    <View style={styles.testCardHeader}>
                      <Text style={styles.testName}>{opt.name}</Text>
                      <Stars count={opt.stars} />
                    </View>
                    <Text style={styles.testMeta}>{opt.duration} · {opt.difficulty} · {opt.forWho}</Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={[styles.primaryButton, !selected && styles.buttonDisabled]}
                disabled={!selected}
                onPress={() => goTo(2)}
              >
                <Text style={styles.primaryButtonText}>Next</Text>
              </TouchableOpacity>
            </>
          ) : null}

          {/* STEP 2 — preparation */}
          {step === 2 && selectedOption ? (
            <>
              <Text style={styles.title}>Preparation</Text>
              <View style={styles.card}>
                {selectedOption.timeline.map((seg, i) => (
                  <View key={i} style={styles.timelineRow}>
                    <View style={styles.timelineDot} />
                    <View style={styles.flex}>
                      <Text style={styles.timelineLabel}>{seg.label}</Text>
                      <Text style={styles.timelineDetail}>{seg.detail}</Text>
                    </View>
                  </View>
                ))}
              </View>

              <Text style={styles.sectionHeading}>Check before the test</Text>
              {CHECKLIST.map((item, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.checkRow}
                  activeOpacity={0.8}
                  onPress={() => setChecked((c) => c.map((v, j) => (j === i ? !v : v)))}
                >
                  <View style={[styles.checkbox, checked[i] && styles.checkboxOn]}>
                    {checked[i] ? <Text style={styles.checkmark}>✓</Text> : null}
                  </View>
                  <Text style={styles.checkLabel}>{item}</Text>
                </TouchableOpacity>
              ))}

              {!allChecked ? (
                <View style={styles.warnBanner}>
                  <Text style={styles.warnText}>Check all items for the best result.</Text>
                </View>
              ) : null}

              <TouchableOpacity style={styles.primaryButton} onPress={startTest}>
                <Text style={styles.primaryButtonText}>Start test (open Strava)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.linkButton} onPress={() => goTo(1)}>
                <Text style={styles.linkText}>Back</Text>
              </TouchableOpacity>
            </>
          ) : null}

          {/* STEP 3 — result */}
          {step === 3 ? (
            <>
              <Text style={styles.title}>After the test</Text>
              {analyzing ? (
                <View style={styles.center}>
                  <ActivityIndicator color={lightColors.primary} size="large" />
                  <Text style={styles.muted}>Analyzing your FTP test…</Text>
                </View>
              ) : analyzeError ? (
                <View style={styles.card}>
                  <Text style={styles.error}>{analyzeError}</Text>
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={() => {
                      setAnalyzeError(null);
                      setResult(null);
                    }}
                  >
                    <Text style={styles.primaryButtonText}>Try again</Text>
                  </TouchableOpacity>
                </View>
              ) : result ? (
                <>
                  <View style={styles.resultCard}>
                    <Text style={styles.cardLabel}>NEW FTP</Text>
                    <View style={styles.ftpRow}>
                      <Text style={styles.ftpValue}>{displayFtp}</Text>
                      <Text style={styles.ftpUnit}>W</Text>
                    </View>
                    {result.change_watts != null ? (
                      <View
                        style={[
                          styles.changeBadge,
                          { backgroundColor: result.change_watts >= 0 ? lightColors.form : lightColors.fatigue },
                        ]}
                      >
                        <Text style={styles.changeText}>
                          {result.change_watts >= 0 ? '+' : ''}
                          {result.change_watts} W · {result.change_percent}%
                        </Text>
                      </View>
                    ) : null}
                    {result.w_per_kg != null ? (
                      <Text style={styles.wkg}>
                        {result.w_per_kg} W/kg · {riderCategory(result.w_per_kg)}
                      </Text>
                    ) : null}
                    {result.test_quality === 'questionable' ? (
                      <Text style={styles.questionable}>⚠︎ Power was variable — result is approximate.</Text>
                    ) : null}
                    <Text style={styles.recommendation}>{recommendation(result)}</Text>
                  </View>

                  <TouchableOpacity style={styles.primaryButton} onPress={regeneratePlan}>
                    <Text style={styles.primaryButtonText}>Update training</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.linkButton} onPress={() => goTo(4)}>
                    <Text style={styles.linkText}>Set W' (optional) →</Text>
                  </TouchableOpacity>
                </>
              ) : null}
            </>
          ) : null}

          {/* STEP 4 — W' calibration */}
          {step === 4 ? (
            <>
              <Text style={styles.title}>W' calibration</Text>
              <View style={styles.card}>
                <Text style={styles.body}>W' is your anaerobic battery — how much work you can do above FTP.</Text>

                <View style={styles.battery}>
                  <View style={[styles.batteryFill, { width: `${Math.max(0, Math.min(1, batteryFill)) * 100}%` }]} />
                </View>
                <Text style={styles.wprimeValue}>{Math.round(wprime).toLocaleString()} J</Text>

                <Slider
                  minimumValue={10000}
                  maximumValue={30000}
                  step={500}
                  value={wprime}
                  onValueChange={setWprime}
                  minimumTrackTintColor={lightColors.primary}
                  maximumTrackTintColor={lightColors.border}
                  thumbTintColor={lightColors.primary}
                />
                <View style={styles.scaleRow}>
                  <Text style={styles.muted}>10,000 (smaller)</Text>
                  <Text style={styles.muted}>30,000 (larger)</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, savingWprime && styles.buttonDisabled]}
                disabled={savingWprime}
                onPress={saveWprime}
              >
                {savingWprime ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Set W'</Text>
                )}
              </TouchableOpacity>
            </>
          ) : null}
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: lightColors.background },
  flex: { flex: 1 },
  container: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl, gap: spacing.md },
  muted: { color: lightColors.textMuted, fontSize: fontSize.sm },
  body: { color: lightColors.text, fontSize: fontSize.md, lineHeight: 22 },
  error: { color: lightColors.fatigue, fontSize: fontSize.md, marginBottom: spacing.md },

  progressRow: { flexDirection: 'row', gap: 6, padding: spacing.lg, paddingBottom: 0 },
  progressSeg: { flex: 1, height: 5, borderRadius: 3, backgroundColor: lightColors.border },
  progressSegActive: { backgroundColor: lightColors.primary },

  title: { color: lightColors.text, fontSize: fontSize.xl, fontWeight: '800', marginBottom: spacing.sm },
  sectionHeading: { color: lightColors.text, fontSize: fontSize.lg, fontWeight: '700', marginTop: spacing.sm },

  card: {
    backgroundColor: lightColors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: lightColors.border,
    padding: spacing.lg,
  },
  cardLabel: { color: lightColors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1 },

  testCard: {
    backgroundColor: lightColors.surface,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: lightColors.border,
    padding: spacing.lg,
  },
  testCardActive: { borderColor: lightColors.primary },
  testCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  testName: { color: lightColors.text, fontSize: fontSize.lg, fontWeight: '700' },
  testMeta: { color: lightColors.textMuted, fontSize: fontSize.sm, marginTop: spacing.xs },
  stars: { color: '#F5A623', fontSize: fontSize.md },

  timelineRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  timelineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: lightColors.primary, marginTop: 3 },
  timelineLabel: { color: lightColors.text, fontSize: fontSize.md, fontWeight: '700' },
  timelineDetail: { color: lightColors.textMuted, fontSize: fontSize.sm },

  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: lightColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: lightColors.primary, borderColor: lightColors.primary },
  checkmark: { color: '#fff', fontWeight: '800' },
  checkLabel: { color: lightColors.text, fontSize: fontSize.md, flex: 1 },
  warnBanner: { backgroundColor: '#FEF3E6', borderRadius: radius.md, padding: spacing.md },
  warnText: { color: lightColors.primary, fontSize: fontSize.sm, fontWeight: '600' },

  resultCard: {
    backgroundColor: lightColors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: lightColors.border,
    padding: spacing.lg,
    alignItems: 'center',
  },
  ftpRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: spacing.sm },
  ftpValue: { color: lightColors.text, fontSize: 64, fontWeight: '800', lineHeight: 66 },
  ftpUnit: { color: lightColors.textMuted, fontSize: fontSize.lg, marginBottom: 10, marginLeft: 4 },
  changeBadge: { borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 4, marginTop: spacing.sm },
  changeText: { color: '#fff', fontSize: fontSize.sm, fontWeight: '700' },
  wkg: { color: lightColors.text, fontSize: fontSize.md, fontWeight: '600', marginTop: spacing.md },
  questionable: { color: lightColors.fatigue, fontSize: fontSize.sm, marginTop: spacing.sm, textAlign: 'center' },
  recommendation: { color: lightColors.textMuted, fontSize: fontSize.md, lineHeight: 22, marginTop: spacing.md, textAlign: 'center' },

  battery: {
    height: 28,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: lightColors.text,
    marginTop: spacing.md,
    overflow: 'hidden',
    backgroundColor: lightColors.background,
  },
  batteryFill: { height: '100%', backgroundColor: lightColors.form },
  wprimeValue: { color: lightColors.text, fontSize: fontSize.xl, fontWeight: '800', textAlign: 'center', marginTop: spacing.sm },
  scaleRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },

  primaryButton: {
    backgroundColor: lightColors.primary,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  buttonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: '#fff', fontSize: fontSize.md, fontWeight: '700' },
  linkButton: { alignItems: 'center', paddingVertical: spacing.md },
  linkText: { color: lightColors.primary, fontSize: fontSize.md, fontWeight: '600' },
});
