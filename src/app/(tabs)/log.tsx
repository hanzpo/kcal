import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { useRouter } from 'expo-router';
import { useAtom } from 'jotai';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { copyMeal, getLoggedDates } from '@/repos/logs';

import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import { AddButton, Card, Icon, Press, SectionLabel } from '@/components/ui';
import type { LogEntry } from '@/db/schema';
import { useDayLog, useLogMutations, useTargetForDate } from '@/hooks/queries';
import { addDaysStr, formatDayTitle, MEAL_LABELS, MEALS, todayStr, type Meal } from '@/lib/dates';
import { formatGrams, formatInt } from '@/lib/format';
import { logDateAtom } from '@/lib/prefs';
import { usePalette } from '@/lib/theme';

function EntryRow({
  entry,
  onPress,
  onDelete,
}: {
  entry: LogEntry;
  onPress: () => void;
  onDelete: () => void;
}) {
  const via =
    entry.loggedVia === 'ai_photo' || entry.loggedVia === 'ai_text'
      ? '✦'
      : entry.loggedVia === 'barcode'
        ? '⌷'
        : null;
  return (
    <Swipeable
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={() => (
        <Press onPress={onDelete} className="w-[72px] items-center justify-center bg-[#C24040]">
          <Icon name="trash" size={17} tint="#FFFFFF" />
        </Press>
      )}>
      <Press
        onPress={onPress}
        className="flex-row items-center bg-card px-4 py-[11px] dark:bg-card-dark">
        <View className="flex-1 pr-3">
          <Text numberOfLines={1} className="text-[15px] font-medium text-ink dark:text-ink-inv">
            {entry.name}
            {via ? <Text className="text-ink-faint"> {via}</Text> : null}
          </Text>
          <Text className="mt-[1px] text-[12px] text-ink-mut">
            {entry.unit === 'g'
              ? `${formatGrams(entry.grams ?? entry.quantity)} g`
              : `${entry.quantity % 1 === 0 ? entry.quantity : entry.quantity.toFixed(2)} × ${entry.unit}`}
            {'   ·   '}
            <Text className="text-protein">{formatGrams(entry.proteinG)}p</Text>{' '}
            <Text className="text-carbs">{formatGrams(entry.carbsG)}c</Text>{' '}
            <Text className="text-fat">{formatGrams(entry.fatG)}f</Text>
          </Text>
        </View>
        <Text className="font-mono text-[14px] text-ink-sec dark:text-ink-dsec">{formatInt(entry.kcal)}</Text>
      </Press>
    </Swipeable>
  );
}

function MealSection({ meal, date }: { meal: Meal; date: string }) {
  const router = useRouter();
  const p = usePalette();
  const qc = useQueryClient();
  const { deleteEntry } = useLogMutations();
  const { data: day } = useDayLog(date);
  const yesterday = addDaysStr(date, -1);
  const { data: prevDay } = useDayLog(yesterday);
  const entries = day?.byMeal[meal] ?? [];
  const subtotal = day?.mealTotals[meal] ?? 0;
  const prevEntries = prevDay?.byMeal[meal] ?? [];
  const prevKcal = prevDay?.mealTotals[meal] ?? 0;

  const copyYesterday = async () => {
    await copyMeal(yesterday, date, meal);
    qc.invalidateQueries({ queryKey: ['log'] });
    qc.invalidateQueries({ queryKey: ['coaching'] });
    qc.invalidateQueries({ queryKey: ['intakes'] });
  };

  return (
    <Card className="mb-3 overflow-hidden">
      <View className="flex-row items-center justify-between border-b border-line px-4 py-2.5 dark:border-line-dark">
        <Text className="text-[13px] font-bold uppercase tracking-[1px] text-ink-sec dark:text-ink-dsec">
          {MEAL_LABELS[meal]}
        </Text>
        <View className="flex-row items-center gap-3">
          {subtotal > 0 ? (
            <Text className="font-mono text-[13px] text-ink-mut">{formatInt(subtotal)}</Text>
          ) : null}
          <Press
            onPress={() => router.push({ pathname: '/add', params: { meal, date } })}
            className="h-7 w-7 items-center justify-center rounded-full bg-raise dark:bg-raise-dark">
            <Icon name="plus" size={13} tint={p.inkSec} weight="bold" />
          </Press>
        </View>
      </View>
      {entries.length === 0 ? (
        <View className="flex-row items-center">
          <Press
            onPress={() => router.push({ pathname: '/add', params: { meal, date } })}
            className="flex-1 px-4 py-3.5">
            <Text className="text-[13px] text-ink-faint">Add food…</Text>
          </Press>
          {prevEntries.length > 0 ? (
            <Press onPress={copyYesterday} className="flex-row items-center gap-1.5 px-4 py-3.5">
              <Icon name="doc.on.doc" size={13} tint={p.inkMut} />
              <Text className="text-[12.5px] font-medium text-ink-sec dark:text-ink-dsec">
                Yesterday · {formatInt(prevKcal)}
              </Text>
            </Press>
          ) : null}
        </View>
      ) : (
        entries.map((e, i) => (
          <View key={e.id} className={i > 0 ? 'border-t border-line/60 dark:border-line-dark/60' : ''}>
            <EntryRow
              entry={e}
              onPress={() => router.push(`/entry/${e.id}`)}
              onDelete={() => deleteEntry.mutate(e.id)}
            />
          </View>
        ))
      )}
    </Card>
  );
}

function WeekStrip({ date, onSelect }: { date: string; onSelect: (d: string) => void }) {
  const today = todayStr();
  const { data: loggedDates } = useQuery({
    queryKey: ['loggedDates'],
    queryFn: () => getLoggedDates(addDaysStr(todayStr(), -13)),
  });
  const logged = new Set(loggedDates ?? []);
  const days = Array.from({ length: 7 }, (_, i) => addDaysStr(today, i - 6));

  return (
    <View className="flex-row justify-between px-4 pb-3">
      {days.map((d) => {
        const selected = d === date;
        const dayNum = d.slice(-2).replace(/^0/, '');
        const letter = format(parseISO(d), 'EEEEE');
        return (
          <Press
            key={d}
            onPress={() => onSelect(d)}
            className={`h-[52px] w-[40px] items-center justify-center gap-0.5 rounded-2xl ${
              selected ? 'bg-ink dark:bg-ink-inv' : ''
            }`}>
            <Text
              className={`text-[10px] font-semibold uppercase ${
                selected ? 'text-ink-inv/70 dark:text-ink/70' : 'text-ink-faint'
              }`}>
              {letter}
            </Text>
            <Text
              className={`font-mono text-[14px] ${
                selected ? 'text-ink-inv dark:text-ink' : 'text-ink dark:text-ink-inv'
              }`}>
              {dayNum}
            </Text>
            <View
              className="h-[4px] w-[4px] rounded-full"
              style={{
                backgroundColor: logged.has(d)
                  ? selected
                    ? '#EDA100'
                    : '#DE9300'
                  : 'transparent',
              }}
            />
          </Press>
        );
      })}
    </View>
  );
}

export default function Log() {
  const insets = useSafeAreaInsets();
  const p = usePalette();
  const router = useRouter();
  const [dateOverride, setDate] = useAtom(logDateAtom);
  const date = dateOverride ?? todayStr();
  const { data: day } = useDayLog(date);
  const { data: target } = useTargetForDate(date);

  const totals = day?.totals;
  const isToday = date === todayStr();

  return (
    <View className="flex-1 bg-page dark:bg-page-dark" style={{ paddingTop: insets.top + 8 }}>
      {/* Date navigation */}
      <View className="flex-row items-center justify-between px-4 pb-3">
        <Press
          onPress={() => setDate(addDaysStr(date, -1))}
          className="h-10 w-10 items-center justify-center rounded-full bg-card dark:bg-card-dark">
          <Icon name="chevron.left" size={15} tint={p.inkSec} />
        </Press>
        <Press onPress={() => setDate(null)}>
          <View className="items-center">
            <Text className="text-[20px] font-bold text-ink dark:text-ink-inv">
              {formatDayTitle(date)}
            </Text>
            {!isToday ? (
              <Text className="text-[11px] font-medium text-ink-mut">tap for today</Text>
            ) : null}
          </View>
        </Press>
        <Press
          onPress={() => setDate(addDaysStr(date, 1))}
          className="h-10 w-10 items-center justify-center rounded-full bg-card dark:bg-card-dark">
          <Icon name="chevron.right" size={15} tint={p.inkSec} />
        </Press>
      </View>

      <WeekStrip date={date} onSelect={(d) => setDate(d === todayStr() ? null : d)} />

      {/* Day summary strip */}
      <View className="mx-4 mb-3 flex-row items-center justify-between rounded-2xl border border-line bg-card px-4 py-3 dark:border-line-dark dark:bg-card-dark">
        <View className="flex-row items-baseline gap-1.5">
          <Text className="font-monosemi text-[20px] text-ink dark:text-ink-inv">
            {formatInt(totals?.kcal ?? 0)}
          </Text>
          <Text className="text-[12px] text-ink-mut">/ {formatInt(target?.kcal ?? 0)} kcal</Text>
        </View>
        <View className="flex-row gap-3">
          <Text className="font-mono text-[13px] text-protein">{formatGrams(totals?.proteinG ?? 0)}p</Text>
          <Text className="font-mono text-[13px] text-carbs">{formatGrams(totals?.carbsG ?? 0)}c</Text>
          <Text className="font-mono text-[13px] text-fat">{formatGrams(totals?.fatG ?? 0)}f</Text>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}>
        {MEALS.map((m) => (
          <MealSection key={m} meal={m} date={date} />
        ))}
      </ScrollView>
      <AddButton onPress={() => router.push('/add')} />
    </View>
  );
}
