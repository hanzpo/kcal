/* Debug harness: run the coaching engine against the simulator DB. */
import { execSync } from 'node:child_process';

import { computeExpenditure, computeWeightTrend } from '../src/services/coaching';

const app = execSync('xcrun simctl get_app_container booted com.anonymous.tablet data')
  .toString()
  .trim();
const db = `${app}/Documents/SQLite/tablet.db`;
const q = (sql: string) =>
  execSync(`sqlite3 -json "${db}" "${sql}"`).toString().trim() || '[]';

const weights = JSON.parse(q('select date, weight_kg as weightKg from weights order by date')) as {
  date: string;
  weightKg: number;
}[];
const intakes = JSON.parse(
  q(
    "select date, sum(kcal) as kcal, count(*) as entryCount from log_entries where deleted_at is null group by date order by date",
  ),
) as { date: string; kcal: number; entryCount: number }[];
const [target] = JSON.parse(q('select effective_date as d from targets order by effective_date limit 1'));
const [settings] = JSON.parse(q('select initial_tdee as seed from settings'));

const today = new Date().toISOString().slice(0, 10);
const trend = computeWeightTrend(weights);
console.log('trend first/last:', trend[0], trend[trend.length - 1]);

const result = computeExpenditure({
  weighIns: weights,
  intakes,
  seedTdee: settings.seed,
  startDate: target.d,
  endDate: today,
});
console.log('current:', result.current, 'calibrating:', result.calibrating, 'days:', result.dataDays);
for (const h of result.history.slice(-16)) console.log(h.date, Math.round(h.tdee), h.holding ? 'HOLD' : '');
const meanIntake = intakes.slice(0, -1).reduce((a, b) => a + b.kcal, 0) / (intakes.length - 1);
console.log('mean seeded intake:', Math.round(meanIntake));
