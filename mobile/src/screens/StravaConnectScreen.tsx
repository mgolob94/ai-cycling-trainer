import { View, Text, Button, StyleSheet, Linking } from 'react-native';
import Constants from 'expo-constants';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuthStore } from '../store/useAuthStore';
import type { AppStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'StravaConnect'>;

export default function StravaConnectScreen(_props: Props) {
  const token = useAuthStore((state) => state.token);

  // Open the backend's OAuth entry point in the system browser. The backend
  // identifies the user from the access token and redirects on to Strava.
  const handleConnect = () => {
    const apiBase =
      (Constants.expoConfig?.extra?.apiBaseUrl as string) ?? 'http://localhost:3000/api';
    const origin = apiBase.replace(/\/api$/, '');
    Linking.openURL(`${origin}/auth/strava?token=${token ?? ''}`);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Connect Strava</Text>
      <Text style={styles.body}>
        Link your Strava account so we can analyze your rides and build your training plan.
      </Text>
      <Button title="Connect with Strava" onPress={handleConnect} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 16 },
  heading: { fontSize: 24, fontWeight: '700' },
  body: { fontSize: 16, color: '#555' },
});
