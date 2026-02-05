'use node';

import { v } from 'convex/values';
import { action, internalMutation } from './_generated/server';
import { internal } from './_generated/api';

type GroceryItemInput = {
  itemId: string;
  name: string;
  quantity: number;
  unit: string;
};

type AmazonUrlResult = {
  itemId: string;
  url: string;
};

/**
 * Generate Amazon Fresh search URLs for grocery items using OpenAI.
 * OpenAI normalizes ingredient names for better search results.
 */
export const generateAmazonUrls = action({
  args: {
    items: v.array(
      v.object({
        itemId: v.string(),
        name: v.string(),
        quantity: v.number(),
        unit: v.string(),
      })
    ),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ success: boolean; results?: AmazonUrlResult[]; error?: string }> => {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.error('OPENAI_API_KEY is not set');
      return {
        success: false,
        error: 'OpenAI API key not configured',
      };
    }

    if (args.items.length === 0) {
      return { success: true, results: [] };
    }

    const systemPrompt = `You are a grocery shopping assistant. For each ingredient, generate an optimized search query for Amazon Fresh that will find the most relevant product.

Rules:
- Remove preparation instructions (diced, minced, chopped, sliced, etc.)
- Use common grocery store terminology
- Keep queries simple and searchable (2-4 words max)
- For produce, just use the item name (e.g., "tomatoes" not "roma tomatoes diced")
- For specific cuts of meat, include the cut (e.g., "chicken breast boneless")
- Don't include quantities or units in the search query
- Return the most generic searchable form that would find the ingredient

Return a JSON object where keys are the original item names and values are the search queries.`;

    const itemsList = args.items.map((i) => `- ${i.name}`).join('\n');
    const userPrompt = `Generate Amazon Fresh search queries for these grocery items:\n${itemsList}`;

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
          temperature: 0.3,
          max_tokens: 1000,
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

      const parsed = JSON.parse(content) as Record<string, string>;

      // Build Amazon search URLs (using grocery category for better results)
      const results: AmazonUrlResult[] = args.items.map((item) => {
        const searchQuery = parsed[item.name] ?? item.name;
        const encodedQuery = encodeURIComponent(searchQuery);
        // Use regular Amazon search - more reliable on mobile than Amazon Fresh
        const url = `https://www.amazon.com/s?k=${encodedQuery}`;

        return {
          itemId: item.itemId,
          url,
        };
      });

      return {
        success: true,
        results,
      };
    } catch (error) {
      console.error('Error generating Amazon URLs:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate URLs',
      };
    }
  },
});

/**
 * Normalize ingredient names using OpenAI for consistent aggregation.
 * This helps match "chicken breast, boneless skinless" with "chicken breast".
 */
export const normalizeIngredients = action({
  args: {
    ingredients: v.array(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ success: boolean; normalized?: Record<string, string>; error?: string }> => {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return {
        success: false,
        error: 'OpenAI API key not configured',
      };
    }

    if (args.ingredients.length === 0) {
      return { success: true, normalized: {} };
    }

    const systemPrompt = `You are a food ingredient normalization assistant. For each ingredient, return a standardized, simplified name that can be used to match the same ingredient across different recipes.

Rules:
- Remove brand names
- Remove preparation instructions (diced, minced, chopped)
- Remove descriptors like "fresh", "organic", "large", "small"
- Keep the core ingredient name
- Use lowercase
- Use singular form when possible
- Examples:
  - "2% reduced fat milk" → "milk"
  - "large organic eggs" → "egg"
  - "boneless skinless chicken breast" → "chicken breast"
  - "extra virgin olive oil" → "olive oil"
  - "fresh basil leaves, chopped" → "basil"

Return a JSON object where keys are the original names and values are the normalized names.`;

    const itemsList = args.ingredients.map((i) => `- ${i}`).join('\n');
    const userPrompt = `Normalize these ingredient names:\n${itemsList}`;

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
          temperature: 0.1,
          max_tokens: 1000,
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

      const normalized = JSON.parse(content) as Record<string, string>;

      return {
        success: true,
        normalized,
      };
    } catch (error) {
      console.error('Error normalizing ingredients:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to normalize ingredients',
      };
    }
  },
});
