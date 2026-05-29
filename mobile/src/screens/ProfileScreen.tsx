import { View, Text, Button, StyleSheet } from 'react-native';

import { useAuthStore } from '../store/useAuthStore';

export default function ProfileScreen() {
  const clearSession = useAuthStore((state) => state.clearSession);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Profile</Text>
      <Text style={styles.body}>
        Age, weight, fitness level, goal, and your Strava connection live here.
      </Text>
      {/* Clearing the token flips navigation back to the auth stack. */}
      <Button title="Sign out" onPress={clearSession} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 16 },
  heading: { fontSize: 24, fontWeight: '700' },
  body: { fontSize: 16, color: '#555' },
});
