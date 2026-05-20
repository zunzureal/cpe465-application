import { CommonActions } from '@react-navigation/native';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useNavigation } from 'expo-router';
import { ActivityIndicator, StyleSheet, View, Alert, Pressable } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { MockDeviceProvider } from '@/hooks/useMockDevice';

import { CustomHeader } from '@/components/CustomHeader';
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { DSColors } from '@/constants/design-system';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { DevicePairedProvider } from '@/contexts/DevicePairedContext';
import '@/global.css';

function LogoutButton() {
  const auth = useAuth();
  const navigation = useNavigation();

  const handleLogout = () => {
    Alert.alert(
      'ยืนยันการออกจากระบบ',
      'คุณต้องการออกจากระบบและกลับไปที่หน้าเลือกบทบาทหรือไม่?',
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ออกจากระบบ',
          style: 'destructive',
          onPress: async () => {
            try {
              await auth.logout();
              // Reset the root Stack to only [index] — no back button possible.
              // CommonActions.reset bypasses URL/Tabs resolution entirely.
              navigation.dispatch(
                CommonActions.reset({ index: 0, routes: [{ name: 'index' }] })
              );
            } catch (err) {
              console.error('[LogoutButton] Logout error:', err);
              Alert.alert('ออกจากระบบไม่สำเร็จ', 'กรุณาลองอีกครั้ง');
            }
          },
        },
      ]
    );
  };

  return (
    <Pressable
      hitSlop={10}
      onPress={handleLogout}
      accessibilityRole="button"
      accessibilityLabel="ออกจากระบบ"
      style={({ pressed }) => [
        {
          width: 40,
          height: 40,
          borderRadius: 8,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: DSColors.primaryLight,
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      <Ionicons name="log-out" size={22} color={DSColors.primary} />
    </Pressable>
  );
}

function RootContent() {
  const auth = useAuth();

  if (auth.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={DSColors.primary} />
      </View>
    );
  }

  // Unauthenticated: minimal Stack — React Navigation discards any screens not
  // listed here (e.g. (tabs)) and falls back to `index` (RoleSelectionScreen).
  if (!auth.isLoggedIn) {
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
      </Stack>
    );
  }

  // Authenticated: full Stack with LogoutButton in header.
  return (
    <Stack
      screenOptions={{
        header: () => <CustomHeader rightSlot={<LogoutButton />} />,
        headerShown: true,
        contentStyle: { backgroundColor: DSColors.background },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="doctor" />
      <Stack.Screen
        name="therapy-session"
        options={{ header: () => <CustomHeader showBack /> }}
      />
      <Stack.Screen
        name="manual-setup"
        options={{ header: () => <CustomHeader showBack /> }}
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
          <DevicePairedProvider>
            <MockDeviceProvider>
              <RootContent />
              <StatusBar style="dark" />
            </MockDeviceProvider>
          </DevicePairedProvider>
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
