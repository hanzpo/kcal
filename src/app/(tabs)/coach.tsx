import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, Icon, Press, PrimaryButton, SectionLabel } from '@/components/ui';
import { useCoaching, useSettings } from '@/hooks/queries';
import { daysBetween, todayStr } from '@/lib/dates';
import { displayToKg, formatInt, formatSigned, formatWeight, kgToDisplay } from '@/lib/format';
import { usePalette } from '@/lib/theme';
import { getLoggedDates } from '@/repos/logs';
import { updateSettings } from '@/repos/settings';
import { getActiveTarget, getTargetHistory, insertTarget } from '@/repos/targets';
import { deriveTargets, mifflinStJeorBmr, projectGoalDate } from '@/services/coaching';
import { addDaysStr } from '@/lib/dates';

type Goal = 'lose' | 'maintain' | 'gain';

const GOAL_RATES: Record<Goal, { label: string; pct: number }[]> = {
  lose: [
    { label: '−0.25%', pct: -0.25 },
    { label: '−0.5%', pct: -0.5 },
    { label: '−0.75%', pct: -0.75 },
    { label: '−1%', pct: -1.0 },
  ],
  maintain: [{ label: '0%', pct: 0 }],
  gain: [
    { label: '+0.125%', pct: 0.125 },
    { label: '+0.25%', pct: 0.25 },
    { label: '+0.5%', pct: 0.5 },
  ],
};

export default function Coach() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const p = usePalette();
  const qc = useQueryClient();
  const { data: settings } = useSettings();
  const { data: coach } = useCoaching();

  const { data: active } = useQuery({ queryKey: ['activeTarget'], queryFn: getActiveTarget });
  const { data: history } = useQuery({ queryKey: ['targetHistory'], queryFn: getTargetHistory });
  const { data: adherence } = useQuery({
    queryKey: ['adherence'],
    queryFn: async () => {
      const dates = await getLoggedDates(addDaysStr(todayStr(), -6));
      return dates.length;
    },
  });

  const [editingGoal, setEditingGoal] = useState(false);
  const [goal, setGoal] = useState<Goal>((settings?.goalType as Goal) ?? 'maintain');
  const [ratePct, setRatePct] = useState<number>(settings?.goalRatePctPerWeek ?? 0);
  const [goalWeightStr, setGoalWeightStr] = useState('');
  const [goalPrefilled, setGoalPrefilled] = useState(false);

  const unit = settings?.weightUnit ?? 'lb';
  const exp = coach?.expenditure;

  if (settings && !goalPrefilled) {
    setGoalPrefilled(true);
    if (settings.goalWeightKg != null) {
      setGoalWeightStr(kgToDisplay(settings.goalWeightKg, settings.weightUnit ?? 'lb').toFixed(1));
    }
  }

  const projection = useMemo(() => {
    const from = coach?.trendKg ?? coach?.scaleKg;
    if (!settings?.goalWeightKg || !settings.goalRatePctPerWeek || from == null) return null;
    const date = projectGoalDate(from, settings.goalWeightKg, settings.goalRatePctPerWeek, todayStr());
    if (!date) return null;
    return {
      target: formatWeight(settings.goalWeightKg, unit, 1),
      when: format(parseISO(date), 'MMM d'),
      toGo: kgToDisplay(Math.abs(settings.goalWeightKg - from), unit),
    };
  }, [settings, coach?.trendKg, coach?.scaleKg, unit]);

  const applyGoal = async () => {
    const weightKg = coach?.trendKg ?? coach?.scaleKg;
    if (!settings || !weightKg) return;
    const gw = parseFloat(goalWeightStr);
    const goalWeightKg =
      isFinite(gw) && gw > 0 ? displayToKg(gw, settings.weightUnit ?? 'lb') : null;
    const bmr = mifflinStJeorBmr({
      sex: settings.sex ?? 'male',
      age: new Date().getFullYear() - (settings.birthYear ?? 1995),
      heightCm: settings.heightCm ?? 175,
      weightKg,
    });
    const t = deriveTargets({
      tdee: exp?.current ?? settings.initialTdee ?? 2200,
      weightKg,
      goalRatePctPerWeek: ratePct,
      proteinGPerKg: settings.proteinGPerKg,
      bmr,
    });
    await updateSettings({
      goalType: goal,
      goalRatePctPerWeek: ratePct,
      goalWeightKg,
      lastCheckinDate: todayStr(),
    });
    await insertTarget({
      effectiveDate: todayStr(),
      kcal: t.kcal,
      proteinG: t.proteinG,
      carbsG: t.carbsG,
      fatG: t.fatG,
      tdeeAtSet: exp?.current ?? null,
      reason: 'manual',
    });
    setEditingGoal(false);
    qc.invalidateQueries();
  };

  const goalLabel =
    settings?.goalType === 'lose' ? 'Losing' : settings?.goalType === 'gain' ? 'Gaining' : 'Maintaining';
  const lastAdjust = settings?.lastCheckinDate ?? history?.[0]?.effectiveDate;
  const daysToCheckIn = lastAdjust ? Math.max(0, 7 - daysBetween(lastAdjust, todayStr())) : null;

  return (
    <ScrollView
      className="flex-1 bg-page dark:bg-page-dark"
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 110, paddingHorizontal: 16 }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
      showsVerticalScrollIndicator={false}>
      <Text className="mb-4 px-1 text-[28px] font-bold tracking-tight text-ink dark:text-ink-inv">
        Coach
      </Text>

      {/* Check-in status */}
      {coach?.proposal ? (
        <Press onPress={() => router.push('/checkin')}>
          <Card className="mb-3 flex-row items-center gap-3 border-energy/40 bg-energy/10 px-4 py-4 dark:bg-energy-dark/10">
            <Icon name="sparkles" size={20} tint={p.energy} />
            <View className="flex-1">
              <Text className="text-[15px] font-bold text-ink dark:text-ink-inv">
                Weekly check-in ready
              </Text>
              <Text className="mt-0.5 text-[12.5px] text-ink-sec dark:text-ink-dsec">
                Proposed: {formatInt(coach.proposal.kcal)} kcal ({formatSigned(coach.proposal.kcal - coach.proposal.currentKcal, 0)})
              </Text>
            </View>
            <Icon name="chevron.right" size={13} tint={p.inkMut} />
          </Card>
        </Press>
      ) : daysToCheckIn != null ? (
        <Card className="mb-3 flex-row items-center gap-3 px-4 py-3.5">
          <Icon name="calendar" size={18} tint={p.inkMut} />
          <Text className="flex-1 text-[13.5px] text-ink-sec dark:text-ink-dsec">
            {exp?.calibrating
              ? `Calibrating, day ${exp.dataDays} of 14`
              : daysToCheckIn === 0
                ? 'Check-in unlocks with more data'
                : `Next check-in in ${daysToCheckIn} day${daysToCheckIn === 1 ? '' : 's'}`}
          </Text>
        </Card>
      ) : null}

      {/* Current program */}
      <SectionLabel className="px-2 pb-1.5">Current program</SectionLabel>
      <Card className="mb-3 p-5">
        <View className="flex-row items-baseline justify-between">
          <View className="flex-row items-baseline gap-1.5">
            <Text className="font-monosemi text-[36px] text-ink dark:text-ink-inv">
              {formatInt(active?.kcal ?? 0)}
            </Text>
            <Text className="text-[13px] text-ink-mut">kcal / day</Text>
          </View>
          <Text className="text-[13px] font-semibold text-ink-sec dark:text-ink-dsec">
            {goalLabel}
            {settings?.goalRatePctPerWeek ? ` ${Math.abs(settings.goalRatePctPerWeek)}%/wk` : ''}
          </Text>
        </View>
        <View className="mt-4 flex-row justify-between border-t border-line pt-4 dark:border-line-dark">
          {(
            [
              ['Protein', active?.proteinG ?? 0, p.protein],
              ['Carbs', active?.carbsG ?? 0, p.carbs],
              ['Fat', active?.fatG ?? 0, p.fat],
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

      {/* Expenditure card */}
      <SectionLabel className="px-2 pb-1.5">Expenditure</SectionLabel>
      <Card className="mb-3 gap-2 p-5">
        <View className="flex-row items-baseline gap-1.5">
          <Text className="font-monosemi text-[28px] text-ink dark:text-ink-inv">
            {exp ? formatInt(exp.current) : '—'}
          </Text>
          <Text className="text-[13px] text-ink-mut">kcal / day</Text>
          {exp?.calibrating ? (
            <View className="ml-2 rounded-full bg-raise px-2.5 py-1 dark:bg-raise-dark">
              <Text className="text-[10.5px] font-semibold uppercase tracking-[0.5px] text-ink-sec dark:text-ink-dsec">
                calibrating
              </Text>
            </View>
          ) : null}
        </View>
        <Text className="text-[13px] leading-[19px] text-ink-sec dark:text-ink-dsec">
          {exp?.calibrating
            ? 'Your true burn rate is being learned from intake vs. weight change. Early numbers lean on your profile estimate.'
            : 'Estimated from what you eat and how your trend weight responds, not from a formula.'}
        </Text>
        <View className="mt-1 flex-row gap-6">
          <View>
            <Text className="font-mono text-[15px] text-ink dark:text-ink-inv">{adherence ?? 0}/7</Text>
            <SectionLabel className="mt-0.5">days logged</SectionLabel>
          </View>
          {coach?.trendKg != null && coach?.scaleKg != null ? (
            <View>
              <Text className="font-mono text-[15px] text-ink dark:text-ink-inv">
                {kgToDisplay(coach.trendKg, unit).toFixed(1)} {unit}
              </Text>
              <SectionLabel className="mt-0.5">trend weight</SectionLabel>
            </View>
          ) : null}
        </View>
      </Card>

      {/* Edit goal */}
      <SectionLabel className="px-2 pb-1.5">Goal</SectionLabel>
      <Card className="p-4">
        {!editingGoal ? (
          <Press onPress={() => setEditingGoal(true)} className="gap-1">
            <View className="flex-row items-center justify-between">
              <Text className="text-[15px] font-medium text-ink dark:text-ink-inv">
                {goalLabel}
                {settings?.goalRatePctPerWeek
                  ? ` · ${formatSigned(settings.goalRatePctPerWeek, 2)}% BW / week`
                  : ''}
              </Text>
              <Text className="text-[13px] font-semibold text-ink-sec dark:text-ink-dsec">Change</Text>
            </View>
            {projection ? (
              <Text className="text-[12.5px] text-ink-mut">
                On pace for {projection.target} around{' '}
                <Text className="font-semibold text-ink-sec dark:text-ink-dsec">{projection.when}</Text>
                {' · '}
                {projection.toGo.toFixed(1)} {unit} to go
              </Text>
            ) : null}
          </Press>
        ) : (
          <View className="gap-3">
            <View className="flex-row gap-1.5">
              {(['lose', 'maintain', 'gain'] as Goal[]).map((g) => (
                <Press
                  key={g}
                  onPress={() => {
                    setGoal(g);
                    setRatePct(GOAL_RATES[g][Math.min(1, GOAL_RATES[g].length - 1)].pct);
                  }}
                  className={`flex-1 items-center rounded-full py-2 ${
                    goal === g ? 'bg-ink dark:bg-ink-inv' : 'bg-raise dark:bg-raise-dark'
                  }`}>
                  <Text
                    className={`text-[12.5px] font-semibold capitalize ${
                      goal === g ? 'text-ink-inv dark:text-ink' : 'text-ink-sec dark:text-ink-dsec'
                    }`}>
                    {g}
                  </Text>
                </Press>
              ))}
            </View>
            {goal !== 'maintain' ? (
              <View className="flex-row items-center gap-2">
                <View className="w-[120px] flex-row items-center rounded-xl border border-line bg-page px-3 dark:border-line-dark dark:bg-page-dark">
                  <TextInput
                    value={goalWeightStr}
                    onChangeText={setGoalWeightStr}
                    placeholder={goal === 'lose' ? '165' : '190'}
                    placeholderTextColor="#8F8D88"
                    keyboardType="decimal-pad"
                    className="h-[40px] flex-1 font-mono text-[15px] text-ink dark:text-ink-inv"
                  />
                  <Text className="text-[12px] font-semibold text-ink-mut">{unit}</Text>
                </View>
                <Text className="text-[12px] text-ink-mut">goal weight (optional)</Text>
              </View>
            ) : null}
            {goal !== 'maintain' ? (
              <View className="flex-row flex-wrap gap-1.5">
                {GOAL_RATES[goal].map((r) => (
                  <Press
                    key={r.pct}
                    onPress={() => setRatePct(r.pct)}
                    className={`rounded-full border px-3.5 py-1.5 ${
                      ratePct === r.pct
                        ? 'border-ink bg-ink dark:border-ink-inv dark:bg-ink-inv'
                        : 'border-line dark:border-line-dark'
                    }`}>
                    <Text
                      className={`font-mono text-[12.5px] ${
                        ratePct === r.pct ? 'text-ink-inv dark:text-ink' : 'text-ink-sec dark:text-ink-dsec'
                      }`}>
                      {r.label}/wk
                    </Text>
                  </Press>
                ))}
              </View>
            ) : null}
            <PrimaryButton label="Apply new targets" onPress={applyGoal} />
          </View>
        )}
      </Card>

      {/* Program history */}
      {(history?.length ?? 0) > 1 ? (
        <>
          <SectionLabel className="px-2 pb-1.5 pt-4">Adjustment history</SectionLabel>
          <Card className="overflow-hidden">
            {[...history!].reverse().slice(0, 8).map((t, i) => (
              <View
                key={t.id}
                className={`flex-row items-center justify-between px-4 py-3 ${
                  i > 0 ? 'border-t border-line/60 dark:border-line-dark/60' : ''
                }`}>
                <View>
                  <Text className="text-[14px] font-medium text-ink dark:text-ink-inv">
                    {formatInt(t.kcal)} kcal
                  </Text>
                  <Text className="mt-[1px] text-[11.5px] text-ink-mut">
                    {t.effectiveDate} ·{' '}
                    {t.reason === 'initial' ? 'starting plan' : t.reason === 'manual' ? 'goal change' : 'check-in'}
                  </Text>
                </View>
                <Text className="font-mono text-[12px] text-ink-mut">
                  {formatInt(t.proteinG)}p·{formatInt(t.carbsG)}c·{formatInt(t.fatG)}f
                </Text>
              </View>
            ))}
          </Card>
        </>
      ) : null}
    </ScrollView>
  );
}
