import Anthropic from '@anthropic-ai/sdk';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

/**
 * AI food logging: photo of a meal OR a nutrition-facts label, or a plain-text
 * description, → itemized macro estimates via the Claude API. Personal-use app:
 * the key lives on-device (Settings override in SecureStore, else the dev
 * machine's ANTHROPIC_API_KEY baked in via app.config.js).
 */

const API_KEY_STORE = 'anthropic_api_key';
const MODEL_STORE = 'anthropic_model';
export const DEFAULT_AI_MODEL = 'claude-opus-5';
export const AI_MODELS = ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5'] as const;

export async function getStoredApiKey(): Promise<string | null> {
  return SecureStore.getItemAsync(API_KEY_STORE);
}

export async function setStoredApiKey(key: string | null): Promise<void> {
  if (key?.trim()) await SecureStore.setItemAsync(API_KEY_STORE, key.trim());
  else await SecureStore.deleteItemAsync(API_KEY_STORE);
}

export async function getEffectiveApiKey(): Promise<string | null> {
  const stored = await getStoredApiKey();
  if (stored) return stored;
  const baked = Constants.expoConfig?.extra?.anthropicApiKey;
  return typeof baked === 'string' && baked ? baked : null;
}

export async function getAiModel(): Promise<string> {
  return (await SecureStore.getItemAsync(MODEL_STORE)) ?? DEFAULT_AI_MODEL;
}

export async function setAiModel(model: string): Promise<void> {
  await SecureStore.setItemAsync(MODEL_STORE, model);
}

export interface AiFoodItem {
  name: string;
  /** Human-readable portion, e.g. "1 cup, cooked" */
  quantity_desc: string;
  grams: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g?: number | null;
  sugar_g?: number | null;
  sodium_mg?: number | null;
  /** 0–1 confidence in the portion + macro estimate */
  confidence: number;
}

export interface AiMealResult {
  meal_name: string;
  items: AiFoodItem[];
  notes: string | null;
}

const RESULT_SCHEMA = {
  type: 'object',
  properties: {
    meal_name: { type: 'string', description: 'Short name for the whole meal, e.g. "Chicken burrito bowl"' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          quantity_desc: { type: 'string' },
          grams: { type: 'number' },
          kcal: { type: 'number' },
          protein_g: { type: 'number' },
          carbs_g: { type: 'number' },
          fat_g: { type: 'number' },
          fiber_g: { type: ['number', 'null'] },
          sugar_g: { type: ['number', 'null'] },
          sodium_mg: { type: ['number', 'null'] },
          confidence: { type: 'number' },
        },
        required: [
          'name', 'quantity_desc', 'grams', 'kcal', 'protein_g', 'carbs_g', 'fat_g',
          'fiber_g', 'sugar_g', 'sodium_mg', 'confidence',
        ],
        additionalProperties: false,
      },
    },
    notes: { type: ['string', 'null'], description: 'Only for genuinely useful caveats, else null' },
  },
  required: ['meal_name', 'items', 'notes'],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `You are the nutrition-estimation engine inside a personal macro-tracking app. Given a photo of food, a photo of a nutrition-facts label, or a text description of a meal, return an itemized nutritional breakdown.

Rules:
- Break composite meals into their visible/likely components (e.g. burrito → tortilla, rice, beans, chicken, cheese, salsa). Include cooking fats and sauces that are almost certainly present even if not visible.
- Estimate realistic portion weights in grams from visual cues (plate size, utensils, packaging) or typical servings for described food. kcal/protein/carbs/fat are for THAT portion, not per 100 g. Keep kcal consistent with macros (4/4/9, alcohol 7).
- If the image is a nutrition-facts label: transcribe it exactly for one serving (or the stated package quantity if the user says they ate the whole thing), as a single item named after the product. Set confidence 0.95.
- Confidence reflects portion + identification certainty: plated visible food ~0.6-0.8, wrapped/mixed foods ~0.4-0.6, labels ~0.95.
- If the user supplies a correction to a previous estimate, keep everything they didn't dispute and re-estimate what they did.
- If the image contains no food or the description isn't food, return an empty items array with a note explaining why.`;

class AiError extends Error {}

async function getClient(): Promise<Anthropic> {
  const apiKey = await getEffectiveApiKey();
  if (!apiKey) {
    throw new AiError('No API key configured. Add your Anthropic API key in Settings → AI.');
  }
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true, timeout: 90_000, maxRetries: 1 });
}

type UserContent = Anthropic.MessageParam['content'];

async function runEstimate(content: UserContent): Promise<AiMealResult> {
  const client = await getClient();
  const model = await getAiModel();
  const response = await client.messages.create({
    model,
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    output_config: {
      format: { type: 'json_schema', schema: RESULT_SCHEMA },
      // low effort keeps logging latency down; extraction doesn't need deep reasoning
      ...(model.startsWith('claude-haiku') ? {} : { effort: 'low' }),
    },
    messages: [{ role: 'user', content }],
  } as Anthropic.MessageCreateParamsNonStreaming);

  if (response.stop_reason === 'refusal') {
    throw new AiError('The AI declined to analyze this input. Try describing the meal in text.');
  }
  const text = response.content.find((b) => b.type === 'text');
  if (!text || text.type !== 'text') {
    throw new AiError('The AI returned no result. Try again.');
  }
  const parsed = JSON.parse(text.text) as AiMealResult;
  parsed.items = (parsed.items ?? []).filter((i) => i.grams > 0 && i.kcal >= 0);
  return parsed;
}

export async function estimateFromText(description: string): Promise<AiMealResult> {
  return runEstimate([{ type: 'text', text: `Meal description: ${description}` }]);
}

export async function estimateFromImage(base64Jpeg: string, userNote?: string): Promise<AiMealResult> {
  return runEstimate([
    {
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: base64Jpeg },
    },
    {
      type: 'text',
      text: userNote?.trim()
        ? `Analyze this food (or nutrition label) photo. Note from user: ${userNote.trim()}`
        : 'Analyze this food (or nutrition label) photo.',
    },
  ]);
}

/** Cal AI-style "fix results": re-estimate with a free-text correction. */
export async function fixEstimate(prior: AiMealResult, correction: string): Promise<AiMealResult> {
  return runEstimate([
    {
      type: 'text',
      text: `Previous estimate:\n${JSON.stringify(prior, null, 2)}\n\nUser correction: ${correction}\n\nReturn the full corrected breakdown.`,
    },
  ]);
}

export async function hasAiConfigured(): Promise<boolean> {
  return (await getEffectiveApiKey()) != null;
}
