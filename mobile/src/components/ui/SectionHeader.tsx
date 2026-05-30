import { View, Pressable, StyleSheet } from 'react-native';

import Text from './Text';
import { palette, spacing } from '../../theme/tokens';

interface Props {
  title: string;
  /** Optional trailing action, e.g. { label: 'Vse →', onPress }. */
  action?: { label: string; onPress: () => void };
}

/** Row with an uppercase section title (slate-400) and an optional indigo action. */
export default function SectionHeader({ title, action }: Props) {
  return (
    <View style={styles.row}>
      <Text variant="label" color={palette.slate400} style={styles.title}>
        {title}
      </Text>
      {action ? (
        <Pressable onPress={action.onPress} hitSlop={8}>
          <Text variant="caption" color={palette.indigo600} style={styles.action}>
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[3],
  },
  title: { letterSpacing: 0.6 },
  action: { fontWeight: '600' },
});
