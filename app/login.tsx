/**
 * Login route. When already logged in, redirects to home.
 * When not logged in, the root layout shows PhoneLoginScreen directly (this route is not used).
 */

import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { PhoneLoginScreen } from '@/components/screens/PhoneLoginScreen';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginScreen() {
  const router = useRouter();
  const auth = useAuth();

  useEffect(() => {
    if (auth.isLoggedIn) {
      router.replace('/(tabs)');
    }
  }, [auth.isLoggedIn, router]);

  if (auth.isLoggedIn) {
    return null;
  }

  return (
    <PhoneLoginScreen
      onSuccess={async (phone) => {
        await auth.login(phone);
        router.replace('/(tabs)');
      }}
    />
  );
}
