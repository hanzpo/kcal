import { useRouter } from 'expo-router';
import { useAtom } from 'jotai';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';

import { MacroBar, ProgressRing, Sparkline } from '@/components/rings';
import { Card, Icon, Press, SectionLabel } from '@/components/ui';
import { useCoaching, useDayLog, useSettings, useTargetForDate } from '@/hooks/queries';
import { MEAL_LABELS, todayStr } from '@/lib/dates';
import { formatInt, formatWeight } from '@/lib/format';
import { remainingModeAtom } from '@/lib/prefs';
import { usePalette } from '@/lib/theme';

export default function Today() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const p = usePalette();
  const today = todayStr();

  const { data: settings } = useSettings();
  const { data: day } = useDayLog(today);
  const { data: target } = useTargetForDate(today);
  const { data: coach } = useCoaching();
  const [remainingMode, setRemainingMode] = useAtom(remainingModeAtom);

  const kcalTarget = target?.kcal ?? 0;
  const consumed = day?.totals.kcal ?? 0;
  const remaining = kcalTarget - consumed;
  const heroValue = remainingMode ? Math.round(Math.abs(remaining)) : Math.round(consumed);
  const heroCaption = remainingMode ? (remaining >= 0 ? 'kcal left' : 'kcal over') : 'kcal eaten';
  const unit = settings?.weightUnit ?? 'lb';

  const trendSeries = (coach?.trend ?? []).slice(-14).map((t) => t.trendKg);
  const checkInDue = coach?.proposal != null;

  const entryCount = day?.entries.length ?? 0;
  const lastEntries = (day?.entries ?? []).slice(-3).reverse();

  return (
    <ScrollView
      className="flex-1 bg-page dark:bg-page-dark"
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 110, paddingHorizontal: 16 }}
      showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View className="mb-4 flex-row items-end justify-between px-1">
        <View>
          <SectionLabel>{format(new Date(), 'EEEE, MMM d')}</SectionLabel>
          <Text className="mt-0.5 text-[28px] font-bold tracking-tight text-ink dark:text-ink-inv">
            Today
          </Text>
        </View>
        <Press onPress={() => router.push('/settings')} className="mb-1 h-10 w-10 items-center justify-center rounded-full bg-card dark:bg-card-dark">
          <Icon name="gearshape" size={18} tint={p.inkSec} />
        </Press>
      </View>

      {/* Check-in banner */}
      {checkInDue ? (
        <Press onPress={() => router.push('/checkin')}>
          <Card className="mb-3 flex-row items-center gap-3 border-energy/40 bg-energy/10 px-4 py-3.5 dark:bg-energy-dark/10">
            <Icon name="sparkles" size={18} tint={p.energy} />
            <View className="flex-1">
              <Text className="text-[14px] font-semibold text-ink dark:text-ink-inv">
                Weekly check-in ready
              </Text>
              <Text className="text-[12px] text-ink-sec dark:text-ink-dsec">
                New targets based on your data
              </Text>
            </View>
            <Icon name="chevron.right" size={13} tint={p.inkMut} />
          </Card>
        </Press>
      ) : null}

      {/* Hero: energy ring + macros */}
      <Card className="p-5">
        <View className="flex-row items-center gap-6">
          <Press onPress={() => setRemainingMode(!remainingMode)} haptic>
            <ProgressRing
              size={148}
              stroke={11}
              progress={kcalTarget > 0 ? consumed / kcalTarget : 0}
              color={remaining < 0 ? p.ink : p.energy}>
              <Text className="font-monosemi text-[32px] leading-9 text-ink dark:text-ink-inv">
                {formatInt(heroValue)}
              </Text>
              <Text className="text-[11px] font-semibold uppercase tracking-[1px] text-ink-mut">
                {heroCaption}
              </Text>
            </ProgressRing>
          </Press>
          <View className="flex-1 gap-3.5">
            <MacroBar
              label="Protein"
              color={p.protein}
              consumed={day?.totals.proteinG ?? 0}
              target={target?.proteinG ?? 0}
              remainingMode={remainingMode}
            />
            <MacroBar
              label="Carbs"
              color={p.carbs}
              consumed={day?.totals.carbsG ?? 0}
              target={target?.carbsG ?? 0}
              remainingMode={remainingMode}
            />
            <MacroBar
              label="Fat"
              color={p.fat}
              consumed={day?.totals.fatG ?? 0}
              target={target?.fatG ?? 0}
              remainingMode={remainingMode}
            />
          </View>
        </View>
        <View className="mt-4 flex-row items-center justify-between border-t border-line pt-3 dark:border-line-dark">
          <Text className="text-[12px] text-ink-mut">
            {formatInt(consumed)} eaten · target {formatInt(kcalTarget)}
          </Text>
          <Text className="text-[12px] font-medium text-ink-mut">tap ring to flip</Text>
        </View>
      </Card>

      {/* Weight + Expenditure row */}
      <View className="mt-3 flex-row gap-3">
        <Press onPress={() => router.push('/weight')} className="flex-1">
          <Card className="h-[128px] justify-between p-4">
            <View className="flex-row items-center justify-between">
              <SectionLabel>Weight</SectionLabel>
              <Icon name="plus.circle.fill" size={20} tint={p.inkFaint} />
            </View>
            {coach?.trendKg != null ? (
              <>
                <View className="flex-row items-baseline gap-1">
                  <Text className="font-monosemi text-[24px] text-ink dark:text-ink-inv">
                    {formatWeight(coach.trendKg, unit, 1).split(' ')[0]}
                  </Text>
                  <Text className="text-[12px] font-medium text-ink-mut">{unit} trend</Text>
                </View>
                <Sparkline values={trendSeries} width={120} height={26} color={p.inkFaint} />
              </>
            ) : (
              <Text className="text-[13px] leading-[18px] text-ink-mut">
                Tap to log your first weigh-in
              </Text>
            )}
          </Card>
        </Press>
        <Card className="h-[128px] flex-1 justify-between p-4">
          <SectionLabel>Expenditure</SectionLabel>
          {coach?.expenditure ? (
            <>
              <View className="flex-row items-baseline gap-1">
                <Text className="font-monosemi text-[24px] text-ink dark:text-ink-inv">
                  {formatInt(coach.expenditure.current)}
                </Text>
                <Text className="text-[12px] font-medium text-ink-mut">kcal/d</Text>
              </View>
              <Text className="text-[12px] leading-4 text-ink-mut">
                {coach.expenditure.calibrating
                  ? `calibrating · day ${coach.expenditure.dataDays} of 14`
                  : 'learned from your data'}
              </Text>
            </>
          ) : (
            <Text className="text-[13px] text-ink-mut">Awaiting data</Text>
          )}
        </Card>
      </View>

      {/* Today's log preview */}
      <View className="mt-5 px-1">
        <View className="flex-row items-center justify-between">
          <SectionLabel>Logged today</SectionLabel>
          <Press onPress={() => router.push('/log')}>
            <Text className="text-[13px] font-semibold text-ink-sec dark:text-ink-dsec">
              Open log →
            </Text>
          </Press>
        </View>
      </View>
      <Card className="mt-2 overflow-hidden">
        {entryCount === 0 ? (
          <Press onPress={() => router.push('/add')} className="items-center gap-2 px-6 py-8">
            <Icon name="fork.knife" size={22} tint={p.inkFaint} />
            <Text className="text-center text-[14px] leading-5 text-ink-mut">
              Nothing yet. Tap + to log your first meal.
            </Text>
          </Press>
        ) : (
          lastEntries.map((e, i) => (
            <Press key={e.id} onPress={() => router.push(`/entry/${e.id}`)}>
              <View
                className={`flex-row items-center justify-between px-4 py-3 ${
                  i > 0 ? 'border-t border-line dark:border-line-dark' : ''
                }`}>
                <View className="flex-1 pr-3">
                  <Text numberOfLines={1} className="text-[15px] font-medium text-ink dark:text-ink-inv">
                    {e.name}
                  </Text>
                  <Text className="mt-0.5 text-[12px] text-ink-mut">{MEAL_LABELS[e.meal]}</Text>
                </View>
                <Text className="font-mono text-[14px] text-ink-sec dark:text-ink-dsec">
                  {formatInt(e.kcal)}
                </Text>
              </View>
            </Press>
          ))
        )}
      </Card>
    </ScrollView>
  );
}
