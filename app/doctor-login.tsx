/**
 * Doctor login route — Email + Password authentication.
 * On success, persists the doctor role with JWT token and routes to the doctor dashboard.
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
      onSuccess={async (email, password) => {
        await auth.loginDoctor(email, password);
        router.replace('/doctor');
      }}
    />
  );
}
