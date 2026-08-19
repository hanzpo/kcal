import { addDaysStr, daysBetween } from '@/lib/dates';
import { clamp } from '@/lib/format';

/**
 * Adaptive expenditure (TDEE) engine, MacroFactor-style:
 * energy balance over a smoothed weight trend, blended day by day from a
 * formula seed toward the observed estimate. All functions are pure —
 * inputs come from repos, nothing here touches storage.
 *
 * Method per Hacker's Diet EMA + published Pensum/MacroFactor-v3 behavior:
 * symmetric 7700 kcal/kg, 14-day observation window, imputed missing days.
 */

export const KCAL_PER_KG = 7700;
const TREND_ALPHA = 0.1; // EMA on weigh-ins; half-life ≈ 6.6 days
const OUTLIER_PCT = 0.025; // clamp weigh-ins beyond ±2.5% of trend
const TDEE_WINDOW = 14; // days per expenditure observation
const TDEE_BLEND_ALPHA = 0.2; // EMA over daily observations
const MAX_DAILY_STEP = 100; // kcal/day movement clamp
const SEED_BAND = 0.4; // keep estimate within ±40% of seed
export const MIN_DAYS_TO_TRUST = 14;
const MIN_VALID_DAYS = 7; // holding state below this
const MIN_WEIGHINS_IN_WINDOW = 2;
const TARGET_SMOOTHING = 0.5; // weekly check-in drifts halfway to ideal
export const PROTEIN_MIN_G_PER_KG = 1.6;
const FAT_MIN_G_PER_KG = 0.6;
const FAT_DEFAULT_PCT_KCAL = 0.25;

export interface WeighIn {
  date: string; // YYYY-MM-DD
  weightKg: number;
}

export interface TrendPoint {
  date: string;
  scaleKg: number | null; // actual weigh-in, if any
  trendKg: number;
}

/**
 * Smoothed weight trend: gap-aware EMA over sparse weigh-ins with outlier
 * clamping, linearly interpolated to a daily series through the last weigh-in.
 */
export function computeWeightTrend(weighIns: WeighIn[]): TrendPoint[] {
  if (weighIns.length === 0) return [];
  const sorted = [...weighIns].sort((a, b) => (a.date < b.date ? -1 : 1));

  // EMA at each weigh-in date
  const anchors: { date: string; scaleKg: number; trendKg: number }[] = [];
  let trend = sorted[0].weightKg;
  let prevDate = sorted[0].date;
  anchors.push({ date: prevDate, scaleKg: sorted[0].weightKg, trendKg: trend });
  for (let i = 1; i < sorted.length; i++) {
    const { date, weightKg } = sorted[i];
    const gap = Math.max(1, daysBetween(prevDate, date));
    const w = clamp(weightKg, trend * (1 - OUTLIER_PCT), trend * (1 + OUTLIER_PCT));
    const alphaEff = 1 - Math.pow(1 - TREND_ALPHA, gap);
    trend = trend + alphaEff * (w - trend);
    anchors.push({ date, scaleKg: weightKg, trendKg: trend });
    prevDate = date;
  }

  // daily series with linear interpolation of the trend between anchors
  const out: TrendPoint[] = [];
  for (let i = 0; i < anchors.length; i++) {
    const a = anchors[i];
    out.push({ date: a.date, scaleKg: a.scaleKg, trendKg: a.trendKg });
    const b = anchors[i + 1];
    if (!b) continue;
    const span = daysBetween(a.date, b.date);
    for (let d = 1; d < span; d++) {
      out.push({
        date: addDaysStr(a.date, d),
        scaleKg: null,
        trendKg: a.trendKg + ((b.trendKg - a.trendKg) * d) / span,
      });
    }
  }
  return out;
}

export interface IntakeDay {
  date: string;
  kcal: number;
  entryCount: number;
}

export interface ExpenditureParams {
  weighIns: WeighIn[];
  intakes: IntakeDay[]; // days with logging (absent = unlogged)
  seedTdee: number; // formula estimate from onboarding
  startDate: string; // first day of data (usually onboarding date)
  endDate: string; // usually today
}

export interface ExpenditurePoint {
  date: string;
  tdee: number;
  holding: boolean;
}

export interface ExpenditureResult {
  history: ExpenditurePoint[];
  current: number;
  /** Days of data contributing; below MIN_DAYS_TO_TRUST show "calibrating". */
  dataDays: number;
  calibrating: boolean;
}

/** Median helper; returns undefined on empty. */
function median(xs: number[]): number | undefined {
  if (xs.length === 0) return undefined;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Day-by-day adaptive expenditure. For each day: take the trailing
 * TDEE_WINDOW days, impute missing/implausibly-low intake days with the
 * median same-weekday intake (last 4 weeks) else window median, read the
 * trend-weight slope across the window, form the energy-balance observation,
 * and blend it into the running estimate with step + seed-band clamps.
 */
export function computeExpenditure(params: ExpenditureParams): ExpenditureResult {
  const { weighIns, intakes, seedTdee, startDate, endDate } = params;
  const trend = computeWeightTrend(weighIns);
  const trendByDate = new Map(trend.map((t) => [t.date, t.trendKg]));
  const intakeByDate = new Map(intakes.map((i) => [i.date, i]));
  const weighInDates = new Set(weighIns.map((w) => w.date));

  const totalDays = Math.max(0, daysBetween(startDate, endDate) + 1);
  const history: ExpenditurePoint[] = [];
  let tdee = seedTdee;
  let loggedDays = 0;

  for (let d = 0; d < totalDays; d++) {
    const date = addDaysStr(startDate, d);
    if (intakeByDate.has(date)) loggedDays++;

    const winStart = addDaysStr(date, -(TDEE_WINDOW - 1));

    // collect window intakes with imputation
    const windowIntakes: number[] = [];
    let validDays = 0;
    let weighInsInWindow = 0;
    const rawWindow: (number | undefined)[] = [];
    for (let i = 0; i < TDEE_WINDOW; i++) {
      const day = addDaysStr(winStart, i);
      if (day < startDate || day > endDate) {
        rawWindow.push(undefined);
        continue;
      }
      if (weighInDates.has(day)) weighInsInWindow++;
      const intake = intakeByDate.get(day);
      rawWindow.push(intake?.kcal);
      if (intake) validDays++;
    }
    const windowMedian = median(rawWindow.filter((x): x is number => x != null));
    const lowCutoff = windowMedian != null ? windowMedian * 0.5 : 0;
    for (let i = 0; i < TDEE_WINDOW; i++) {
      const day = addDaysStr(winStart, i);
      if (day < startDate || day > endDate) continue;
      let kcal = rawWindow[i];
      if (kcal == null || kcal < lowCutoff) {
        // same-weekday median over prior 4 weeks, else window median
        const sameWeekday: number[] = [];
        for (let w = 1; w <= 4; w++) {
          const prev = intakeByDate.get(addDaysStr(day, -7 * w));
          if (prev) sameWeekday.push(prev.kcal);
        }
        kcal = median(sameWeekday) ?? windowMedian ?? tdee;
      }
      windowIntakes.push(kcal);
    }

    const trendStart = trendByDate.get(winStart);
    const trendEnd = trendByDate.get(date);
    const holding =
      validDays < MIN_VALID_DAYS ||
      weighInsInWindow < MIN_WEIGHINS_IN_WINDOW ||
      trendStart == null ||
      trendEnd == null ||
      windowIntakes.length === 0;

    if (!holding) {
      const slopeKgPerDay = (trendEnd - trendStart) / TDEE_WINDOW;
      const meanIntake = windowIntakes.reduce((a, b) => a + b, 0) / windowIntakes.length;
      const observed = meanIntake - slopeKgPerDay * KCAL_PER_KG;
      let next = tdee + TDEE_BLEND_ALPHA * (observed - tdee);
      next = clamp(next, tdee - MAX_DAILY_STEP, tdee + MAX_DAILY_STEP);
      next = clamp(next, seedTdee * (1 - SEED_BAND), seedTdee * (1 + SEED_BAND));
      tdee = next;
    }
    history.push({ date, tdee, holding });
  }

  // early-data confidence blend toward the seed
  const dataDays = Math.min(loggedDays, totalDays);
  const w = clamp(dataDays / MIN_DAYS_TO_TRUST, 0, 1);
  const current = history.length ? w * history[history.length - 1].tdee + (1 - w) * seedTdee : seedTdee;

  return { history, current, dataDays, calibrating: dataDays < MIN_DAYS_TO_TRUST };
}

// ---------------------------------------------------------------------------
// Seed estimates & targets

export interface Profile {
  sex: 'male' | 'female';
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
}

const ACTIVITY_MULTIPLIERS: Record<Profile['activityLevel'], number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export function mifflinStJeorBmr(p: Omit<Profile, 'activityLevel'>): number {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  return p.sex === 'male' ? base + 5 : base - 161;
}

export function seedTdeeFromProfile(p: Profile): number {
  return mifflinStJeorBmr(p) * ACTIVITY_MULTIPLIERS[p.activityLevel];
}

export interface MacroTargets {
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

export interface TargetParams {
  tdee: number;
  weightKg: number;
  /** Signed %BW/week: -0.5 = lose 0.5%/wk, +0.25 = gain. */
  goalRatePctPerWeek: number;
  proteinGPerKg: number;
  bmr: number;
  /** Previous calorie target to smooth from; omit for initial program. */
  prevKcalTarget?: number;
}

/**
 * Derive calorie + macro targets. Each week is self-contained — no make-up
 * deficits — and the recommendation drifts halfway toward ideal per check-in.
 */
export function deriveTargets(p: TargetParams): MacroTargets {
  const dailyDelta = (p.goalRatePctPerWeek / 100) * p.weightKg * KCAL_PER_KG / 7;
  const ideal = p.tdee + dailyDelta;
  let kcal =
    p.prevKcalTarget != null ? p.prevKcalTarget + TARGET_SMOOTHING * (ideal - p.prevKcalTarget) : ideal;
  kcal = Math.max(kcal, p.bmr, 1200);
  kcal = Math.round(kcal / 5) * 5;

  let proteinG = p.proteinGPerKg * p.weightKg;
  let fatG = Math.max(FAT_MIN_G_PER_KG * p.weightKg, (FAT_DEFAULT_PCT_KCAL * kcal) / 9);
  let carbsG = (kcal - 4 * proteinG - 9 * fatG) / 4;
  if (carbsG < 0) {
    fatG = FAT_MIN_G_PER_KG * p.weightKg;
    carbsG = (kcal - 4 * proteinG - 9 * fatG) / 4;
  }
  if (carbsG < 0) {
    proteinG = Math.max(PROTEIN_MIN_G_PER_KG * p.weightKg, (kcal - 9 * fatG) / 4 / 2);
    carbsG = Math.max(0, (kcal - 4 * proteinG - 9 * fatG) / 4);
  }
  return {
    kcal,
    proteinG: Math.round(proteinG),
    fatG: Math.round(fatG),
    carbsG: Math.round(carbsG),
  };
}

/** Projected date of reaching a goal weight at the configured rate; null if not converging. */
export function projectGoalDate(
  currentKg: number,
  goalKg: number,
  ratePctPerWeek: number,
  fromDate: string,
): string | null {
  const delta = goalKg - currentKg;
  const weeklyKg = (ratePctPerWeek / 100) * currentKg;
  if (weeklyKg === 0 || Math.sign(delta) !== Math.sign(weeklyKg)) return null;
  const weeks = delta / weeklyKg;
  if (!isFinite(weeks) || weeks > 520) return null;
  return addDaysStr(fromDate, Math.round(weeks * 7));
}
