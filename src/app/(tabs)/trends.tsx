import { useFont } from '@shopify/react-native-skia';
import { useQuery } from '@tanstack/react-query';
import { useAtom } from 'jotai';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CartesianChart, Bar, Line, Scatter } from 'victory-native';

import { Card, Press, SectionLabel } from '@/components/ui';
import { useCoaching, useIntakeHistory, useSettings, useTargetForDate } from '@/hooks/queries';
import { addDaysStr, todayStr } from '@/lib/dates';
import { formatInt, kgToDisplay } from '@/lib/format';
import { MICRO_META, parseMicros, type MicroKey } from '@/lib/nutrition';
import { trendsRangeAtom } from '@/lib/prefs';
import { usePalette } from '@/lib/theme';
import { getEntriesBetween } from '@/repos/logs';

const RANGES = [
  { label: '2W', days: 14 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: 'All', days: 3650 },
];

const AXIS_FONT = require('@expo-google-fonts/ibm-plex-mono/500Medium/IBMPlexMono_500Medium.ttf');

const TRACKED_MICROS: MicroKey[] = ['fiberG', 'sugarG', 'satFatG', 'sodiumMg', 'potassiumMg', 'calciumMg', 'ironMg'];

function ChartCard({ title, caption, children }: { title: string; caption?: string; children: React.ReactNode }) {
  return (
    <Card className="mb-3 p-4">
      <View className="flex-row items-baseline justify-between pb-3">
        <SectionLabel>{title}</SectionLabel>
        {caption ? <Text className="font-mono text-[12px] text-ink-mut">{caption}</Text> : null}
      </View>
      {children}
    </Card>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <View className="h-[140px] items-center justify-center">
      <Text className="px-6 text-center text-[13px] leading-[18px] text-ink-mut">{message}</Text>
    </View>
  );
}

export default function Trends() {
  const insets = useSafeAreaInsets();
  const p = usePalette();
  const font = useFont(AXIS_FONT, 10);
  const [rangeDays, setRangeDays] = useAtom(trendsRangeAtom);

  const { data: settings } = useSettings();
  const { data: coach } = useCoaching();
  const { data: intakes } = useIntakeHistory(Math.min(rangeDays, 90));
  const { data: target } = useTargetForDate(todayStr());
  const unit = settings?.weightUnit ?? 'lb';

  const cutoff = addDaysStr(todayStr(), -rangeDays);

  // Weight: dots (scale) + line (trend)
  const weightData = (coach?.trend ?? [])
    .filter((t) => t.date >= cutoff)
    .map((t, i) => ({
      i,
      scale: t.scaleKg != null ? kgToDisplay(t.scaleKg, unit) : (null as number | null),
      trend: kgToDisplay(t.trendKg, unit),
    }));

  // Expenditure over time
  const expData = (coach?.expenditure?.history ?? [])
    .filter((h) => h.date >= cutoff)
    .map((h, i) => ({ i, tdee: h.tdee }));

  // Energy balance: intake bars vs expenditure line
  const expByDate = new Map((coach?.expenditure?.history ?? []).map((h) => [h.date, h.tdee]));
  const balanceData = (intakes ?? []).map((d, i) => ({
    i,
    intake: d.kcal,
    tdee: expByDate.get(d.date) ?? null,
  }));

  // 7-day micro averages
  const { data: microAvg } = useQuery({
    queryKey: ['micros7'],
    queryFn: async () => {
      const end = todayStr();
      const entries = await getEntriesBetween(addDaysStr(end, -6), end);
      const days = new Set(entries.map((e) => e.date)).size || 1;
      const sums: Partial<Record<MicroKey, number>> = {};
      for (const e of entries) {
        const m = parseMicros(e.micros);
        for (const k of TRACKED_MICROS) {
          const v = (m as any)[k];
          if (typeof v === 'number') sums[k] = (sums[k] ?? 0) + v;
        }
      }
      return { days, avgs: Object.fromEntries(TRACKED_MICROS.map((k) => [k, (sums[k] ?? 0) / days])) };
    },
  });

  return (
    <ScrollView
      className="flex-1 bg-page dark:bg-page-dark"
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 110, paddingHorizontal: 16 }}
      showsVerticalScrollIndicator={false}>
      <View className="mb-4 flex-row items-center justify-between px-1">
        <Text className="text-[28px] font-bold tracking-tight text-ink dark:text-ink-inv">Trends</Text>
        <View className="flex-row gap-1">
          {RANGES.map((r) => (
            <Press
              key={r.label}
              onPress={() => setRangeDays(r.days)}
              className={`rounded-full px-3 py-1.5 ${
                rangeDays === r.days ? 'bg-ink dark:bg-ink-inv' : 'bg-card dark:bg-card-dark'
              }`}>
              <Text
                className={`text-[12px] font-semibold ${
                  rangeDays === r.days ? 'text-ink-inv dark:text-ink' : 'text-ink-sec dark:text-ink-dsec'
                }`}>
                {r.label}
              </Text>
            </Press>
          ))}
        </View>
      </View>

      {/* Weight */}
      <ChartCard
        title="Weight"
        caption={coach?.trendKg != null ? `${kgToDisplay(coach.trendKg, unit).toFixed(1)} ${unit} trend` : undefined}>
        {weightData.length >= 2 ? (
          <View style={{ height: 190 }}>
            <CartesianChart
              data={weightData}
              xKey="i"
              yKeys={['scale', 'trend']}
              domainPadding={{ top: 12, bottom: 12, left: 6, right: 6 }}
              axisOptions={{
                font,
                labelColor: p.inkMut,
                lineColor: p.line,
                tickCount: { x: 0, y: 4 },
                formatYLabel: (v) => `${Math.round(v as number)}`,
              }}>
              {({ points }) => (
                <>
                  <Scatter points={points.scale.filter((pt) => pt.y != null)} radius={2.5} color={p.inkFaint} />
                  <Line points={points.trend} color={p.protein} strokeWidth={2.5} curveType="natural" />
                </>
              )}
            </CartesianChart>
          </View>
        ) : (
          <EmptyChart message="Log a few weigh-ins and the smoothed trend appears here." />
        )}
      </ChartCard>

      {/* Expenditure */}
      <ChartCard
        title="Expenditure"
        caption={coach?.expenditure ? `${formatInt(coach.expenditure.current)} kcal/d` : undefined}>
        {expData.length >= 2 && coach?.expenditure && !coach.expenditure.calibrating ? (
          <View style={{ height: 160 }}>
            <CartesianChart
              data={expData}
              xKey="i"
              yKeys={['tdee']}
              domainPadding={{ top: 14, bottom: 14 }}
              axisOptions={{
                font,
                labelColor: p.inkMut,
                lineColor: p.line,
                tickCount: { x: 0, y: 4 },
                formatYLabel: (v) => `${Math.round(v as number)}`,
              }}>
              {({ points }) => <Line points={points.tdee} color={p.energy} strokeWidth={2.5} curveType="monotoneX" />}
            </CartesianChart>
          </View>
        ) : (
          <EmptyChart
            message={
              coach?.expenditure?.calibrating
                ? `Calibrating — day ${coach.expenditure.dataDays} of 14. Keep logging food and weigh-ins.`
                : 'Your learned daily burn will chart here after two weeks of data.'
            }
          />
        )}
      </ChartCard>

      {/* Energy balance */}
      <ChartCard title="Energy balance" caption={target ? `target ${formatInt(target.kcal)}` : undefined}>
        {balanceData.length >= 2 ? (
          <View style={{ height: 160 }}>
            <CartesianChart
              data={balanceData}
              xKey="i"
              yKeys={['intake', 'tdee']}
              domainPadding={{ top: 14, left: 12, right: 12 }}
              axisOptions={{
                font,
                labelColor: p.inkMut,
                lineColor: p.line,
                tickCount: { x: 0, y: 4 },
                formatYLabel: (v) => `${Math.round((v as number) / 100) / 10}k`,
              }}>
              {({ points, chartBounds }) => (
                <>
                  <Bar
                    points={points.intake}
                    chartBounds={chartBounds}
                    color={p.isDark ? '#3A3A37' : '#D9D8D0'}
                    roundedCorners={{ topLeft: 3, topRight: 3 }}
                    barWidth={Math.max(3, 180 / balanceData.length)}
                  />
                  <Line
                    points={points.tdee.filter((pt) => pt.y != null)}
                    color={p.energy}
                    strokeWidth={2}
                    curveType="monotoneX"
                  />
                </>
              )}
            </CartesianChart>
          </View>
        ) : (
          <EmptyChart message="Grey bars: what you ate. Amber line: what you burned. Log meals to fill this in." />
        )}
        <View className="mt-2 flex-row items-center gap-4">
          <View className="flex-row items-center gap-1.5">
            <View className="h-2.5 w-2.5 rounded-[3px] bg-[#D9D8D0] dark:bg-[#3A3A37]" />
            <Text className="text-[11px] text-ink-mut">intake</Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            <View className="h-[2px] w-4 rounded-full" style={{ backgroundColor: p.energy }} />
            <Text className="text-[11px] text-ink-mut">expenditure</Text>
          </View>
        </View>
      </ChartCard>

      {/* Micronutrients — 7-day averages */}
      <ChartCard title="Nutrition · 7-day avg">
        {microAvg && microAvg.days > 0 ? (
          <View className="gap-3">
            {TRACKED_MICROS.map((k) => {
              const meta = MICRO_META[k];
              const v = (microAvg.avgs as any)[k] as number;
              const pct = Math.min(1, v / meta.dv);
              return (
                <View key={k} className="gap-1">
                  <View className="flex-row items-baseline justify-between">
                    <Text className="text-[12.5px] font-medium text-ink-sec dark:text-ink-dsec">
                      {meta.label}
                    </Text>
                    <Text className="font-mono text-[12px] text-ink dark:text-ink-inv">
                      {v >= 100 ? Math.round(v) : v.toFixed(1)} / {meta.dv} {meta.unit}
                    </Text>
                  </View>
                  <View className="h-[5px] overflow-hidden rounded-full bg-raise dark:bg-raise-dark">
                    <View
                      className="h-full rounded-full"
                      style={{
                        width: `${pct * 100}%`,
                        backgroundColor: meta.limit ? p.inkFaint : p.fat,
                      }}
                    />
                  </View>
                </View>
              );
            })}
            <Text className="pt-1 text-[11px] leading-4 text-ink-faint">
              Muted bars are limits (less is fine); green bars are goals. Reference: adult daily values.
            </Text>
          </View>
        ) : (
          <EmptyChart message="Log a few days of food to see fiber, sodium, and more." />
        )}
      </ChartCard>
    </ScrollView>
  );
}
