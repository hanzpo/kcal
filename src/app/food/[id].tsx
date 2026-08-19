import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, Icon, Press, PrimaryButton, SectionLabel } from '@/components/ui';
import { useLogMutations, useToggleFavorite } from '@/hooks/queries';
import { MEAL_LABELS, mealForNow, todayStr, type Meal } from '@/lib/dates';
import { formatGrams, formatInt } from '@/lib/format';
import { MICRO_KEYS, MICRO_META, nutrientsFromFood, parseServings, scaleNutrients } from '@/lib/nutrition';
import { usePalette } from '@/lib/theme';
import { getFood } from '@/repos/foods';

const QUICK_MULTIPLIERS = [0.5, 1, 1.5, 2];

export default function FoodDetail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const p = usePalette();
  const { id, meal: mealParam, date: dateParam } = useLocalSearchParams<{ id: string; meal?: Meal; date?: string }>();
  const meal = mealParam ?? mealForNow();
  const date = dateParam ?? todayStr();

  const { data: food } = useQuery({ queryKey: ['food', id], queryFn: () => getFood(id) });
  const { logFood } = useLogMutations();
  const toggleFav = useToggleFavorite();

  const servings = useMemo(() => (food ? parseServings(food) : []), [food]);
  const units = useMemo(
    () => [...servings.map((s) => ({ name: s.name, grams: s.grams })), { name: 'g', grams: 1 }],
    [servings],
  );
  const [unitIndex, setUnitIndex] = useState(0);
  const [amountStr, setAmountStr] = useState(() => (servings.length > 0 ? '1' : '100'));

  if (!food) return <View className="flex-1 bg-page dark:bg-page-dark" />;

  const unit = units[Math.min(unitIndex, units.length - 1)];
  const amount = parseFloat(amountStr) || 0;
  const grams = amount * unit.grams;
  const n = scaleNutrients(nutrientsFromFood(food), grams);

  const micros = MICRO_KEYS.map((k) => ({ key: k, value: n[k] })).filter(
    (m) => m.value != null && (m.value as number) > 0.05,
  );

  const log = async () => {
    await logFood.mutateAsync({
      food,
      grams,
      quantity: amount,
      unit: unit.name,
      meal,
      date,
      via: food.source === 'ai' ? 'recent' : 'search',
    });
    router.dismissAll();
  };

  return (
    <View className="flex-1 bg-page pt-3.5 dark:bg-page-dark">
      <View className="items-center pb-3">
        <View className="h-[5px] w-9 rounded-full bg-line dark:bg-line-dark" />
      </View>
      <ScrollView className="flex-1 px-4" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Title */}
        <View className="flex-row items-start justify-between px-1 pb-4">
          <View className="flex-1 pr-3">
            <Text className="text-[22px] font-bold leading-7 text-ink dark:text-ink-inv">{food.name}</Text>
            <Text className="mt-1 text-[13px] text-ink-mut">
              {food.brand ? `${food.brand} · ` : ''}
              {food.source === 'ai' ? 'AI estimate' : food.source === 'custom' ? 'Custom food' : food.source === 'off' ? 'Open Food Facts' : 'USDA'}
              {' → '}
              {MEAL_LABELS[meal]}
            </Text>
          </View>
          <Press onPress={() => toggleFav.mutate(food.id)} className="pt-1">
            <Icon
              name={food.isFavorite ? 'star.fill' : 'star'}
              size={22}
              tint={food.isFavorite ? p.energy : p.inkFaint}
            />
          </Press>
        </View>

        {/* Live preview */}
        <Card className="items-center gap-1 p-5">
          <View className="flex-row items-baseline gap-1.5">
            <Text className="font-monosemi text-[42px] leading-[46px] text-ink dark:text-ink-inv">
              {formatInt(n.kcal)}
            </Text>
            <Text className="text-[13px] font-medium text-ink-mut">kcal</Text>
          </View>
          <View className="mt-1 flex-row gap-5">
            <Text className="font-mono text-[15px] text-protein">{formatGrams(n.proteinG)}g P</Text>
            <Text className="font-mono text-[15px] text-carbs">{formatGrams(n.carbsG)}g C</Text>
            <Text className="font-mono text-[15px] text-fat">{formatGrams(n.fatG)}g F</Text>
          </View>
          <Text className="mt-1 text-[12px] text-ink-mut">= {formatGrams(grams)} g total</Text>
        </Card>

        {/* Amount */}
        <SectionLabel className="px-1 pb-2 pt-5">Amount</SectionLabel>
        <View className="flex-row items-center gap-2">
          <View className="w-[110px] flex-row items-center rounded-2xl border border-line bg-card px-4 dark:border-line-dark dark:bg-card-dark">
            <TextInput
              value={amountStr}
              onChangeText={setAmountStr}
              keyboardType="decimal-pad"
              selectTextOnFocus
              className="h-[50px] flex-1 font-mono text-[19px] text-ink dark:text-ink-inv"
            />
          </View>
          <View className="flex-1 flex-row flex-wrap gap-1.5">
            {QUICK_MULTIPLIERS.map((m) => (
              <Press
                key={m}
                onPress={() => setAmountStr(String(unit.name === 'g' ? Math.round(m * 100) : m))}
                className="rounded-full border border-line px-3 py-1.5 dark:border-line-dark">
                <Text className="text-[13px] font-medium text-ink-sec dark:text-ink-dsec">
                  {unit.name === 'g' ? `${Math.round(m * 100)}` : m}
                </Text>
              </Press>
            ))}
          </View>
        </View>

        {/* Unit picker */}
        <SectionLabel className="px-1 pb-2 pt-4">Serving</SectionLabel>
        <View className="flex-row flex-wrap gap-2">
          {units.map((u, i) => (
            <Press
              key={u.name + i}
              onPress={() => {
                setUnitIndex(i);
                setAmountStr(u.name === 'g' ? String(Math.round(amount * unit.grams) || 100) : '1');
              }}
              className={`rounded-2xl border px-4 py-2.5 ${
                i === unitIndex
                  ? 'border-ink bg-ink dark:border-ink-inv dark:bg-ink-inv'
                  : 'border-line bg-card dark:border-line-dark dark:bg-card-dark'
              }`}>
              <Text
                className={`text-[13px] font-semibold ${
                  i === unitIndex ? 'text-ink-inv dark:text-ink' : 'text-ink dark:text-ink-inv'
                }`}>
                {u.name === 'g' ? 'grams' : u.name}
              </Text>
              {u.name !== 'g' ? (
                <Text className={`text-[11px] ${i === unitIndex ? 'text-ink-inv/60 dark:text-ink/60' : 'text-ink-mut'}`}>
                  {formatGrams(u.grams)} g
                </Text>
              ) : null}
            </Press>
          ))}
        </View>

        {/* Micros */}
        {micros.length > 0 ? (
          <>
            <SectionLabel className="px-1 pb-2 pt-5">Nutrition detail</SectionLabel>
            <Card className="overflow-hidden">
              {micros.map((m, i) => {
                const meta = MICRO_META[m.key];
                return (
                  <View
                    key={m.key}
                    className={`flex-row items-center justify-between px-4 py-2.5 ${
                      i > 0 ? 'border-t border-line/60 dark:border-line-dark/60' : ''
                    }`}>
                    <Text className="text-[14px] text-ink-sec dark:text-ink-dsec">{meta.label}</Text>
                    <Text className="font-mono text-[13px] text-ink dark:text-ink-inv">
                      {formatGrams(m.value as number)} {meta.unit}
                    </Text>
                  </View>
                );
              })}
            </Card>
          </>
        ) : null}
      </ScrollView>

      <View className="px-4" style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
        <PrimaryButton
          label={`Log to ${MEAL_LABELS[meal]}`}
          onPress={log}
          disabled={grams <= 0 || logFood.isPending}
        />
      </View>
    </View>
  );
}
