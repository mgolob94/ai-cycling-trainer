import { View, StyleSheet } from 'react-native';

import Text from './Text';
import { palette, spacing } from '../../theme/tokens';
import { useThemeColors } from '../../theme/useThemeColors';

interface Props {
  /** Optional centered label, e.g. "ALI". */
  label?: string;
}

/** 1px hairline. With a label, renders a line–label–line row. */
export default function Divider({ label }: Props) {
  const { colors } = useThemeColors();
  const line = { backgroundColor: colors.borderSubtle ?? palette.slate100 };

  if (!label) return <View style={[styles.line, line]} />;

  return (
    <View style={styles.row}>
      <View style={[styles.line, styles.flex, line]} />
      <Text variant="label" color={palette.slate400} style={styles.label}>
        {label}
      </Text>
      <View style={[styles.line, styles.flex, line]} />
    </View>
  );
}

const styles = StyleSheet.create({
  line: { height: StyleSheet.hairlineWidth < 1 ? 1 : StyleSheet.hairlineWidth },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  label: { letterSpacing: 0.6 },
});
