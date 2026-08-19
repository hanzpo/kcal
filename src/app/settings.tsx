import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useAtom } from 'jotai';
import { useEffect, useState } from 'react';
import { Alert, Appearance, ScrollView, Text, TextInput, View } from 'react-native';

import { healthSyncAtom, themeAtom } from '@/lib/prefs';
import { healthAvailable, importWeightsFromHealth, requestWeightAccess } from '@/services/health';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, Divider, NavRow, Press, SectionLabel } from '@/components/ui';
import { db } from '@/db/client';
import { foods, logEntries, settings as settingsTable, targets, weights } from '@/db/schema';
import { seedFoodsIfNeeded } from '@/db/seed';
import { useSettings, useUpdateSettings } from '@/hooks/queries';
import { usePalette } from '@/lib/theme';
import {
  AI_MODELS,
  getAiModel,
  getStoredApiKey,
  hasAiConfigured,
  setAiModel,
  setStoredApiKey,
} from '@/services/ai';
import { exportAndShare, importFromFile } from '@/services/backup';
import { setFdcApiKey } from '@/services/foodApi';

function KeyField({
  placeholder,
  onSave,
  savedLabel,
}: {
  placeholder: string;
  onSave: (v: string) => Promise<void>;
  savedLabel: string | null;
}) {
  const p = usePalette();
  const [value, setValue] = useState('');
  const [saved, setSaved] = useState(false);
  return (
    <View className="flex-row items-center gap-2 px-4 pb-3.5">
      <View className="flex-1 rounded-xl border border-line bg-page px-3 dark:border-line-dark dark:bg-page-dark">
        <TextInput
          value={value}
          onChangeText={(v) => {
            setValue(v);
            setSaved(false);
          }}
          placeholder={savedLabel ?? placeholder}
          placeholderTextColor={savedLabel ? p.inkSec : p.inkFaint}
          autoCapitalize="none"
          autoCorrect={false}
          className="h-[40px] font-mono text-[13px] text-ink dark:text-ink-inv"
        />
      </View>
      <Press
        onPress={async () => {
          await onSave(value.trim());
          setValue('');
          setSaved(true);
        }}
        className="h-[40px] items-center justify-center rounded-xl bg-ink px-4 dark:bg-ink-inv">
        <Text className="text-[13px] font-semibold text-ink-inv dark:text-ink">
          {saved ? 'Saved ✓' : 'Save'}
        </Text>
      </Press>
    </View>
  );
}

export default function Settings() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: settings } = useSettings();
  const update = useUpdateSettings();
  const [theme, setTheme] = useAtom(themeAtom);

  const [healthSync, setHealthSync] = useAtom(healthSyncAtom);
  const [healthBusy, setHealthBusy] = useState(false);
  const [healthResult, setHealthResult] = useState<string | null>(null);

  const syncHealthNow = async () => {
    setHealthBusy(true);
    setHealthResult(null);
    try {
      const changed = await importWeightsFromHealth(365);
      setHealthResult(changed > 0 ? `${changed} weigh-ins` : 'up to date');
      if (changed > 0) qc.invalidateQueries();
    } catch (e: any) {
      setHealthResult('failed');
    } finally {
      setHealthBusy(false);
    }
  };

  const toggleHealth = async () => {
    if (healthSync) {
      setHealthSync(false);
      return;
    }
    if (!healthAvailable()) {
      Alert.alert('Not available', 'Apple Health is not available on this device.');
      return;
    }
    const ok = await requestWeightAccess();
    if (!ok) {
      Alert.alert(
        'Health access',
        'Tablet needs Health permission to read weight. You can grant it in the Health app → Sharing.',
      );
    }
    setHealthSync(true);
    syncHealthNow();
  };

  const [aiReady, setAiReady] = useState<boolean | null>(null);
  const [aiKeySaved, setAiKeySaved] = useState<string | null>(null);
  const [model, setModel] = useState<string>('claude-opus-5');
  const [fdcSaved, setFdcSaved] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setAiReady(await hasAiConfigured());
      const k = await getStoredApiKey();
      setAiKeySaved(k ? `••••${k.slice(-4)}` : null);
      setModel(await getAiModel());
      const fdc = await SecureStore.getItemAsync('fdc_api_key');
      setFdcSaved(fdc ? `••••${fdc.slice(-4)}` : null);
    })();
  }, []);

  const wipe = () => {
    Alert.alert('Erase everything?', 'All logs, weights, and foods will be permanently deleted from this phone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Erase',
        style: 'destructive',
        onPress: async () => {
          await db.delete(logEntries);
          await db.delete(weights);
          await db.delete(targets);
          await db.delete(foods);
          await db.delete(settingsTable);
          await seedFoodsIfNeeded();
          await qc.invalidateQueries();
          router.dismissAll(); // gate sends the fresh profile back through onboarding
        },
      },
    ]);
  };

  const unit = settings?.weightUnit ?? 'lb';
  const protein = settings?.proteinGPerKg ?? 1.8;

  // stored canonically as g/kg; imperial users see & step in g/lb
  const KG_PER_LB = 0.45359237;
  const displayProtein =
    unit === 'lb' ? (protein * KG_PER_LB).toFixed(2) : protein.toFixed(1);
  const stepProtein = (dir: 1 | -1) => {
    if (unit === 'lb') {
      const gPerLb = protein * KG_PER_LB + dir * 0.05;
      const clamped = Math.min(1.4, Math.max(0.55, Math.round(gPerLb * 100) / 100));
      update.mutate({ proteinGPerKg: clamped / KG_PER_LB });
    } else {
      const next = Math.min(3.0, Math.max(1.2, Math.round((protein + dir * 0.1) * 10) / 10));
      update.mutate({ proteinGPerKg: next });
    }
  };

  return (
    <View className="flex-1 bg-page pt-3.5 dark:bg-page-dark">
      <View className="items-center pb-3">
        <View className="h-[5px] w-9 rounded-full bg-line dark:bg-line-dark" />
      </View>
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled">
        <Text className="px-1 pb-4 text-[22px] font-bold text-ink dark:text-ink-inv">Settings</Text>

        <SectionLabel className="px-2 pb-1.5">Preferences</SectionLabel>
        <Card className="mb-4 overflow-hidden">
          <View className="flex-row items-center justify-between px-4 py-3.5">
            <Text className="text-[15px] font-medium text-ink dark:text-ink-inv">Appearance</Text>
            <View className="flex-row overflow-hidden rounded-full bg-raise dark:bg-raise-dark">
              {(['system', 'light', 'dark'] as const).map((t) => (
                <Press
                  key={t}
                  haptic={false}
                  onPress={() => {
                    setTheme(t);
                    Appearance.setColorScheme(t === 'system' ? 'unspecified' : t);
                  }}
                  className={`px-3.5 py-1.5 ${theme === t ? 'rounded-full bg-ink dark:bg-ink-inv' : ''}`}>
                  <Text
                    className={`text-[13px] font-semibold capitalize ${
                      theme === t ? 'text-ink-inv dark:text-ink' : 'text-ink-sec dark:text-ink-dsec'
                    }`}>
                    {t === 'system' ? 'Auto' : t}
                  </Text>
                </Press>
              ))}
            </View>
          </View>
          <Divider />
          <View className="flex-row items-center justify-between px-4 py-3.5">
            <Text className="text-[15px] font-medium text-ink dark:text-ink-inv">Weight unit</Text>
            <View className="flex-row overflow-hidden rounded-full bg-raise dark:bg-raise-dark">
              {(['lb', 'kg'] as const).map((u) => (
                <Press
                  key={u}
                  haptic={false}
                  onPress={() => update.mutate({ weightUnit: u })}
                  className={`px-4 py-1.5 ${unit === u ? 'rounded-full bg-ink dark:bg-ink-inv' : ''}`}>
                  <Text
                    className={`text-[13px] font-semibold ${
                      unit === u ? 'text-ink-inv dark:text-ink' : 'text-ink-sec dark:text-ink-dsec'
                    }`}>
                    {u}
                  </Text>
                </Press>
              ))}
            </View>
          </View>
          <Divider />
          <View className="flex-row items-center justify-between px-4 py-3.5">
            <View>
              <Text className="text-[15px] font-medium text-ink dark:text-ink-inv">Protein target</Text>
              <Text className="text-[12px] text-ink-mut">
                grams per {unit === 'lb' ? 'lb' : 'kg'} bodyweight
              </Text>
            </View>
            <View className="flex-row items-center gap-3">
              <Press
                onPress={() => stepProtein(-1)}
                className="h-8 w-8 items-center justify-center rounded-full bg-raise dark:bg-raise-dark">
                <Text className="text-[16px] text-ink dark:text-ink-inv">−</Text>
              </Press>
              <Text className="w-12 text-center font-mono text-[15px] text-ink dark:text-ink-inv">
                {displayProtein}
              </Text>
              <Press
                onPress={() => stepProtein(1)}
                className="h-8 w-8 items-center justify-center rounded-full bg-raise dark:bg-raise-dark">
                <Text className="text-[16px] text-ink dark:text-ink-inv">+</Text>
              </Press>
            </View>
          </View>
        </Card>

        <SectionLabel className="px-2 pb-1.5">AI logging</SectionLabel>
        <Card className="mb-4 overflow-hidden">
          <View className="px-4 pb-1 pt-3.5">
            <Text className="text-[15px] font-medium text-ink dark:text-ink-inv">
              Anthropic API key{' '}
              {aiReady != null && (
                <Text className={aiReady ? 'text-good' : 'text-ink-faint'}>
                  {aiReady ? '· active' : '· not set'}
                </Text>
              )}
            </Text>
            <Text className="pt-0.5 text-[12px] leading-4 text-ink-mut">
              Powers photo & describe logging. Stored only on this device.
            </Text>
          </View>
          <KeyField
            placeholder="sk-ant-…"
            savedLabel={aiKeySaved}
            onSave={async (v) => {
              await setStoredApiKey(v || null);
              setAiReady(await hasAiConfigured());
              const k = await getStoredApiKey();
              setAiKeySaved(k ? `••••${k.slice(-4)}` : null);
            }}
          />
          <Divider />
          <View className="flex-row items-center justify-between px-4 py-3.5">
            <Text className="text-[15px] font-medium text-ink dark:text-ink-inv">Model</Text>
            <View className="flex-row gap-1.5">
              {AI_MODELS.map((m) => {
                const short = m.includes('opus') ? 'Opus' : m.includes('sonnet') ? 'Sonnet' : 'Haiku';
                return (
                  <Press
                    key={m}
                    haptic={false}
                    onPress={async () => {
                      await setAiModel(m);
                      setModel(m);
                    }}
                    className={`rounded-full px-3 py-1.5 ${
                      model === m ? 'bg-ink dark:bg-ink-inv' : 'bg-raise dark:bg-raise-dark'
                    }`}>
                    <Text
                      className={`text-[12px] font-semibold ${
                        model === m ? 'text-ink-inv dark:text-ink' : 'text-ink-sec dark:text-ink-dsec'
                      }`}>
                      {short}
                    </Text>
                  </Press>
                );
              })}
            </View>
          </View>
        </Card>

        <SectionLabel className="px-2 pb-1.5">Integrations</SectionLabel>
        <Card className="mb-4 overflow-hidden">
          <View className="flex-row items-center justify-between px-4 py-3.5">
            <View className="flex-1 pr-3">
              <Text className="text-[15px] font-medium text-ink dark:text-ink-inv">Apple Health</Text>
              <Text className="pt-0.5 text-[12px] leading-4 text-ink-mut">
                Smart-scale weigh-ins (Renpho, Withings…) flow in via Health; Tablet writes manual
                entries back.
              </Text>
            </View>
            <Press
              onPress={toggleHealth}
              className={`h-[30px] w-[52px] justify-center rounded-full px-[3px] ${
                healthSync ? 'items-end bg-good dark:bg-good-dark' : 'items-start bg-raise dark:bg-raise-dark'
              }`}>
              <View className="h-6 w-6 rounded-full bg-white shadow-sm" />
            </Press>
          </View>
          {healthSync ? (
            <>
              <Divider />
              <NavRow
                icon="arrow.triangle.2.circlepath"
                title={healthBusy ? 'Syncing…' : 'Sync now'}
                detail={healthResult ?? undefined}
                onPress={healthBusy ? undefined : syncHealthNow}
              />
            </>
          ) : null}
        </Card>

        <SectionLabel className="px-2 pb-1.5">Food database</SectionLabel>
        <Card className="mb-4 overflow-hidden">
          <View className="px-4 pb-1 pt-3.5">
            <Text className="text-[15px] font-medium text-ink dark:text-ink-inv">USDA API key</Text>
            <Text className="pt-0.5 text-[12px] leading-4 text-ink-mut">
              Optional — raises search limits. Free at fdc.nal.usda.gov/api-key-signup
            </Text>
          </View>
          <KeyField
            placeholder="DEMO_KEY (default)"
            savedLabel={fdcSaved}
            onSave={async (v) => {
              if (v) await SecureStore.setItemAsync('fdc_api_key', v);
              else await SecureStore.deleteItemAsync('fdc_api_key');
              setFdcApiKey(v || null);
              setFdcSaved(v ? `••••${v.slice(-4)}` : null);
            }}
          />
        </Card>

        <SectionLabel className="px-2 pb-1.5">Data</SectionLabel>
        <Card className="mb-4 overflow-hidden">
          <NavRow icon="square.and.arrow.up" title="Export backup" onPress={() => exportAndShare()} />
          <Divider />
          <NavRow
            icon="square.and.arrow.down"
            title="Import backup"
            onPress={async () => {
              try {
                const r = await importFromFile();
                if (r.imported) {
                  qc.invalidateQueries();
                  Alert.alert('Import complete', `Merged ${r.counts}.`);
                }
              } catch (e: any) {
                Alert.alert('Import failed', e?.message ?? 'Unknown error');
              }
            }}
          />
          <Divider />
          <NavRow icon="trash" title="Erase all data" destructive onPress={wipe} />
        </Card>

        <Text className="px-2 text-[11.5px] leading-4 text-ink-faint">
          Tablet · local-first macro tracker. All data lives in SQLite on this phone; export a
          backup before switching devices.
        </Text>
      </ScrollView>
    </View>
  );
}
