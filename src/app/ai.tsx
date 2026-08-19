import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, GhostButton, Icon, Press, PrimaryButton, SectionLabel } from '@/components/ui';
import { useLogMutations } from '@/hooks/queries';
import { MEAL_LABELS, mealForNow, todayStr, type Meal } from '@/lib/dates';
import { formatGrams, formatInt } from '@/lib/format';
import { usePalette } from '@/lib/theme';
import {
  estimateFromImage,
  estimateFromText,
  fixEstimate,
  type AiFoodItem,
  type AiMealResult,
} from '@/services/ai';

type Phase = 'input' | 'loading' | 'results' | 'fixing';

async function toBase64Jpeg(uri: string): Promise<string> {
  const ctx = ImageManipulator.ImageManipulator.manipulate(uri);
  ctx.resize({ width: 1024 });
  const rendered = await ctx.renderAsync();
  const saved = await rendered.saveAsync({
    format: ImageManipulator.SaveFormat.JPEG,
    compress: 0.8,
    base64: true,
  });
  return saved.base64!;
}

function scaleItem(item: AiFoodItem, factor: number): AiFoodItem {
  return {
    ...item,
    grams: item.grams * factor,
    kcal: item.kcal * factor,
    protein_g: item.protein_g * factor,
    carbs_g: item.carbs_g * factor,
    fat_g: item.fat_g * factor,
    fiber_g: item.fiber_g != null ? item.fiber_g * factor : item.fiber_g,
    sugar_g: item.sugar_g != null ? item.sugar_g * factor : item.sugar_g,
    sodium_mg: item.sodium_mg != null ? item.sodium_mg * factor : item.sodium_mg,
    quantity_desc: `${Math.round(item.grams * factor)} g`,
  };
}

export default function AiLogging() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const p = usePalette();
  const params = useLocalSearchParams<{ meal?: Meal; date?: string; mode?: 'photo' | 'text' }>();
  const meal = params.meal ?? mealForNow();
  const date = params.date ?? todayStr();
  const mode = params.mode ?? 'photo';
  const { logAi } = useLogMutations();

  const [phase, setPhase] = useState<Phase>('input');
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [result, setResult] = useState<AiMealResult | null>(null);
  const [fixText, setFixText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<AiMealResult>) => {
    setPhase('loading');
    setError(null);
    try {
      const r = await fn();
      setResult(r);
      setPhase('results');
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong.');
      setPhase('input');
    }
  };

  const pickImage = async (fromCamera: boolean) => {
    const picker = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync().then((perm) =>
          perm.granted ? ImagePicker.launchCameraAsync({ quality: 0.9 }) : null,
        )
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.9 });
    if (!picker || picker.canceled || !picker.assets?.[0]) return;
    const uri = picker.assets[0].uri;
    setImageUri(uri);
    await run(async () => estimateFromImage(await toBase64Jpeg(uri), description));
  };

  const applyFix = async () => {
    if (!result || !fixText.trim()) return;
    const correction = fixText.trim();
    setFixText('');
    setPhase('fixing');
    try {
      setResult(await fixEstimate(result, correction));
    } catch (e: any) {
      setError(e?.message ?? 'Fix failed.');
    } finally {
      setPhase('results');
    }
  };

  const logAll = async () => {
    if (!result || result.items.length === 0) return;
    await logAi.mutateAsync({
      items: result.items,
      meal,
      date,
      via: mode === 'photo' ? 'ai_photo' : 'ai_text',
    });
    router.dismissAll();
  };

  const updateItem = (index: number, next: AiFoodItem | null) => {
    if (!result) return;
    const items = [...result.items];
    if (next == null) items.splice(index, 1);
    else items[index] = next;
    setResult({ ...result, items });
  };

  const totals = (result?.items ?? []).reduce(
    (acc, i) => ({
      kcal: acc.kcal + i.kcal,
      p: acc.p + i.protein_g,
      c: acc.c + i.carbs_g,
      f: acc.f + i.fat_g,
    }),
    { kcal: 0, p: 0, c: 0, f: 0 },
  );

  return (
    <View className="flex-1 bg-page pt-3.5 dark:bg-page-dark">
      <View className="items-center pb-3">
        <View className="h-[5px] w-9 rounded-full bg-line dark:bg-line-dark" />
      </View>
      <ScrollView
        className="flex-1 px-4"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="flex-row items-center gap-2 px-1 pb-3">
          <Icon name="sparkles" size={20} tint={p.energy} />
          <Text className="text-[22px] font-bold text-ink dark:text-ink-inv">
            {mode === 'photo' ? 'AI photo log' : 'Describe your meal'}
          </Text>
        </View>

        {error ? (
          <Card className="mb-3 border-[#C24040]/30 bg-[#C24040]/5 px-4 py-3">
            <Text className="text-[13px] leading-[18px] text-[#C24040]">{error}</Text>
          </Card>
        ) : null}

        {phase === 'input' ? (
          mode === 'photo' ? (
            <View className="gap-3">
              <Text className="px-1 text-[14px] leading-5 text-ink-sec dark:text-ink-dsec">
                Snap your plate, packaging, or the nutrition-facts label. Add a note if something
                won't be visible (cooking oil, what's inside the wrap).
              </Text>
              <View className="rounded-2xl border border-line bg-card px-4 dark:border-line-dark dark:bg-card-dark">
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Optional note, e.g. 'cooked in butter'"
                  placeholderTextColor={p.inkFaint}
                  className="h-[46px] text-[15px] text-ink dark:text-ink-inv"
                />
              </View>
              <View className="flex-row gap-2.5">
                <Press
                  onPress={() => pickImage(true)}
                  className="h-[120px] flex-1 items-center justify-center gap-2 rounded-card bg-ink dark:bg-ink-inv">
                  <Icon name="camera.fill" size={24} tint={p.isDark ? '#111110' : '#FFFFFF'} />
                  <Text className="text-[14px] font-semibold text-ink-inv dark:text-ink">Camera</Text>
                </Press>
                <Press
                  onPress={() => pickImage(false)}
                  className="h-[120px] flex-1 items-center justify-center gap-2 rounded-card border border-line bg-card dark:border-line-dark dark:bg-card-dark">
                  <Icon name="photo.on.rectangle" size={24} tint={p.ink} />
                  <Text className="text-[14px] font-semibold text-ink dark:text-ink-inv">Library</Text>
                </Press>
              </View>
            </View>
          ) : (
            <View className="gap-3">
              <View className="rounded-card border border-line bg-card px-4 py-2 dark:border-line-dark dark:bg-card-dark">
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder={'e.g. "2 eggs scrambled in butter, 2 slices sourdough, oat milk latte"'}
                  placeholderTextColor={p.inkFaint}
                  multiline
                  autoFocus
                  className="min-h-[110px] text-[16px] leading-6 text-ink dark:text-ink-inv"
                  style={{ textAlignVertical: 'top' }}
                />
              </View>
              <PrimaryButton
                label="Estimate macros"
                icon="sparkles"
                onPress={() => run(() => estimateFromText(description))}
                disabled={description.trim().length < 3}
              />
            </View>
          )
        ) : null}

        {phase === 'loading' ? (
          <Card className="items-center gap-3 p-10">
            {imageUri ? (
              <Image source={{ uri: imageUri }} className="h-[140px] w-[140px] rounded-2xl" />
            ) : null}
            <ActivityIndicator color={p.energy} />
            <Text className="text-[14px] font-medium text-ink-sec dark:text-ink-dsec">
              Analyzing{mode === 'photo' ? ' photo' : ''}…
            </Text>
          </Card>
        ) : null}

        {(phase === 'results' || phase === 'fixing') && result && result.items.length === 0 ? (
          <View className="gap-3">
            <Card className="items-center gap-2 px-6 py-8">
              <Icon name="questionmark.circle" size={24} tint={p.inkFaint} />
              <Text className="text-center text-[14px] leading-5 text-ink-sec dark:text-ink-dsec">
                {result.notes ?? "Couldn't find food in that. Try a clearer photo or description."}
              </Text>
            </Card>
            <GhostButton
              label="Try again"
              onPress={() => {
                setResult(null);
                setImageUri(null);
                setPhase('input');
              }}
            />
          </View>
        ) : null}

        {(phase === 'results' || phase === 'fixing') && result && result.items.length > 0 ? (
          <View className="gap-3">
            {/* Totals header */}
            <Card className="flex-row items-center justify-between p-4">
              <View className="flex-1 pr-3">
                <Text numberOfLines={1} className="text-[16px] font-bold text-ink dark:text-ink-inv">
                  {result.meal_name || 'Estimated meal'}
                </Text>
                <View className="mt-1 flex-row gap-3">
                  <Text className="font-mono text-[12.5px] text-protein">{formatGrams(totals.p)}p</Text>
                  <Text className="font-mono text-[12.5px] text-carbs">{formatGrams(totals.c)}c</Text>
                  <Text className="font-mono text-[12.5px] text-fat">{formatGrams(totals.f)}f</Text>
                </View>
              </View>
              <View className="items-end">
                <Text className="font-monosemi text-[26px] text-ink dark:text-ink-inv">
                  {formatInt(totals.kcal)}
                </Text>
                <Text className="text-[10px] uppercase tracking-[1px] text-ink-mut">kcal</Text>
              </View>
            </Card>

            {result.notes ? (
              <Text className="px-2 text-[12.5px] leading-[17px] text-ink-mut">{result.notes}</Text>
            ) : null}

            {/* Items */}
            <Card className="overflow-hidden">
              {result.items.map((item, i) => (
                  <View
                    key={i}
                    className={`px-4 py-3 ${i > 0 ? 'border-t border-line/60 dark:border-line-dark/60' : ''}`}>
                    <View className="flex-row items-center">
                      <View className="flex-1 pr-2">
                        <Text className="text-[15px] font-medium text-ink dark:text-ink-inv">
                          {item.name}
                          {item.confidence < 0.5 ? (
                            <Text className="text-[12px] text-ink-faint">  ~uncertain</Text>
                          ) : null}
                        </Text>
                        <Text className="mt-[1px] text-[12px] text-ink-mut">
                          {item.quantity_desc} · {formatGrams(item.grams)} g ·{' '}
                          <Text className="text-protein">{formatGrams(item.protein_g)}p</Text>{' '}
                          <Text className="text-carbs">{formatGrams(item.carbs_g)}c</Text>{' '}
                          <Text className="text-fat">{formatGrams(item.fat_g)}f</Text>
                        </Text>
                      </View>
                      <Text className="w-[52px] text-right font-mono text-[14px] text-ink-sec dark:text-ink-dsec">
                        {formatInt(item.kcal)}
                      </Text>
                    </View>
                    <View className="mt-2 flex-row items-center gap-1.5">
                      {[0.75, 1.25].map((f) => (
                        <Press
                          key={f}
                          onPress={() => updateItem(i, scaleItem(item, f))}
                          className="rounded-full border border-line px-2.5 py-1 dark:border-line-dark">
                          <Text className="text-[11.5px] font-semibold text-ink-sec dark:text-ink-dsec">
                            {f < 1 ? '− less' : '+ more'}
                          </Text>
                        </Press>
                      ))}
                      <View className="flex-1" />
                      <Press onPress={() => updateItem(i, null)} className="px-1.5 py-1">
                        <Icon name="trash" size={14} tint={p.inkFaint} />
                      </Press>
                    </View>
                  </View>
                ))}
            </Card>

            {/* Fix box */}
            <View className="flex-row gap-2">
              <View className="flex-1 rounded-2xl border border-line bg-card px-4 dark:border-line-dark dark:bg-card-dark">
                <TextInput
                  value={fixText}
                  onChangeText={setFixText}
                  placeholder="Fix it: 'that's brown rice, about 2 cups'"
                  placeholderTextColor={p.inkFaint}
                  className="h-[46px] text-[14px] text-ink dark:text-ink-inv"
                  onSubmitEditing={applyFix}
                  returnKeyType="send"
                />
              </View>
              <Press
                onPress={applyFix}
                disabled={phase === 'fixing' || !fixText.trim()}
                className={`h-[46px] w-[46px] items-center justify-center rounded-2xl bg-raise dark:bg-raise-dark ${
                  fixText.trim() ? '' : 'opacity-40'
                }`}>
                {phase === 'fixing' ? (
                  <ActivityIndicator size="small" color={p.inkSec} />
                ) : (
                  <Icon name="arrow.up" size={16} tint={p.ink} weight="bold" />
                )}
              </Press>
            </View>

            <PrimaryButton
              label={`Log ${result.items.length} item${result.items.length === 1 ? '' : 's'} to ${MEAL_LABELS[meal]}`}
              onPress={logAll}
              disabled={result.items.length === 0 || logAi.isPending || phase === 'fixing'}
            />
            <GhostButton
              label="Start over"
              onPress={() => {
                setResult(null);
                setImageUri(null);
                setPhase('input');
              }}
            />
          </View>
        ) : null}
      </ScrollView>
      <View style={{ paddingBottom: insets.bottom }} />
    </View>
  );
}
