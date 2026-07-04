import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from '../src/context/AppContext';
import { AuthProvider } from '../src/context/AuthContext';
import { triggerRefresh } from '../src/context/refreshBridge';
import { COLORS as C } from '../src/constants';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <AuthProvider onDataChanged={triggerRefresh}>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: C.bg },
              headerTintColor: C.text,
              contentStyle: { backgroundColor: C.bg },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="vehicle/[id]" options={{ title: 'Vehicle' }} />
          </Stack>
        </AuthProvider>
      </AppProvider>
    </SafeAreaProvider>
  );
}
