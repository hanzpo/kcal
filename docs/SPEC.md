# Kcal — Personal Macro Tracker (MacroFactor-class)

Personal-use adaptive macro tracker: MacroFactor's coaching engine + Cal AI's AI logging,
minus subscriptions, accounts, and bloat. Local-first (SQLite), architected for a later
Supabase sync layer. iOS-first via Expo dev build.

## Product pillars

1. **Logging speed is the product.** Most logs are repeats → search screen pre-populates
   with time-of-day-aware recents/frequents/favorites before a single keystroke. Target:
   2–3 taps for a repeat food, zero typing.
2. **Adaptive coaching, not static math.** TDEE ("Expenditure") continuously inferred
   from logged intake vs. smoothed weight trend (energy balance). Weekly check-in
   proposes new targets; user accepts/declines. Never punishes a bad week.
3. **AI logging that closes the loop.** Photo or text → itemized editable results card
   (steppers, delete, add, free-text "fix it" re-estimate) → one tap to log. Also reads
   nutrition-fact labels from photos (fallback when barcode misses).
4. **Interpreted data over raw data.** Dashboard shows conclusions (trend direction,
   on/off track, kcal left); full charts one tap deeper. Neutral tone — no red shaming,
   no "complete your day" nagging.

## Navigation

Bottom tabs: **Today · Log · [ + ] · Trends · Strategy** (center + is an action, not a tab).

- **Today** — hero card: calories left today (big ring, consumed⇄remaining toggle) +
  three macro bars (P/C/F) with grams left; weight card (current trend weight, 7-day
  sparkline, tap to log today's weigh-in inline); expenditure mini-card (current TDEE,
  ±trend arrow); today's log preview (last few entries, jump to Log).
- **Log** — food diary day view: date header with ‹ › + "Today" jump; four collapsible
  meal sections (Breakfast/Lunch/Dinner/Snacks) each with kcal subtotal and "+" row;
  entry rows: name, serving, kcal, macro chips; swipe to delete, tap to edit serving;
  day totals header vs. targets.
- **+ (log sheet)** — action sheet: Search · Scan barcode · AI photo · Describe (AI text)
  · Quick add. Defaults target meal by time of day.
- **Trends** — charts with range picker (2W/1M/3M/6M/All): Weight (scale dots + trend
  line, goal band); Expenditure history; Energy balance (daily intake bars vs.
  expenditure line); Macro averages (stacked weekly bars). Nutrition detail: 7-day
  micro averages vs. reference intakes (fiber, sodium, sugar, sat fat, potassium, etc.).
- **Strategy** — current program card (kcal + P/C/F targets, goal, rate); Expenditure
  card (current estimate, confidence state: calibrating <14d / ok); weekly check-in
  card when due (≥7 days since last): proposed new targets + "why" explanation,
  Accept / Not now; Edit goal (re-derives targets immediately as `reason: manual`).
- **Settings** (gear from Today/Strategy): profile (sex, birth year, height, activity),
  units (kg/lb), protein g/kg, AI (API key status, model), data (export JSON, import
  JSON, wipe), about.
- **Onboarding** (first launch): units → sex/birth year/height → current weight →
  activity level → goal (lose/maintain/gain + rate slider, live "≈ X by date" feedback)
  → computed starting targets summary → done. Seeds TDEE via Mifflin-St Jeor × activity.

## Coaching algorithm (services/coaching.ts — pure functions)

Constants: `KCAL_PER_KG=7700` (symmetric), trend EMA `α=0.10` (gap-scaled
`1−0.9^gap`, outlier clamp ±2.5% of trend), TDEE window 14d, observation blend
`α=0.20`, max step ±100 kcal/day, seed band ±40%, trust after 14 logged days
(confidence blend `w=days/14` between formula seed and adaptive estimate).
Missing intake days imputed with median of same-weekday intake (last 4 wks) else
window median; holding state if <7 valid days or <2 weigh-ins in window.

Weekly check-in: `ideal = TDEE − rate% × weightKg × 7700 / 7` (signed);
`target = prev + 0.5×(ideal − prev)`, floored at BMR. Macros: protein =
settings g/kg × weight; fat = max(0.6 g/kg, 25% kcal); carbs = remainder
(4/4/9); negative carbs → shrink fat to floor then protein toward 1.6.

## Food data

- Normalized model: everything per-100g + named servings `[{name, grams}]`.
- **Barcode** → Open Food Facts v2 (`/api/v2/product/{code}` with `fields=` and
  proper User-Agent; `status:0` = miss) → USDA FDC Branded fallback
  (`query={upc}&dataType=Branded`) → miss: offer AI label scan / custom food.
  Normalize iOS UPC-A-as-EAN13 leading zero; throttle scanner; kJ→kcal ÷4.184;
  salt g → sodium mg ×400; sanity-check (kcal_100g ≤ 900).
- **Generic search** → bundled seed DB (~100 SR Legacy-style common foods, instant,
  offline) + USDA FDC search (`dataType=SR Legacy,Foundation`; nutrients parsed from
  search response by `nutrientNumber`: 208 kcal, 203 P, 205 C, 204 F, 291 fiber,
  269 sugar, 307 Na, 306 K, 301 Ca, 303 Fe, 401 C, 328 D) + OFF search-a-licious
  for branded name search. `DEMO_KEY` default; real key field in Settings.
- Every logged food is cached into `foods` (bumping lastUsedAt/useCount) → repeat
  logging never hits the network.

## AI logging (services/ai.ts)

Claude API direct from device (personal use). Key: `EXPO_PUBLIC`-style via app config
extra (dev) overridden by Settings value in expo-secure-store. Photo (downscaled
~1024px JPEG base64) or text → structured JSON: `{items: [{name, quantity_desc,
grams, kcal, protein_g, carbs_g, fat_g, confidence}], notes}`. Results card: totals
header, itemized rows with gram steppers, delete/add, "Fix results" free-text →
re-prompt with prior JSON + correction. Log-all writes entries + caches foods
(source 'ai'). Same flow handles nutrition-label photos (prompt covers both).

## Schema / architecture

See src/db/schema.ts. UUID PKs, epoch-ms created/updated, soft deletes, no user_id
(future Supabase stamps `auth.uid()` server-side + RLS). Repos in src/repos/* are
the only DB touchpoint; TanStack Query hooks in src/hooks/*; screens never import db.
Auth seam: src/auth/ AuthProvider (local no-op, always signed in) ready for
Supabase Auth swap. MMKV for UI prefs (consumed/remaining toggle, last range, etc.).
Log entries snapshot nutrition at log time (macros as columns, micros JSON).

## Design language

Data-dense & clean. System font, tabular numerals, SF-rounded-feel hero numbers.
Dark + light (automatic). Neutral zinc surfaces; single warm accent for energy/kcal;
fixed macro colors (protein/carbs/fat) used consistently across rings, chips, charts.
Cards with generous radius, hairline borders, no shadows-heavy look. Charts: Skia
(victory-native) — dots for scale weights, smooth trend line, subtle goal band.

## Explicitly out of scope (v1)

Accounts/sync (architected-for, not built), Apple Health, widgets/watch, habit/period
tracking, training/rest-day macro splits, recipes (schema-ready via foods, UI later),
streaks/gamification, water tracking.
