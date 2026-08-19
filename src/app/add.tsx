import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SFSymbol } from 'expo-symbols';

import { Card, Icon, Press, SectionLabel } from '@/components/ui';
import type { Food } from '@/db/schema';
import {
  useLocalFoodSearch,
  useLocalFoodSuggestions,
  useRemoteFoodSearch,
} from '@/hooks/queries';
import { MEAL_LABELS, MEALS, mealForNow, todayStr, type Meal } from '@/lib/dates';
import { formatInt } from '@/lib/format';
import { usePalette } from '@/lib/theme';
import { upsertCachedFood, type FoodInput } from '@/repos/foods';

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function MethodTile({
  icon,
  label,
  onPress,
  tint,
}: {
  icon: SFSymbol;
  label: string;
  onPress: () => void;
  tint?: string;
}) {
  const p = usePalette();
  return (
    <Press onPress={onPress} className="flex-1 items-center gap-1.5 rounded-2xl border border-line bg-card py-3.5 dark:border-line-dark dark:bg-card-dark">
      <Icon name={icon} size={21} tint={tint ?? p.ink} />
      <Text className="text-[11px] font-semibold text-ink-sec dark:text-ink-dsec">{label}</Text>
    </Press>
  );
}

function FoodRow({
  name,
  brand,
  detail,
  kcal,
  onPress,
  favorite,
}: {
  name: string;
  brand?: string | null;
  detail: string;
  kcal: number;
  onPress: () => void;
  favorite?: boolean;
}) {
  return (
    <Press onPress={onPress} className="flex-row items-center px-4 py-3">
      <View className="flex-1 pr-3">
        <Text numberOfLines={1} className="text-[15px] font-medium text-ink dark:text-ink-inv">
          {favorite ? '★ ' : ''}
          {name}
        </Text>
        <Text numberOfLines={1} className="mt-[1px] text-[12px] text-ink-mut">
          {brand ? `${brand} · ` : ''}
          {detail}
        </Text>
      </View>
      <View className="items-end">
        <Text className="font-mono text-[14px] text-ink-sec dark:text-ink-dsec">{formatInt(kcal)}</Text>
        <Text className="text-[10px] text-ink-faint">kcal</Text>
      </View>
    </Press>
  );
}

export default function AddFood() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const p = usePalette();
  const params = useLocalSearchParams<{ meal?: Meal; date?: string }>();

  const [meal, setMeal] = useState<Meal>(params.meal ?? mealForNow());
  const date = params.date ?? todayStr();
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, 350);

  const { data: suggestions } = useLocalFoodSuggestions(new Date().getHours());
  const { data: localResults } = useLocalFoodSearch(query);
  const remote = useRemoteFoodSearch(debounced, debounced === query);

  const searching = query.trim().length > 0;
  const localIds = useMemo(() => new Set((localResults ?? []).map((f) => f.sourceId).filter(Boolean)), [localResults]);

  const openFood = (food: Food) =>
    router.push({ pathname: '/food/[id]', params: { id: food.id, meal, date } });

  const openRemote = async (input: FoodInput) => {
    const food = await upsertCachedFood(input);
    openFood(food);
  };

  const per100Detail = (f: { servingName?: string | null; servingGrams?: number | null }) =>
    f.servingName ? f.servingName : '100 g';

  const kcalForDefaultServing = (f: { kcal: number; servingGrams?: number | null }) =>
    f.servingGrams ? (f.kcal * f.servingGrams) / 100 : f.kcal;

  return (
    <View className="flex-1 bg-page dark:bg-page-dark" style={{ paddingTop: 14 }}>
      {/* Grabber + meal selector */}
      <View className="items-center pb-3">
        <View className="h-[5px] w-9 rounded-full bg-line dark:bg-line-dark" />
      </View>
      <View className="flex-row gap-1.5 px-4 pb-3">
        {MEALS.map((m) => (
          <Press
            key={m}
            onPress={() => setMeal(m)}
            className={`flex-1 items-center rounded-full py-2 ${
              meal === m ? 'bg-ink dark:bg-ink-inv' : 'bg-card dark:bg-card-dark'
            }`}>
            <Text
              className={`text-[12px] font-semibold ${
                meal === m ? 'text-ink-inv dark:text-ink' : 'text-ink-sec dark:text-ink-dsec'
              }`}>
              {MEAL_LABELS[m]}
            </Text>
          </Press>
        ))}
      </View>

      {/* Method tiles */}
      <View className="flex-row gap-2 px-4 pb-3">
        <MethodTile
          icon="barcode.viewfinder"
          label="Scan"
          onPress={() => router.push({ pathname: '/barcode', params: { meal, date } })}
        />
        <MethodTile
          icon="camera.fill"
          label="AI photo"
          tint={p.energy}
          onPress={() => router.push({ pathname: '/ai', params: { meal, date, mode: 'photo' } })}
        />
        <MethodTile
          icon="text.bubble.fill"
          label="Describe"
          tint={p.energy}
          onPress={() => router.push({ pathname: '/ai', params: { meal, date, mode: 'text' } })}
        />
        <MethodTile
          icon="bolt.fill"
          label="Quick"
          onPress={() => router.push({ pathname: '/quick', params: { meal, date } })}
        />
      </View>

      {/* Search */}
      <View className="mx-4 mb-2 flex-row items-center gap-2 rounded-2xl border border-line bg-card px-3.5 dark:border-line-dark dark:bg-card-dark">
        <Icon name="magnifyingglass" size={15} tint={p.inkMut} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search foods"
          placeholderTextColor={p.inkFaint}
          autoCorrect={false}
          className="h-[46px] flex-1 text-[16px] text-ink dark:text-ink-inv"
        />
        {query ? (
          <Press onPress={() => setQuery('')} haptic={false}>
            <Icon name="xmark.circle.fill" size={16} tint={p.inkFaint} />
          </Press>
        ) : null}
      </View>

      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {!searching ? (
          <>
            {(suggestions?.ordered.length ?? 0) > 0 ? (
              <>
                <SectionLabel className="px-5 pb-1.5 pt-2">For you right now</SectionLabel>
                <Card className="mx-4 overflow-hidden">
                  {suggestions!.ordered.slice(0, 10).map((f, i) => (
                    <View key={f.id} className={i > 0 ? 'border-t border-line/60 dark:border-line-dark/60' : ''}>
                      <FoodRow
                        name={f.name}
                        brand={f.brand}
                        detail={per100Detail(f)}
                        kcal={kcalForDefaultServing(f)}
                        favorite={f.isFavorite === 1}
                        onPress={() => openFood(f)}
                      />
                    </View>
                  ))}
                </Card>
              </>
            ) : (
              <View className="items-center gap-2 px-8 pt-10">
                <Icon name="magnifyingglass" size={24} tint={p.inkFaint} />
                <Text className="text-center text-[14px] leading-5 text-ink-mut">
                  Search the catalog, scan a barcode, or snap a photo — foods you log show up here
                  for one-tap repeats.
                </Text>
              </View>
            )}
          </>
        ) : (
          <>
            {(localResults?.length ?? 0) > 0 ? (
              <>
                <SectionLabel className="px-5 pb-1.5 pt-2">Your foods</SectionLabel>
                <Card className="mx-4 mb-3 overflow-hidden">
                  {localResults!.map((f, i) => (
                    <View key={f.id} className={i > 0 ? 'border-t border-line/60 dark:border-line-dark/60' : ''}>
                      <FoodRow
                        name={f.name}
                        brand={f.brand}
                        detail={per100Detail(f)}
                        kcal={kcalForDefaultServing(f)}
                        favorite={f.isFavorite === 1}
                        onPress={() => openFood(f)}
                      />
                    </View>
                  ))}
                </Card>
              </>
            ) : null}

            <View className="flex-row items-center gap-2 px-5 pb-1.5 pt-2">
              <SectionLabel>Catalog</SectionLabel>
              {remote.isFetching ? <ActivityIndicator size="small" color={p.inkMut} /> : null}
            </View>
            {remote.data ? (
              <Card className="mx-4 mb-3 overflow-hidden">
                {[...remote.data.generic, ...remote.data.branded]
                  .filter((f) => !f.sourceId || !localIds.has(f.sourceId))
                  .slice(0, 25)
                  .map((f, i) => (
                    <View key={`${f.source}-${f.sourceId}-${i}`} className={i > 0 ? 'border-t border-line/60 dark:border-line-dark/60' : ''}>
                      <FoodRow
                        name={f.name}
                        brand={f.brand}
                        detail={per100Detail(f)}
                        kcal={kcalForDefaultServing(f as any)}
                        onPress={() => openRemote(f)}
                      />
                    </View>
                  ))}
                {remote.data.generic.length + remote.data.branded.length === 0 && !remote.isFetching ? (
                  <View className="px-4 py-5">
                    <Text className="text-[13px] text-ink-mut">
                      Nothing found — try the AI describe button instead.
                    </Text>
                  </View>
                ) : null}
              </Card>
            ) : remote.isFetching ? null : (
              <Text className="px-5 pt-1 text-[13px] text-ink-mut">Keep typing to search online…</Text>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
