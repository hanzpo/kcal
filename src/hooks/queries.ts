import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { LogEntry, Settings } from '@/db/schema';
import { addDaysStr, daysBetween, todayStr, type Meal } from '@/lib/dates';
import * as coaching from '@/services/coaching';
import * as foodApi from '@/services/foodApi';
import * as loggingSvc from '@/services/logging';
import { scheduleCloudSync } from '@/services/sync';
import * as foodsRepo from '@/repos/foods';
import * as logsRepo from '@/repos/logs';
import * as settingsRepo from '@/repos/settings';
import * as targetsRepo from '@/repos/targets';
import * as weightsRepo from '@/repos/weights';

// ---------------------------------------------------------------------------
// Settings

export function useSettings() {
  return useQuery({ queryKey: ['settings'], queryFn: settingsRepo.getSettings });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Settings>) => settingsRepo.updateSettings(patch),
    onSuccess: () => {
      qc.invalidateQueries();
      scheduleCloudSync();
    },
  });
}

// ---------------------------------------------------------------------------
// Diary

export interface DayLog {
  entries: LogEntry[];
  byMeal: Record<Meal, LogEntry[]>;
  totals: { kcal: number; proteinG: number; carbsG: number; fatG: number };
  mealTotals: Record<Meal, number>;
}

export function useDayLog(date: string) {
  return useQuery({
    queryKey: ['log', date],
    queryFn: async (): Promise<DayLog> => {
      const entries = await logsRepo.getEntriesForDate(date);
      const byMeal: DayLog['byMeal'] = { breakfast: [], lunch: [], dinner: [], snacks: [] };
      const totals = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
      const mealTotals: DayLog['mealTotals'] = { breakfast: 0, lunch: 0, dinner: 0, snacks: 0 };
      for (const e of entries) {
        byMeal[e.meal].push(e);
        totals.kcal += e.kcal;
        totals.proteinG += e.proteinG;
        totals.carbsG += e.carbsG;
        totals.fatG += e.fatG;
        mealTotals[e.meal] += e.kcal;
      }
      return { entries, byMeal, totals, mealTotals };
    },
  });
}

export function useTargetForDate(date: string) {
  return useQuery({
    queryKey: ['target', date],
    queryFn: () => targetsRepo.getTargetForDate(date).then((t) => t ?? null),
  });
}

function invalidateData(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['log'] });
  qc.invalidateQueries({ queryKey: ['coaching'] });
  qc.invalidateQueries({ queryKey: ['foods'] });
  qc.invalidateQueries({ queryKey: ['intakes'] });
  qc.invalidateQueries({ queryKey: ['loggedDates'] });
  qc.invalidateQueries({ queryKey: ['micros7'] });
  qc.invalidateQueries({ queryKey: ['adherence'] });
  scheduleCloudSync();
}

export function useLogMutations() {
  const qc = useQueryClient();
  const onSuccess = () => invalidateData(qc);
  return {
    logFood: useMutation({ mutationFn: loggingSvc.logFood, onSuccess }),
    quickAdd: useMutation({ mutationFn: loggingSvc.logQuickAdd, onSuccess }),
    logAi: useMutation({ mutationFn: loggingSvc.logAiItems, onSuccess }),
    deleteEntry: useMutation({ mutationFn: logsRepo.softDeleteEntry, onSuccess }),
    updateEntry: useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof logsRepo.updateEntry>[1] }) =>
        logsRepo.updateEntry(id, patch),
      onSuccess,
    }),
  };
}

// ---------------------------------------------------------------------------
// Weights

export function useWeights() {
  return useQuery({ queryKey: ['weights'], queryFn: weightsRepo.getAllWeights });
}

export function useWeightMutations() {
  const qc = useQueryClient();
  const onSuccess = () => {
    qc.invalidateQueries({ queryKey: ['weights'] });
    qc.invalidateQueries({ queryKey: ['coaching'] });
    scheduleCloudSync();
  };
  return {
    upsert: useMutation({
      mutationFn: ({ date, weightKg }: { date: string; weightKg: number }) =>
        weightsRepo.upsertWeight(date, weightKg),
      onSuccess,
    }),
    remove: useMutation({ mutationFn: weightsRepo.softDeleteWeight, onSuccess }),
  };
}

// ---------------------------------------------------------------------------
// Coaching: trend, expenditure, check-in

export interface CoachingState {
  trend: coaching.TrendPoint[];
  trendKg: number | null;
  scaleKg: number | null;
  expenditure: coaching.ExpenditureResult | null;
  intakes: logsRepo.DailyIntake[];
  startDate: string | null;
  /** Weekly check-in proposal, present when ≥7 days since last adjustment. */
  proposal: (coaching.MacroTargets & { currentKcal: number }) | null;
}

export function useCoaching() {
  return useQuery({
    queryKey: ['coaching'],
    queryFn: async (): Promise<CoachingState> => {
      const settings = await settingsRepo.getSettings();
      const weights = await weightsRepo.getAllWeights();
      const weighIns = weights.map((w) => ({ date: w.date, weightKg: w.weightKg }));
      const trend = coaching.computeWeightTrend(weighIns);
      const trendKg = trend.length ? trend[trend.length - 1].trendKg : null;
      const scaleKg = weights.length ? weights[weights.length - 1].weightKg : null;

      const history = await targetsRepo.getTargetHistory();
      const firstTarget = history[0];
      const startDate = firstTarget?.effectiveDate ?? weights[0]?.date ?? null;
      if (!settings.onboardingComplete || !startDate || !settings.initialTdee) {
        return { trend, trendKg, scaleKg, expenditure: null, intakes: [], startDate, proposal: null };
      }

      const today = todayStr();
      const intakes = await logsRepo.getDailyIntakes(startDate, today);
      const expenditure = coaching.computeExpenditure({
        weighIns,
        intakes: intakes.map((i) => ({ date: i.date, kcal: i.kcal, entryCount: i.entryCount })),
        seedTdee: settings.initialTdee,
        startDate,
        endDate: today,
      });

      // weekly check-in proposal
      let proposal: CoachingState['proposal'] = null;
      const active = await targetsRepo.getActiveTarget();
      const lastAdjust = settings.lastCheckinDate ?? firstTarget.effectiveDate;
      const weightKg = trendKg ?? scaleKg;
      if (
        active &&
        weightKg &&
        settings.goalRatePctPerWeek != null &&
        daysBetween(lastAdjust, today) >= 7 &&
        !expenditure.calibrating
      ) {
        const bmr = coaching.mifflinStJeorBmr({
          sex: settings.sex ?? 'male',
          age: new Date().getFullYear() - (settings.birthYear ?? 1995),
          heightCm: settings.heightCm ?? 175,
          weightKg,
        });
        const t = coaching.deriveTargets({
          tdee: expenditure.current,
          weightKg,
          goalRatePctPerWeek: settings.goalRatePctPerWeek,
          proteinGPerKg: settings.proteinGPerKg,
          bmr,
          prevKcalTarget: active.kcal,
        });
        proposal = { ...t, currentKcal: active.kcal };
      }

      return { trend, trendKg, scaleKg, expenditure, intakes, startDate, proposal };
    },
  });
}

/** Accept the weekly check-in: writes a new target row + stamps the date. */
export function useAcceptCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (t: coaching.MacroTargets) => {
      const today = todayStr();
      const exp = qc.getQueryData<CoachingState>(['coaching']);
      await targetsRepo.insertTarget({
        effectiveDate: today,
        kcal: t.kcal,
        proteinG: t.proteinG,
        carbsG: t.carbsG,
        fatG: t.fatG,
        tdeeAtSet: exp?.expenditure?.current ?? null,
        reason: 'weekly_checkin',
      });
      await settingsRepo.updateSettings({ lastCheckinDate: today });
    },
    onSuccess: () => {
      qc.invalidateQueries();
      scheduleCloudSync();
    },
  });
}

/** Daily intake history for charts (last N days). */
export function useIntakeHistory(days: number) {
  const end = todayStr();
  const start = addDaysStr(end, -(days - 1));
  return useQuery({
    queryKey: ['intakes', days],
    queryFn: () => logsRepo.getDailyIntakes(start, end),
  });
}

// ---------------------------------------------------------------------------
// Food search & catalog

export function useLocalFoodSuggestions(hour: number) {
  return useQuery({
    queryKey: ['foods', 'suggestions', hour],
    queryFn: async () => {
      const [hourly, recent, frequent, favorites] = await Promise.all([
        foodsRepo.getFoodsForHour(hour),
        foodsRepo.getRecentFoods(),
        foodsRepo.getFrequentFoods(),
        foodsRepo.getFavoriteFoods(),
      ]);
      // de-dupe, hour-matched first
      const seen = new Set<string>();
      const ordered = [...hourly, ...favorites, ...recent, ...frequent].filter((f) => {
        if (seen.has(f.id)) return false;
        seen.add(f.id);
        return true;
      });
      return { ordered, favorites };
    },
  });
}

export function useLocalFoodSearch(query: string) {
  return useQuery({
    queryKey: ['foods', 'local', query],
    queryFn: () => foodsRepo.searchLocalFoods(query),
    enabled: query.trim().length > 0,
  });
}

export function useRemoteFoodSearch(query: string, enabled: boolean) {
  return useQuery({
    queryKey: ['foods', 'remote', query],
    queryFn: () => foodApi.searchRemote(query),
    enabled: enabled && query.trim().length >= 2,
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });
}

export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: foodsRepo.toggleFavorite,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['foods'] });
      scheduleCloudSync();
    },
  });
}
