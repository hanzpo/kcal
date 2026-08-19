import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import { Press, PrimaryButton, SectionLabel } from '@/components/ui';
import type { Settings } from '@/db/schema';
import { todayStr } from '@/lib/dates';
import { displayToKg, formatSigned, kgToDisplay } from '@/lib/format';
import { updateSettings } from '@/repos/settings';
import { insertTarget } from '@/repos/targets';
import { upsertWeight } from '@/repos/weights';
import { deriveTargets, mifflinStJeorBmr, seedTdeeFromProfile } from '@/services/coaching';

type Sex = 'male' | 'female';
type Activity = NonNullable<Settings['activityLevel']>;
type Goal = 'lose' | 'maintain' | 'gain';

const ACTIVITIES: { key: Activity; label: string; desc: string }[] = [
  { key: 'sedentary', label: 'Sedentary', desc: 'Desk work, little exercise' },
  { key: 'light', label: 'Light', desc: '1–3 workouts / week' },
  { key: 'moderate', label: 'Moderate', desc: '3–5 workouts / week' },
  { key: 'active', label: 'Active', desc: '6–7 workouts / week' },
  { key: 'very_active', label: 'Very active', desc: 'Physical job + training' },
];

const RATES: Record<Goal, { label: string; pct: number }[]> = {
  lose: [
    { label: 'Relaxed', pct: -0.25 },
    { label: 'Moderate', pct: -0.5 },
    { label: 'Aggressive', pct: -0.75 },
    { label: 'Max', pct: -1.0 },
  ],
  maintain: [{ label: 'Maintain', pct: 0 }],
  gain: [
    { label: 'Lean', pct: 0.125 },
    { label: 'Moderate', pct: 0.25 },
    { label: 'Fast', pct: 0.5 },
  ],
};

function ChoiceChip({ label, active, onPress, desc }: { label: string; active: boolean; onPress: () => void; desc?: string }) {
  return (
    <Press
      onPress={onPress}
      className={`rounded-2xl border px-4 py-3.5 ${
        active
          ? 'border-ink bg-ink dark:border-ink-inv dark:bg-ink-inv'
          : 'border-line bg-card dark:border-line-dark dark:bg-card-dark'
      }`}>
      <Text
        className={`text-[15px] font-semibold ${
          active ? 'text-ink-inv dark:text-ink' : 'text-ink dark:text-ink-inv'
        }`}>
        {label}
      </Text>
      {desc ? (
        <Text className={`mt-0.5 text-[12px] ${active ? 'text-ink-inv/70 dark:text-ink/70' : 'text-ink-mut'}`}>
          {desc}
        </Text>
      ) : null}
    </Press>
  );
}

function NumberField({
  value,
  onChange,
  placeholder,
  suffix,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  suffix: string;
}) {
  return (
    <View className="flex-row items-center rounded-2xl border border-line bg-card px-4 dark:border-line-dark dark:bg-card-dark">
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#B8B6AD"
        keyboardType="decimal-pad"
        className="h-[54px] flex-1 font-mono text-[20px] text-ink dark:text-ink-inv"
      />
      <Text className="text-[14px] font-semibold text-ink-mut">{suffix}</Text>
    </View>
  );
}

export default function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [step, setStep] = useState(0);
  const [unit, setUnit] = useState<'lb' | 'kg'>('lb');
  const [sex, setSex] = useState<Sex | null>(null);
  const [birthYear, setBirthYear] = useState('');
  const [height, setHeight] = useState(''); // cm or ft'in as decimal ft? keep cm/in by unit
  const [weight, setWeight] = useState('');
  const [activity, setActivity] = useState<Activity | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [ratePct, setRatePct] = useState<number | null>(null);

  const heightCm = useMemo(() => {
    const v = parseFloat(height);
    if (!isFinite(v) || v <= 0) return null;
    return unit === 'kg' ? v : v * 2.54; // metric: cm, imperial: inches
  }, [height, unit]);

  const weightKg = useMemo(() => {
    const v = parseFloat(weight);
    if (!isFinite(v) || v <= 0) return null;
    return displayToKg(v, unit);
  }, [weight, unit]);

  const profileReady =
    sex && heightCm && weightKg && activity && parseInt(birthYear) > 1900 && parseInt(birthYear) < 2020;

  const preview = useMemo(() => {
    if (!profileReady || goal == null || ratePct == null) return null;
    const age = new Date().getFullYear() - parseInt(birthYear);
    const profile = { sex: sex!, age, heightCm: heightCm!, weightKg: weightKg!, activityLevel: activity! };
    const tdee = seedTdeeFromProfile(profile);
    const bmr = mifflinStJeorBmr(profile);
    const targets = deriveTargets({
      tdee,
      weightKg: weightKg!,
      goalRatePctPerWeek: ratePct,
      proteinGPerKg: 1.8,
      bmr,
    });
    const weeklyKg = (ratePct / 100) * weightKg!;
    return { tdee, targets, weeklyKg };
  }, [profileReady, goal, ratePct, sex, birthYear, heightCm, weightKg, activity]);

  async function finish() {
    if (!preview || !weightKg) return;
    const today = todayStr();
    await updateSettings({
      onboardingComplete: 1,
      sex,
      birthYear: parseInt(birthYear),
      heightCm,
      activityLevel: activity,
      goalType: goal,
      goalRatePctPerWeek: ratePct,
      proteinGPerKg: 1.8,
      weightUnit: unit,
      initialTdee: preview.tdee,
    });
    await upsertWeight(today, weightKg);
    await insertTarget({
      effectiveDate: today,
      kcal: preview.targets.kcal,
      proteinG: preview.targets.proteinG,
      carbsG: preview.targets.carbsG,
      fatG: preview.targets.fatG,
      tdeeAtSet: preview.tdee,
      reason: 'initial',
    });
    await qc.invalidateQueries();
    router.replace('/(tabs)');
  }

  const steps = [
    // 0 — welcome + units
    <View key="w" className="gap-6">
      <View className="gap-2">
        <Text className="font-monosemi text-[42px] leading-[46px] text-ink dark:text-ink-inv">Tablet</Text>
        <Text className="text-[16px] leading-6 text-ink-sec dark:text-ink-dsec">
          Log what you eat, weigh in when you can. Tablet learns your real energy burn and adjusts
          your targets every week — no guesswork.
        </Text>
      </View>
      <View className="gap-2">
        <SectionLabel>Units</SectionLabel>
        <View className="flex-row gap-2">
          <View className="flex-1">
            <ChoiceChip label="Imperial" desc="lb · ft/in" active={unit === 'lb'} onPress={() => setUnit('lb')} />
          </View>
          <View className="flex-1">
            <ChoiceChip label="Metric" desc="kg · cm" active={unit === 'kg'} onPress={() => setUnit('kg')} />
          </View>
        </View>
      </View>
    </View>,

    // 1 — profile
    <View key="p" className="gap-5">
      <Text className="text-[24px] font-bold text-ink dark:text-ink-inv">About you</Text>
      <View className="gap-2">
        <SectionLabel>Biological sex</SectionLabel>
        <View className="flex-row gap-2">
          <View className="flex-1">
            <ChoiceChip label="Male" active={sex === 'male'} onPress={() => setSex('male')} />
          </View>
          <View className="flex-1">
            <ChoiceChip label="Female" active={sex === 'female'} onPress={() => setSex('female')} />
          </View>
        </View>
      </View>
      <View className="gap-2">
        <SectionLabel>Birth year</SectionLabel>
        <NumberField value={birthYear} onChange={setBirthYear} placeholder="1995" suffix="" />
      </View>
      <View className="gap-2">
        <SectionLabel>Height</SectionLabel>
        <NumberField
          value={height}
          onChange={setHeight}
          placeholder={unit === 'kg' ? '178' : '70'}
          suffix={unit === 'kg' ? 'cm' : 'in'}
        />
      </View>
      <View className="gap-2">
        <SectionLabel>Current weight</SectionLabel>
        <NumberField value={weight} onChange={setWeight} placeholder={unit === 'kg' ? '80' : '175'} suffix={unit} />
      </View>
    </View>,

    // 2 — activity
    <View key="a" className="gap-4">
      <Text className="text-[24px] font-bold text-ink dark:text-ink-inv">Activity level</Text>
      <Text className="-mt-2 text-[14px] text-ink-mut">
        Just a starting point — Tablet replaces this estimate with your real data within two weeks.
      </Text>
      <View className="gap-2">
        {ACTIVITIES.map((a) => (
          <ChoiceChip key={a.key} label={a.label} desc={a.desc} active={activity === a.key} onPress={() => setActivity(a.key)} />
        ))}
      </View>
    </View>,

    // 3 — goal
    <View key="g" className="gap-5">
      <Text className="text-[24px] font-bold text-ink dark:text-ink-inv">Your goal</Text>
      <View className="gap-2">
        {(['lose', 'maintain', 'gain'] as Goal[]).map((g) => (
          <ChoiceChip
            key={g}
            label={g === 'lose' ? 'Lose weight' : g === 'maintain' ? 'Maintain' : 'Build muscle'}
            active={goal === g}
            onPress={() => {
              setGoal(g);
              setRatePct(RATES[g][Math.min(1, RATES[g].length - 1)].pct);
            }}
          />
        ))}
      </View>
      {goal && goal !== 'maintain' ? (
        <View className="gap-2">
          <SectionLabel>Pace</SectionLabel>
          <View className="flex-row flex-wrap gap-2">
            {RATES[goal].map((r) => (
              <Press
                key={r.pct}
                onPress={() => setRatePct(r.pct)}
                className={`rounded-full border px-4 py-2 ${
                  ratePct === r.pct
                    ? 'border-ink bg-ink dark:border-ink-inv dark:bg-ink-inv'
                    : 'border-line dark:border-line-dark'
                }`}>
                <Text
                  className={`text-[13px] font-semibold ${
                    ratePct === r.pct ? 'text-ink-inv dark:text-ink' : 'text-ink-sec dark:text-ink-dsec'
                  }`}>
                  {r.label} · {Math.abs(r.pct)}%
                </Text>
              </Press>
            ))}
          </View>
          {weightKg && ratePct != null ? (
            <Text className="mt-1 font-mono text-[13px] text-ink-sec dark:text-ink-dsec">
              ≈ {formatSigned(kgToDisplay((ratePct / 100) * weightKg, unit), 1)} {unit} / week
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>,

    // 4 — summary
    <View key="s" className="gap-5">
      <Text className="text-[24px] font-bold text-ink dark:text-ink-inv">Your starting plan</Text>
      {preview ? (
        <View className="gap-3 rounded-card border border-line bg-card p-5 dark:border-line-dark dark:bg-card-dark">
          <View className="items-center gap-1 py-2">
            <Text className="font-monosemi text-[44px] text-ink dark:text-ink-inv">
              {Math.round(preview.targets.kcal).toLocaleString()}
            </Text>
            <SectionLabel>Calories / day</SectionLabel>
          </View>
          <View className="flex-row justify-between border-t border-line pt-4 dark:border-line-dark">
            {(
              [
                ['Protein', preview.targets.proteinG, '#2A78D6'],
                ['Carbs', preview.targets.carbsG, '#EB6834'],
                ['Fat', preview.targets.fatG, '#0FA371'],
              ] as const
            ).map(([label, v, color]) => (
              <View key={label} className="items-center gap-0.5">
                <Text className="font-monosemi text-[20px]" style={{ color }}>
                  {Math.round(v)}g
                </Text>
                <SectionLabel>{label}</SectionLabel>
              </View>
            ))}
          </View>
          <Text className="pt-1 text-center text-[12.5px] leading-[18px] text-ink-mut">
            Starting estimate: {Math.round(preview.tdee).toLocaleString()} kcal/day burn. Weigh in
            and log consistently — your first data-driven adjustment lands in about a week.
          </Text>
        </View>
      ) : null}
    </View>,
  ];

  const canNext =
    step === 0 || (step === 1 && profileReady) || (step === 2 && activity) || (step === 3 && goal && ratePct != null) || step === 4;

  return (
    <View className="flex-1 bg-page dark:bg-page-dark" style={{ paddingTop: insets.top }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <View className="flex-row gap-1.5 px-6 pt-4">
          {steps.map((_, i) => (
            <View
              key={i}
              className={`h-[3px] flex-1 rounded-full ${i <= step ? 'bg-ink dark:bg-ink-inv' : 'bg-raise dark:bg-raise-dark'}`}
            />
          ))}
        </View>
        <ScrollView className="flex-1 px-6 pt-8" keyboardShouldPersistTaps="handled">
          {steps[step]}
        </ScrollView>
        <View className="flex-row gap-3 px-6 pb-6" style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
          {step > 0 ? (
            <Press
              onPress={() => setStep(step - 1)}
              className="h-[52px] w-[52px] items-center justify-center rounded-2xl border border-line dark:border-line-dark">
              <Text className="text-[18px] text-ink dark:text-ink-inv">←</Text>
            </Press>
          ) : null}
          <View className="flex-1">
            <PrimaryButton
              label={step === steps.length - 1 ? 'Start tracking' : 'Continue'}
              disabled={!canNext}
              onPress={() => (step === steps.length - 1 ? finish() : setStep(step + 1))}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
