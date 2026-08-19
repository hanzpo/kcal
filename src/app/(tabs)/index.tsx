import { useRouter } from 'expo-router';
import { useAtom } from 'jotai';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';

import { Sparkline } from '@/components/rings';
import { AddButton, Divider, Icon, Press, SectionLabel } from '@/components/ui';
import { useCoaching, useDayLog, useSettings, useTargetForDate } from '@/hooks/queries';
import { MEAL_LABELS, todayStr } from '@/lib/dates';
import { clamp, formatInt, formatWeight } from '@/lib/format';
import { remainingModeAtom } from '@/lib/prefs';
import { usePalette } from '@/lib/theme';

function MacroRow({
  label,
  color,
  consumed,
  target,
}: {
  label: string;
  color: string;
  consumed: number;
  target: number;
}) {
  const pct = target > 0 ? clamp(consumed / target, 0, 1) : 0;
  return (
    <View className="flex-row items-center gap-2.5 py-2.5">
      <View className="h-[10px] w-[10px]" style={{ backgroundColor: color }} />
      <Text className="w-[60px] text-[13.5px] font-semibold text-ink dark:text-ink-inv">{label}</Text>
      <View className="h-[3px] flex-1 bg-raise dark:bg-raise-dark">
        <View className="h-full" style={{ width: `${pct * 100}%`, backgroundColor: color }} />
      </View>
      <Text className="w-[92px] text-right font-mono text-[13.5px] text-ink dark:text-ink-inv">
        {formatInt(consumed)} / {formatInt(target)} g
      </Text>
    </View>
  );
}

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
  const kcalPct = kcalTarget > 0 ? clamp(consumed / kcalTarget, 0, 1) : 0;

  const trendSeries = (coach?.trend ?? []).slice(-14).map((t) => t.trendKg);
  const checkInDue = coach?.proposal != null;

  const entryCount = day?.entries.length ?? 0;
  const lastEntries = (day?.entries ?? []).slice(-3).reverse();

  return (
    <View className="flex-1 bg-page dark:bg-page-dark">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 130, paddingHorizontal: 22 }}
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="mb-4 flex-row items-end justify-between">
          <View>
            <Text className="text-[12px] font-semibold uppercase tracking-[1.5px] text-ink-mut">
              {format(new Date(), 'EEE MMM d')}
            </Text>
            <Text className="mt-0.5 text-[30px] font-bold tracking-tight text-ink dark:text-ink-inv">
              Today
            </Text>
          </View>
          <Press
            onPress={() => router.push('/settings')}
            className="mb-2 h-10 w-10 items-end justify-center">
            <Icon name="gearshape" size={19} tint={p.inkSec} />
          </Press>
        </View>

        <View className="h-[1.5px] bg-ink dark:bg-ink-inv" />

        {/* Check-in banner */}
        {checkInDue ? (
          <Press onPress={() => router.push('/checkin')}>
            <View className="mt-4 flex-row items-center gap-3 border border-ink px-4 py-3 dark:border-ink-inv">
              <Icon name="sparkles" size={16} tint={p.energy} />
              <Text className="flex-1 text-[14px] font-semibold text-ink dark:text-ink-inv">
                Weekly check-in ready
              </Text>
              <Icon name="chevron.right" size={12} tint={p.inkMut} />
            </View>
          </Press>
        ) : null}

        {/* Hero */}
        <Press onPress={() => setRemainingMode(!remainingMode)} haptic>
          <View className="pt-6">
            <View className="flex-row items-baseline gap-2.5">
              <Text className="font-monosemi text-[58px] leading-[60px] tracking-[-2px] text-ink dark:text-ink-inv">
                {formatInt(heroValue)}
              </Text>
              <Text className="text-[15px] font-medium text-ink-mut">{heroCaption}</Text>
            </View>
            <Text className="mt-1 text-[13px] font-medium text-ink-mut">
              {formatInt(consumed)} eaten of {formatInt(kcalTarget)}
            </Text>
            <View className="mt-5 h-[3px] bg-raise dark:bg-raise-dark">
              <View
                className="h-full bg-ink dark:bg-ink-inv"
                style={{ width: `${kcalPct * 100}%` }}
              />
            </View>
          </View>
        </Press>

        {/* Macros */}
        <View className="mt-4">
          <MacroRow label="Protein" color={p.protein} consumed={day?.totals.proteinG ?? 0} target={target?.proteinG ?? 0} />
          <MacroRow label="Carbs" color={p.carbs} consumed={day?.totals.carbsG ?? 0} target={target?.carbsG ?? 0} />
          <MacroRow label="Fat" color={p.fat} consumed={day?.totals.fatG ?? 0} target={target?.fatG ?? 0} />
        </View>

        <Divider className="mt-3" />

        {/* Weight + burn rate columns */}
        <View className="flex-row py-4">
          <Press onPress={() => router.push('/weight')} className="flex-1 gap-1 border-r border-line pr-4 dark:border-line-dark">
            <SectionLabel>Weight trend</SectionLabel>
            {coach?.trendKg != null ? (
              <>
                <View className="flex-row items-baseline gap-1">
                  <Text className="font-monosemi text-[25px] tracking-[-0.5px] text-ink dark:text-ink-inv">
                    {formatWeight(coach.trendKg, unit, 1).split(' ')[0]}
                  </Text>
                  <Text className="text-[12px] font-medium text-ink-mut">{unit}</Text>
                </View>
                <Sparkline values={trendSeries} width={120} height={24} color={p.inkFaint} />
              </>
            ) : (
              <Text className="pt-1 text-[13px] leading-[18px] text-ink-mut">
                Tap to log your first weigh-in
              </Text>
            )}
          </Press>
          <View className="flex-1 gap-1 pl-4">
            <SectionLabel>Burn rate</SectionLabel>
            {coach?.expenditure ? (
              <>
                <View className="flex-row items-baseline gap-1">
                  <Text className="font-monosemi text-[25px] tracking-[-0.5px] text-ink dark:text-ink-inv">
                    {formatInt(coach.expenditure.current)}
                  </Text>
                  <Text className="text-[12px] font-medium text-ink-mut">kcal</Text>
                </View>
                <Text className="text-[12px] leading-4 text-ink-mut">
                  {coach.expenditure.calibrating
                    ? `calibrating, day ${coach.expenditure.dataDays} of 14`
                    : 'learned from your data'}
                </Text>
              </>
            ) : (
              <Text className="pt-1 text-[13px] text-ink-mut">Awaiting data</Text>
            )}
          </View>
        </View>

        <Divider />

        {/* Today's log preview */}
        <View className="mt-4 flex-row items-center justify-between">
          <SectionLabel>Logged today</SectionLabel>
          <Press onPress={() => router.push('/log')}>
            <Text className="text-[13px] font-semibold text-ink underline dark:text-ink-inv" style={{ textDecorationLine: 'underline' }}>
              Open log
            </Text>
          </Press>
        </View>
        {entryCount === 0 ? (
          <Press onPress={() => router.push('/add')} className="items-center gap-2 px-6 py-9">
            <Icon name="fork.knife" size={22} tint={p.inkFaint} />
            <Text className="text-center text-[14px] leading-5 text-ink-mut">
              Nothing yet. Tap + to log your first meal.
            </Text>
          </Press>
        ) : (
          <View className="mt-1">
            {lastEntries.map((e) => (
              <Press key={e.id} onPress={() => router.push(`/entry/${e.id}`)}>
                <View className="flex-row items-center justify-between border-b border-raise py-3 dark:border-raise-dark">
                  <View className="flex-1 pr-3">
                    <Text numberOfLines={1} className="text-[15px] font-semibold text-ink dark:text-ink-inv">
                      {e.name}
                    </Text>
                    <Text className="mt-0.5 text-[12px] text-ink-mut">{MEAL_LABELS[e.meal]}</Text>
                  </View>
                  <Text className="font-mono text-[14.5px] text-ink dark:text-ink-inv">
                    {formatInt(e.kcal)}
                  </Text>
                </View>
              </Press>
            ))}
          </View>
        )}
      </ScrollView>
      <AddButton onPress={() => router.push('/add')} />
    </View>
  );
}
