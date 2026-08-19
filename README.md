# Tablet

A personal, local-first macro tracker — MacroFactor's adaptive coaching engine plus Cal AI's
AI logging, with no accounts, no subscription, and all data in SQLite on the phone.

<p>
  <img src="assets/images/icon.png" width="80" alt="icon" />
</p>

## What it does

- **Adaptive expenditure (TDEE)** — learned continuously from logged intake vs. the smoothed
  weight trend (Hacker's-Diet EMA + 14-day energy-balance window, MacroFactor-style holding /
  imputation / clamping). Formula estimates only seed the first two weeks.
- **Weekly check-in** — proposes new calorie/macro targets from your real data; accept or
  decline. Each week is self-contained; no punishment deficits.
- **Five ways to log**
  - Search: bundled offline catalog of ~85 common foods + USDA FoodData Central + Open Food
    Facts, pre-populated with time-of-day-aware recents/frequents/favorites
  - Barcode scan (EAN/UPC → Open Food Facts, USDA Branded fallback, manual entry field)
  - **AI photo** — plate, packaging, or nutrition-facts label → itemized editable estimate
  - **AI describe** — type the meal, get an itemized estimate, correct it with free text
    ("that was brown rice, about 2 cups") and re-estimate
  - Quick add (kcal + optional macros)
- **Diary** with meal sections, snapshot nutrition (editing a food never rewrites history),
  portion re-scaling, micronutrient detail per food and 7-day averages.
- **Charts** — weight (scale dots + trend line), expenditure history, energy balance,
  micro averages. Dark and light themes throughout.
- **Apple Health sync** — two-way weight bridge. Smart-scale apps (Renpho, Withings, Eufy…)
  write to Health; Tablet imports on launch/foreground and after "Sync now", and writes manual
  weigh-ins back so Health stays the single record. Enable in Settings → Integrations.
  (For Renpho: turn on Apple Health sync inside the Renpho app once.)
- **Appearance** — follows iOS automatically, with a manual Auto/Light/Dark override in Settings.
- **Copy yesterday** — empty meal sections in the diary offer yesterday's meal in one tap;
  suggestion rows re-log a food's default serving in one tap.
- **Backup** — one-tap JSON export/import (the phone-migration path).

## Running it

```sh
npm install
npx expo run:ios          # dev build on the iOS simulator (or a plugged-in iPhone)
```

- **AI logging key**: `ANTHROPIC_API_KEY` in the environment when Metro starts is baked in for
  dev; on a real device set it in **Settings → AI** (stored in the keychain). Model is
  switchable Opus/Sonnet/Haiku in Settings (Opus default; Haiku is fastest).
- **USDA key** (optional): DEMO_KEY works out of the box but is rate-limited (~30 req/hr).
  Free instant signup at https://fdc.nal.usda.gov/api-key-signup — paste in Settings.
- **On your iPhone**: plug it in and `npx expo run:ios --device`, or set up EAS
  (`eas build --profile development --platform ios`) for cable-free installs. With a free
  Apple ID the signature lasts 7 days; a paid developer account lasts a year.

## Architecture (Supabase-ready)

- `src/db/schema.ts` — Drizzle + expo-sqlite. Sync-ready by construction: client-generated
  UUID keys, `created_at`/`updated_at` epoch-ms, soft deletes (`deleted_at` tombstones), no
  `user_id` locally (Postgres would stamp `auth.uid()` server-side under RLS).
- `src/repos/*` — the only code that touches the DB. Swapping in `supabase-js` (or adding a
  sync engine underneath) touches nothing above this layer.
- `src/hooks/queries.ts` — TanStack Query over repos; screens never import the DB.
- `src/services/coaching.ts` — the pure-function TDEE/targets engine (constants documented
  inline; validated against the published MacroFactor/Pensum behavior).
- `src/services/foodApi.ts` — OFF + FDC normalized to per-100g; `ai.ts` — Claude structured
  outputs; `logging.ts` — snapshot writes; `backup.ts` — export/import.
- UI: Expo Router + NativeWind, SF Symbols, IBM Plex Mono numerals, Skia charts
  (victory-native). Design tokens in `tailwind.config.js` / `src/lib/theme.ts`.

`scripts/debug-coaching.ts` runs the coaching engine against the simulator's live DB
(`npx tsx scripts/debug-coaching.ts`) — useful when tuning the algorithm.

## Docs

- `docs/SPEC.md` — full product spec (screens, algorithm constants, API strategy).
