/**
 * Patient login route — phone-number entry.
 * On success, persists the patient role and routes to the tabs.
 */

import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { PhoneLoginScreen } from '@/components/screens/PhoneLoginScreen';
import { useAuth } from '@/contexts/AuthContext';

export default function PatientLoginScreen() {
  const router = useRouter();
  const auth = useAuth();

  useEffect(() => {
    if (auth.isLoggedIn && auth.role === 'patient') {
      router.replace('/(tabs)');
    }
  }, [auth.isLoggedIn, auth.role, router]);

  if (auth.isLoggedIn && auth.role === 'patient') {
    return null;
  }

  return (
    <PhoneLoginScreen
      onSuccess={async (phone) => {
        await auth.loginPatient(phone);
        router.replace('/(tabs)');
      }}
    />
  );
}
