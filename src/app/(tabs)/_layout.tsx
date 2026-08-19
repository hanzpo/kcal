import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { View } from 'react-native';

import { useSettings } from '@/hooks/queries';
import { usePalette } from '@/lib/theme';

const Trigger = NativeTabs.Trigger;

export default function TabsLayout() {
  const p = usePalette();
  const { data: settings, isLoading } = useSettings();
  if (isLoading) return <View className="flex-1 bg-page dark:bg-page-dark" />;
  if (settings && !settings.onboardingComplete) return <Redirect href="/onboarding" />;

  return (
    <NativeTabs tintColor={p.ink}>
      <Trigger name="index">
        <Trigger.Icon sf={{ default: 'circle.grid.2x2', selected: 'circle.grid.2x2.fill' }} />
        <Trigger.Label>Today</Trigger.Label>
      </Trigger>
      <Trigger name="log">
        <Trigger.Icon sf={{ default: 'book.pages', selected: 'book.pages.fill' }} />
        <Trigger.Label>Log</Trigger.Label>
      </Trigger>
      <Trigger name="trends">
        <Trigger.Icon sf="chart.xyaxis.line" />
        <Trigger.Label>Trends</Trigger.Label>
      </Trigger>
      <Trigger name="coach">
        <Trigger.Icon sf="scope" />
        <Trigger.Label>Coach</Trigger.Label>
      </Trigger>
    </NativeTabs>
  );
}
