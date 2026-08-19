import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton, SectionLabel } from '@/components/ui';
import { useLogMutations } from '@/hooks/queries';
import { MEAL_LABELS, mealForNow, todayStr, type Meal } from '@/lib/dates';
import { usePalette } from '@/lib/theme';

function Field({
  label,
  value,
  onChange,
  placeholder,
  suffix,
  autoFocus,
  keyboard = 'number-pad',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  suffix?: string;
  autoFocus?: boolean;
  keyboard?: 'number-pad' | 'decimal-pad' | 'default';
}) {
  const p = usePalette();
  return (
    <View className="gap-1.5">
      <SectionLabel>{label}</SectionLabel>
      <View className="flex-row items-center rounded-2xl border border-line bg-card px-4 dark:border-line-dark dark:bg-card-dark">
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={p.inkFaint}
          keyboardType={keyboard}
          autoFocus={autoFocus}
          className={`h-[50px] flex-1 text-[17px] text-ink dark:text-ink-inv ${keyboard !== 'default' ? 'font-mono' : ''}`}
        />
        {suffix ? <Text className="text-[13px] font-semibold text-ink-mut">{suffix}</Text> : null}
      </View>
    </View>
  );
}

export default function QuickAdd() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ meal?: Meal; date?: string }>();
  const meal = params.meal ?? mealForNow();
  const date = params.date ?? todayStr();
  const { quickAdd } = useLogMutations();

  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  const save = async () => {
    await quickAdd.mutateAsync({
      name,
      kcal: parseFloat(kcal) || 0,
      proteinG: parseFloat(protein) || 0,
      carbsG: parseFloat(carbs) || 0,
      fatG: parseFloat(fat) || 0,
      meal,
      date,
    });
    router.dismissAll();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-page pt-3.5 dark:bg-page-dark">
      <View className="items-center pb-3">
        <View className="h-[5px] w-9 rounded-full bg-line dark:bg-line-dark" />
      </View>
      <View className="flex-1 gap-4 px-4 pt-1">
        <Text className="px-1 text-[22px] font-bold text-ink dark:text-ink-inv">
          Quick add · {MEAL_LABELS[meal]}
        </Text>
        <Field label="Calories" value={kcal} onChange={setKcal} placeholder="350" suffix="kcal" autoFocus />
        <View className="flex-row gap-2.5">
          <View className="flex-1">
            <Field label="Protein" value={protein} onChange={setProtein} placeholder="0" suffix="g" keyboard="decimal-pad" />
          </View>
          <View className="flex-1">
            <Field label="Carbs" value={carbs} onChange={setCarbs} placeholder="0" suffix="g" keyboard="decimal-pad" />
          </View>
          <View className="flex-1">
            <Field label="Fat" value={fat} onChange={setFat} placeholder="0" suffix="g" keyboard="decimal-pad" />
          </View>
        </View>
        <Field label="Name (optional)" value={name} onChange={setName} placeholder="Dinner out" keyboard="default" />
      </View>
      <View className="px-4" style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
        <PrimaryButton label="Log it" onPress={save} disabled={!(parseFloat(kcal) > 0) || quickAdd.isPending} />
      </View>
    </KeyboardAvoidingView>
  );
}
