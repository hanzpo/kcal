import { Redirect, Tabs, useRouter } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Press } from '@/components/ui';
import { useSettings } from '@/hooks/queries';
import { usePalette } from '@/lib/theme';

const TAB_ICONS: Record<string, { icon: SFSymbol; label: string }> = {
  index: { icon: 'circle.grid.2x2.fill', label: 'Today' },
  log: { icon: 'book.pages', label: 'Log' },
  trends: { icon: 'chart.xyaxis.line', label: 'Trends' },
  coach: { icon: 'scope', label: 'Coach' },
};

interface TabBarProps {
  state: { index: number; routes: { name: string }[] };
  navigation: { navigate: (name: string) => void };
}

function TabBar({ state, navigation }: TabBarProps) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const renderTab = (routeName: string, index: number) => {
    const meta = TAB_ICONS[routeName];
    if (!meta) return null;
    const focused = state.index === index;
    return (
      <Press
        key={routeName}
        onPress={() => navigation.navigate(routeName)}
        className="flex-1 items-center justify-center gap-1 py-2">
        <SymbolView
          name={meta.icon}
          size={22}
          tintColor={focused ? p.ink : p.inkFaint}
          weight={focused ? 'semibold' : 'regular'}
        />
        <Text
          className="text-[10px] font-semibold"
          style={{ color: focused ? p.ink : p.inkFaint }}>
          {meta.label}
        </Text>
      </Press>
    );
  };

  return (
    <View
      className="border-t border-line bg-card dark:border-line-dark dark:bg-card-dark"
      style={{ paddingBottom: Math.max(insets.bottom, 8) }}>
      <View className="flex-row items-center px-2 pt-1.5">
        {renderTab('index', 0)}
        {renderTab('log', 1)}
        <View className="w-[72px] items-center">
          <Press
            onPress={() => router.push('/add')}
            className="-mt-7 h-[58px] w-[58px] items-center justify-center rounded-full bg-ink shadow-lg dark:bg-ink-inv"
            style={{ shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}>
            <SymbolView name="plus" size={24} tintColor={p.isDark ? '#141412' : '#F6F6F3'} weight="semibold" />
          </Press>
        </View>
        {renderTab('trends', 2)}
        {renderTab('coach', 3)}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { data: settings, isLoading } = useSettings();
  if (isLoading) return <View className="flex-1 bg-page dark:bg-page-dark" />;
  if (settings && !settings.onboardingComplete) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="log" />
      <Tabs.Screen name="trends" />
      <Tabs.Screen name="coach" />
    </Tabs>
  );
}
