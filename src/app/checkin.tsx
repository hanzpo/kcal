import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, GhostButton, Icon, PrimaryButton, SectionLabel } from '@/components/ui';
import { useAcceptCheckIn, useCoaching } from '@/hooks/queries';
import { formatInt, formatSigned } from '@/lib/format';
import { usePalette } from '@/lib/theme';

export default function CheckIn() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const p = usePalette();
  const { data: coach } = useCoaching();
  const accept = useAcceptCheckIn();

  const proposal = coach?.proposal;
  if (!proposal) {
    return (
      <View className="flex-1 items-center justify-center bg-page px-8 dark:bg-page-dark">
        <Text className="text-center text-[14px] text-ink-mut">No check-in due right now.</Text>
      </View>
    );
  }

  const delta = proposal.kcal - proposal.currentKcal;
  const exp = coach?.expenditure;

  const apply = async () => {
    await accept.mutateAsync(proposal);
    router.back();
  };

  return (
    <View className="flex-1 bg-page pt-3.5 dark:bg-page-dark">
      <View className="items-center pb-3">
        <View className="h-[5px] w-9 rounded-full bg-line dark:bg-line-dark" />
      </View>
      <View className="flex-1 px-5">
        <View className="flex-row items-center gap-2 pb-1">
          <Icon name="sparkles" size={20} tint={p.energy} />
          <Text className="text-[24px] font-bold text-ink dark:text-ink-inv">Weekly check-in</Text>
        </View>
        <Text className="pb-5 text-[14px] leading-5 text-ink-sec dark:text-ink-dsec">
          Over the last week your burn rate reads {exp ? formatInt(exp.current) : '—'} kcal per
          day. This adjustment keeps you on pace:
        </Text>

        <Card className="items-center gap-1 p-6">
          <View className="flex-row items-baseline gap-2">
            <Text className="font-monosemi text-[44px] text-ink dark:text-ink-inv">
              {formatInt(proposal.kcal)}
            </Text>
            <Text className="text-[14px] text-ink-mut">kcal/day</Text>
          </View>
          <View className="rounded-full bg-raise px-3 py-1 dark:bg-raise-dark">
            <Text className="font-mono text-[13px] text-ink-sec dark:text-ink-dsec">
              {formatSigned(delta, 0)} vs current
            </Text>
          </View>
          <View className="mt-4 w-full flex-row justify-between border-t border-line pt-4 dark:border-line-dark">
            {(
              [
                ['Protein', proposal.proteinG, p.protein],
                ['Carbs', proposal.carbsG, p.carbs],
                ['Fat', proposal.fatG, p.fat],
              ] as const
            ).map(([label, v, color]) => (
              <View key={label} className="items-center gap-0.5">
                <Text className="font-monosemi text-[19px]" style={{ color }}>
                  {formatInt(v)}g
                </Text>
                <SectionLabel>{label}</SectionLabel>
              </View>
            ))}
          </View>
        </Card>

        <Text className="px-1 pt-4 text-[12.5px] leading-[18px] text-ink-mut">
          Adjustments move halfway to the ideal each week, so one rough week never causes a
          punishing cut. Skip it if this week wasn't normal for you, like travel or illness.
        </Text>
      </View>
      <View className="gap-2.5 px-5" style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
        <PrimaryButton label="Accept new targets" onPress={apply} disabled={accept.isPending} />
        <GhostButton label="Not this week" onPress={() => router.back()} />
      </View>
    </View>
  );
}
