/**
 * Doctor login route — Username + Password mock entry.
 * On success, persists the doctor role and routes to the doctor dashboard.
 */

import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { DoctorLoginScreen } from '@/components/screens/DoctorLoginScreen';
import { useAuth } from '@/contexts/AuthContext';

export default function DoctorLoginRoute() {
  const router = useRouter();
  const auth = useAuth();

  useEffect(() => {
    if (auth.isLoggedIn && auth.role === 'doctor') {
      router.replace('/doctor');
    }
  }, [auth.isLoggedIn, auth.role, router]);

  if (auth.isLoggedIn && auth.role === 'doctor') {
    return null;
  }

  return (
    <DoctorLoginScreen
      onBack={() => router.back()}
      onSuccess={async (username) => {
        await auth.loginDoctor(username);
        router.replace('/doctor');
      }}
    />
  );
}
