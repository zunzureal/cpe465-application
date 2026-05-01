/**
 * Smart Rehab entry route — auth gate.
 *
 * - While restoring auth from storage: render a centred spinner.
 * - Patient already signed in -> redirect to the patient tabs.
 * - Doctor already signed in -> redirect to the doctor dashboard.
 * - Otherwise -> show the role selection screen.
 */

import { Redirect, useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { RoleSelectionScreen } from '@/components/screens/RoleSelectionScreen';
import { DSColors } from '@/constants/design-system';
import { useAuth } from '@/contexts/AuthContext';

export default function IndexScreen() {
  const router = useRouter();
  const auth = useAuth();

  if (auth.isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={DSColors.primary} />
      </View>
    );
  }

  if (auth.isLoggedIn && auth.role === 'patient') {
    return <Redirect href="/(tabs)" />;
  }
  if (auth.isLoggedIn && auth.role === 'doctor') {
    return <Redirect href="/doctor" />;
  }

  return (
    <RoleSelectionScreen
      onSelect={(role) => {
        router.push(role === 'patient' ? '/patient-login' : '/doctor-login');
      }}
    />
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DSColors.background,
  },
});
