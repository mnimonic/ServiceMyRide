import React from 'react';
import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { COLORS as C } from '../../src/constants';

function icon(emoji) {
  return ({ focused }) => (
    <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: C.bg },
        headerTintColor: C.text,
        tabBarStyle: { backgroundColor: C.card, borderTopColor: C.border, height: 62, paddingBottom: 8, paddingTop: 6 },
        tabBarActiveTintColor: C.accent,
        tabBarInactiveTintColor: C.textDim,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Garage', tabBarIcon: icon('🏠') }} />
      <Tabs.Screen name="reminders" options={{ title: 'Reminders', tabBarIcon: icon('⏰') }} />
      <Tabs.Screen name="inventory" options={{ title: 'Inventory', tabBarIcon: icon('📦') }} />
      <Tabs.Screen name="documents" options={{ title: 'Documents', tabBarIcon: icon('📋') }} />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: icon('☁️') }} />
    </Tabs>
  );
}
