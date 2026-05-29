import { View, Text, StyleSheet } from 'react-native';

export default function PlanScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>This Week's Plan</Text>
      <Text style={styles.body}>
        Your AI-generated workouts for the week will be listed here.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  heading: { fontSize: 24, fontWeight: '700', marginBottom: 12 },
  body: { fontSize: 16, color: '#555' },
});
