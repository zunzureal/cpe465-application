import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { MockDeviceProvider } from '@/hooks/useMockDevice';

import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { PhoneLoginScreen } from '@/components/screens/PhoneLoginScreen';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import '@/global.css';

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootContent() {
  const auth = useAuth();

  if (auth.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  if (!auth.isLoggedIn) {
    return (
      <PhoneLoginScreen
        onSuccess={async (phone) => {
          await auth.login(phone);
        }}
      />
    );
  }

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="doctor" options={{ title: 'ภาพรวมแพทย์', headerShown: true }} />
      <Stack.Screen name="therapy-session" options={{ title: 'เซสชันกายภาพบำบัด', headerShown: true }} />
      <Stack.Screen name="manual-setup" options={{ title: 'ตั้งค่าโหมดฝึกอิสระ', headerShown: true }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'รับโปรแกรม' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <GluestackUIProvider mode={colorScheme ?? 'light'}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AuthProvider>
          <MockDeviceProvider>
            <RootContent />
            <StatusBar style="auto" />
          </MockDeviceProvider>
        </AuthProvider>
      </ThemeProvider>
    </GluestackUIProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
});
