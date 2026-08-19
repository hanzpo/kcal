import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, GhostButton, Press, PrimaryButton, SectionLabel } from '@/components/ui';
import { useLogMutations } from '@/hooks/queries';
import { MEAL_LABELS, MEALS, type Meal } from '@/lib/dates';
import { formatGrams, formatInt } from '@/lib/format';
import { getEntry } from '@/repos/logs';

export default function EditEntry() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: entry } = useQuery({ queryKey: ['entry', id], queryFn: () => getEntry(id) });
  const { updateEntry, deleteEntry } = useLogMutations();

  const [scaleStr, setScaleStr] = useState('1');
  const [meal, setMeal] = useState<Meal | null>(null);

  if (!entry) return <View className="flex-1 bg-page dark:bg-page-dark" />;

  const scale = parseFloat(scaleStr) || 1;
  const activeMeal = meal ?? entry.meal;

  const save = async () => {
    await updateEntry.mutateAsync({
      id: entry.id,
      patch: {
        meal: activeMeal,
        quantity: entry.quantity * scale,
        grams: entry.grams != null ? entry.grams * scale : null,
        kcal: entry.kcal * scale,
        proteinG: entry.proteinG * scale,
        carbsG: entry.carbsG * scale,
        fatG: entry.fatG * scale,
      },
    });
    router.back();
  };

  const remove = async () => {
    await deleteEntry.mutateAsync(entry.id);
    router.back();
  };

  return (
    <View className="flex-1 bg-page pt-3.5 dark:bg-page-dark">
      <View className="items-center pb-3">
        <View className="h-[5px] w-9 rounded-full bg-line dark:bg-line-dark" />
      </View>
      <View className="flex-1 px-4">
        <Text className="px-1 text-[22px] font-bold text-ink dark:text-ink-inv">{entry.name}</Text>
        <Text className="mt-1 px-1 text-[13px] text-ink-mut">
          Logged {entry.quantity % 1 === 0 ? entry.quantity : entry.quantity.toFixed(2)} × {entry.unit}
        </Text>

        <Card className="mt-4 items-center gap-1 p-5">
          <View className="flex-row items-baseline gap-1.5">
            <Text className="font-monosemi text-[36px] text-ink dark:text-ink-inv">
              {formatInt(entry.kcal * scale)}
            </Text>
            <Text className="text-[13px] text-ink-mut">kcal</Text>
          </View>
          <View className="flex-row gap-5">
            <Text className="font-mono text-[14px] text-protein">{formatGrams(entry.proteinG * scale)}g P</Text>
            <Text className="font-mono text-[14px] text-carbs">{formatGrams(entry.carbsG * scale)}g C</Text>
            <Text className="font-mono text-[14px] text-fat">{formatGrams(entry.fatG * scale)}g F</Text>
          </View>
        </Card>

        <SectionLabel className="px-1 pb-2 pt-5">Adjust portion ×</SectionLabel>
        <View className="flex-row items-center gap-2">
          <View className="w-[110px] rounded-2xl border border-line bg-card px-4 dark:border-line-dark dark:bg-card-dark">
            <TextInput
              value={scaleStr}
              onChangeText={setScaleStr}
              keyboardType="decimal-pad"
              selectTextOnFocus
              className="h-[48px] font-mono text-[18px] text-ink dark:text-ink-inv"
            />
          </View>
          {[0.5, 0.75, 1.25, 1.5, 2].map((m) => (
            <Press key={m} onPress={() => setScaleStr(String(m))} className="rounded-full border border-line px-3 py-1.5 dark:border-line-dark">
              <Text className="text-[13px] font-medium text-ink-sec dark:text-ink-dsec">{m}×</Text>
            </Press>
          ))}
        </View>

        <SectionLabel className="px-1 pb-2 pt-5">Meal</SectionLabel>
        <View className="flex-row gap-1.5">
          {MEALS.map((m) => (
            <Press
              key={m}
              onPress={() => setMeal(m)}
              className={`flex-1 items-center rounded-full py-2 ${
                activeMeal === m ? 'bg-ink dark:bg-ink-inv' : 'bg-card dark:bg-card-dark'
              }`}>
              <Text
                className={`text-[12px] font-semibold ${
                  activeMeal === m ? 'text-ink-inv dark:text-ink' : 'text-ink-sec dark:text-ink-dsec'
                }`}>
                {MEAL_LABELS[m]}
              </Text>
            </Press>
          ))}
        </View>
      </View>

      <View className="gap-2.5 px-4" style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
        <PrimaryButton label="Save changes" onPress={save} disabled={updateEntry.isPending} />
        <GhostButton label="Delete entry" onPress={remove} />
      </View>
    </View>
  );
}
