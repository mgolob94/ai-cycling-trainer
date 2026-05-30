import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { supabase } from '../../services/supabase';
import { useKnowledgeLevel } from '../../context/KnowledgeLevelContext';
import type { KnowledgeLevel } from '../../services/userLevel';
import type { AuthStackParamList } from '../../navigation/types';
import { colors, spacing, radius, fontSize } from '../../theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'ProfileSetup'>;

type FitnessLevel = 'beginner' | 'intermediate' | 'advanced';
type Goal = 'endurance' | 'speed' | 'weight loss';

const FITNESS_LEVELS: FitnessLevel[] = ['beginner', 'intermediate', 'advanced'];
const GOALS: Goal[] = ['endurance', 'speed', 'weight loss'];

// Knowledge-level self-report → tailors how much data the UI shows. The preview
// mirrors how the Dashboard form line will read at each level.
const LEVEL_OPTIONS: {
  level: KnowledgeLevel;
  emoji: string;
  title: string;
  desc: string;
  preview: string;
}[] = [
  {
    level: 'beginner',
    emoji: '🚴',
    title: "I'm a beginner",
    desc: 'Show me only the essentials — no jargon',
    preview: 'Optimal form — today you can handle an intense workout',
  },
  {
    level: 'intermediate',
    emoji: '🚴‍♂️',
    title: 'I ride for fun',
    desc: 'I understand the basics and want to learn more',
    preview: 'Optimal form     TSB: +12  ⓘ',
  },
  {
    level: 'advanced',
    emoji: '⚡',
    title: 'I know FTP, TSS, CTL…',
    desc: 'Show me everything — I like working with numbers',
    preview: 'CTL: 74   ATL: 62   TSB: +12  — Optimal form',
  },
];

/** A row of selectable pill options (single-select). */
function OptionGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.optionRow}>
      {options.map((option) => {
        const selected = option === value;
        return (
          <TouchableOpacity
            key={option}
            activeOpacity={0.8}
            style={[styles.chip, selected && styles.chipSelected]}
            onPress={() => onChange(option)}
          >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
              {option}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function ProfileSetupScreen({ navigation }: Props) {
  const { setLevel } = useKnowledgeLevel();
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [fitnessLevel, setFitnessLevel] = useState<FitnessLevel | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  // Safe default: beginner (least jargon). Saved to storage immediately on tap.
  const [knowledgeLevel, setKnowledgeLevel] = useState<KnowledgeLevel>('beginner');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = !!fitnessLevel && !!goal && !loading;

  // Persist immediately (AsyncStorage now; Supabase once the session is stored).
  const selectKnowledgeLevel = (lvl: KnowledgeLevel) => {
    setKnowledgeLevel(lvl);
    setLevel(lvl);
  };

  const handleFinish = async () => {
    setError(null);
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setError('Your session expired. Please sign up again.');
        return;
      }

      // The signup trigger already created the row; fill in the profile fields.
      const { error: upsertError } = await supabase.from('users').upsert({
        id: session.user.id,
        email: session.user.email,
        age: age ? parseInt(age, 10) : null,
        weight_kg: weight ? parseFloat(weight) : null,
        fitness_level: fitnessLevel,
        goal,
        knowledge_level: knowledgeLevel,
      });

      if (upsertError) {
        setError(upsertError.message);
        return;
      }

      // Profile saved — continue to the final onboarding step (connect Strava).
      // The session is stored there, which is what flips us to the app stack.
      navigation.navigate('StravaSetup');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Tell us about you</Text>
        <Text style={styles.subtitle}>
          We use this to calibrate your training load and intensity.
        </Text>

        <Text style={styles.label}>Age</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 34"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          value={age}
          onChangeText={setAge}
        />

        <Text style={styles.label}>Weight (kg)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 72"
          placeholderTextColor={colors.textMuted}
          keyboardType="decimal-pad"
          value={weight}
          onChangeText={setWeight}
        />

        <Text style={styles.label}>Fitness level</Text>
        <OptionGroup options={FITNESS_LEVELS} value={fitnessLevel} onChange={setFitnessLevel} />

        <Text style={styles.label}>Goal</Text>
        <OptionGroup options={GOALS} value={goal} onChange={setGoal} />

        {/* Knowledge level */}
        <Text style={styles.sectionTitle}>How well do you know cycling terminology?</Text>
        <Text style={styles.sectionSubtitle}>
          We'll tailor how data is shown to your experience — you can change this anytime.
        </Text>
        {LEVEL_OPTIONS.map((opt) => {
          const selected = knowledgeLevel === opt.level;
          return (
            <TouchableOpacity
              key={opt.level}
              activeOpacity={0.85}
              style={[styles.levelCard, selected && styles.levelCardSelected]}
              onPress={() => selectKnowledgeLevel(opt.level)}
            >
              <Text style={styles.levelEmoji}>{opt.emoji}</Text>
              <View style={styles.levelTextCol}>
                <Text style={styles.levelTitle}>{opt.title}</Text>
                <Text style={styles.levelDesc}>{opt.desc}</Text>
              </View>
              {selected ? <Text style={styles.levelCheck}>✓</Text> : null}
            </TouchableOpacity>
          );
        })}

        {/* Dashboard preview for the selected level */}
        <View style={styles.previewBox}>
          <Text style={styles.previewLabel}>DASHBOARD PREVIEW</Text>
          <Text style={styles.previewText}>
            {LEVEL_OPTIONS.find((o) => o.level === knowledgeLevel)?.preview}
          </Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.primaryButton, !canSubmit && styles.buttonDisabled]}
          activeOpacity={0.85}
          disabled={!canSubmit}
          onPress={handleFinish}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Continue</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, paddingBottom: spacing.xl },
  title: { color: colors.text, fontSize: fontSize.xl, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: fontSize.md, marginTop: spacing.xs },
  label: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    color: colors.text,
    fontSize: fontSize.md,
  },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontSize: fontSize.md, fontWeight: '600', textTransform: 'capitalize' },
  chipTextSelected: { color: '#fff' },

  sectionTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: '800', marginTop: spacing.xl },
  sectionSubtitle: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.xs, lineHeight: 20, marginBottom: spacing.sm },
  levelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  levelCardSelected: { borderColor: colors.primary, backgroundColor: colors.surfaceAlt },
  levelEmoji: { fontSize: 28 },
  levelTextCol: { flex: 1 },
  levelTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: '700' },
  levelDesc: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 2, lineHeight: 18 },
  levelCheck: { color: colors.primary, fontSize: fontSize.lg, fontWeight: '900' },

  previewBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  previewLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  previewText: { color: colors.text, fontSize: fontSize.md, lineHeight: 22 },

  error: { color: colors.danger, fontSize: fontSize.sm, marginTop: spacing.lg },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  buttonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: '#fff', fontSize: fontSize.md, fontWeight: '700' },
});
