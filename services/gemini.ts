const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const APIFY_API_URL =
  'https://api.apify.com/v2/acts/scrape-creators~best-tiktok-transcripts-scraper/run-sync-get-dataset-items';

const EXTRACTION_PROMPT = `Extract recipe data from the provided video transcript and return ONLY valid JSON matching the exact schema below. No explanations, no markdown formatting, no code blocks—just the raw JSON object.

Schema:
- title (string): Name of the dish
- description (string): Brief 1-2 sentence summary
- cuisine (string): e.g., "Italian", "Thai", "American"
- difficulty (string): "easy", "medium", or "hard"
- servings (integer): Number of portions
- yield (string): e.g., "12 cookies", "1 loaf", or null if same as servings
- prep_time_minutes (integer): Active preparation time
- cook_time_minutes (integer): Passive cooking time
- total_time_minutes (integer): Sum of prep and cook time
- calories (integer): Per serving, estimate if not stated
- protein_grams (number): Per serving
- carbs_grams (number): Per serving
- fat_grams (number): Per serving
- dietary_tags (array of strings): e.g., ["vegan", "gluten_free", "dairy_free", "keto", "vegetarian"]
- keywords (array of strings): e.g., ["quick", "one-pot", "meal-prep", "weeknight"]
- equipment (array of strings): e.g., ["oven", "blender", "cast iron skillet"]
- creator_name (string): Username or handle of video creator
- creator_profile_url (string): Link to creator's profile
- ingredients (array of objects):
  - raw_text (string): Original text, e.g., "2 cups all-purpose flour, sifted"
  - name (string): Ingredient name, e.g., "all-purpose flour"
  - normalized_name (string): Lowercase, snake_case, e.g., "all_purpose_flour"
  - quantity (number): Numeric amount, 0 if "to taste"
  - unit (string): e.g., "cups", "tbsp", "grams", "" if none
  - preparation (string): e.g., "sifted", "diced", "" if none
  - category (string): "produce", "dairy", "meat", "pantry", "spice", "frozen", "other"
  - optional (boolean): True for garnishes or "optional" items
  - sort_order (integer): Order as listed, starting at 0
- instructions (array of objects):
  - step_number (integer): Starting at 1
  - text (string): The instruction
  - time_seconds (integer): Duration if applicable, 0 if none
  - temperature (string): e.g., "350°F", "medium-high heat", "" if none
  - tip (string): Any tips mentioned for this step, "" if none

Use null for unknown string fields. Use 0 for unknown numeric fields. Estimate nutrition if not explicitly stated. Infer the full recipe from the transcript — the speaker may be casual or skip details, so use your best judgment to fill in quantities, times, and steps.

Transcript:
`;

export type GeminiIngredient = {
  raw_text: string;
  name: string;
  normalized_name: string;
  quantity: number;
  unit: string;
  preparation: string;
  category: string;
  optional: boolean;
  sort_order: number;
};

export type GeminiInstruction = {
  step_number: number;
  text: string;
  time_seconds: number;
  temperature: string;
  tip: string;
};

export type GeminiRecipeResponse = {
  title: string | null;
  description: string | null;
  cuisine: string | null;
  difficulty: string | null;
  servings: number;
  yield: string | null;
  prep_time_minutes: number;
  cook_time_minutes: number;
  total_time_minutes: number;
  calories: number;
  protein_grams: number;
  carbs_grams: number;
  fat_grams: number;
  dietary_tags: string[];
  keywords: string[];
  equipment: string[];
  creator_name: string | null;
  creator_profile_url: string | null;
  ingredients: GeminiIngredient[];
  instructions: GeminiInstruction[];
};

/**
 * Convert Gemini's snake_case response to camelCase for Convex.
 */
function toConvexRecipeData(raw: GeminiRecipeResponse) {
  return {
    title: raw.title ?? undefined,
    description: raw.description ?? undefined,
    cuisine: raw.cuisine ?? undefined,
    difficulty: raw.difficulty ?? undefined,
    servings: raw.servings ?? undefined,
    yield: raw.yield ?? undefined,
    prepTimeMinutes: raw.prep_time_minutes ?? undefined,
    cookTimeMinutes: raw.cook_time_minutes ?? undefined,
    totalTimeMinutes: raw.total_time_minutes ?? undefined,
    calories: raw.calories ?? undefined,
    proteinGrams: raw.protein_grams ?? undefined,
    carbsGrams: raw.carbs_grams ?? undefined,
    fatGrams: raw.fat_grams ?? undefined,
    dietaryTags: raw.dietary_tags ?? undefined,
    keywords: raw.keywords ?? undefined,
    equipment: raw.equipment ?? undefined,
    creatorName: raw.creator_name ?? undefined,
    creatorProfileUrl: raw.creator_profile_url ?? undefined,
    ingredients: raw.ingredients?.map((ing) => ({
      rawText: ing.raw_text,
      name: ing.name,
      normalizedName: ing.normalized_name,
      quantity: ing.quantity,
      unit: ing.unit,
      preparation: ing.preparation,
      category: ing.category,
      optional: ing.optional,
      sortOrder: ing.sort_order,
    })),
    instructions: raw.instructions?.map((inst) => ({
      stepNumber: inst.step_number,
      text: inst.text,
      timeSeconds: inst.time_seconds,
      temperature: inst.temperature,
      tip: inst.tip,
    })),
  };
}

/**
 * Fetch a video transcript from Apify's TikTok transcript scraper.
 */
async function fetchTranscript(url: string): Promise<string> {
  const apifyToken = process.env.EXPO_PUBLIC_APIFY_API_TOKEN?.trim();
  if (!apifyToken) {
    throw new Error('EXPO_PUBLIC_APIFY_API_TOKEN is not set');
  }

  console.log('[Apify] Fetching transcript for:', url);

  const response = await fetch(`${APIFY_API_URL}?token=${apifyToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videos: [url] }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Apify] API error:', errorText);
    throw new Error(`Apify API error (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  const transcript = result?.[0]?.transcript;

  if (!transcript) {
    console.error('[Apify] No transcript in response:', JSON.stringify(result));
    throw new Error('No transcript returned from Apify');
  }

  console.log('[Apify] Got transcript, length:', transcript.length);
  return transcript;
}

/**
 * Call Apify to get a transcript, then Gemini to extract structured recipe data.
 */
export async function extractRecipeFromUrl(url: string) {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY?.trim();
  if (!apiKey) {
    console.error('[Gemini] EXPO_PUBLIC_GEMINI_API_KEY is not set');
    throw new Error('EXPO_PUBLIC_GEMINI_API_KEY is not set');
  }

  // Step 1: Get transcript from Apify
  const transcript = await fetchTranscript(url);

  // Step 2: Send transcript to Gemini
  console.log('[Gemini] Sending transcript to Gemini for extraction...');

  const fullUrl = `${GEMINI_API_URL}?key=${apiKey}`;

  const requestBody = {
    contents: [
      {
        parts: [{ text: EXTRACTION_PROMPT + transcript }],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
    },
  };

  const response = await fetch(fullUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  console.log('[Gemini] Response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Gemini] API error response:', errorText);
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    console.error('[Gemini] No content in response. Full result:', JSON.stringify(result, null, 2));
    throw new Error('No content returned from Gemini');
  }

  console.log('[Gemini] Response text (first 500 chars):', text.slice(0, 500));

  try {
    const parsed: GeminiRecipeResponse = JSON.parse(text);
    console.log('[Gemini] Parsed recipe title:', parsed.title);
    console.log('[Gemini] Ingredients count:', parsed.ingredients?.length);
    console.log('[Gemini] Instructions count:', parsed.instructions?.length);

    const converted = toConvexRecipeData(parsed);
    console.log('[Gemini] Conversion to Convex format successful');
    return converted;
  } catch (parseError) {
    console.error('[Gemini] JSON parse error:', parseError);
    console.error('[Gemini] Raw text that failed to parse:', text);
    throw parseError;
  }
}
