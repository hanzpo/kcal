import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Press, PrimaryButton, SectionLabel } from '@/components/ui';
import { useSettings, useWeightMutations, useWeights } from '@/hooks/queries';
import { addDaysStr, formatDayTitle, todayStr } from '@/lib/dates';
import { displayToKg, kgToDisplay } from '@/lib/format';
import { usePalette } from '@/lib/theme';

export default function WeightSheet() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const p = usePalette();
  const { data: settings } = useSettings();
  const { data: weights } = useWeights();
  const { upsert } = useWeightMutations();

  const unit = settings?.weightUnit ?? 'lb';
  const [date, setDate] = useState(todayStr());
  const [valueStr, setValueStr] = useState('');
  const [prefilled, setPrefilled] = useState(false);
  // prefill with the last weigh-in once data arrives
  if (!prefilled && weights && settings) {
    setPrefilled(true);
    const last = weights.length ? weights[weights.length - 1].weightKg : null;
    if (last != null) setValueStr(kgToDisplay(last, settings.weightUnit ?? 'lb').toFixed(1));
  }

  const save = async () => {
    const v = parseFloat(valueStr);
    if (!isFinite(v) || v <= 0) return;
    await upsert.mutateAsync({ date, weightKg: displayToKg(v, unit) });
    router.back();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-page pt-3.5 dark:bg-page-dark">
      <View className="items-center pb-3">
        <View className="h-[5px] w-9 rounded-full bg-line dark:bg-line-dark" />
      </View>
      <View className="flex-1 gap-4 px-5">
        <Text className="text-[22px] font-bold text-ink dark:text-ink-inv">Log weight</Text>

        <View className="flex-row items-center justify-between">
          <Press onPress={() => setDate(addDaysStr(date, -1))} className="px-3 py-2">
            <Text className="text-[16px] text-ink-sec dark:text-ink-dsec">←</Text>
          </Press>
          <Text className="text-[15px] font-semibold text-ink dark:text-ink-inv">
            {formatDayTitle(date)}
          </Text>
          <Press
            onPress={() => date < todayStr() && setDate(addDaysStr(date, 1))}
            className="px-3 py-2">
            <Text className={`text-[16px] ${date < todayStr() ? 'text-ink-sec dark:text-ink-dsec' : 'text-ink-faint'}`}>
              →
            </Text>
          </Press>
        </View>

        <View className="flex-row items-center rounded-2xl border border-line bg-card px-5 dark:border-line-dark dark:bg-card-dark">
          <TextInput
            value={valueStr}
            onChangeText={setValueStr}
            keyboardType="decimal-pad"
            autoFocus
            selectTextOnFocus
            placeholder={unit === 'kg' ? '80.0' : '175.0'}
            placeholderTextColor={p.inkFaint}
            className="h-[62px] flex-1 font-monosemi text-[30px] text-ink dark:text-ink-inv"
          />
          <SectionLabel>{unit}</SectionLabel>
        </View>

        <Text className="px-1 text-[12.5px] leading-[18px] text-ink-mut">
          Morning weigh-ins, after the bathroom and before eating, give the steadiest trend. Daily
          fluctuation is water — Tablet smooths it out.
        </Text>
      </View>
      <View className="px-5" style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
        <PrimaryButton label="Save weigh-in" onPress={save} disabled={upsert.isPending || !(parseFloat(valueStr) > 0)} />
      </View>
    </KeyboardAvoidingView>
  );
}
