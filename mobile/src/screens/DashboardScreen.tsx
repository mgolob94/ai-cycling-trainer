import { View, Text, Button, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

export default function DashboardScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Dashboard</Text>
      <Text style={styles.body}>Your recent rides and weekly summary will appear here.</Text>
      <View style={styles.actions}>
        <Button title="View training plan" onPress={() => navigation.navigate('Plan')} />
        <Button title="Profile" onPress={() => navigation.navigate('Profile')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  heading: { fontSize: 24, fontWeight: '700', marginBottom: 12 },
  body: { fontSize: 16, color: '#555', marginBottom: 24 },
  actions: { gap: 12 },
});
