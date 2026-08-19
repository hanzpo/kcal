import '../global.css';

import {
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
  useFonts,
} from '@expo-google-fonts/ibm-plex-mono';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { Stack } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Appearance, AppState, LogBox, Text, View } from 'react-native';

import { readHealthSyncPref, readThemePref } from '@/lib/prefs';
import { importWeightsFromHealth } from '@/services/health';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { db } from '@/db/client';
import migrations from '@/db/migrations/migrations';
import { seedFoodsIfNeeded } from '@/db/seed';
import { setFdcApiKey } from '@/services/foodApi';

SplashScreen.preventAutoHideAsync();
// warnings stay visible in the Metro terminal; in-app toasts just get in the way
LogBox.ignoreAllLogs();

// apply any saved appearance override before first render
const savedTheme = readThemePref();
Appearance.setColorScheme(savedTheme === 'system' ? 'unspecified' : savedTheme);

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5_000, retry: 1 } },
});

let lastHealthSync = 0;
async function syncHealthSilently() {
  if (!readHealthSyncPref()) return;
  if (Date.now() - lastHealthSync < 5 * 60_000) return;
  lastHealthSync = Date.now();
  try {
    const changed = await importWeightsFromHealth(90);
    if (changed > 0) {
      queryClient.invalidateQueries({ queryKey: ['weights'] });
      queryClient.invalidateQueries({ queryKey: ['coaching'] });
    }
  } catch {
    // best-effort background sync
  }
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ IBMPlexMono_500Medium, IBMPlexMono_600SemiBold });
  const { success: migrated, error: migrationError } = useMigrations(db, migrations);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (!migrated) return;
    (async () => {
      try {
        setFdcApiKey(await SecureStore.getItemAsync('fdc_api_key'));
        await seedFoodsIfNeeded();
      } finally {
        setSeeded(true);
      }
      syncHealthSilently();
    })();

    // re-sync when the app returns to foreground (morning scale → open app)
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncHealthSilently();
    });
    return () => sub.remove();
  }, [migrated]);

  const ready = fontsLoaded && migrated && seeded;

  useEffect(() => {
    if (ready || migrationError) SplashScreen.hideAsync();
  }, [ready, migrationError]);

  if (migrationError) {
    return (
      <View className="flex-1 items-center justify-center bg-page p-8 dark:bg-page-dark">
        <Text className="text-center text-ink dark:text-ink-inv">
          Database error: {migrationError.message}
        </Text>
      </View>
    );
  }
  if (!ready) return <View className="flex-1 bg-page dark:bg-page-dark" />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="auto" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: 'transparent' },
          }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
          <Stack.Screen name="add" options={{ presentation: 'modal' }} />
          <Stack.Screen name="ai" options={{ presentation: 'modal' }} />
          <Stack.Screen name="barcode" options={{ presentation: 'modal' }} />
          <Stack.Screen name="quick" options={{ presentation: 'modal' }} />
          <Stack.Screen name="weight" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.55] }} />
          <Stack.Screen name="food/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="entry/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
          <Stack.Screen name="checkin" options={{ presentation: 'modal' }} />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
