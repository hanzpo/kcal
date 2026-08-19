import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GhostButton, Icon, Press, SectionLabel } from '@/components/ui';
import { mealForNow, todayStr, type Meal } from '@/lib/dates';
import { usePalette } from '@/lib/theme';
import { upsertCachedFood } from '@/repos/foods';
import { lookupBarcode } from '@/services/foodApi';

export default function BarcodeScanner() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const p = usePalette();
  const params = useLocalSearchParams<{ meal?: Meal; date?: string }>();
  const meal = params.meal ?? mealForNow();
  const date = params.date ?? todayStr();

  const [permission, requestPermission] = useCameraPermissions();
  const [status, setStatus] = useState<'scanning' | 'looking' | 'miss'>('scanning');
  const [manualCode, setManualCode] = useState('');
  const lastScan = useRef(0);
  const busy = useRef(false);

  const handleCode = async (code: string) => {
    if (busy.current) return;
    busy.current = true;
    setStatus('looking');
    try {
      const result = await lookupBarcode(code);
      if (result) {
        const food = await upsertCachedFood(result);
        router.replace({ pathname: '/food/[id]', params: { id: food.id, meal, date } });
        return;
      }
      setStatus('miss');
    } catch {
      setStatus('miss');
    } finally {
      busy.current = false;
    }
  };

  const onScanned = ({ data }: { data: string }) => {
    const now = Date.now();
    if (now - lastScan.current < 2000 || status !== 'scanning') return;
    lastScan.current = now;
    handleCode(data);
  };

  return (
    <View className="flex-1 bg-page pt-3.5 dark:bg-page-dark">
      <View className="items-center pb-3">
        <View className="h-[5px] w-9 rounded-full bg-line dark:bg-line-dark" />
      </View>
      <View className="flex-1 px-4">
        <Text className="px-1 pb-3 text-[22px] font-bold text-ink dark:text-ink-inv">Scan barcode</Text>

        <View className="h-[300px] items-center justify-center overflow-hidden rounded-card bg-ink/90">
          {permission?.granted ? (
            <>
              <CameraView
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
                onBarcodeScanned={status === 'scanning' ? onScanned : undefined}
              />
              <View className="h-[110px] w-[240px] rounded-2xl border-2 border-white/80" />
              {status === 'looking' ? (
                <View className="absolute inset-0 items-center justify-center bg-black/50">
                  <ActivityIndicator color="#fff" />
                  <Text className="mt-2 text-[13px] font-medium text-white">Looking up…</Text>
                </View>
              ) : null}
            </>
          ) : (
            <View className="items-center gap-3 px-8">
              <Icon name="camera.fill" size={26} tint="#8B8981" />
              <Text className="text-center text-[14px] text-white/80">
                Camera access is needed to scan barcodes
              </Text>
              <Press onPress={requestPermission} className="rounded-full bg-white px-5 py-2.5">
                <Text className="text-[14px] font-semibold text-ink">Allow camera</Text>
              </Press>
            </View>
          )}
        </View>

        {status === 'miss' ? (
          <View className="mt-4 gap-2.5 rounded-card border border-line bg-card p-4 dark:border-line-dark dark:bg-card-dark">
            <Text className="text-[15px] font-semibold text-ink dark:text-ink-inv">
              Not in the databases
            </Text>
            <Text className="text-[13px] leading-[18px] text-ink-mut">
              Snap a photo of the nutrition label instead and the AI will read it.
            </Text>
            <View className="mt-1 flex-row gap-2">
              <View className="flex-1">
                <GhostButton
                  label="Scan label with AI"
                  onPress={() =>
                    router.replace({ pathname: '/ai', params: { meal, date, mode: 'photo' } })
                  }
                />
              </View>
              <View className="flex-1">
                <GhostButton label="Try again" onPress={() => setStatus('scanning')} />
              </View>
            </View>
          </View>
        ) : null}

        {/* Manual entry (also the simulator path) */}
        <SectionLabel className="px-1 pb-2 pt-5">Or enter the number</SectionLabel>
        <View className="flex-row gap-2">
          <View className="flex-1 rounded-2xl border border-line bg-card px-4 dark:border-line-dark dark:bg-card-dark">
            <TextInput
              value={manualCode}
              onChangeText={setManualCode}
              placeholder="e.g. 038000138416"
              placeholderTextColor={p.inkFaint}
              keyboardType="number-pad"
              className="h-[48px] font-mono text-[16px] text-ink dark:text-ink-inv"
            />
          </View>
          <Press
            onPress={() => manualCode.length >= 8 && handleCode(manualCode)}
            className={`h-[48px] items-center justify-center rounded-2xl bg-ink px-5 dark:bg-ink-inv ${manualCode.length >= 8 ? '' : 'opacity-40'}`}>
            <Text className="text-[14px] font-semibold text-ink-inv dark:text-ink">Look up</Text>
          </Press>
        </View>
      </View>
      <View style={{ paddingBottom: Math.max(insets.bottom, 16) }} />
    </View>
  );
}
