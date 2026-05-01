import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { MockDeviceProvider } from '@/hooks/useMockDevice';

import { CustomHeader } from '@/components/CustomHeader';
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { DSColors } from '@/constants/design-system';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import '@/global.css';

function RootContent() {
  const auth = useAuth();

  if (auth.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={DSColors.primary} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        header: () => <CustomHeader />,
        headerShown: true,
        contentStyle: { backgroundColor: DSColors.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen
        name="patient-login"
        options={{ header: () => <CustomHeader showBack /> }}
      />
      <Stack.Screen
        name="doctor-login"
        options={{ header: () => <CustomHeader showBack /> }}
      />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="doctor" />
      <Stack.Screen
        name="therapy-session"
        options={{ header: () => <CustomHeader title="เซสชันกายภาพบำบัด" showBack /> }}
      />
      <Stack.Screen
        name="manual-setup"
        options={{ header: () => <CustomHeader title="ตั้งค่าโหมดฝึกอิสระ" showBack /> }}
      />
      <Stack.Screen
        name="modal"
        options={{ presentation: 'modal', headerShown: false }}
      />
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
            <StatusBar style="dark" />
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
    backgroundColor: DSColors.background,
  },
});
