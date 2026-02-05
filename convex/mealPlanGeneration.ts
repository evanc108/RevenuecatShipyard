'use node';

import { v } from 'convex/values';
import { action } from './_generated/server';

/**
 * Generated recipe structure matching the store's GeneratedRecipe type
 */
type GeneratedRecipe = {
  id: string;
  title: string;
  description: string;
  cuisine?: string;
  difficulty?: string;
  servings: number;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  totalTimeMinutes?: number;
  calories?: number;
  proteinGrams?: number;
  carbsGrams?: number;
  fatGrams?: number;
  dietaryTags?: string[];
  ingredients: {
    name: string;
    quantity: number;
    unit: string;
    preparation?: string;
  }[];
  instructions: {
    stepNumber: number;
    text: string;
  }[];
};

type GeneratedMealPlan = {
  breakfast: GeneratedRecipe[];
  lunch: GeneratedRecipe[];
  dinner: GeneratedRecipe[];
  snack: GeneratedRecipe[];
};

/**
 * Generate a meal plan using OpenAI based on pantry ingredients and preferences.
 */
export const generate = action({
  args: {
    ingredients: v.array(v.string()),
    vibe: v.optional(v.string()),
    cuisine: v.optional(v.string()),
    dietaryRestrictions: v.optional(v.array(v.string())),
    ingredientDislikes: v.optional(v.array(v.string())),
    goals: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args): Promise<{ success: boolean; recipes?: GeneratedMealPlan; error?: string }> => {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.error('OPENAI_API_KEY is not set');
      return {
        success: false,
        error: 'OpenAI API key not configured. Please add OPENAI_API_KEY to Convex environment variables.',
      };
    }

    // Get user info if authenticated
    let dietaryRestrictions = args.dietaryRestrictions ?? [];
    let ingredientDislikes = args.ingredientDislikes ?? [];
    let goals = args.goals ?? [];

    // Try to get user preferences if authenticated
    try {
      const identity = await ctx.auth.getUserIdentity();
      if (identity) {
        const user = await ctx.runQuery(
          // @ts-expect-error - internal query
          'users:getByClerkId' as never,
          { clerkId: identity.subject }
        );
        if (user) {
          dietaryRestrictions = user.dietaryRestrictions ?? dietaryRestrictions;
          ingredientDislikes = user.ingredientDislikes ?? ingredientDislikes;
          goals = user.goals ?? goals;
        }
      }
    } catch (e) {
      // Continue without user preferences
      console.log('Could not fetch user preferences:', e);
    }

    const systemPrompt = `You are a helpful meal planning assistant. Generate creative, practical recipes based on the available ingredients. Each recipe should:
- Use primarily the provided pantry ingredients (can suggest 1-2 additional common items if needed)
- Be realistic and achievable for home cooking
- Include accurate nutritional estimates
- Respect any dietary restrictions or dislikes

Return recipes in the exact JSON format specified.`;

    const userPrompt = buildUserPrompt({
      ingredients: args.ingredients,
      vibe: args.vibe,
      cuisine: args.cuisine,
      dietaryRestrictions,
      ingredientDislikes,
      goals,
    });

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.8,
          max_tokens: 8000,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('OpenAI API error:', errorData);
        return {
          success: false,
          error: `OpenAI API error: ${response.status}`,
        };
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        return {
          success: false,
          error: 'No response from OpenAI',
        };
      }

      const parsed = JSON.parse(content);

      // Validate and transform the response
      const recipes = transformOpenAIResponse(parsed);

      return {
        success: true,
        recipes,
      };
    } catch (error) {
      console.error('Error generating meal plan:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate meal plan',
      };
    }
  },
});

function buildUserPrompt(args: {
  ingredients: string[];
  vibe?: string;
  cuisine?: string;
  dietaryRestrictions: string[];
  ingredientDislikes: string[];
  goals: string[];
}): string {
  let prompt = `Generate a meal plan with 3 recipe options each for breakfast, lunch, dinner, and snacks (12 recipes total).

Available pantry ingredients:
${args.ingredients.map((i) => `- ${i}`).join('\n')}`;

  if (args.dietaryRestrictions.length > 0) {
    prompt += `\n\nDietary restrictions (MUST follow):
${args.dietaryRestrictions.map((r) => `- ${r}`).join('\n')}`;
  }

  if (args.ingredientDislikes.length > 0) {
    prompt += `\n\nIngredients to AVOID:
${args.ingredientDislikes.map((i) => `- ${i}`).join('\n')}`;
  }

  if (args.goals.length > 0) {
    prompt += `\n\nNutrition goals:
${args.goals.map((g) => `- ${g}`).join('\n')}`;
  }

  if (args.vibe) {
    prompt += `\n\nDesired vibe/style: ${args.vibe}`;
  }

  if (args.cuisine) {
    prompt += `\n\nPreferred cuisine: ${args.cuisine}`;
  }

  prompt += `

Return a JSON object with this exact structure:
{
  "breakfast": [array of 3 recipes],
  "lunch": [array of 3 recipes],
  "dinner": [array of 3 recipes],
  "snack": [array of 3 recipes]
}

Each recipe should have this structure:
{
  "title": "Recipe Name",
  "description": "Brief 1-2 sentence description",
  "cuisine": "Italian/Mexican/etc or null",
  "difficulty": "Easy/Medium/Hard",
  "servings": 2,
  "prepTimeMinutes": 15,
  "cookTimeMinutes": 30,
  "totalTimeMinutes": 45,
  "calories": 450,
  "proteinGrams": 25,
  "carbsGrams": 40,
  "fatGrams": 15,
  "dietaryTags": ["vegetarian", "gluten-free"],
  "ingredients": [
    { "name": "ingredient name", "quantity": 1, "unit": "cup", "preparation": "diced" }
  ],
  "instructions": [
    { "stepNumber": 1, "text": "Step description" }
  ]
}`;

  return prompt;
}

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function transformOpenAIResponse(parsed: Record<string, unknown>): GeneratedMealPlan {
  const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
  const result: GeneratedMealPlan = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
  };

  for (const mealType of mealTypes) {
    const recipes = parsed[mealType];
    if (!Array.isArray(recipes)) continue;

    result[mealType] = recipes.slice(0, 3).map((recipe: Record<string, unknown>) => ({
      id: generateId(),
      title: String(recipe.title ?? 'Untitled Recipe'),
      description: String(recipe.description ?? ''),
      cuisine: recipe.cuisine ? String(recipe.cuisine) : undefined,
      difficulty: recipe.difficulty ? String(recipe.difficulty) : undefined,
      servings: Number(recipe.servings) || 2,
      prepTimeMinutes: recipe.prepTimeMinutes ? Number(recipe.prepTimeMinutes) : undefined,
      cookTimeMinutes: recipe.cookTimeMinutes ? Number(recipe.cookTimeMinutes) : undefined,
      totalTimeMinutes: recipe.totalTimeMinutes ? Number(recipe.totalTimeMinutes) : undefined,
      calories: recipe.calories ? Number(recipe.calories) : undefined,
      proteinGrams: recipe.proteinGrams ? Number(recipe.proteinGrams) : undefined,
      carbsGrams: recipe.carbsGrams ? Number(recipe.carbsGrams) : undefined,
      fatGrams: recipe.fatGrams ? Number(recipe.fatGrams) : undefined,
      dietaryTags: Array.isArray(recipe.dietaryTags)
        ? recipe.dietaryTags.map(String)
        : undefined,
      ingredients: Array.isArray(recipe.ingredients)
        ? recipe.ingredients.map((ing: Record<string, unknown>) => ({
            name: String(ing.name ?? ''),
            quantity: Number(ing.quantity) || 1,
            unit: String(ing.unit ?? ''),
            preparation: ing.preparation ? String(ing.preparation) : undefined,
          }))
        : [],
      instructions: Array.isArray(recipe.instructions)
        ? recipe.instructions.map((inst: Record<string, unknown>, idx: number) => ({
            stepNumber: Number(inst.stepNumber) || idx + 1,
            text: String(inst.text ?? ''),
          }))
        : [],
    }));
  }

  return result;
}
